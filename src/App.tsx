import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { WelcomePage } from './pages/WelcomePage';
import { GraphView } from './pages/GraphView';
import './App.css';

export default function App() {
  const { activeNoteId, setActiveNote } = useStore();
  const [path, setPath] = useState(window.location.pathname);
  const isGraph = path === '/graph';

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    setPath(nextPath);
  };

  const openNote = (noteId: string) => {
    setActiveNote(noteId);
    navigate('/');
  };

  return (
    <div className="app">
      <Sidebar currentPath={path} onNavigate={navigate} />
      <main className="app__main">
        {isGraph ? <GraphView onOpenNote={openNote} /> : activeNoteId ? <NoteEditor /> : <WelcomePage />}
      </main>
    </div>
  );
}
