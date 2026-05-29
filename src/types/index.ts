export interface Note {
  id: string;
  title: string;
  content: string;
  fileName?: string;
  createdAt: number;
  updatedAt: number;
  groupId: string | null;
}

export interface Group {
  id: string;
  name: string;
  folderName?: string;
  sourceFolderPath?: string;
  parentGroupId: string | null;
  createdAt: number;
}

export type SidebarItem =
  | { kind: 'note'; note: Note }
  | { kind: 'group'; group: Group };
