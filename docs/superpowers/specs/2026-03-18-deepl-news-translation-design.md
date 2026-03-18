# DeepL News Translation — Design Spec

## Overview

Automatically translate German news articles from `content/news/` to English in `content/news-en/` using DeepL Free API, triggered by a GitHub Action on push.

## Trigger

- GitHub Action workflow on push to `master` or `dev` branches
- Only runs when files in `content/news/**` are changed

## Translation Flow

1. Script scans all `.mdx` files in `content/news/`
2. For each file (`translate-news.mjs`):
   a. Parse frontmatter (title, excerpt, date, category, image) and MDX body
   b. Compute MD5 hash of the translatable German source (`title + excerpt + body`)
   c. Check if `content/news-en/<same-filename>` exists with matching `source_hash`
   d. If missing or hash differs → translate title, excerpt, body via DeepL (single batch call)
   e. Write EN `.mdx` with translated text fields + copied metadata + `source_hash`
3. If any files were written, commit and push to the same branch

## What Gets Translated

| Field | Translated | Notes |
|-------|-----------|-------|
| `title` | Yes | |
| `excerpt` | Yes | |
| `body` (MDX) | Yes | Prose only — see constraint below |
| `date` | No | Copied as-is |
| `category` | No | Code-level key (`club`/`volleyball`/`basketball`) |
| `image` | No | Copied as-is (path reference) |

### MDX Body Constraint

News body content must be **prose-only** (paragraphs, headings, bold, italic, links, images). No JSX components or import statements. DeepL translates the body as plain text with basic Markdown formatting. If MDX components are needed in future, a token-protection strategy must be added.

## Hash-Based Change Detection

- MD5 hash computed from: `title + excerpt + body` (German source)
- Stored as `source_hash` field in EN frontmatter
- Only re-translates when hash differs or EN file doesn't exist
- Avoids unnecessary API calls on unchanged content
- All files scanned on every run (no `git diff` dependency) — simple and correct

## EN Frontmatter Format

```yaml
title: Welcome to the new KSCW Website
excerpt: The new KSC Wiedikon website is live...
date: 2026-03-17T00:00:00.000Z
category: club
image: /uploads/news/example.jpg
source_hash: a1b2c3d4e5f6
```

## DeepL API

- Endpoint: `https://api-free.deepl.com/v2/translate`
- Source language: `DE`
- Target language: `EN-GB` (consistent with Swiss English conventions)
- Auth: `DEEPL_API_KEY` GitHub secret (Authorization header)
- Title + excerpt + body sent as batch text array in a single API call per article
- Free tier limit: 500,000 chars/month — script logs `DeepL-API-Usage` response headers

## File Structure

```
.github/
  workflows/
    translate-news.yml          # Workflow definition
  scripts/
    translate-news.mjs          # Translation script (Node.js, zero dependencies)
content/
  news/                         # German source (Tina-managed)
    2026-03-willkommen.mdx
  news-en/                      # English translations (auto-generated)
    .gitkeep                    # Ensures directory exists before first translation
    2026-03-willkommen.mdx
```

## Workflow Details

- **Runs on:** `push` to `master` or `dev`, path filter `content/news/**`
- **Runner:** `ubuntu-latest`
- **Node version:** 20
- **Commit message:** `chore: translate news to English [skip ci]`
- **`[skip ci]`** in commit message prevents infinite workflow loops
- **Permissions:** `contents: write` to push translated files back

## Edge Cases

- **New article:** No EN file exists → full translation
- **Updated article:** Hash mismatch → re-translate
- **Deleted DE article:** EN file is NOT auto-deleted (manual cleanup)
- **No changes needed:** Script exits cleanly, no commit created
- **API failure:** Script exits with error code, workflow fails visibly in Actions tab
- **429 rate limit:** Single retry after 5s backoff; fail if still 429

## Prerequisites

- `content/news-en/.gitkeep` must exist in the repo
- `DEEPL_API_KEY` added as GitHub repository secret

## Dependencies

- Zero npm dependencies — uses Node.js built-in `crypto`, `fs`, `path`
- Frontmatter parsing via simple `---` delimiter splitting (assumes single-line key-value pairs)

## Security

- `DEEPL_API_KEY` stored as GitHub repository secret
- Never logged or exposed in workflow output
