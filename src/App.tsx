import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { WelcomePage } from './pages/WelcomePage';
import { GraphView } from './pages/GraphView';
import { PluginRuntimeProvider } from './plugins/PluginRuntime';
import './App.css';

const isFileProtocol = window.location.protocol === 'file:';

function getCurrentPath() {
  if (isFileProtocol) {
    return window.location.hash.replace(/^#/, '') || '/';
  }

  return window.location.pathname;
}

export default function App() {
  const {
    notes,
    groups,
    activeNoteId,
    openedGroupId,
    openedFolderPath,
    pluginFolderPath,
    setActiveNote,
    setGroupFolderNames,
    setNoteFileNames,
    setPluginLoadResult,
  } = useStore();
  const [path, setPath] = useState(getCurrentPath);
  const isGraph = path === '/graph';
  const hasActiveNote = activeNoteId ? notes.some(note => note.id === activeNoteId) : false;

  useEffect(() => {
    const handleLocationChange = () => setPath(getCurrentPath());
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (activeNoteId && !hasActiveNote) {
      setActiveNote(null);
    }
  }, [activeNoteId, hasActiveNote, setActiveNote]);

  useEffect(() => {
    if (!pluginFolderPath || !window.nota?.loadPlugins) return;

    let canceled = false;

    window.nota.loadPlugins(pluginFolderPath)
      .then(result => {
        if (!canceled) {
          setPluginLoadResult(result.plugins, result.errors);
        }
      })
      .catch(() => {
        if (!canceled) {
          setPluginLoadResult([], [{ folderName: 'Plugins', message: 'Failed to refresh plugin folder.' }]);
        }
      });

    return () => {
      canceled = true;
    };
  }, [pluginFolderPath, setPluginLoadResult]);

  useEffect(() => {
    const getGroupIds = (rootGroupId: string) => {
      const groupIds = new Set<string>();
      const collect = (groupId: string) => {
        groupIds.add(groupId);
        groups.filter(group => group.parentGroupId === groupId).forEach(group => collect(group.id));
      };

      collect(rootGroupId);
      return groupIds;
    };

    const handleSave = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey) || event.altKey) return;

      event.preventDefault();

      if (!window.nota?.saveMarkdownDirectory || !openedGroupId || !openedFolderPath) return;

      const groupIds = getGroupIds(openedGroupId);
      const result = await window.nota.saveMarkdownDirectory({
        folderPath: openedFolderPath,
        rootGroupId: openedGroupId,
        groups: groups
          .filter(group => groupIds.has(group.id))
          .map(group => ({
            id: group.id,
            name: group.name,
            folderName: group.folderName,
            parentGroupId: group.parentGroupId,
          })),
        notes: notes
          .filter(note => groupIds.has(note.groupId ?? ''))
          .map(note => ({
            id: note.id,
            title: note.title,
            content: note.content,
            fileName: note.fileName,
            groupId: note.groupId,
          })),
      });

      if (!result.canceled && result.savedNotes) {
        setNoteFileNames(result.savedNotes);
      }

      if (!result.canceled && result.savedGroups) {
        setGroupFolderNames(result.savedGroups);
      }
    };

    window.addEventListener('keydown', handleSave);
    return () => window.removeEventListener('keydown', handleSave);
  }, [groups, notes, openedFolderPath, openedGroupId, setGroupFolderNames, setNoteFileNames]);

  const navigate = (nextPath: string) => {
    if (isFileProtocol) {
      if (getCurrentPath() !== nextPath) {
        window.location.hash = nextPath;
      }
    } else if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }

    setPath(nextPath);
  };

  const openNote = (noteId: string) => {
    setActiveNote(noteId);
    navigate('/');
  };

  return (
    <PluginRuntimeProvider>
      <div className="app">
        <Sidebar currentPath={path} onNavigate={navigate} />
        <main className="app__main">
          {isGraph ? <GraphView onOpenNote={openNote} /> : hasActiveNote ? <NoteEditor /> : <WelcomePage />}
        </main>
      </div>
    </PluginRuntimeProvider>
  );
}
