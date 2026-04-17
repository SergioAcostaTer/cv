export const getDashboardHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CV Studio Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github.min.css"
    />
    <style>
      :root {
        --bg: #f6f8fb;
        --panel: #ffffff;
        --muted: #5b6474;
        --text: #0f172a;
        --line: #e2e8f0;
        --line-strong: #d6deea;
        --shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
        --accent: #2563eb;
        --accent-soft: #dbeafe;
        --radius: 14px;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        height: 100%;
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: var(--text);
        background: radial-gradient(circle at 80% 0%, #eaf0ff 0%, transparent 40%), var(--bg);
      }

      .app {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 16px;
        height: 100vh;
        padding: 16px;
      }

      .sidebar {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .sidebar-header {
        padding: 16px;
        border-bottom: 1px solid var(--line);
      }

      .sidebar-header h1 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
      }

      .sidebar-header p {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 0.88rem;
      }

      .library {
        overflow: auto;
        padding: 10px;
        display: grid;
        gap: 8px;
      }

      details {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #fbfdff;
      }

      summary {
        list-style: none;
        padding: 10px 12px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        border-bottom: 1px solid transparent;
      }

      details[open] summary {
        border-bottom-color: var(--line);
      }

      .file-list {
        display: grid;
        gap: 6px;
        padding: 8px;
      }

      .file-item {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #ffffff;
        text-align: left;
        width: 100%;
        cursor: pointer;
        padding: 10px;
        transition: 130ms ease;
      }

      .file-item:hover {
        border-color: var(--line-strong);
        transform: translateY(-1px);
      }

      .file-item.active {
        border-color: #93c5fd;
        background: var(--accent-soft);
      }

      .file-name {
        display: block;
        font-size: 0.86rem;
        font-weight: 600;
        color: #111827;
      }

      .file-date {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 0.75rem;
      }

      .main {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .main-toolbar {
        border-bottom: 1px solid var(--line);
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .main-title {
        margin: 0;
        font-size: 0.92rem;
      }

      .copy-btn {
        border: 1px solid var(--line-strong);
        background: #ffffff;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        display: none;
      }

      .copy-btn.visible {
        display: inline-flex;
      }

      .content {
        padding: 20px;
        overflow: auto;
        min-height: 0;
        line-height: 1.55;
      }

      .empty-state {
        margin: auto;
        text-align: center;
        color: var(--muted);
        max-width: 460px;
      }

      .pdf-frame {
        width: 100%;
        height: calc(100vh - 180px);
        border: 1px solid var(--line);
        border-radius: 12px;
      }

      pre {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #f8fafc;
        padding: 12px;
        overflow: auto;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      @media (max-width: 980px) {
        .app {
          grid-template-columns: 1fr;
          grid-template-rows: 42vh 1fr;
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
          <p>Browse archived artifacts and generated resumes.</p>
        </div>
        <div id="library" class="library"></div>
      </aside>

      <main class="main">
        <div class="main-toolbar">
          <p id="mainTitle" class="main-title">Select an artifact from the sidebar</p>
          <button id="copyButton" class="copy-btn" type="button">Copy to Clipboard</button>
        </div>
        <section id="content" class="content">
          <div class="empty-state">
            <h2>Ready</h2>
            <p>Open a PDF, LinkedIn draft, or roadmap from the left panel.</p>
          </div>
        </section>
      </main>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js"></script>
    <script>
      const state = {
        selectedKey: null,
        rawText: ''
      };

      const contentEl = document.getElementById('content');
      const titleEl = document.getElementById('mainTitle');
      const libraryEl = document.getElementById('library');
      const copyButton = document.getElementById('copyButton');

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

      const setCopyButton = (visible, text) => {
        state.rawText = text || '';
        copyButton.classList.toggle('visible', Boolean(visible));
      };

      const showMarkdown = async (item) => {
        titleEl.textContent = item.filename;
        const response = await fetch('/api/file?path=' + encodeURIComponent(item.path));
        if (!response.ok) {
          throw new Error('Could not load file content.');
        }

        const raw = await response.text();
        const rendered = marked.parse(raw);
        contentEl.innerHTML = rendered;
        setCopyButton(true, raw);
      };

      const showPdf = (item) => {
        titleEl.textContent = item.filename;
        contentEl.innerHTML = '<iframe class="pdf-frame" src="/pdfs/' + encodeURI(item.path) + '"></iframe>';
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

      const loadLibrary = async () => {
        try {
          const response = await fetch('/api/library');
          if (!response.ok) {
            throw new Error('Could not load library.');
          }

          const data = await response.json();
          libraryEl.innerHTML = '';

          ['resumes', 'linkedinDrafts', 'roadmaps'].forEach((key) => {
            const items = Array.isArray(data[key]) ? data[key] : [];
            libraryEl.appendChild(renderGroup(key, items));
          });
        } catch (error) {
          libraryEl.innerHTML = '<pre>' + String(error) + '</pre>';
        }
      };

      copyButton.addEventListener('click', async () => {
        if (!state.rawText) {
          return;
        }

        try {
          await navigator.clipboard.writeText(state.rawText);
          const oldText = copyButton.textContent;
          copyButton.textContent = 'Copied';
          setTimeout(() => {
            copyButton.textContent = oldText;
          }, 1000);
        } catch (error) {
          alert('Clipboard access failed: ' + String(error));
        }
      });

      void loadLibrary();
    </script>
  </body>
</html>`;
