#!/usr/bin/env node
/**
 * Translates German content (news + events) to English using DeepL Free API.
 * Zero dependencies — uses Node.js built-ins only.
 *
 * Usage: DEEPL_API_KEY=xxx node .github/scripts/translate-content.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';
const API_KEY = process.env.DEEPL_API_KEY;

if (!API_KEY) {
  console.error('ERROR: DEEPL_API_KEY environment variable is not set.');
  process.exit(1);
}

// ── Content types to translate ──

const CONTENT_TYPES = [
  {
    name: 'news',
    deDir: 'content/news',
    enDir: 'content/news-en',
    hashFields: (fm, body) => `${fm.title || ''}\n${fm.excerpt || ''}\n${body}`,
    translateFields: (fm, body) => [fm.title || '', fm.excerpt || '', body],
    buildEnFrontmatter: ([enTitle, enExcerpt, enBody], fm) => {
      const en = { title: enTitle, excerpt: enExcerpt, date: fm.date || '', category: fm.category || '' };
      if (fm.image) en.image = fm.image;
      return { frontmatter: en, body: enBody };
    },
  },
  {
    name: 'events',
    deDir: 'content/events',
    enDir: 'content/events-en',
    hashFields: (fm, body) => `${fm.title || ''}\n${body}`,
    translateFields: (fm, body) => [fm.title || '', body],
    buildEnFrontmatter: ([enTitle, enBody], fm) => {
      const en = { title: enTitle, date: fm.date || '', category: fm.category || '' };
      if (fm.endDate) en.endDate = fm.endDate;
      if (fm.time) en.time = fm.time;
      if (fm.location) en.location = fm.location;
      if (fm.image) en.image = fm.image;
      return { frontmatter: en, body: enBody };
    },
  },
];

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

function computeHash(input) {
  return createHash('md5').update(input).digest('hex').slice(0, 12);
}

function getExistingHash(enFilePath) {
  if (!existsSync(enFilePath)) return null;
  const parsed = parseMdx(readFileSync(enFilePath, 'utf-8'));
  return parsed?.frontmatter?.source_hash ?? null;
}

// ── DeepL API ──

async function translateTexts(texts) {
  const params = new URLSearchParams();
  for (const t of texts) {
    params.append('text', t || ' ');
  }
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
  let totalTranslated = 0;

  for (const ct of CONTENT_TYPES) {
    if (!existsSync(ct.deDir)) continue;

    const deFiles = readdirSync(ct.deDir).filter(f => f.endsWith('.mdx'));
    if (!deFiles.length) {
      console.log(`[${ct.name}] No files found.`);
      continue;
    }

    console.log(`\n── ${ct.name} ──`);

    for (const file of deFiles) {
      const dePath = join(ct.deDir, file);
      const enPath = join(ct.enDir, file);

      const content = readFileSync(dePath, 'utf-8');
      const parsed = parseMdx(content);

      if (!parsed) {
        console.warn(`Skipping ${file}: could not parse frontmatter.`);
        continue;
      }

      const { frontmatter, body } = parsed;

      // Skip files with manual_override flag
      if (existsSync(enPath)) {
        const enParsed = parseMdx(readFileSync(enPath, 'utf-8'));
        if (enParsed?.frontmatter?.manual_override === 'true') {
          console.log(`⊘ ${file} — manual override, skipping`);
          continue;
        }
      }

      const hashInput = ct.hashFields(frontmatter, body);
      const hash = computeHash(hashInput);
      const existingHash = getExistingHash(enPath);

      if (hash === existingHash) {
        console.log(`✓ ${file} — up to date`);
        continue;
      }

      console.log(`→ ${file} — translating...`);

      const textsToTranslate = ct.translateFields(frontmatter, body);
      const translated = await translateTexts(textsToTranslate);
      const { frontmatter: enFm, body: enBody } = ct.buildEnFrontmatter(translated, frontmatter);
      enFm.source_hash = hash;

      writeFileSync(enPath, buildMdx(enFm, enBody));
      console.log(`✓ ${file} — translated`);
      totalTranslated++;
    }
  }

  console.log(`\nDone. Translated ${totalTranslated} file(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
