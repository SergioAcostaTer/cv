# CV Generator (TypeScript, pnpm-first)

A TypeScript CLI to generate polished resume PDFs and AI-assisted LinkedIn content from your local resume JSON files.

## What It Includes

1. Resume PDF generator (Handlebars + Puppeteer).
2. AI LinkedIn generator with interactive strategy and model selection.
3. Provider support for OpenAI and DeepSeek.
4. Persona-based runtime paths and naming.
5. Persona override merge system (`config/overrides/{personaId}.json`).
6. Watch mode for resume rebuilds on data/config changes.
7. Styled HTML outputs for quick copy/open workflows:
   - `dist/index.html` for generated PDFs.
   - `dist/linkedin.html` (or same folder as chosen LinkedIn JSON output) for copy-ready LinkedIn sections.

## Requirements

1. Node.js 20+
2. pnpm 10+

## Install

```bash
pnpm install
```

## Scripts

```bash
pnpm dev
pnpm dev:dashboard
pnpm build
pnpm chat
pnpm linkedin
pnpm typecheck
pnpm test
pnpm test:watch
pnpm coverage
```

## Resume Generation

Generate all `resume.json` files from `data/local/**` into PDFs:

```bash
pnpm build
```

Use a specific theme:

```bash
pnpm build -- --theme harvard
```

Enable watch mode (rebuild on JSON/config updates):

```bash
pnpm build -- --watch
```

Resume outputs:

1. PDFs in `dist/` using persona naming format.
2. `dist/index.html` with minimal clean styling and one-click Open PDF links.

## LinkedIn Generation

For the web dashboard + Vite frontend, use:

```bash
pnpm dev:dashboard
```

This starts both the API/dashboard server on port 3000 and the Vite client together, avoiding `/api/*` proxy `ECONNREFUSED` errors.

Interactive generation:

```bash
pnpm linkedin
```

What it does:

1. Lets you pick source JSON from local profiles.
2. Lets you choose provider and model.
3. Generates AI strategy options (scored recommendations).
4. Guides grouped selections (goal, positioning, market, seniority, constraints, keyword cluster, languages).
5. Generates multilingual LinkedIn JSON.
6. Generates a styled HTML copy board with copy buttons for headline/about/skills/experience.
7. Shows estimated operation cost receipt at the end.

Generate HTML board from existing LinkedIn JSON without re-running AI:

```bash
pnpm linkedin -- --from-json dist/linkedin.json
```

LinkedIn outputs:

1. JSON file at the selected output path (default `dist/linkedin.json`).
2. HTML file alongside it (for example `dist/linkedin.html`).

## Chat Mode

Run interactive career chat:

```bash
pnpm chat
```

## Environment Variables

Create `.env` in project root.

```bash
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
```

Supported variables:

1. `OPENAI_API_KEY`
2. `DEEPSEEK_API_KEY`
3. `AI_API_KEY` (fallback)

## Persona Configuration

File: `config/persona.config.json`

Example:

```json
{
  "personaId": "sergio",
  "displayName": "Sergio Acosta Quintana",
  "defaultLanguage": "en",
  "defaultRole": "backend",
  "outputNaming": "{persona}-{role}-{lang}.pdf"
}
```

Supported `outputNaming` tokens:

1. `{persona}`
2. `{role}`
3. `{lang}`
4. `{date}`

## Persona Overrides

Override/augment any resume JSON fields without editing source profile files.

Path:

1. `config/overrides/{personaId}.json`

Example:

```json
{
  "basics": {
    "name": "Alternative Name",
    "email": "custom@example.com"
  }
}
```

## Typical Workflow

1. Add or edit resume data under `data/local/<role>/<lang>/resume.json`.
2. Run `pnpm build` (or `pnpm build -- --watch`) to generate PDFs and `dist/index.html`.
3. Run `pnpm linkedin` to generate LinkedIn JSON and HTML copy board.
4. Open HTML files in `dist/` for faster copy/open operations.

## Notes

1. This repo is pnpm-first.
2. Run `pnpm typecheck` and `pnpm test` before committing.
