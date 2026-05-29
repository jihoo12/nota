import { useEffect, useRef, useState, useCallback } from 'react';
import katex from 'katex';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-agda';
import 'katex/dist/katex.min.css';
import { useStore } from '../store/useStore';
import { createMention, MentionKind, parseMentionToken, splitMentionText } from '../utils/mentions';
import './NoteEditor.css';

interface MentionSuggestion {
  id: string;
  kind: MentionKind;
  label: string;
}

type PreviewPart =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string; language: string };

type MathPart =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean };

function splitCodeBlocks(text: string): PreviewPart[] {
  const parts: PreviewPart[] = [];
  const codeBlockPattern = /```([A-Za-z0-9_-]*)[ \t]*\n([\s\S]*?)```/g;
  let lastIndex = 0;

  for (const match of text.matchAll(codeBlockPattern)) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }

    parts.push({
      kind: 'code',
      language: match[1].trim().toLowerCase(),
      value: match[2].replace(/\n$/, ''),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

function splitMathText(text: string): MathPart[] {
  const parts: MathPart[] = [];
  let index = 0;

  while (index < text.length) {
    const displayStart = text.indexOf('$$', index);
    const inlineStart = text.indexOf('$', index);
    const start = displayStart === -1
      ? inlineStart
      : inlineStart === -1
        ? displayStart
        : Math.min(displayStart, inlineStart);

    if (start === -1) {
      parts.push({ kind: 'text', value: text.slice(index) });
      break;
    }

    if (start > index) {
      parts.push({ kind: 'text', value: text.slice(index, start) });
    }

    const isDisplay = text.startsWith('$$', start);
    const delimiter = isDisplay ? '$$' : '$';
    const contentStart = start + delimiter.length;
    const end = text.indexOf(delimiter, contentStart);

    if (end === -1) {
      parts.push({ kind: 'text', value: text.slice(start) });
      break;
    }

    const value = text.slice(contentStart, end);
    if (value.trim()) {
      parts.push({ kind: 'math', value, display: isDisplay });
    } else {
      parts.push({ kind: 'text', value: text.slice(start, end + delimiter.length) });
    }
    index = end + delimiter.length;
  }

  return parts;
}

function renderLatex(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return null;
  }
}

function normalizeLanguage(language: string) {
  const aliases: Record<string, string> = {
    js: 'javascript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    ts: 'typescript',
  };
  return aliases[language] ?? language;
}

function highlightCode(code: string, language: string) {
  const normalizedLanguage = normalizeLanguage(language);
  const grammar = Prism.languages[normalizedLanguage] ?? Prism.languages.markup;
  return Prism.highlight(code, grammar, normalizedLanguage || 'markup');
}

export function NoteEditor() {
  const { notes, groups, activeNoteId, updateNote } = useStore();
  const note = notes.find(n => n.id === activeNoteId) ?? null;

  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [mentionCursor, setMentionCursor] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  const suggestions: MentionSuggestion[] = mentionOpen
    ? [
        ...notes
          .filter(n => n.id !== activeNoteId)
          .map(n => ({ id: n.id, kind: 'note' as const, label: n.title || 'Untitled' })),
        ...groups.map(g => ({ id: g.id, kind: 'group' as const, label: g.name || 'Untitled group' })),
      ]
        .filter(item => item.label.toLowerCase().includes(mentionQuery.toLowerCase()))
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

  const insertMention = useCallback((target: MentionSuggestion) => {
    const ta = contentRef.current;
    if (!ta || !note) return;
    const val = ta.value;
    const cursor = ta.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf('@');
    const before = val.slice(0, atIdx);
    const after = val.slice(cursor);
    const mention = createMention(target.kind, target.label);
    const newVal = `${before}${mention}${after}`;
    updateNote(note.id, { content: newVal });
    setMentionOpen(false);
    setTimeout(() => {
      ta.focus();
      const pos = (before + mention).length;
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
      insertMention(suggestions[mentionCursor]);
    } else if (e.key === 'Escape') {
      setMentionOpen(false);
    }
  };

  if (!note) return null;

  // Render content with highlighted [[mentions]], KaTeX math, and Prism code blocks.
  const renderContent = (text: string) => {
    return splitMentionText(text).flatMap((part, i) => {
      const mention = parseMentionToken(part);
      if (mention) {
        return [
          <mark key={`mention-${i}`} className={`mention-chip mention-chip--${mention.kind}`}>
            {mention.kind}:{mention.label}
          </mark>,
        ];
      }

      return splitCodeBlocks(part).flatMap((codePart, j) => {
        if (codePart.kind === 'code') {
          const language = normalizeLanguage(codePart.language);

          return [
            <pre key={`code-${i}-${j}`} className="code-block">
              <code
                className={`language-${language || 'text'}`}
                dangerouslySetInnerHTML={{ __html: highlightCode(codePart.value, language) }}
              />
            </pre>,
          ];
        }

        return splitMathText(codePart.value).map((mathPart, k) => {
          if (mathPart.kind === 'text') return mathPart.value;

          const html = renderLatex(mathPart.value, mathPart.display);
          if (!html) return `${mathPart.display ? '$$' : '$'}${mathPart.value}${mathPart.display ? '$$' : '$'}`;

          return (
            <span
              key={`math-${i}-${j}-${k}`}
              className={mathPart.display ? 'math math--display' : 'math math--inline'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        });
      });
    });
  };

  return (
    <div className="editor">
      <div className="editor__topbar">
        <div className="editor__meta">
          {new Date(note.updatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <button
          className={`editor__preview-toggle${previewMode ? ' editor__preview-toggle--active' : ''}`}
          type="button"
          onClick={() => setPreviewMode(isPreview => !isPreview)}
        >
          {previewMode ? 'Edit' : 'Preview'}
        </button>
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
        {previewMode ? (
          <div className="editor__preview editor__preview--main">
            {note.content.trim() ? renderContent(note.content) : (
              <span className="editor__preview-placeholder">Nothing to preview yet.</span>
            )}
          </div>
        ) : (
          <textarea
            ref={contentRef}
            className="editor__textarea"
            value={note.content}
            onChange={handleContentChange}
            onKeyDown={handleContentKeyDown}
            placeholder={"Start writing...\n\nType @ to mention a note or group."}
            spellCheck={false}
          />
        )}

        {/* Mention dropdown */}
        {!previewMode && mentionOpen && suggestions.length > 0 && (
          <div
            className="mention-dropdown"
            style={{ top: mentionPos.top, left: mentionPos.left }}
          >
            {suggestions.map((s, i) => (
              <div
                key={`${s.kind}:${s.id}`}
                className={`mention-option ${i === mentionCursor ? 'mention-option--active' : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                  insertMention(s);
                }}
              >
                <span className={`mention-option__kind mention-option__kind--${s.kind}`}>
                  {s.kind}
                </span>
                <span className="mention-option__label">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
