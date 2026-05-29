import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useStore } from '../store/useStore';
import { Note } from '../types';
import './Sidebar.css';

type DragState = { type: 'note' | 'group'; id: string; overGroupId: string | null } | null;
type SetDragState = Dispatch<SetStateAction<DragState>>;

function NoteRow({ note, activeNoteId, dragState, setDragState, onOpenNote }: {
  note: Note; activeNoteId: string | null;
  dragState: DragState; setDragState: SetDragState;
  onOpenNote: (noteId: string) => void;
}) {
  const { deleteNote, setActiveNote } = useStore();
  return (
    <div
      className={`note-row${activeNoteId === note.id ? ' active' : ''}${dragState?.id === note.id && dragState.type === 'note' ? ' dragging' : ''}`}
      onClick={() => { setActiveNote(note.id); onOpenNote(note.id); }}
      draggable
      onDragStart={() => setDragState({ type: 'note', id: note.id, overGroupId: null })}
      onDragEnd={() => setDragState(null)}
    >
      <svg className="note-icon" width={13} height={13} viewBox="0 0 13 13" fill="none">
        <rect x={1} y={1} width={11} height={11} rx={2} stroke="currentColor" strokeWidth={1.2}/>
        <path d="M3.5 4.5h6M3.5 6.5h6M3.5 8.5h4" stroke="currentColor" strokeWidth={1} strokeLinecap="round"/>
      </svg>
      <span className="note-title">{note.title || 'Untitled'}</span>
      <button className="note-del" onClick={e => { e.stopPropagation(); deleteNote(note.id); }}>×</button>
    </div>
  );
}

