# Nota
Nota is a local-first note app for writing connected notes, organizing them into nested groups, and visualizing relationships in a graph view.

## Features

- Create, edit, delete, and organize notes.
- Create nested groups and drag notes or groups between them.
- Mention notes and groups from the editor with `@`.
- Preview notes with rendered LaTeX using KaTeX.
- Preview fenced code blocks with Prism.js syntax highlighting.
- Explore notes and groups in a graph view.
- Zoom and pan the graph canvas.
- Open a directory as a group, with Markdown files imported as notes and subdirectories imported as groups.
- Save the opened group back to Markdown files and group directories with Ctrl/Cmd + S.
- Load trusted local editor plugins from a plugin folder.
- Toggle the sidebar with the hamburger button or `Tab`.

## Preview Syntax

Inline math:

```text
$E = mc^2$
```

Display math:

```text
$$
\int_0^1 x^2 dx
$$
```

Code blocks:

````text
```ts
const message = "hello";
console.log(message);
```
````

Supported code language aliases include `js`, `ts`, `tsx`, `python`/`py`, `bash`/`sh`, `css`, `json`,`rust`,`c`,`haskell`,`agda` and `markdown`.

## Graph View

The graph view represents:

- notes as smaller circles
- groups as larger circles
- nested groups as smaller circles inside parent group circles
- notes inside their group when they belong to a group without explicitly mentioning it
- mention relationships as arrowed links

Controls:

- Use `+`, `-`, and `Reset` to control zoom.
- Use Ctrl/Command + wheel to zoom.
- Hold the middle mouse button and drag to pan.
- Click a note node to open it.

## Plugins

Nota supports trusted local JavaScript plugins for editor actions and status text.
Open the Plugins activity in the sidebar, choose a folder containing plugin subfolders, then enable the plugins you want.

This repository includes sample plugins in `plugins/`:

- `word-count` shows word and character counts for the active note.
- `templates` adds Daily and Meeting template actions to the editor.

Each plugin subfolder needs a `plugin.json` file:

```json
{
  "id": "word-count",
  "name": "Word Count",
  "version": "1.0.0",
  "description": "Shows word and character counts for the active note.",
  "main": "index.js"
}
```

The `main` file registers an activation function:

```js
notaPlugin.register({
  activate(ctx) {
    const disposeStyle = ctx.ui.addStyle(`
      .template-preview {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px;
      }
    `);

    const dispose = ctx.events.onNoteChange((note) => {
      ctx.ui.setStatus(note ? `${note.content.split(/\s+/).filter(Boolean).length} words` : '');
    });

    ctx.ui.registerEditorAction({
      id: 'insert-template',
      label: 'Template',
      run: () => ctx.editor.insertText('# New Note\n\n'),
    });

    ctx.ui.registerPreviewRenderer({
      id: 'template-preview',
      render: (note) => note.content.startsWith('# New Note')
        ? '<article class="template-preview"><h2>New Note</h2></article>'
        : null,
    });

    return () => {
      disposeStyle();
      dispose();
    };
  },
});
```

Preview renderers return an HTML string for notes they handle, or `null` to let Nota use the built-in preview. Because local plugins are trusted, plugin preview HTML and plugin-added CSS are rendered directly in the preview pane.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the desktop app in development mode:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run the production build in Electron:

```bash
npm run build
npm start
```

Preview the production build:

```bash
npm run preview
```

## Nix Shell

This repository includes `shell.nix` with Node.js and npm. If you use Nix, enter the shell first:

```bash
nix-shell
```

The shell also provides Electron through Nix and points the npm Electron wrapper at that binary. Then run the normal npm commands.

## Tech Stack

- React
- TypeScript
- Vite
- Electron
- Zustand
- KaTeX
- Prism.js

## Data Storage

Notes, groups, and UI state are persisted in browser local storage under the Zustand storage key `nota-storage`. In the desktop app, an opened directory is treated as a group, subdirectories are treated as subgroups, and Ctrl/Cmd + S writes note content back as Markdown as-is.
