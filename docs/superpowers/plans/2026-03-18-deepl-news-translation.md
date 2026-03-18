# DeepL News Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-translate German news articles to English via DeepL Free API in a GitHub Action.

**Architecture:** GitHub Action triggers on push to `master`/`dev` when `content/news/**` changes. A zero-dependency Node.js script scans all DE articles, compares MD5 hashes against existing EN translations, and only translates new/changed content. Translated files are committed back to the branch.

**Tech Stack:** GitHub Actions, Node.js 20 (built-in `crypto`, `fs`, `path`), DeepL Free API

**Spec:** `docs/superpowers/specs/2026-03-18-deepl-news-translation-design.md`

---

## File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Create | `.github/scripts/translate-news.mjs` | Translation script |
| Create | `.github/workflows/translate-news.yml` | Workflow definition |
| Verify | `content/news-en/.gitkeep` | Ensure EN output dir exists |

---

### Task 1: Ensure `content/news-en/.gitkeep` exists

**Files:**
- Verify: `content/news-en/.gitkeep`

- [ ] **Step 1: Check if `.gitkeep` exists**

```bash
ls content/news-en/.gitkeep
```

If it exists, skip to Task 2. If not, create it:

- [ ] **Step 2: Create `.gitkeep`**

```bash
touch content/news-en/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add content/news-en/.gitkeep
git commit -m "chore: ensure content/news-en directory exists"
```

---

### Task 2: Create the translation script

**Files:**
- Create: `.github/scripts/translate-news.mjs`

- [ ] **Step 1: Create `.github/scripts/` directory**

```bash
mkdir -p .github/scripts
```

- [ ] **Step 2: Write `translate-news.mjs`**

Create `.github/scripts/translate-news.mjs` with the following content:

```javascript
#!/usr/bin/env node
/**
 * Translates German news MDX files to English using DeepL Free API.
 * Zero dependencies — uses Node.js built-ins only.
 *
 * Usage: DEEPL_API_KEY=xxx node .github/scripts/translate-news.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';

const DE_DIR = 'content/news';
const EN_DIR = 'content/news-en';
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';
const API_KEY = process.env.DEEPL_API_KEY;

if (!API_KEY) {
  console.error('ERROR: DEEPL_API_KEY environment variable is not set.');
  process.exit(1);
}

// ── Frontmatter parsing ──

function parseMdx(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Strip YAML quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body: match[2].trim() };
}

function yamlValue(v) {
  if (/[:#'"[\]{}|>&*!%@`]/.test(v) || v.trim() !== v) {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return v;
}

function buildMdx(frontmatter, body) {
  const lines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join('\n');
  return `---\n${lines}\n---\n\n${body}\n`;
}

// ── Hashing ──

function computeHash(title, excerpt, body) {
  return createHash('md5')
    .update(`${title}\n${excerpt}\n${body}`)
    .digest('hex')
    .slice(0, 12);
}

function getExistingHash(enFilePath) {
  if (!existsSync(enFilePath)) return null;
  const parsed = parseMdx(readFileSync(enFilePath, 'utf-8'));
  return parsed?.frontmatter?.source_hash ?? null;
}

// ── DeepL API ──

