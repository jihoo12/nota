import { useState } from 'react';
import { useStore } from '../store/useStore';
import './Sidebar.css';

export function Sidebar() {
  const { notes, createNote, deleteNote, setActiveNote, activeNoteId } = useStore();
  const [open, setOpen] = useState(true);

  return (
    <>
      <button className="hamburger" onClick={() => setOpen(o => !o)} title="Toggle sidebar">
        <span /><span /><span />
      </button>

      <aside className={`sidebar ${open ? 'sidebar--open' : 'sidebar--closed'}`}>
        <div className="sidebar__header">
          <span className="sidebar__logo">nota</span>
        </div>

        <div className="sidebar__section">
          <button
            className="sidebar__new-btn"
            onClick={() => createNote()}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New Note
          </button>
        </div>

        <nav className="sidebar__nav">
          {notes.length === 0 && (
            <p className="sidebar__empty">No notes yet</p>
          )}
          {notes.map(note => (
            <div
              key={note.id}
              className={`sidebar__item ${activeNoteId === note.id ? 'sidebar__item--active' : ''}`}
              onClick={() => setActiveNote(note.id)}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="sidebar__item-icon">
                <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3.5 4.5h6M3.5 6.5h6M3.5 8.5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span className="sidebar__item-title">{note.title || 'Untitled'}</span>
              <button
                className="sidebar__item-del"
                onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                title="Delete"
              >×</button>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
