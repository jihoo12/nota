import { Group, Note } from '../types';

export type MentionKind = 'note' | 'group';

export interface ParsedMention {
  kind: MentionKind;
  label: string;
}

const mentionPattern = /\[\[(note|group):([^\]]+)\]\]/g;

export function createMention(kind: MentionKind, label: string) {
  return `[[${kind}:${label.trim()}]]`;
}

export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  for (const match of content.matchAll(mentionPattern)) {
    mentions.push({ kind: match[1] as MentionKind, label: match[2].trim() });
  }
  return mentions;
}

export function findMentionTarget(
  mention: ParsedMention,
  notes: Note[],
  groups: Group[],
) {
  if (mention.kind === 'note') {
    return notes.find(note => note.title.trim() === mention.label) ?? null;
  }

  return groups.find(group => group.name.trim() === mention.label) ?? null;
}

export function splitMentionText(text: string) {
  return text.split(/(\[\[(?:note|group):[^\]]+\]\])/g);
}

export function parseMentionToken(token: string): ParsedMention | null {
  const match = token.match(/^\[\[(note|group):([^\]]+)\]\]$/);
  if (!match) return null;
  return { kind: match[1] as MentionKind, label: match[2].trim() };
}
