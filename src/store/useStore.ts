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
  moveNote: (noteId: string, groupId: string | null) => void;

  createGroup: (name: string, parentGroupId?: string | null) => string;
  deleteGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;
  moveGroup: (groupId: string, newParentId: string | null) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useStore = create<Store>()(
  persist(
    (set) => ({
      notes: [],
      groups: [],
      activeNoteId: null,

      createNote: (groupId = null) => {
        const id = uid();
        const now = Date.now();
        set(s => ({ notes: [...s.notes, { id, title: 'Untitled', content: '', createdAt: now, updatedAt: now, groupId: groupId ?? null }], activeNoteId: id }));
        return id;
      },
      updateNote: (id, patch) => set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n) })),
      deleteNote: (id) => set(s => ({ notes: s.notes.filter(n => n.id !== id), activeNoteId: s.activeNoteId === id ? null : s.activeNoteId })),
      setActiveNote: (id) => set({ activeNoteId: id }),
      moveNote: (noteId, groupId) => set(s => ({ notes: s.notes.map(n => n.id === noteId ? { ...n, groupId } : n) })),

      createGroup: (name, parentGroupId = null) => {
        const id = uid();
        set(s => ({ groups: [...s.groups, { id, name, parentGroupId: parentGroupId ?? null, createdAt: Date.now() }] }));
        return id;
      },
      deleteGroup: (id) => set(s => {
        const toDelete = new Set<string>();
        const collect = (gid: string) => { toDelete.add(gid); s.groups.filter(g => g.parentGroupId === gid).forEach(g => collect(g.id)); };
        collect(id);
        return { groups: s.groups.filter(g => !toDelete.has(g.id)), notes: s.notes.map(n => toDelete.has(n.groupId ?? '') ? { ...n, groupId: null } : n) };
      }),
      renameGroup: (id, name) => set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, name } : g) })),
      moveGroup: (groupId, newParentId) => set(s => {
        const isDescendant = (checkId: string | null, ancestorId: string): boolean => {
          let cur = checkId;
          while (cur) { const g = s.groups.find(x => x.id === cur); if (!g) break; if (g.parentGroupId === ancestorId) return true; cur = g.parentGroupId; }
          return false;
        };
        if (groupId === newParentId || (newParentId && isDescendant(newParentId, groupId))) return s;
        return { groups: s.groups.map(g => g.id === groupId ? { ...g, parentGroupId: newParentId ?? null } : g) };
      }),
    }),
    { name: 'nota-storage' }
  )
);
