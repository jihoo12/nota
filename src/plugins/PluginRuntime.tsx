import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Note } from '../types';
import { useStore } from '../store/useStore';

interface PluginNote {
  id: string;
  title: string;
  content: string;
}

interface PluginEditorAction {
  id: string;
  pluginId: string;
  label: string;
  run: () => void;
}

interface PluginPreviewRenderer {
  id: string;
  pluginId: string;
  render: (note: PluginNote) => string | null | undefined;
}

interface EditorBridge {
  insertText: (text: string) => void;
  replaceSelection: (text: string) => void;
}

interface RuntimeContextValue {
  actions: PluginEditorAction[];
  previewRenderers: PluginPreviewRenderer[];
  statuses: string[];
  registerEditorBridge: (bridge: EditorBridge | null) => void;
}

interface PluginRegistration {
  activate?: (context: PluginContext) => void | (() => void);
}

interface PluginContext {
  editor: {
    getActiveNote: () => PluginNote | null;
    insertText: (text: string) => void;
    replaceSelection: (text: string) => void;
  };
  events: {
    onNoteChange: (listener: (note: PluginNote | null) => void) => () => void;
  };
  ui: {
    setStatus: (text: string) => void;
    registerEditorAction: (action: { id: string; label: string; run: () => void }) => () => void;
    registerPreviewRenderer: (renderer: { id: string; render: (note: PluginNote) => string | null | undefined }) => () => void;
  };
}

const PluginRuntimeContext = createContext<RuntimeContextValue | null>(null);

function toPluginNote(note: Note | null): PluginNote | null {
  if (!note) return null;
  return {
    id: note.id,
    title: note.title,
    content: note.content,
  };
}

function getActivePluginNote() {
  const { notes, activeNoteId } = useStore.getState();
  return toPluginNote(notes.find(note => note.id === activeNoteId) ?? null);
}

function sourceUrlFor(pluginId: string) {
  return `nota-plugin-${pluginId.replace(/[^A-Za-z0-9_-]/g, '-')}.js`;
}

export function PluginRuntimeProvider({ children }: { children: ReactNode }) {
  const { plugins, enabledPluginIds, setPluginRuntimeErrors } = useStore();
  const activeNoteId = useStore(state => state.activeNoteId);
  const activeNote = useStore(state => state.notes.find(note => note.id === activeNoteId) ?? null);
  const editorBridgeRef = useRef<EditorBridge | null>(null);
  const noteListenersRef = useRef(new Map<string, Set<(note: PluginNote | null) => void>>());
  const disposersRef = useRef<Array<() => void>>([]);
  const [actions, setActions] = useState<PluginEditorAction[]>([]);
  const [previewRenderers, setPreviewRenderers] = useState<PluginPreviewRenderer[]>([]);
  const [statusesByPlugin, setStatusesByPlugin] = useState<Record<string, string>>({});

  const registerEditorBridge = useCallback((bridge: EditorBridge | null) => {
    editorBridgeRef.current = bridge;
  }, []);

  useEffect(() => {
    const note = toPluginNote(activeNote);
    noteListenersRef.current.forEach(listeners => {
      listeners.forEach(listener => listener(note));
    });
  }, [activeNote?.id, activeNote?.title, activeNote?.content, activeNote?.updatedAt]);

  useEffect(() => {
    disposersRef.current.forEach(dispose => dispose());
    disposersRef.current = [];
    noteListenersRef.current.clear();
    setActions([]);
    setPreviewRenderers([]);
    setStatusesByPlugin({});

    const enabledPlugins = plugins.filter(plugin => enabledPluginIds.includes(plugin.id));
    const runtimeErrors: Array<{ folderName: string; message: string }> = [];

    enabledPlugins.forEach(plugin => {
      const pluginListeners = new Set<(note: PluginNote | null) => void>();
      noteListenersRef.current.set(plugin.id, pluginListeners);

      const removeAction = (actionId: string) => {
        setActions(current => current.filter(action => !(action.pluginId === plugin.id && action.id === actionId)));
      };
      const removePreviewRenderer = (rendererId: string) => {
        setPreviewRenderers(current => current.filter(renderer => !(renderer.pluginId === plugin.id && renderer.id === rendererId)));
      };

      const context: PluginContext = {
        editor: {
          getActiveNote: getActivePluginNote,
          insertText: (text) => editorBridgeRef.current?.insertText(text),
          replaceSelection: (text) => editorBridgeRef.current?.replaceSelection(text),
        },
        events: {
          onNoteChange: (listener) => {
            pluginListeners.add(listener);
            listener(getActivePluginNote());
            return () => pluginListeners.delete(listener);
          },
        },
        ui: {
          setStatus: (text) => {
            setStatusesByPlugin(current => ({ ...current, [plugin.id]: text }));
          },
          registerEditorAction: (action) => {
            if (!action?.id || !action?.label || typeof action.run !== 'function') {
              return () => {};
            }

            removeAction(action.id);
            setActions(current => [...current, {
              id: action.id,
              pluginId: plugin.id,
              label: action.label,
              run: action.run,
            }]);

            return () => removeAction(action.id);
          },
          registerPreviewRenderer: (renderer) => {
            if (!renderer?.id || typeof renderer.render !== 'function') {
              return () => {};
            }

            removePreviewRenderer(renderer.id);
            setPreviewRenderers(current => [...current, {
              id: renderer.id,
              pluginId: plugin.id,
              render: renderer.render,
            }]);

            return () => removePreviewRenderer(renderer.id);
          },
        },
      };

      try {
        const registrationRef: { current: PluginRegistration | null } = { current: null };
        const notaPlugin = {
          register(nextRegistration: PluginRegistration) {
            registrationRef.current = nextRegistration;
          },
        };

        const runPlugin = new Function('notaPlugin', `${plugin.source}\n//# sourceURL=${sourceUrlFor(plugin.id)}`);
        runPlugin(notaPlugin);

        const registration = registrationRef.current;
        if (!registration || typeof registration.activate !== 'function') {
          throw new Error('Plugin did not register an activate function.');
        }

        const maybeDispose = registration.activate(context);
        if (typeof maybeDispose === 'function') {
          disposersRef.current.push(maybeDispose);
        }
      } catch (error) {
        noteListenersRef.current.delete(plugin.id);
        runtimeErrors.push({
          folderName: plugin.name || plugin.id,
          message: error instanceof Error ? error.message : 'Plugin failed to activate.',
        });
      }
    });

    setPluginRuntimeErrors(runtimeErrors);

    return () => {
      disposersRef.current.forEach(dispose => dispose());
      disposersRef.current = [];
      noteListenersRef.current.clear();
      setActions([]);
      setPreviewRenderers([]);
      setStatusesByPlugin({});
    };
  }, [enabledPluginIds, plugins, setPluginRuntimeErrors]);

  const statuses = useMemo(
    () => Object.values(statusesByPlugin).map(status => status.trim()).filter(Boolean),
    [statusesByPlugin]
  );

  const value = useMemo(() => ({
    actions,
    previewRenderers,
    statuses,
    registerEditorBridge,
  }), [actions, previewRenderers, registerEditorBridge, statuses]);

  return (
    <PluginRuntimeContext.Provider value={value}>
      {children}
    </PluginRuntimeContext.Provider>
  );
}

export function usePluginRuntime() {
  const context = useContext(PluginRuntimeContext);
  if (!context) {
    throw new Error('usePluginRuntime must be used within PluginRuntimeProvider.');
  }

  return context;
}
