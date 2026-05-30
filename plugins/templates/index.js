notaPlugin.register({
  activate(ctx) {
    const disposeStyle = ctx.ui.addStyle(`
      .nota-template-preview {
        --template-border: rgba(232, 230, 223, 0.12);
        --template-panel: rgba(20, 20, 23, 0.72);
        --template-panel-strong: rgba(31, 31, 40, 0.92);
        --template-green: #9bc58f;
        --template-blue: #8cb9dc;
        --template-gold: #c4a96b;
        --template-red: #d6927a;
        color: var(--text-secondary);
        display: flex;
        flex-direction: column;
        gap: 16px;
        line-height: 1.45;
      }

      .nota-template-preview__hero {
        background: var(--template-panel-strong);
        border: 1px solid var(--template-border);
        border-left: 3px solid var(--template-gold);
        border-radius: 8px;
        padding: 18px 18px 16px;
      }

      .nota-template-preview__kicker {
        color: var(--template-gold);
        display: block;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        letter-spacing: .08em;
        margin-bottom: 7px;
        text-transform: uppercase;
      }

      .nota-template-preview__title {
        color: var(--text);
        font-family: 'Playfair Display', serif;
        font-size: 30px;
        line-height: 1.15;
      }

      .nota-template-preview__grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }

      .nota-template-preview__card {
        background: var(--template-panel);
        border: 1px solid var(--template-border);
        border-radius: 8px;
        min-height: 126px;
        padding: 14px;
      }

      .nota-template-preview__card--focus { border-top: 2px solid var(--template-green); }
      .nota-template-preview__card--notes { border-top: 2px solid var(--template-blue); }
      .nota-template-preview__card--attendees { border-top: 2px solid var(--template-blue); }
      .nota-template-preview__card--decisions { border-top: 2px solid var(--template-gold); }
      .nota-template-preview__card--actions { border-top: 2px solid var(--template-red); }

      .nota-template-preview__card-title {
        color: var(--text);
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 11px;
      }

      .nota-template-preview__list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        list-style: none;
      }

      .nota-template-preview__item {
        align-items: flex-start;
        color: var(--text-secondary);
        display: flex;
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        gap: 8px;
      }

      .nota-template-preview__item::before {
        background: currentColor;
        border-radius: 999px;
        content: '';
        flex: 0 0 auto;
        height: 5px;
        margin-top: 8px;
        opacity: .72;
        width: 5px;
      }

      .nota-template-preview__empty {
        color: var(--text-muted);
        display: block;
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        padding-top: 1px;
      }
    `);

    const escapeHtml = (value) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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

    const renderSection = (section, fallbackText) => {
      const items = section.items.length
        ? `<ul class="nota-template-preview__list">${section.items.map(item => `<li class="nota-template-preview__item">${escapeHtml(item)}</li>`).join('')}</ul>`
        : `<span class="nota-template-preview__empty">${escapeHtml(fallbackText)}</span>`;

      return `
        <section class="nota-template-preview__card nota-template-preview__card--${slug(section.title)}">
          <h3 class="nota-template-preview__card-title">${escapeHtml(section.title)}</h3>
          ${items}
        </section>
      `;
    };

    const renderPreview = ({ kind, title, sections }) => `
      <article class="nota-template-preview nota-template-preview--${kind}">
        <header class="nota-template-preview__hero">
          <span class="nota-template-preview__kicker">${kind === 'daily' ? 'Daily note' : 'Meeting note'}</span>
          <h2 class="nota-template-preview__title">${escapeHtml(title)}</h2>
        </header>
        <div class="nota-template-preview__grid">
          ${sections.map(section => renderSection(section, 'Ready when you are.')).join('')}
        </div>
      </article>
    `;

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

        return renderPreview({
          kind: isDaily ? 'daily' : 'meeting',
          title,
          sections,
        });
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
      disposeStyle();
      disposePreview();
      disposeDaily();
      disposeMeeting();
    };
  },
});