function GroupTree({ groupId, depth = 0, dragState, setDragState, onOpenNote }: {
  groupId: string; depth?: number;
  dragState: DragState; setDragState: SetDragState;
  onOpenNote: (noteId: string) => void;
}) {
  const { notes, groups, activeNoteId, createNote, createGroup, deleteGroup, renameGroup, moveNote, moveGroup } = useStore();
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [showSubGroupInput, setShowSubGroupInput] = useState(false);
  const [subGroupName, setSubGroupName] = useState('');

  const group = groups.find(g => g.id === groupId);
  if (!group) return null;
  const childGroups = groups.filter(g => g.parentGroupId === groupId);
  const childNotes = notes.filter(n => n.groupId === groupId);
  const isDragOver = dragState?.overGroupId === groupId;

  return (
    <div className="tree-group">
      <div
        className={`group-row${isDragOver ? ' drag-over' : ''}`}
        style={{ paddingLeft: 8 + depth * 4 }}
        onClick={() => setOpen(o => !o)}
        draggable
        onDragStart={e => { e.stopPropagation(); setDragState({ type: 'group', id: groupId, overGroupId: null }); }}
        onDragEnd={() => setDragState(null)}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!dragState) return; if (dragState.type === 'note') moveNote(dragState.id, groupId); if (dragState.type === 'group') moveGroup(dragState.id, groupId); setDragState(null); }}
        onDragOver={e => { e.preventDefault(); setDragState(d => d ? { ...d, overGroupId: groupId } : d); }}
        onDragLeave={() => setDragState(d => d ? { ...d, overGroupId: null } : d)}
      >
        <svg className={`group-caret${open ? ' open' : ''}`} viewBox="0 0 14 14" fill="none" width={14} height={14}>
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <svg className="group-icon" width={14} height={14} viewBox="0 0 14 14" fill="none">
          <path d="M1 4.5C1 3.67 1.67 3 2.5 3H5l1.5 1.5H11.5C12.33 4.5 13 5.17 13 6v4.5c0 .83-.67 1.5-1.5 1.5h-9C1.67 12 1 11.33 1 10.5v-6z" stroke="var(--group-color)" strokeWidth={1.1} fill={open ? 'rgba(107,158,196,0.18)' : 'none'}/>
        </svg>
        {renaming ? (
          <input className="inline-input" value={renameVal} autoFocus onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { renameGroup(groupId, renameVal); setRenaming(false); } if (e.key === 'Escape') setRenaming(false); }}
            onBlur={() => { renameGroup(groupId, renameVal); setRenaming(false); }}
            onClick={e => e.stopPropagation()} />
        ) : (
          <span className="group-name">{group.name}</span>
        )}
        <div className="group-actions" onClick={e => e.stopPropagation()}>
          <button className="g-action" title="New note" onClick={() => { const noteId = createNote(groupId); onOpenNote(noteId); setOpen(true); }}>+</button>
          <button className="g-action" title="New subgroup" onClick={() => { setShowSubGroupInput(true); setOpen(true); }}>📁</button>
          <button className="g-action" title="Rename" onClick={() => { setRenameVal(group.name); setRenaming(true); }}>✎</button>
          <button className="g-action" title="Delete" onClick={() => deleteGroup(groupId)}>×</button>
        </div>
      </div>
      {open && (
        <div className="group-children">
          {showSubGroupInput && (
            <div style={{ padding: '4px 8px' }}>
              <input className="inline-input" placeholder="Subgroup name" autoFocus value={subGroupName} onChange={e => setSubGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && subGroupName.trim()) { createGroup(subGroupName.trim(), groupId); setSubGroupName(''); setShowSubGroupInput(false); } if (e.key === 'Escape') setShowSubGroupInput(false); }}
                onBlur={() => setShowSubGroupInput(false)} />
            </div>
          )}
          {childGroups.map(cg => <GroupTree key={cg.id} groupId={cg.id} depth={depth + 1} dragState={dragState} setDragState={setDragState} onOpenNote={onOpenNote} />)}
          {childNotes.map(note => <NoteRow key={note.id} note={note} activeNoteId={activeNoteId} dragState={dragState} setDragState={setDragState} onOpenNote={onOpenNote} />)}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  const { notes, groups, activeNoteId, createNote, createGroup, moveNote, moveGroup } = useStore();
  const [open, setSidebarOpen] = useState(true);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [dragState, setDragState] = useState<DragState>(null);

  const rootGroups = groups.filter(g => g.parentGroupId === null);
  const rootNotes = notes.filter(n => n.groupId === null);
  const isRootDragOver = dragState?.overGroupId === 'root';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      const isTyping = target?.closest('input, textarea, [contenteditable="true"]');
      if (isTyping) return;

      event.preventDefault();
      setSidebarOpen(isOpen => !isOpen);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <button className={`hamburger${open ? ' open' : ''}`} onClick={() => setSidebarOpen(o => !o)}>
        <span /><span /><span />
      </button>
      <aside className={`sidebar${open ? ' sidebar--open' : ' sidebar--closed'}`}>
        <div className="sidebar__header">
          <button className="sidebar__logo-btn" onClick={() => onNavigate('/')}>nota</button>
        </div>
        <div className="sidebar__tabs" role="tablist" aria-label="Workspace views">
          <button
            className={`sidebar-tab${currentPath !== '/graph' ? ' active' : ''}`}
            role="tab"
            aria-selected={currentPath !== '/graph'}
            onClick={() => onNavigate('/')}
          >
            <svg className="sidebar-tab__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 2.5h8A1.5 1.5 0 0 1 13.5 4v8A1.5 1.5 0 0 1 12 13.5H4A1.5 1.5 0 0 1 2.5 12V4A1.5 1.5 0 0 1 4 2.5Z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5.25 6h5.5M5.25 8.25h5.5M5.25 10.5h3.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <span>Editor</span>
          </button>
          <button
            className={`sidebar-tab${currentPath === '/graph' ? ' active' : ''}`}
            role="tab"
            aria-selected={currentPath === '/graph'}
            onClick={() => {
              onNavigate('/graph');
              setSidebarOpen(false);
            }}
          >
            <svg className="sidebar-tab__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="4" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="11.5" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="9" cy="11.5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5.7 4.65 9.8 4.25M4.95 6.5 7.9 10.25M10.55 5.65 9.75 9.75" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <span>Graph</span>
          </button>
        </div>
        <div className="sidebar__actions">
          <button className="action-btn note-btn" onClick={() => { createNote(); onNavigate('/'); }}>+ Note</button>
          <button className="action-btn group-btn" onClick={() => setShowGroupInput(true)}>+ Group</button>
        </div>
        <nav className="sidebar__nav">
          {showGroupInput && (
            <div style={{ padding: '4px 8px 8px' }}>
              <input className="inline-input" placeholder="Group name" autoFocus value={groupName} onChange={e => setGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && groupName.trim()) { createGroup(groupName.trim()); setGroupName(''); setShowGroupInput(false); } if (e.key === 'Escape') setShowGroupInput(false); }}
                onBlur={() => setShowGroupInput(false)} />
            </div>
          )}
          {rootGroups.map(g => <GroupTree key={g.id} groupId={g.id} dragState={dragState} setDragState={setDragState} onOpenNote={() => onNavigate('/')} />)}
          {rootNotes.map(note => <NoteRow key={note.id} note={note} activeNoteId={activeNoteId} dragState={dragState} setDragState={setDragState} onOpenNote={() => onNavigate('/')} />)}
          {(rootGroups.length > 0 || rootNotes.length > 0) && (
            <div className={`root-drop${isRootDragOver ? ' drag-over' : ''}`}
              onDrop={e => { e.preventDefault(); if (!dragState) return; if (dragState.type === 'note') moveNote(dragState.id, null); if (dragState.type === 'group') moveGroup(dragState.id, null); setDragState(null); }}
              onDragOver={e => { e.preventDefault(); setDragState(d => d ? { ...d, overGroupId: 'root' } : d); }}
              onDragLeave={() => setDragState(d => d ? { ...d, overGroupId: null } : d)}>
              ↑ drop here to ungroup
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
