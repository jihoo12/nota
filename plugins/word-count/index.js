notaPlugin.register({
  activate(ctx) {
    return ctx.events.onNoteChange((note) => {
      if (!note) {
        ctx.ui.setStatus('');
        return;
      }

      const words = note.content.trim().split(/\s+/).filter(Boolean).length;
      const chars = note.content.length;
      ctx.ui.setStatus(`${words} words / ${chars} chars`);
    });
  },
});
