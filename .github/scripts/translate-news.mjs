#!/usr/bin/env node
/**
 * Translates German news MDX files to English using DeepL Free API.
 * Zero dependencies — uses Node.js built-ins only.
 *
 * Usage: DEEPL_API_KEY=xxx node .github/scripts/translate-news.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
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

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  };

  let response = await fetch(DEEPL_URL, fetchOptions);

  // Single retry on 429
  if (response.status === 429) {
    console.warn('Rate limited by DeepL, retrying in 5s...');
    await new Promise(r => setTimeout(r, 5000));
    response = await fetch(DEEPL_URL, fetchOptions);
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