async function translateTexts(texts) {
  const params = new URLSearchParams();
  for (const t of texts) params.append('text', t);
  params.append('source_lang', 'DE');
  params.append('target_lang', 'EN-GB');

  let response = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  // Single retry on 429
  if (response.status === 429) {
    console.warn('Rate limited by DeepL, retrying in 5s...');
    await new Promise(r => setTimeout(r, 5000));
    response = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepL API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.translations.map(t => t.text);
}

// ── Main ──

async function main() {
  const deFiles = readdirSync(DE_DIR).filter(f => f.endsWith('.mdx'));

  if (!deFiles.length) {
    console.log('No German news articles found.');
    process.exit(0);
  }

  let translated = 0;

  for (const file of deFiles) {
    const dePath = join(DE_DIR, file);
    const enPath = join(EN_DIR, file);

    const content = readFileSync(dePath, 'utf-8');
    const parsed = parseMdx(content);

    if (!parsed) {
      console.warn(`Skipping ${file}: could not parse frontmatter.`);
      continue;
    }

    const { frontmatter, body } = parsed;
    const title = frontmatter.title || '';
    const excerpt = frontmatter.excerpt || '';

    const hash = computeHash(title, excerpt, body);
    const existingHash = getExistingHash(enPath);

    if (hash === existingHash) {
      console.log(`✓ ${file} — up to date`);
      continue;
    }

    console.log(`→ ${file} — translating...`);

    const [enTitle, enExcerpt, enBody] = await translateTexts([title, excerpt, body]);

    const enFrontmatter = {
      title: enTitle,
      excerpt: enExcerpt,
      date: frontmatter.date || '',
      category: frontmatter.category || '',
    };

    // Copy image if present
    if (frontmatter.image) {
      enFrontmatter.image = frontmatter.image;
    }

    enFrontmatter.source_hash = hash;

    writeFileSync(enPath, buildMdx(enFrontmatter, enBody));
    console.log(`✓ ${file} — translated`);
    translated++;
  }

  console.log(`\nDone. Translated ${translated} article(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Make script executable**

```bash
chmod +x .github/scripts/translate-news.mjs
```

- [ ] **Step 4: Test script locally (dry check — no API call)**

Run without API key to verify it exits cleanly with the expected error:

```bash
node .github/scripts/translate-news.mjs 2>&1 | head -1
```

Expected: `ERROR: DEEPL_API_KEY environment variable is not set.`

- [ ] **Step 5: Test script with API key**

```bash
DEEPL_API_KEY=<key> node .github/scripts/translate-news.mjs
```

Expected: Translates `2026-03-willkommen.mdx` and writes to `content/news-en/2026-03-willkommen.mdx`.

- [ ] **Step 6: Verify output**

Check that `content/news-en/2026-03-willkommen.mdx` has:
- English title, excerpt, body
- Same date, category as German source
- `source_hash` field in frontmatter

```bash
cat content/news-en/2026-03-willkommen.mdx
```

- [ ] **Step 7: Run script again — verify hash skip**

```bash
DEEPL_API_KEY=<key> node .github/scripts/translate-news.mjs
```

Expected: `✓ 2026-03-willkommen.mdx — up to date` (no re-translation).

- [ ] **Step 8: Commit**

```bash
git add .github/scripts/translate-news.mjs
git commit -m "feat: add DeepL news translation script"
```

---

### Task 3: Create the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/translate-news.yml`

- [ ] **Step 1: Create workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `translate-news.yml`**

Create `.github/workflows/translate-news.yml`:

```yaml
name: Translate News (DE → EN)

on:
  push:
    branches: [master, dev]
    paths:
      - 'content/news/**'

permissions:
  contents: write

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run translation script
        env:
          DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
        run: node .github/scripts/translate-news.mjs

      - name: Commit translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add content/news-en/
          if git diff --staged --quiet; then
            echo "No translation changes to commit."
          else
            git commit -m "chore: translate news to English [skip ci]"
            git push
          fi
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/translate-news.yml
git commit -m "feat: add GitHub Action for DeepL news translation"
```

---

### Task 4: Build verification

- [ ] **Step 1: Run Astro build to verify EN news renders**

```bash
npx astro build
```

Expected: Build succeeds. The EN homepage should now include the translated news card from `content/news-en/2026-03-willkommen.mdx`.

- [ ] **Step 2: Verify EN page output**

Check that the translated article appears in the build output:

```bash
grep -l "news" dist/en/index.html | head -1 && grep -o '<h3>[^<]*</h3>' dist/en/index.html | head -3
```

Expected: Shows the English-translated title in the HTML.

- [ ] **Step 3: Commit translated content**

```bash
git add content/news-en/2026-03-willkommen.mdx
git commit -m "chore: add initial English translation of news article"
```

---

### Task 5: Set up GitHub secret (manual step)

- [ ] **Step 1: Document the required secret**

The `DEEPL_API_KEY` must be added as a GitHub repository secret:

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `DEEPL_API_KEY`
4. Value: the DeepL Free API key

This is a manual step — cannot be automated.
