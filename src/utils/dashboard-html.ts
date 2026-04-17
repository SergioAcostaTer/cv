export const getDashboardHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CV Studio Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github.min.css"
    />
    <style>
      :root {
        --bg: #f1f5f9;
        --panel: rgba(255, 255, 255, 0.82);
        --panel-solid: #ffffff;
        --text: #0b1220;
        --muted: #4b5563;
        --line: #d8e0eb;
        --line-strong: #bcc8d9;
        --brand: #0f766e;
        --brand-soft: #dff8f3;
        --danger: #b91c1c;
        --shadow: 0 22px 56px rgba(15, 23, 42, 0.12);
        --radius-lg: 18px;
        --radius-md: 12px;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        height: 100%;
        color: var(--text);
        font-family: Manrope, 'Segoe UI', sans-serif;
        background:
          radial-gradient(circle at 4% -6%, #ffe4d6 0%, transparent 34%),
          radial-gradient(circle at 88% -10%, #d5f9f0 0%, transparent 36%),
          radial-gradient(circle at 50% 120%, #dbeafe 0%, transparent 40%),
          var(--bg);
      }

      .app {
        display: grid;
        grid-template-columns: 330px 1fr;
        gap: 18px;
        height: 100vh;
        padding: 18px;
      }

      .sidebar,
      .main {
        border-radius: var(--radius-lg);
        border: 1px solid rgba(255, 255, 255, 0.65);
        background: var(--panel);
        backdrop-filter: blur(12px);
        box-shadow: var(--shadow);
      }

      .sidebar {
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .sidebar-header {
        padding: 18px;
        border-bottom: 1px solid var(--line);
      }

      .sidebar-header h1 {
        margin: 0;
        font-size: 1.08rem;
        font-weight: 800;
        letter-spacing: 0.02em;
      }

      .sidebar-header p {
        margin: 7px 0 0;
        color: var(--muted);
        font-size: 0.85rem;
      }

      .library {
        overflow: auto;
        padding: 11px;
        display: grid;
        gap: 10px;
      }

      details {
        border-radius: var(--radius-md);
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
      }

      summary {
        list-style: none;
        cursor: pointer;
        font-size: 0.86rem;
        font-weight: 700;
        padding: 10px 12px;
        border-bottom: 1px solid transparent;
      }

      details[open] summary {
        border-bottom-color: var(--line);
      }

      .file-list {
        display: grid;
        gap: 7px;
        padding: 8px;
      }

      .file-item {
        width: 100%;
        text-align: left;
        cursor: pointer;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: var(--panel-solid);
        padding: 10px;
        transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease;
      }

      .file-item:hover {
        transform: translateY(-1px);
        border-color: var(--line-strong);
      }

      .file-item.active {
        border-color: #5eead4;
        background: var(--brand-soft);
      }

      .file-name {
        display: block;
        font-size: 0.84rem;
        font-weight: 700;
      }

      .file-date {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 0.74rem;
        font-family: 'IBM Plex Mono', Consolas, monospace;
      }

      .main {
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .main-toolbar {
        border-bottom: 1px solid var(--line);
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .main-title {
        margin: 0;
        font-size: 0.94rem;
        font-weight: 700;
      }

      .toolbar-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .btn {
        border: 1px solid var(--line-strong);
        background: var(--panel-solid);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
      }

      .btn:hover {
        border-color: #7dd3fc;
      }

      .btn-primary {
        color: #ffffff;
        border-color: transparent;
        background: linear-gradient(92deg, #0f766e, #0ea5a4);
      }

      .btn.hidden {
        display: none;
      }

      .content {
        min-height: 0;
        overflow: auto;
        padding: 20px;
      }

      .empty-state {
        margin: auto;
        text-align: center;
        max-width: 520px;
        color: var(--muted);
      }

      .empty-state h2 {
        margin: 0;
        font-size: 1.25rem;
      }

      .empty-state p {
        margin-top: 8px;
      }

      .pdf-frame {
        width: 100%;
        height: calc(100vh - 190px);
        border-radius: var(--radius-md);
        border: 1px solid var(--line);
        background: var(--panel-solid);
      }

      .sections-grid {
        display: grid;
        gap: 14px;
      }

      .section-card {
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: var(--panel-solid);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
        overflow: hidden;
      }

      .section-header {
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .section-title {
        margin: 0;
        font-size: 0.86rem;
        font-weight: 800;
      }

      .section-body {
        padding: 12px;
        line-height: 1.55;
      }

      .copy-section-btn {
        border: 1px solid var(--line-strong);
        background: #f8fafc;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
      }

      .copy-section-btn:hover {
        border-color: #67e8f9;
      }

      .toast {
        position: fixed;
        right: 22px;
        bottom: 22px;
        background: #111827;
        color: #f9fafb;
        border-radius: 999px;
        padding: 9px 14px;
        font-size: 0.78rem;
        font-weight: 700;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
      }

      .toast.visible {
        opacity: 1;
        transform: translateY(0);
      }

      pre {
        border-radius: 10px;
        border: 1px solid var(--line);
        background: #f8fafc;
        padding: 12px;
        overflow: auto;
      }

      code {
        font-family: 'IBM Plex Mono', Consolas, monospace;
      }

      @media (max-width: 1024px) {
        .app {
          grid-template-columns: 1fr;
          grid-template-rows: 44vh 1fr;
        }

        .pdf-frame {
          height: 62vh;
        }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h1>CV Studio Library</h1>
          <p>Browse generated resumes, LinkedIn drafts and career roadmaps.</p>
        </div>
        <div id="library" class="library"></div>
      </aside>

      <main class="main">
        <div class="main-toolbar">
          <p id="mainTitle" class="main-title">Select an artifact from the sidebar</p>
          <div class="toolbar-actions">
            <button id="copyButton" class="btn btn-primary hidden" type="button">Copy All</button>
          </div>
        </div>
        <section id="content" class="content">
          <div class="empty-state">
            <h2>Ready</h2>
            <p>Open a PDF, LinkedIn draft, or roadmap from the left panel. Markdown files support Copy All and Copy Section actions.</p>
          </div>
        </section>
      </main>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js"></script>
    <script>
      const state = {
        selectedKey: null,
        selectedItem: null,
        rawText: '',
        sections: [],
        lastLibrarySignature: '',
        toastTimer: null
      };

      const contentEl = document.getElementById('content');
      const titleEl = document.getElementById('mainTitle');
      const libraryEl = document.getElementById('library');
      const copyButton = document.getElementById('copyButton');
      const toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);

      marked.setOptions({
        highlight(code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return hljs.highlightAuto(code).value;
        }
      });

      const categoryLabels = {
        resumes: 'Resumes (PDF)',
        linkedinDrafts: 'LinkedIn Drafts',
        roadmaps: 'Career Roadmaps'
      };

      const formatDate = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.valueOf())) {
          return 'Unknown date';
        }
        return date.toLocaleString();
      };

      const showToast = (message) => {
        toastEl.textContent = message;
        toastEl.classList.add('visible');
        if (state.toastTimer) {
          clearTimeout(state.toastTimer);
        }

        state.toastTimer = setTimeout(() => {
          toastEl.classList.remove('visible');
          state.toastTimer = null;
        }, 1300);
      };

      const setCopyButton = (visible, text) => {
        state.rawText = text || '';
        copyButton.classList.toggle('hidden', !visible);
      };

      const copyText = async (text, label) => {
        if (!text) {
          return;
        }

        try {
          await navigator.clipboard.writeText(text);
          showToast(label + ' copied');
        } catch (error) {
          showToast('Clipboard failed');
          console.error(error);
        }
      };

      const splitMarkdownSections = (raw) => {
        const levelTwoMatches = Array.from(raw.matchAll(/^##\s+(.+)$/gmu));
        const levelThreeMatches = Array.from(raw.matchAll(/^###\s+(.+)$/gmu));
        const matches = levelTwoMatches.length > 1 ? levelTwoMatches : levelThreeMatches;

        if (!matches.length) {
          return [
            {
              title: 'Full Content',
              markdown: raw
            }
          ];
        }

        return matches.map((match, index) => {
          const start = match.index || 0;
          const end = index + 1 < matches.length ? matches[index + 1].index || raw.length : raw.length;

          return {
            title: String(match[1] || 'Section ' + (index + 1)).trim(),
            markdown: raw.slice(start, end).trim()
          };
        });
      };

      const renderMarkdownSections = async (raw) => {
        state.sections = splitMarkdownSections(raw);
        const cards = await Promise.all(
          state.sections.map(async (section, index) => {
            const parsed = marked.parse(section.markdown);
            const html = typeof parsed === 'string' ? parsed : await parsed;
            return (
              '<article class="section-card">' +
              '<header class="section-header">' +
              '<p class="section-title">' + section.title + '</p>' +
              '<button class="copy-section-btn" data-section-index="' + index + '" type="button">Copy Section</button>' +
              '</header>' +
              '<div class="section-body">' + html + '</div>' +
              '</article>'
            );
          })
        );

        contentEl.innerHTML = '<div class="sections-grid">' + cards.join('') + '</div>';
      };

      const showMarkdown = async (item) => {
        titleEl.textContent = item.filename;
        const response = await fetch('/api/file?path=' + encodeURIComponent(item.path));
        if (!response.ok) {
          throw new Error('Could not load file content.');
        }

        const raw = await response.text();
        await renderMarkdownSections(raw);
        setCopyButton(true, raw);
      };

      const showPdf = (item) => {
        titleEl.textContent = item.filename;
        contentEl.innerHTML = '<iframe class="pdf-frame" src="/pdfs/' + encodeURI(item.path) + '"></iframe>';
        state.sections = [];
        setCopyButton(false, '');
      };

      const setActive = (key) => {
        state.selectedKey = key;
        document.querySelectorAll('.file-item').forEach((el) => {
          el.classList.toggle('active', el.dataset.key === key);
        });
      };

      const renderGroup = (category, items) => {
        const details = document.createElement('details');
        details.open = true;

        const summary = document.createElement('summary');
        summary.textContent = categoryLabels[category] + ' (' + items.length + ')';
        details.appendChild(summary);

        const list = document.createElement('div');
        list.className = 'file-list';

        items.forEach((item) => {
          const key = category + ':' + item.path;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'file-item';
          button.dataset.key = key;
          button.innerHTML =
            '<span class="file-name">' + item.filename + '</span>' +
            '<span class="file-date">' + formatDate(item.modifiedAt) + '</span>';

          button.addEventListener('click', async () => {
            try {
              setActive(key);
              state.selectedItem = {
                category,
                path: item.path,
                key
              };

              if (category === 'resumes') {
                showPdf(item);
              } else {
                await showMarkdown(item);
              }
            } catch (error) {
              contentEl.innerHTML = '<pre>' + String(error) + '</pre>';
              setCopyButton(false, '');
            }
          });

          list.appendChild(button);
        });

        details.appendChild(list);
        return details;
      };

      const buildLibrarySignature = (data) =>
        JSON.stringify({
          resumes: (Array.isArray(data.resumes) ? data.resumes : []).map((item) => [item.path, item.modifiedAt]),
          linkedinDrafts: (Array.isArray(data.linkedinDrafts) ? data.linkedinDrafts : []).map((item) => [
            item.path,
            item.modifiedAt
          ]),
          roadmaps: (Array.isArray(data.roadmaps) ? data.roadmaps : []).map((item) => [item.path, item.modifiedAt])
        });

      const rerenderLibrary = (data) => {
        const previousSelection = state.selectedItem;
        libraryEl.innerHTML = '';

        ['resumes', 'linkedinDrafts', 'roadmaps'].forEach((key) => {
          const items = Array.isArray(data[key]) ? data[key] : [];
          libraryEl.appendChild(renderGroup(key, items));
        });

        if (previousSelection) {
          const selectedButton = libraryEl.querySelector('[data-key="' + previousSelection.key + '"]');
          if (selectedButton) {
            setActive(previousSelection.key);
          }
        }
      };

      const loadLibrary = async (mode = 'initial') => {
        try {
          const response = await fetch('/api/library');
          if (!response.ok) {
            throw new Error('Could not load library.');
          }

          const data = await response.json();
          const nextSignature = buildLibrarySignature(data);
          const hasChanged = nextSignature !== state.lastLibrarySignature;

          if (mode !== 'initial' && !hasChanged) {
            return;
          }

          state.lastLibrarySignature = nextSignature;
          rerenderLibrary(data);

          if (mode === 'poll' && hasChanged) {
            showToast('Library updated');
          }
        } catch (error) {
          if (mode === 'initial') {
            libraryEl.innerHTML = '<pre>' + String(error) + '</pre>';
          }
        }
      };

      copyButton.addEventListener('click', async () => {
        await copyText(state.rawText, 'Full document');
      });

      contentEl.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const sectionButton = target.closest('[data-section-index]');
        if (!(sectionButton instanceof HTMLElement)) {
          return;
        }

        const rawIndex = sectionButton.dataset.sectionIndex;
        const index = Number(rawIndex);
        if (!Number.isFinite(index)) {
          return;
        }

        const section = state.sections[index];
        if (!section) {
          return;
        }

        await copyText(section.markdown, section.title);
      });

      void loadLibrary('initial');
      setInterval(() => {
        void loadLibrary('poll');
      }, 3000);
    </script>
  </body>
</html>`;
