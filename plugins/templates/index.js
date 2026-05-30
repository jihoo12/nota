notaPlugin.register({
  activate(ctx) {
    const escapeHtml = (value) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const parseSections = (content) => {
      const sections = [];
      const sectionPattern = /^#{2,3}\s+(.+)$/gm;
      const matches = Array.from(content.matchAll(sectionPattern));

      matches.forEach((match, index) => {
        const start = match.index + match[0].length;
        const end = matches[index + 1]?.index ?? content.length;
        const body = content.slice(start, end);
        const items = body
          .split('\n')
          .map(line => line.replace(/^\s*-\s?/, '').trim())
          .filter(Boolean);

        sections.push({
          title: match[1].trim(),
          items,
        });
      });

      return sections;
    };

    const renderSections = (sections) => sections.map(section => {
      const items = section.items.length
        ? `<ol class="template-preview__list">${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
        : '<span class="template-preview__empty">Nothing captured yet.</span>';

      return `
        <section class="template-preview__section">
          <h3 class="template-preview__section-title">${escapeHtml(section.title)}</h3>
          ${items}
        </section>
      `;
    }).join('');

    const disposePreview = ctx.ui.registerPreviewRenderer({
      id: 'template-preview',
      render: (note) => {
        const trimmed = note.content.trim();
        const isDaily = /^#\s+.+\n+##\s+Focus/m.test(trimmed) && /^##\s+Notes/m.test(trimmed);
        const isMeeting = /^##\s+Meeting/m.test(trimmed) && /^###\s+Attendees/m.test(trimmed);

        if (!isDaily && !isMeeting) return null;

        const titleMatch = trimmed.match(/^#\s+(.+)$/m) || trimmed.match(/^##\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : note.title || 'Untitled';
        const sections = parseSections(trimmed).filter(section => section.title !== title);

        return `
          <article class="template-preview template-preview--${isDaily ? 'daily' : 'meeting'}">
            <header class="template-preview__header">
              <span class="template-preview__eyebrow">${isDaily ? 'Daily note' : 'Meeting note'}</span>
              <h2 class="template-preview__title">${escapeHtml(title)}</h2>
            </header>
            <div class="template-preview__grid">
              ${renderSections(sections)}
            </div>
          </article>
        `;
      },
    });

    const disposeDaily = ctx.ui.registerEditorAction({
      id: 'daily-note',
      label: 'Daily',
      run: () => {
        const today = new Date().toLocaleDateString('en', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        ctx.editor.insertText(`# ${today}\n\n## Focus\n\n- \n\n## Notes\n\n`);
      },
    });

    const disposeMeeting = ctx.ui.registerEditorAction({
      id: 'meeting-note',
      label: 'Meeting',
      run: () => {
        ctx.editor.insertText('## Meeting\n\n### Attendees\n\n- \n\n### Decisions\n\n- \n\n### Next Actions\n\n- \n');
      },
    });

    return () => {
      disposePreview();
      disposeDaily();
      disposeMeeting();
    };
  },
});
