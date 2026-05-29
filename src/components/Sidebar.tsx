import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Note } from '../types';
import './Sidebar.css';

type DragState = { type: 'note' | 'group'; id: string; overGroupId: string | null } | null;

function NoteRow({ note, activeNoteId, dragState, setDragState }: {
  note: Note; activeNoteId: string | null;
  dragState: DragState; setDragState: (d: DragState | ((d: DragState) => DragState)) => void;
}) {
  const { deleteNote, setActiveNote } = useStore();
  return (
    <div
      className={`note-row${activeNoteId === note.id ? ' active' : ''}${dragState?.id === note.id && dragState.type === 'note' ? ' dragging' : ''}`}
      onClick={() => setActiveNote(note.id)}
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

function GroupTree({ groupId, depth = 0, dragState, setDragState }: {
  groupId: string; depth?: number;
  dragState: DragState; setDragState: (d: DragState | ((d: DragState) => DragState)) => void;
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
          <button className="g-action" title="New note" onClick={() => { createNote(groupId); setOpen(true); }}>+</button>
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
          {childGroups.map(cg => <GroupTree key={cg.id} groupId={cg.id} depth={depth + 1} dragState={dragState} setDragState={setDragState} />)}
          {childNotes.map(note => <NoteRow key={note.id} note={note} activeNoteId={activeNoteId} dragState={dragState} setDragState={setDragState} />)}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { notes, groups, activeNoteId, createNote, createGroup, moveNote, moveGroup } = useStore();
  const [open, setSidebarOpen] = useState(true);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [dragState, setDragState] = useState<DragState>(null);

  const rootGroups = groups.filter(g => g.parentGroupId === null);
  const rootNotes = notes.filter(n => n.groupId === null);
  const isRootDragOver = dragState?.overGroupId === 'root';

  return (
    <>
      <button className={`hamburger${open ? ' open' : ''}`} onClick={() => setSidebarOpen(o => !o)}>
        <span /><span /><span />
      </button>
      <aside className={`sidebar${open ? '' : ' closed'}`}>
        <div className="sidebar__header"><span className="sidebar__logo">nota</span></div>
        <div className="sidebar__actions">
          <button className="action-btn note-btn" onClick={() => createNote()}>+ Note</button>
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
          {rootGroups.map(g => <GroupTree key={g.id} groupId={g.id} dragState={dragState} setDragState={setDragState as any} />)}
          {rootNotes.map(note => <NoteRow key={note.id} note={note} activeNoteId={activeNoteId} dragState={dragState} setDragState={setDragState as any} />)}
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
