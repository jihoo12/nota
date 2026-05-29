const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

function sanitizeFilename(value) {
  const filename = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return filename || 'Untitled';
}

function isMarkdownFile(fileName) {
  return fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown');
}

function titleFromFilename(fileName) {
  return fileName.replace(/\.(md|markdown)$/i, '') || 'Untitled';
}

function parseMarkdownNote(fileName, content) {
  return {
    title: titleFromFilename(fileName),
    content,
    fileName,
  };
}

function toMarkdown(note) {
  return typeof note?.content === 'string' ? note.content : '';
}

async function uniqueFileName(folderPath, preferredFileName, usedFileNames) {
  const extension = path.extname(preferredFileName) || '.md';
  const baseName = sanitizeFilename(path.basename(preferredFileName, extension));
  let fileName = `${baseName}${extension}`;
  let counter = 2;

  while (usedFileNames.has(fileName.toLowerCase())) {
    fileName = `${baseName} ${counter}${extension}`;
    counter += 1;
  }

  while (true) {
    try {
      await fs.access(path.join(folderPath, fileName));
      fileName = `${baseName} ${counter}${extension}`;
      counter += 1;
    } catch {
      usedFileNames.add(fileName.toLowerCase());
      return fileName;
    }
  }
}

async function readMarkdownGroup(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const fileEntries = entries
    .filter(entry => entry.isFile() && isMarkdownFile(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const directoryEntries = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const notes = await Promise.all(fileEntries.map(async (entry) => {
    const filePath = path.join(folderPath, entry.name);
    const [content, stat] = await Promise.all([
      fs.readFile(filePath, 'utf8'),
      fs.stat(filePath),
    ]);

    return {
      ...parseMarkdownNote(entry.name, content),
      createdAt: stat.birthtimeMs,
      updatedAt: stat.mtimeMs,
    };
  }));

  const groups = await Promise.all(directoryEntries.map(entry => (
    readMarkdownGroup(path.join(folderPath, entry.name))
  )));

  return {
    name: path.basename(folderPath) || folderPath,
    folderName: path.basename(folderPath) || folderPath,
    notes,
    groups,
  };
}

async function uniqueDirectoryName(parentFolderPath, preferredName, usedFolderNames) {
  const baseName = sanitizeFilename(preferredName);
  let folderName = baseName;
  let counter = 2;

  while (usedFolderNames.has(folderName.toLowerCase())) {
    folderName = `${baseName} ${counter}`;
    counter += 1;
  }

  while (true) {
    try {
      await fs.access(path.join(parentFolderPath, folderName));
      folderName = `${baseName} ${counter}`;
      counter += 1;
    } catch {
      usedFolderNames.add(folderName.toLowerCase());
      return folderName;
    }
  }
}

async function pruneMarkdownGroupFolder(folderPath, notes, childGroups) {
  let entries;

  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch {
    return;
  }

  const keptFileNames = new Set(
    notes
      .map(note => typeof note.fileName === 'string' && note.fileName.trim() ? path.basename(note.fileName).toLowerCase() : null)
      .filter(Boolean)
  );
  const keptFolderNames = new Set(
    childGroups
      .map(group => typeof group.folderName === 'string' && group.folderName.trim() ? path.basename(group.folderName).toLowerCase() : null)
      .filter(Boolean)
  );

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(folderPath, entry.name);
    const lowerName = entry.name.toLowerCase();

    if (entry.isFile() && isMarkdownFile(entry.name) && !keptFileNames.has(lowerName)) {
      await fs.unlink(entryPath);
      return;
    }

    if (entry.isDirectory() && !entry.name.startsWith('.') && !keptFolderNames.has(lowerName)) {
      await fs.rm(entryPath, { recursive: true, force: true });
    }
  }));
}

async function saveMarkdownGroup(folderPath, group, groupByParentId, notesByGroupId, savedNotes, savedGroups) {
  await fs.mkdir(folderPath, { recursive: true });

  const usedFileNames = new Set();
  const notes = notesByGroupId.get(group.id) ?? [];
  const childGroups = groupByParentId.get(group.id) ?? [];

  await pruneMarkdownGroupFolder(folderPath, notes, childGroups);

  for (const note of notes) {
    const id = typeof note?.id === 'string' ? note.id : null;
    if (!id) continue;

    const existingFileName = typeof note.fileName === 'string' && note.fileName.trim()
      ? path.basename(note.fileName)
      : null;
    let fileName = existingFileName;

    if (fileName && usedFileNames.has(fileName.toLowerCase())) {
      fileName = null;
    }

    if (!fileName) {
      fileName = await uniqueFileName(folderPath, `${sanitizeFilename(note.title || 'Untitled')}.md`, usedFileNames);
    } else {
      usedFileNames.add(fileName.toLowerCase());
    }

    await fs.writeFile(path.join(folderPath, fileName), toMarkdown(note), 'utf8');
    savedNotes.push({ id, fileName });
  }

  const usedFolderNames = new Set();

  for (const childGroup of childGroups) {
    const existingFolderName = typeof childGroup.folderName === 'string' && childGroup.folderName.trim()
      ? path.basename(childGroup.folderName)
      : null;
    let folderName = existingFolderName;

    if (folderName && usedFolderNames.has(folderName.toLowerCase())) {
      folderName = null;
    }

    if (!folderName) {
      folderName = await uniqueDirectoryName(folderPath, childGroup.name || 'Untitled', usedFolderNames);
    } else {
      usedFolderNames.add(folderName.toLowerCase());
    }

    savedGroups.push({ id: childGroup.id, folderName });
    await saveMarkdownGroup(path.join(folderPath, folderName), childGroup, groupByParentId, notesByGroupId, savedNotes, savedGroups);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#0f0f11',
    title: 'nota',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('group:openMarkdownDirectory', async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(browserWindow, {
      title: 'Open group',
      properties: ['openDirectory'],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const folderPath = result.filePaths[0];
    const group = await readMarkdownGroup(folderPath);

    return {
      canceled: false,
      folderPath,
      group,
    };
  });

  ipcMain.handle('group:saveMarkdownDirectory', async (_event, payload) => {
    const folderPath = typeof payload?.folderPath === 'string' ? payload.folderPath : null;
    const rootGroupId = typeof payload?.rootGroupId === 'string' ? payload.rootGroupId : null;
    const groups = Array.isArray(payload?.groups) ? payload.groups : [];
    const notes = Array.isArray(payload?.notes) ? payload.notes : [];

    if (!folderPath || !rootGroupId) {
      return { canceled: true };
    }

    const rootGroup = groups.find(group => group.id === rootGroupId);
    if (!rootGroup) {
      return { canceled: true };
    }

    const groupByParentId = new Map();
    const notesByGroupId = new Map();
    const savedNotes = [];
    const savedGroups = [];

    for (const group of groups) {
      const parentId = group.parentGroupId ?? null;
      groupByParentId.set(parentId, [...(groupByParentId.get(parentId) ?? []), group]);
    }

    for (const note of notes) {
      const groupId = note.groupId ?? null;
      notesByGroupId.set(groupId, [...(notesByGroupId.get(groupId) ?? []), note]);
    }

    await saveMarkdownGroup(folderPath, rootGroup, groupByParentId, notesByGroupId, savedNotes, savedGroups);

    return { canceled: false, folderPath, savedNotes, savedGroups };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
