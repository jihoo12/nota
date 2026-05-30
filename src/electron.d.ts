export {};

declare global {
  interface MarkdownDirectoryNote {
    title: string;
    content: string;
    fileName: string;
    createdAt: number;
    updatedAt: number;
  }

  interface MarkdownDirectoryGroup {
    name: string;
    folderName: string;
    notes: MarkdownDirectoryNote[];
    groups: MarkdownDirectoryGroup[];
  }

  interface Window {
    nota?: {
      platform: string;
      openMarkdownDirectory: () => Promise<{
        canceled: boolean;
        folderPath?: string;
        group?: MarkdownDirectoryGroup;
      }>;
      saveMarkdownDirectory: (group: {
        folderPath: string;
        rootGroupId: string;
        groups: Array<{
          id: string;
          name: string;
          folderName?: string;
          parentGroupId: string | null;
        }>;
        notes: Array<{
          id: string;
          title: string;
          content: string;
          fileName?: string;
          groupId: string | null;
        }>;
      }) => Promise<{
        canceled: boolean;
        folderPath?: string;
        savedNotes?: Array<{ id: string; fileName: string }>;
        savedGroups?: Array<{ id: string; folderName: string }>;
      }>;
      openPluginDirectory: () => Promise<{
        canceled: boolean;
        folderPath?: string;
      }>;
      loadPlugins: (folderPath: string) => Promise<{
        plugins: Array<{
          id: string;
          name: string;
          version: string;
          description: string;
          source: string;
        }>;
        errors: Array<{
          folderName: string;
          message: string;
        }>;
      }>;
    };
  }
}
