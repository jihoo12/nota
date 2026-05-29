import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Note } from '../types';
import './NoteEditor.css';

interface MentionSuggestion {
  id: string;
  title: string;
}

export function NoteEditor() {
  const { notes, activeNoteId, updateNote } = useStore();
  const note = notes.find(n => n.id === activeNoteId) ?? null;

  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [mentionCursor, setMentionCursor] = useState(0);

  const suggestions: MentionSuggestion[] = mentionOpen
    ? notes
        .filter(n => n.id !== activeNoteId && n.title.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 6)
    : [];

  // Focus title on new note
  useEffect(() => {
    if (note && !note.title || note?.title === 'Untitled') {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [activeNoteId]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    updateNote(note!.id, { content: val });

    // Detect @mention trigger
    const cursor = e.target.selectionStart ?? 0;
    const textBeforeCursor = val.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@([\w ]*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionOpen(true);
      setMentionCursor(0);
      // Position popup near cursor (approximate)
      const lines = textBeforeCursor.split('\n');
      const lineNum = lines.length;
      const lineLen = lines[lines.length - 1].length;
      setMentionPos({ top: lineNum * 22 + 20, left: Math.min(lineLen * 7.5, 300) });
    } else {
      setMentionOpen(false);
    }
  }, [note, updateNote]);

  const insertMention = useCallback((target: Note) => {
    const ta = contentRef.current;
    if (!ta || !note) return;
    const val = ta.value;
    const cursor = ta.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf('@');
    const before = val.slice(0, atIdx);
    const after = val.slice(cursor);
    const newVal = `${before}[[${target.title}]]${after}`;
    updateNote(note.id, { content: newVal });
    setMentionOpen(false);
    setTimeout(() => {
      ta.focus();
      const pos = (before + `[[${target.title}]]`).length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [note, updateNote]);

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionCursor(c => (c + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionCursor(c => (c - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const target = notes.find(n => n.id === suggestions[mentionCursor].id);
      if (target) insertMention(target);
    } else if (e.key === 'Escape') {
      setMentionOpen(false);
    }
  };

  if (!note) return null;

  // Render content with highlighted [[mentions]]
  const renderContent = (text: string) => {
    return text.split(/(\[\[.*?\]\])/g).map((part, i) => {
      if (/^\[\[.*\]\]$/.test(part)) {
        return <mark key={i} className="mention-chip">{part.slice(2, -2)}</mark>;
      }
      return part;
    });
  };

  return (
    <div className="editor">
      <div className="editor__meta">
        {new Date(note.updatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      <input
        ref={titleRef}
        className="editor__title"
        value={note.title}
        onChange={e => updateNote(note.id, { title: e.target.value })}
        placeholder="Untitled"
        spellCheck={false}
      />

      <div className="editor__body">
        <textarea
          ref={contentRef}
          className="editor__textarea"
          value={note.content}
          onChange={handleContentChange}
          onKeyDown={handleContentKeyDown}
          placeholder={"Start writing...\n\nType @ to mention another note."}
          spellCheck={false}
        />

        {/* Mention dropdown */}
        {mentionOpen && suggestions.length > 0 && (
          <div
            className="mention-dropdown"
            style={{ top: mentionPos.top, left: mentionPos.left }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                className={`mention-option ${i === mentionCursor ? 'mention-option--active' : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                  const target = notes.find(n => n.id === s.id);
                  if (target) insertMention(target);
                }}
              >
                <span className="mention-option__at">[[</span>
                {s.title}
                <span className="mention-option__at">]]</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
