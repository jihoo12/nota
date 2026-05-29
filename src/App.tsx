import { useStore } from './store/useStore';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { WelcomePage } from './pages/WelcomePage';
import './App.css';

export default function App() {
  const { activeNoteId } = useStore();

  return (
    <div className="app">
      <Sidebar />
      <main className="app__main">
        {activeNoteId ? <NoteEditor /> : <WelcomePage />}
      </main>
    </div>
  );
}
