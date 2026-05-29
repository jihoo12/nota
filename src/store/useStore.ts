import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Note, Group } from '../types';

interface Store {
  notes: Note[];
  groups: Group[];
  activeNoteId: string | null;

  createNote: (groupId?: string | null) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content'>>) => void;
  deleteNote: (id: string) => void;
  setActiveNote: (id: string | null) => void;

  createGroup: (name: string, parentGroupId?: string | null) => string;
  deleteGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;

  moveNoteToGroup: (noteId: string, groupId: string | null) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      notes: [],
      groups: [],
      activeNoteId: null,

      createNote: (groupId = null) => {
        const id = uid();
        const now = Date.now();
        set(s => ({
          notes: [
            ...s.notes,
            { id, title: 'Untitled', content: '', createdAt: now, updatedAt: now, groupId: groupId ?? null },
          ],
          activeNoteId: id,
        }));
        return id;
      },

      updateNote: (id, patch) =>
        set(s => ({
          notes: s.notes.map(n =>
            n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n
          ),
        })),

      deleteNote: (id) =>
        set(s => ({
          notes: s.notes.filter(n => n.id !== id),
          activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
        })),

      setActiveNote: (id) => set({ activeNoteId: id }),

      createGroup: (name, parentGroupId = null) => {
        const id = uid();
        set(s => ({
          groups: [...s.groups, { id, name, parentGroupId: parentGroupId ?? null, createdAt: Date.now() }],
        }));
        return id;
      },

      deleteGroup: (id) =>
        set(s => ({
          groups: s.groups.filter(g => g.id !== id),
          notes: s.notes.map(n => n.groupId === id ? { ...n, groupId: null } : n),
        })),

      renameGroup: (id, name) =>
        set(s => ({
          groups: s.groups.map(g => g.id === id ? { ...g, name } : g),
        })),

      moveNoteToGroup: (noteId, groupId) =>
        set(s => ({
          notes: s.notes.map(n => n.id === noteId ? { ...n, groupId } : n),
        })),
    }),
    { name: 'nota-storage' }
  )
);
