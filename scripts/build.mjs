import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const utilsDir = path.resolve(repoRoot, 'src')
const corePath = path.resolve(utilsDir, 'mirrorVeilStandalone.mjs')
const outputDir = path.resolve(repoRoot, 'dist')
const constantsModulePath = pathToFileURL(path.resolve(utilsDir, 'mirrorVeilDownload.mjs')).href

const {
  MIRROR_VEIL_DOWNLOAD_FILE,
  MIRROR_VEIL_NAME,
  MIRROR_VEIL_OUTPUT_LABEL,
  MIRROR_VEIL_TAGLINE,
} = await import(constantsModulePath)

const buildHtml = (inlineScript) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${MIRROR_VEIL_NAME} | Local Grey Mirror privacy prep</title>
  <meta name="description" content="${MIRROR_VEIL_NAME} runs locally in your browser so you can optionally redact names, phones, emails, card numbers, and addresses before uploading a CSV to Grey Mirror.">
  <style>
    :root {
      color-scheme: dark;
      --bg: #08111c;
      --panel: rgba(10, 24, 39, 0.94);
      --panel-strong: rgba(14, 30, 48, 0.98);
      --border: rgba(101, 188, 255, 0.22);
      --text: #eef7ff;
      --muted: rgba(214, 229, 244, 0.78);
      --accent: #76e0ff;
      --accent-strong: #3cc7f4;
      --danger: #ff8a8a;
      --success: #9dffc2;
      --shadow: 0 28px 70px rgba(0, 0, 0, 0.28);
      font-family: "Manrope", ui-sans-serif, system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(72, 187, 255, 0.18), transparent 34%),
        radial-gradient(circle at 80% 0%, rgba(140, 255, 207, 0.12), transparent 26%),
        linear-gradient(180deg, #08111c 0%, #050b13 100%);
      color: var(--text);
    }
    .mv-shell {
      width: min(1100px, calc(100% - 2rem));
      margin: 2rem auto;
      display: grid;
      gap: 1.25rem;
    }
    .mv-hero, .mv-panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(16px);
    }
    .mv-hero {
      padding: 1.5rem;
      display: grid;
      gap: 1rem;
    }
    .mv-kicker {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      color: var(--accent);
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: clamp(2rem, 2vw + 1.4rem, 3.3rem);
      line-height: 1.04;
      letter-spacing: -0.03em;
    }
    .mv-hero p, .mv-panel p, .mv-note, .mv-checklist li, label, .mv-option-copy {
      color: var(--muted);
      line-height: 1.55;
    }
    .mv-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 1rem;
    }
    .mv-panel {
      padding: 1.25rem;
    }
    .mv-form {
      display: grid;
      gap: 1rem;
    }
    .mv-dropzone, .mv-preview, .mv-note, .mv-stat, textarea {
      background: var(--panel-strong);
      border: 1px solid rgba(118, 224, 255, 0.16);
      border-radius: 18px;
    }
    .mv-dropzone {
      padding: 1rem;
      display: grid;
      gap: 0.8rem;
    }
    .mv-file {
      width: 100%;
      color: var(--muted);
    }
    textarea {
      width: 100%;
      min-height: 160px;
      resize: vertical;
      padding: 0.9rem 1rem;
      color: var(--text);
    }
    .mv-options {
      display: grid;
      gap: 0.7rem;
    }
    .mv-option-row {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: start;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      background: rgba(7, 16, 27, 0.74);
      border: 1px solid rgba(118, 224, 255, 0.1);
      border-radius: 16px;
    }
    .mv-option-row input { margin-top: 0.2rem; }
    .mv-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
      align-items: center;
    }
    .mv-button {
      appearance: none;
      border: 1px solid rgba(118, 224, 255, 0.25);
      background: linear-gradient(135deg, rgba(34, 74, 112, 0.9), rgba(16, 42, 66, 0.94));
      color: var(--text);
      padding: 0.95rem 1.25rem;
      border-radius: 999px;
      font-size: 0.96rem;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
    .mv-button--secondary {
      background: rgba(255, 255, 255, 0.03);
    }
    .mv-status {
      min-height: 1.5rem;
      font-size: 0.92rem;
    }
    .mv-status[data-tone="success"] { color: var(--success); }
    .mv-status[data-tone="error"] { color: var(--danger); }
    .mv-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.7rem;
    }
    .mv-stat {
      padding: 0.85rem 0.95rem;
      display: grid;
      gap: 0.25rem;
    }
    .mv-stat span {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
      font-weight: 700;
    }
    .mv-contract {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .mv-contract h3 {
      margin: 0 0 0.4rem;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .mv-contract ul { margin: 0; padding-left: 1.1rem; }
    .mv-contract li { margin-bottom: 0.25rem; }
    .mv-receipt {
      margin-top: 1rem;
      padding: 0.9rem;
      overflow-x: auto;
      white-space: pre;
      font-size: 0.78rem;
      line-height: 1.5;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 10px;
    }
    .mv-preview {
      padding: 1rem;
      overflow: auto;
    }
    .mv-preview-table {
      width: 100%;
      border-collapse: collapse;
    }
    .mv-preview-table th,
    .mv-preview-table td {
      text-align: left;
      vertical-align: top;
      padding: 0.75rem 0.65rem;
      border-bottom: 1px solid rgba(118, 224, 255, 0.1);
      font-size: 0.9rem;
    }
    .mv-preview-table th {
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--accent);
    }
    .mv-checklist {
      margin: 0;
      padding-left: 1.1rem;
      display: grid;
      gap: 0.5rem;
    }
    .mv-note {
      padding: 0.95rem 1rem;
    }
    .mv-empty {
      margin: 0;
      color: var(--muted);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #d8f4ff;
    }
    @media (max-width: 860px) {
      .mv-shell { width: min(100%, calc(100% - 1rem)); margin: 1rem auto; }
      .mv-grid { grid-template-columns: 1fr; }
      .mv-hero, .mv-panel { border-radius: 20px; }
    }
  </style>
</head>
<body>
  <div class="mv-shell">
    <section class="mv-hero">
      <span class="mv-kicker">${MIRROR_VEIL_TAGLINE}</span>
      <h1>${MIRROR_VEIL_NAME} turns raw message exports into a Grey Mirror-ready CSV on your device.</h1>
      <p>Runs locally in your browser. Nothing is uploaded by this tool. Turn redaction on if you want names, phones, emails, card numbers, street addresses, and optional URLs scrubbed before you upload the cleaned CSV to Grey Mirror.</p>
      <div class="mv-stats">
        <div class="mv-stat"><span>Output</span><strong><code>${MIRROR_VEIL_OUTPUT_LABEL}</code></strong></div>
        <div class="mv-stat"><span>Privacy</span><strong>Local-only processing</strong></div>
        <div class="mv-stat"><span>Mode</span><strong>Redaction is optional</strong></div>
      </div>
    </section>

    <div class="mv-grid">
      <section class="mv-panel">
        <form id="mv-form" class="mv-form">
          <div class="mv-dropzone">
            <label for="mv-file"><strong>Choose a conversation export</strong></label>
            <input id="mv-file" class="mv-file" type="file" accept=".csv,.txt,.json,.log,.text" />
            <p class="mv-note">Use CSV, JSON, or a timestamped text export from iMessage, WhatsApp, or another app. If your export is already clean, turn redaction off and ${MIRROR_VEIL_NAME} will just normalize it into ${MIRROR_VEIL_OUTPUT_LABEL}.</p>
          </div>

          <div>
            <label for="mv-paste"><strong>Or paste an export directly</strong></label>
            <textarea id="mv-paste" placeholder="Paste a message export here if you do not want to choose a file."></textarea>
          </div>

          <div class="mv-options">
            <label class="mv-option-row">
              <input id="mv-enable-redaction" type="checkbox" checked />
              <span>
                <strong>Enable redaction</strong>
                <div class="mv-option-copy">Leave this on for local privacy prep. Turn it off if you only want a clean CSV wrapper.</div>
              </span>
            </label>
            <label class="mv-option-row">
              <input id="mv-redact-names" data-mv-redaction-option="true" type="checkbox" checked />
              <span><strong>Redact names</strong><div class="mv-option-copy">Sender labels become Person A / Person B, and matching names in the message body are pseudonymized too.</div></span>
            </label>
            <label class="mv-option-row">
              <input id="mv-redact-emails" data-mv-redaction-option="true" type="checkbox" checked />
              <span><strong>Redact emails</strong><div class="mv-option-copy">Common email addresses become <code>[EMAIL]</code>.</div></span>
            </label>
            <label class="mv-option-row">
              <input id="mv-redact-phones" data-mv-redaction-option="true" type="checkbox" checked />
              <span><strong>Redact phone numbers</strong><div class="mv-option-copy">US-style phone numbers become <code>[PHONE]</code>.</div></span>
            </label>
            <label class="mv-option-row">
              <input id="mv-redact-addresses" data-mv-redaction-option="true" type="checkbox" checked />
              <span><strong>Redact street addresses</strong><div class="mv-option-copy">Patterns like <code>123 Main St</code> become <code>[ADDRESS]</code>.</div></span>
            </label>
            <label class="mv-option-row">
              <input id="mv-redact-cards" data-mv-redaction-option="true" type="checkbox" checked />
              <span><strong>Redact card numbers</strong><div class="mv-option-copy">Valid 13–19 digit card numbers become <code>[CARD]</code>.</div></span>
            </label>
            <label class="mv-option-row">
              <input id="mv-redact-urls" data-mv-redaction-option="true" type="checkbox" />
              <span><strong>Redact URLs and @handles</strong><div class="mv-option-copy">Optional if you want a stricter privacy pass.</div></span>
            </label>
          </div>

          <div>
            <label for="mv-custom-names"><strong>Custom names or nicknames to scrub</strong></label>
            <textarea id="mv-custom-names" data-mv-redaction-option="true" placeholder="Add names or nicknames, separated by commas or new lines."></textarea>
          </div>

          <div class="mv-actions">
            <button class="mv-button" type="submit">Create cleaned CSV</button>
            <a id="mv-download" class="mv-button mv-button--secondary" href="#" hidden>Download cleaned CSV</a>
            <a id="mv-receipt-download" class="mv-button mv-button--secondary" href="#" hidden>Download receipt</a>
          </div>
          <div id="mv-status" class="mv-status" aria-live="polite"></div>
        </form>
      </section>

      <section class="mv-panel">
        <p class="mv-note"><strong>How to use it</strong><br>1. Choose or paste the export.<br>2. Leave redaction on or turn it off.<br>3. Review the preview.<br>4. Download the cleaned CSV and upload it to Grey Mirror.</p>
        <ul class="mv-checklist">
          <li>Keeps timestamps when the source export contains them.</li>
          <li>Outputs a simple ingest shape Grey Mirror already accepts: <code>${MIRROR_VEIL_OUTPUT_LABEL}</code>.</li>
          <li>Best for two-person threads, but it can normalize larger exports too.</li>
          <li>Redaction helps with common identifiers. Review the cleaned CSV before upload because context can still reveal identity.</li>
        </ul>
        <div id="mv-contract" class="mv-contract"></div>
        <div id="mv-stats" class="mv-stats"></div>
        <div id="mv-preview" class="mv-preview"><p class="mv-empty">No preview rows yet.</p></div>
        <pre id="mv-receipt" class="mv-receipt" hidden></pre>
      </section>
    </div>
  </div>
  <script>${inlineScript}
bootMirrorVeil(document)
  </script>
</body>
</html>
`

const inlineConstants = `const MIRROR_VEIL_DOWNLOAD_FILE = ${JSON.stringify(MIRROR_VEIL_DOWNLOAD_FILE)}\nconst MIRROR_VEIL_NAME = ${JSON.stringify(MIRROR_VEIL_NAME)}\nconst MIRROR_VEIL_OUTPUT_LABEL = ${JSON.stringify(MIRROR_VEIL_OUTPUT_LABEL)}\nconst MIRROR_VEIL_TAGLINE = ${JSON.stringify(MIRROR_VEIL_TAGLINE)}\n`

let coreSource = await fs.readFile(corePath, 'utf8')
coreSource = coreSource.replace(/import\s+\{[\s\S]*?\}\s+from\s+'\.\/mirrorVeilDownload\.mjs'\n/, inlineConstants)
coreSource = coreSource.replace(/^export\s+/gm, '')

await fs.mkdir(outputDir, { recursive: true })
await fs.writeFile(path.join(outputDir, MIRROR_VEIL_DOWNLOAD_FILE), buildHtml(coreSource))
