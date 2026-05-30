import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Note, Group, LoadedPlugin, PluginLoadError } from '../types';

export interface MarkdownNoteImport {
  title: string;
  content: string;
  fileName: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface MarkdownGroupImport {
  name: string;
  folderName: string;
  notes: MarkdownNoteImport[];
  groups: MarkdownGroupImport[];
}

interface Store {
  notes: Note[];
  groups: Group[];
  activeNoteId: string | null;
  openedGroupId: string | null;
  openedFolderPath: string | null;
  pluginFolderPath: string | null;
  plugins: LoadedPlugin[];
  enabledPluginIds: string[];
  pluginErrors: PluginLoadError[];
  pluginRuntimeErrors: PluginLoadError[];

  createNote: (groupId?: string | null) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content'>>) => void;
  deleteNote: (id: string) => void;
  setActiveNote: (id: string | null) => void;
  moveNote: (noteId: string, groupId: string | null) => void;
  setNoteFileNames: (fileNames: Array<{ id: string; fileName: string }>) => void;
  setGroupFolderNames: (folderNames: Array<{ id: string; folderName: string }>) => void;

  createGroup: (name: string, parentGroupId?: string | null) => string;
  deleteGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;
  moveGroup: (groupId: string, newParentId: string | null) => void;

  openMarkdownGroup: (folderPath: string, importedGroup: MarkdownGroupImport) => void;
  closeMarkdownGroup: () => void;

  setPluginFolderPath: (folderPath: string | null) => void;
  setPluginLoadResult: (plugins: LoadedPlugin[], errors: PluginLoadError[]) => void;
  setPluginRuntimeErrors: (errors: PluginLoadError[]) => void;
  togglePlugin: (pluginId: string) => void;
}

const uid = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
};

function collectGroupIds(groups: Group[], rootId: string) {
  const ids = new Set<string>();
  const collect = (groupId: string) => {
    ids.add(groupId);
    groups.filter(group => group.parentGroupId === groupId).forEach(group => collect(group.id));
  };

  collect(rootId);
  return ids;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      notes: [],
      groups: [],
      activeNoteId: null,
      openedGroupId: null,
      openedFolderPath: null,
      pluginFolderPath: null,
      plugins: [],
      enabledPluginIds: [],
      pluginErrors: [],
      pluginRuntimeErrors: [],

      createNote: (groupId = null) => {
        const id = uid();
        const now = Date.now();
        set(s => ({ notes: [...s.notes, { id, title: 'Untitled', content: '', createdAt: now, updatedAt: now, groupId: groupId ?? null }], activeNoteId: id }));
        return id;
      },
      updateNote: (id, patch) => set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n) })),
      deleteNote: (id) => set(s => ({ notes: s.notes.filter(n => n.id !== id), activeNoteId: s.activeNoteId === id ? null : s.activeNoteId })),
      setActiveNote: (id) => set({ activeNoteId: id }),
      moveNote: (noteId, groupId) => set(s => ({ notes: s.notes.map(n => n.id === noteId ? { ...n, groupId } : n) })),
      setNoteFileNames: (fileNames) => set(s => {
        const fileNameById = new Map(fileNames.map(item => [item.id, item.fileName]));
        return {
          notes: s.notes.map(note => fileNameById.has(note.id)
            ? { ...note, fileName: fileNameById.get(note.id) }
            : note),
        };
      }),
      setGroupFolderNames: (folderNames) => set(s => {
        const folderNameById = new Map(folderNames.map(item => [item.id, item.folderName]));
        return {
          groups: s.groups.map(group => folderNameById.has(group.id)
            ? { ...group, folderName: folderNameById.get(group.id) }
            : group),
        };
      }),

      createGroup: (name, parentGroupId = null) => {
        const id = uid();
        set(s => ({ groups: [...s.groups, { id, name, parentGroupId: parentGroupId ?? null, createdAt: Date.now() }] }));
        return id;
      },
      deleteGroup: (id) => set(s => {
        const toDelete = new Set<string>();
        const collect = (gid: string) => { toDelete.add(gid); s.groups.filter(g => g.parentGroupId === gid).forEach(g => collect(g.id)); };
        collect(id);
        return { groups: s.groups.filter(g => !toDelete.has(g.id)), notes: s.notes.map(n => toDelete.has(n.groupId ?? '') ? { ...n, groupId: null } : n) };
      }),
      renameGroup: (id, name) => set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, name } : g) })),
      moveGroup: (groupId, newParentId) => set(s => {
        const isDescendant = (checkId: string | null, ancestorId: string): boolean => {
          let cur = checkId;
          while (cur) { const g = s.groups.find(x => x.id === cur); if (!g) break; if (g.parentGroupId === ancestorId) return true; cur = g.parentGroupId; }
          return false;
        };
        if (groupId === newParentId || (newParentId && isDescendant(newParentId, groupId))) return s;
        return { groups: s.groups.map(g => g.id === groupId ? { ...g, parentGroupId: newParentId ?? null } : g) };
      }),

      openMarkdownGroup: (folderPath, importedGroup) => set(s => {
        const openedGroupIds = s.openedGroupId ? collectGroupIds(s.groups, s.openedGroupId) : new Set<string>();
        const now = Date.now();
        const importedGroups: Group[] = [];
        const importedNotes: Note[] = [];

        const importGroup = (group: MarkdownGroupImport, parentGroupId: string | null) => {
          const groupId = uid();
          importedGroups.push({
            id: groupId,
            name: group.name,
            folderName: group.folderName,
            sourceFolderPath: parentGroupId === null ? folderPath : undefined,
            parentGroupId,
            createdAt: now,
          });
          group.notes.forEach(importedNote => {
            importedNotes.push({
              id: uid(),
              title: importedNote.title || 'Untitled',
              content: importedNote.content,
              fileName: importedNote.fileName,
              createdAt: importedNote.createdAt ?? now,
              updatedAt: importedNote.updatedAt ?? now,
              groupId,
            });
          });
          group.groups.forEach(childGroup => importGroup(childGroup, groupId));
          return groupId;
        };

        const groupId = importGroup(importedGroup, null);

        return {
          groups: [
            ...s.groups.filter(group => !openedGroupIds.has(group.id)),
            ...importedGroups,
          ],
          notes: [
            ...s.notes.filter(note => !openedGroupIds.has(note.groupId ?? '')),
            ...importedNotes,
          ],
          activeNoteId: importedNotes[0]?.id ?? null,
          openedGroupId: groupId,
          openedFolderPath: folderPath,
        };
      }),

      closeMarkdownGroup: () => set(s => {
        if (!s.openedGroupId) return s;

        const openedGroupIds = collectGroupIds(s.groups, s.openedGroupId);
        const activeNoteIsOpen = s.activeNoteId
          ? s.notes.some(note => note.id === s.activeNoteId && openedGroupIds.has(note.groupId ?? ''))
          : false;

        return {
          groups: s.groups.filter(group => !openedGroupIds.has(group.id)),
          notes: s.notes.filter(note => !openedGroupIds.has(note.groupId ?? '')),
          activeNoteId: activeNoteIsOpen ? null : s.activeNoteId,
          openedGroupId: null,
          openedFolderPath: null,
        };
      }),

      setPluginFolderPath: (folderPath) => set({ pluginFolderPath: folderPath }),
      setPluginLoadResult: (plugins, errors) => set(s => {
        const pluginIds = new Set(plugins.map(plugin => plugin.id));

        return {
          plugins,
          pluginErrors: errors,
          pluginRuntimeErrors: [],
          enabledPluginIds: s.enabledPluginIds.filter(pluginId => pluginIds.has(pluginId)),
        };
      }),
      setPluginRuntimeErrors: (pluginRuntimeErrors) => set({ pluginRuntimeErrors }),
      togglePlugin: (pluginId) => set(s => ({
        enabledPluginIds: s.enabledPluginIds.includes(pluginId)
          ? s.enabledPluginIds.filter(id => id !== pluginId)
          : [...s.enabledPluginIds, pluginId],
      })),
    }),
    { name: 'nota-storage' }
  )
);
