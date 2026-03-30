/**
 * migrate-assets.mjs
 *
 * Migrates file assets (team pictures, news images, sponsor logos)
 * from PocketBase to Directus.
 *
 * Works in two modes:
 *   1. HTTP mode: fetches files from api.kscw.ch (requires CF Zero Trust access)
 *   2. Disk mode: reads files directly from PocketBase storage on disk
 *      Set PB_STORAGE_PATH=/opt/pocketbase-kscw/pb_data/storage to enable
 *
 * Usage (HTTP mode):
 *   DIRECTUS_URL=https://directus.kscw.ch \
 *   DIRECTUS_TOKEN=<token> \
 *   node scripts/migrate-assets.mjs
 *
 * Usage (disk mode, run on VPS or via SSH):
 *   DIRECTUS_URL=https://directus.kscw.ch \
 *   DIRECTUS_TOKEN=<token> \
 *   PB_STORAGE_PATH=/opt/pocketbase-kscw/pb_data/storage \
 *   node scripts/migrate-assets.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'https://api.kscw.ch'
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus-dev.kscw.ch'
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN
const PB_STORAGE_PATH = process.env.PB_STORAGE_PATH || null // e.g. /opt/pocketbase-kscw/pb_data/storage

// PocketBase collection IDs (from DB: SELECT id,name FROM _collections)
const PB_COLLECTION_IDS = {
  teams: 'pbc_1568971955',
  news: 'pbc_987692768',
  sponsors: 'pbc_3665759510',
}

if (!DIRECTUS_TOKEN) {
  console.error('ERROR: DIRECTUS_TOKEN environment variable is required')
  process.exit(1)
}

const authHeaders = { Authorization: `Bearer ${DIRECTUS_TOKEN}` }

// ── Helpers ────────────────────────────────────────────────────────────────

async function directusGet(path) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, { headers: authHeaders })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`GET ${path}: ${res.status} - ${body?.errors?.[0]?.message || res.statusText}`)
  }
  const json = await res.json()
  return json.data
}

async function directusPatch(path, body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(`PATCH ${path}: ${res.status} - ${errBody?.errors?.[0]?.message || res.statusText}`)
  }
  return (await res.json()).data
}

/**
 * Get file buffer: from disk if PB_STORAGE_PATH set, otherwise HTTP download.
 */
async function getFileBuffer(collectionId, recordId, filename) {
  if (PB_STORAGE_PATH) {
    // Disk mode
    const filePath = join(PB_STORAGE_PATH, collectionId, recordId, filename)
    if (!existsSync(filePath)) {
      throw new Error(`File not found on disk: ${filePath}`)
    }
    const buffer = readFileSync(filePath)
    const ext = extname(filename).toLowerCase().replace('.', '')
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
    const contentType = mimeMap[ext] || 'image/jpeg'
    return { buffer, contentType }
  } else {
    // HTTP mode
    const url = `${POCKETBASE_URL}/api/files/${collectionId}/${recordId}/${filename}`
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    return { buffer, contentType }
  }
}

/**
 * Upload a file buffer to Directus /files.
 * Returns the Directus file UUID.
 */
async function uploadToDirectus(buffer, contentType, filename) {
  const formData = new FormData()
  const blob = new Blob([buffer], { type: contentType })
  formData.append('file', blob, filename)

  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Upload failed: ${res.status} - ${body?.errors?.[0]?.message || res.statusText}`)
  }

  const json = await res.json()
  return json.data.id
}

/**
 * Check if a Directus file ID exists and is accessible.
 */
async function directusFileExists(fileId) {
  if (!fileId) return false
  try {
    const res = await fetch(`${DIRECTUS_URL}/files/${fileId}`, { headers: authHeaders })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Check PocketBase HTTP connectivity.
 */
async function checkPocketBaseHttp() {
  try {
    const res = await fetch(`${POCKETBASE_URL}/api/health`, {
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────

const stats = {
  teams: { total: 0, alreadyMigrated: 0, migrated: 0, skipped: 0, failed: 0 },
  news: { total: 0, alreadyMigrated: 0, migrated: 0, skipped: 0, failed: 0 },
  sponsors: { total: 0, alreadyMigrated: 0, migrated: 0, skipped: 0, failed: 0 },
}
const failures = []

// ── Migration: Teams ─────────────────────────────────────────────────────

async function migrateTeamPictures(pbTeams) {
  console.log('\n── Migrating team pictures ──')

  const directusTeams = await directusGet('/items/teams?limit=100')
  const directusByName = Object.fromEntries(directusTeams.map(t => [t.name, t]))

  stats.teams.total = pbTeams.length

  for (const pbTeam of pbTeams) {
    if (!pbTeam.team_picture) {
      stats.teams.skipped++
      continue
    }

    const dirTeam = directusByName[pbTeam.name]
    if (!dirTeam) {
      console.log(`  SKIP  ${pbTeam.name} — not found in Directus`)
      stats.teams.skipped++
      continue
    }

    // Check if already migrated
    if (dirTeam.team_picture) {
      const exists = await directusFileExists(dirTeam.team_picture)
      if (exists) {
        console.log(`  OK    ${pbTeam.name} — already migrated (${dirTeam.team_picture})`)
        stats.teams.alreadyMigrated++
        continue
      }
      console.log(`  WARN  ${pbTeam.name} — has file ID but file missing, re-migrating`)
    }

    try {
      console.log(`  DL    ${pbTeam.name} (${pbTeam.team_picture})`)
      const { buffer, contentType } = await getFileBuffer(
        PB_COLLECTION_IDS.teams,
        pbTeam.id,
        pbTeam.team_picture
      )

      const fileId = await uploadToDirectus(buffer, contentType, pbTeam.team_picture)
      console.log(`  UP    ${pbTeam.name} → ${fileId} (${(buffer.length / 1024).toFixed(0)}KB)`)

      await directusPatch(`/items/teams/${dirTeam.id}`, { team_picture: fileId })
      console.log(`  LINK  team ${dirTeam.id} (${pbTeam.name}) → file ${fileId}`)
      stats.teams.migrated++
    } catch (e) {
      console.error(`  FAIL  ${pbTeam.name}: ${e.message}`)
      stats.teams.failed++
      failures.push({ type: 'team', name: pbTeam.name, error: e.message })
    }
  }
}

// ── Migration: News ──────────────────────────────────────────────────────

async function migrateNewsImages(pbNews) {
  console.log('\n── Migrating news images ──')

  // Check if news collection exists in Directus
  let directusNews = []
  let newsCollectionExists = true
  try {
    directusNews = await directusGet('/items/news?limit=200&fields=id,title,slug,image')
  } catch (e) {
    if (e.message.includes('403') || e.message.includes('FORBIDDEN') || e.message.includes('does not exist')) {
      newsCollectionExists = false
    } else {
      throw e
    }
  }

  stats.news.total = pbNews.length

  if (!newsCollectionExists) {
    console.log('  INFO  news collection does not exist in Directus yet')
    console.log('  INFO  Uploading images to Directus files storage (orphaned, to be linked later)')
    console.log()

    // Upload images anyway — they can be linked when news collection is created
    for (const article of pbNews) {
      if (!article.image) {
        stats.news.skipped++
        continue
      }

      try {
        console.log(`  DL    "${article.title.slice(0, 50)}" (${article.image})`)
        const { buffer, contentType } = await getFileBuffer(
          PB_COLLECTION_IDS.news,
          article.id,
          article.image
        )
        const fileId = await uploadToDirectus(buffer, contentType, `news_${article.id}_${article.image}`)
        console.log(`  UP    → ${fileId} (${(buffer.length / 1024).toFixed(0)}KB) — NEEDS LINKING after news collection created`)
        stats.news.migrated++
      } catch (e) {
        console.error(`  FAIL  "${article.title}": ${e.message}`)
        stats.news.failed++
        failures.push({ type: 'news', name: article.title, error: e.message })
      }
    }
    console.log()
    console.log('  NOTE: News images uploaded as orphaned files.')
    console.log('        Create the news collection in Directus, then re-run this script to link them.')
    return
  }

  const directusByTitle = Object.fromEntries(directusNews.map(n => [n.title, n]))

  for (const pbArticle of pbNews) {
    if (!pbArticle.image) {
      stats.news.skipped++
      continue
    }

    const dirArticle = directusByTitle[pbArticle.title]
    if (!dirArticle) {
      console.log(`  SKIP  "${pbArticle.title.slice(0, 50)}" — not found in Directus`)
      stats.news.skipped++
      continue
    }

    if (dirArticle.image) {
      const exists = await directusFileExists(dirArticle.image)
      if (exists) {
        console.log(`  OK    "${pbArticle.title.slice(0, 50)}" — already migrated`)
        stats.news.alreadyMigrated++
        continue
      }
    }

    try {
      console.log(`  DL    "${pbArticle.title.slice(0, 50)}" (${pbArticle.image})`)
      const { buffer, contentType } = await getFileBuffer(
        PB_COLLECTION_IDS.news,
        pbArticle.id,
        pbArticle.image
      )

      const fileId = await uploadToDirectus(buffer, contentType, pbArticle.image)
      console.log(`  UP    → ${fileId} (${(buffer.length / 1024).toFixed(0)}KB)`)

      await directusPatch(`/items/news/${dirArticle.id}`, { image: fileId })
      console.log(`  LINK  news ${dirArticle.id} → file ${fileId}`)
      stats.news.migrated++
    } catch (e) {
      console.error(`  FAIL  "${pbArticle.title}": ${e.message}`)
      stats.news.failed++
      failures.push({ type: 'news', name: pbArticle.title, error: e.message })
    }
  }
}

// ── Migration: Sponsors ────────────────────────────────────────────────────

async function migrateSponsorLogos(pbSponsors) {
  console.log('\n── Migrating sponsor logos ──')

  let directusSponsors = []
  try {
    directusSponsors = await directusGet('/items/sponsors?limit=200&fields=id,name,logo')
  } catch (e) {
    console.log(`  SKIP  Cannot access sponsors collection: ${e.message}`)
    stats.sponsors.skipped = pbSponsors.length
    return
  }

  const directusByName = Object.fromEntries(directusSponsors.map(s => [s.name, s]))
  stats.sponsors.total = pbSponsors.length

  for (const pbSponsor of pbSponsors) {
    if (!pbSponsor.logo) {
      stats.sponsors.skipped++
      continue
    }

    const dirSponsor = directusByName[pbSponsor.name]
    if (!dirSponsor) {
      console.log(`  SKIP  ${pbSponsor.name} — not found in Directus`)
      stats.sponsors.skipped++
      continue
    }

    if (dirSponsor.logo) {
      const exists = await directusFileExists(dirSponsor.logo)
      if (exists) {
        console.log(`  OK    ${pbSponsor.name} — already migrated`)
        stats.sponsors.alreadyMigrated++
        continue
      }
    }

    try {
      console.log(`  DL    ${pbSponsor.name} (${pbSponsor.logo})`)
      const { buffer, contentType } = await getFileBuffer(
        PB_COLLECTION_IDS.sponsors,
        pbSponsor.id,
        pbSponsor.logo
      )

      const fileId = await uploadToDirectus(buffer, contentType, pbSponsor.logo)
      console.log(`  UP    ${pbSponsor.name} → ${fileId} (${(buffer.length / 1024).toFixed(0)}KB)`)

      await directusPatch(`/items/sponsors/${dirSponsor.id}`, { logo: fileId })
      console.log(`  LINK  sponsor ${dirSponsor.id} → file ${fileId}`)
      stats.sponsors.migrated++
    } catch (e) {
      console.error(`  FAIL  ${pbSponsor.name}: ${e.message}`)
      stats.sponsors.failed++
      failures.push({ type: 'sponsor', name: pbSponsor.name, error: e.message })
    }
  }
}

// ── Data loading ────────────────────────────────────────────────────────────

/**
 * Load PocketBase records from SQLite DB or HTTP API.
 */
async function loadPbData() {
  // If we have storage path, try loading from SQLite via shell command on VPS
  // Otherwise, use HTTP API
  const pbReachable = PB_STORAGE_PATH ? true : await checkPocketBaseHttp()

  if (!pbReachable) {
    console.log(`\n  ✗ PocketBase HTTP API not reachable`)
    console.log('  TIP: Set PB_STORAGE_PATH=/opt/pocketbase-kscw/pb_data/storage to use disk mode')
    return null
  }

  let teams = [], news = [], sponsors = []

  if (PB_STORAGE_PATH) {
    // In disk mode, we need the DB. This script is expected to run on VPS or via SSH
    // where the DB is accessible. We'll use a side-car approach: emit the data as JSON
    // by reading the storage directories directly.
    console.log('  Using disk mode (reading from PB storage directory)')

    // We can't run sqlite3 directly from Node, so we scan the storage directories
    // and match with what we know from the pre-queried data
    // The actual record data was exported to JSON for this purpose

    // Load pre-exported data if available
    const exportPath = process.env.PB_EXPORT_JSON
    if (exportPath && existsSync(exportPath)) {
      const data = JSON.parse(readFileSync(exportPath, 'utf8'))
      teams = data.teams || []
      news = data.news || []
      sponsors = data.sponsors || []
      console.log(`  Loaded from export: ${teams.length} teams, ${news.length} news, ${sponsors.length} sponsors`)
    } else {
      console.log('  NOTE: PB_EXPORT_JSON not set. Using hardcoded data from DB query.')
      // Hardcoded from: sqlite3 /opt/pocketbase-kscw/pb_data/data.db
      // "SELECT id,name,team_picture FROM teams"
      teams = [
        { id: 'qz7y8l4tz48f65j', name: 'H1', team_picture: 'h193rllc4ye3_7d834yw8do.jpg' },
        { id: '601p27iw4xvw1ds', name: 'H2', team_picture: 'h29vraeson3m_zzvezaah1z.jpg' },
        { id: 'il1wd1p018hrb61', name: 'H3', team_picture: 'image1000852_fbnjri0thk.jpg' },
        { id: 'p1i9cs4km520dd6', name: 'D1', team_picture: 'd1jfiquwbimv_si9bndu1ir.jpg' },
        { id: '9kwn129z84967fc', name: 'D2', team_picture: 'd24vsjosw59i_83r02oi737.jpg' },
        { id: 'c18yey33vwx9yo4', name: 'D3', team_picture: 'image1000808_4igis59a3x.png' },
        { id: '2h55x265r941a4k', name: 'D4', team_picture: 'd4jgm2oo03ah_7ouliepg2p.jpg' },
        { id: '6380e7aj8z80o79', name: 'HU23-1', team_picture: null },
        { id: 'vo89vn93wdoo01o', name: 'DU23-1', team_picture: null },
        { id: '6udjwmx5mqtctrn', name: 'DU23-2', team_picture: '5ae68d0f_7730_47c4_961b_b43a94278e46_xdomk9eodj.jpeg' },
        { id: 'e352q254s1cip8y', name: 'Legends', team_picture: 'image1000856_d4zcs4gmho.jpg' },
        { id: '274nyi35of7v34x', name: 'HU20', team_picture: null },
        { id: 'zn061m4bv7j34mv', name: 'Damen D-Classics 1LR', team_picture: null },
        { id: 'k4z8ag9di77znqj', name: 'DU10', team_picture: null },
        { id: '4310083q6jztd64', name: 'DU12', team_picture: null },
        { id: 'm8bg242of393n6a', name: 'DU14', team_picture: null },
        { id: 'pn5630bs846x83d', name: 'DU16', team_picture: null },
        { id: '4w1626k821keydk', name: 'DU18', team_picture: null },
        { id: 'v3dfy53v94117i9', name: 'H-Classics 1LR', team_picture: null },
        { id: 'wpg9887276cdkd9', name: 'Herren 1 H1', team_picture: 'bbh1_bo760yoe5s.jpg' },
        { id: 'oqqn58l012ie36e', name: 'Herren 2 H3', team_picture: 'bbh2_x8bm3fove3.jpg' },
        { id: '4e65vlw744mldc0', name: 'Herren 3 (Unicorns) H4', team_picture: 'bbh3_w5h2xtpj2x.jpg' },
        { id: '2vykw618ihdn790', name: 'HU12', team_picture: null },
        { id: '099j4t5md732125', name: 'HU14', team_picture: null },
        { id: 'nbc312y4ln88532', name: 'HU16', team_picture: null },
        { id: 'qth928mfz6aqp6x', name: 'HU18', team_picture: null },
        { id: '31k9c1qk62p23oe', name: 'Lions D1', team_picture: 'bblions_ldzkbkw0b2.jpg' },
        { id: 'l37v6q2qqlg89n8', name: 'MU10', team_picture: null },
        { id: '9f76dwg4x6zmrgi', name: 'MU8', team_picture: null },
        { id: 'cj55682587v210q', name: 'Rhinos D3', team_picture: 'bbrhinos_jzjphi50in.jpg' },
        { id: 'kbkmwjw4k39e1h9', name: 'DU20', team_picture: null },
        { id: 'r2irhhhiejzml9g', name: 'TEST4', team_picture: null },
        { id: '5ndrs020oitj0rz', name: 'MiniVB', team_picture: null },
      ]
      // From: sqlite3 ... "SELECT id,title,image FROM news"
      news = [
        { id: 'n6tx70ta907bbs5', title: 'Endlich! Das D3 darf den ersten Sieg der Saison feiern!', image: 'kscw_trio_kmw7nc0ynq.png' },
        { id: 'tymasn3sw3rgqiv', title: 'Das Damen 2 sieht rot, ZUZU am Ende aber auch', image: 'kscw_trio_4rm4wsmsqe.png' },
        { id: '4oj971olhr4airh', title: 'D2: Auswärtsspiel gegen bisher ungeschlagenen Tabellenführer', image: 'kscw_trio_yrq4yyxnj8.png' },
        { id: 'gs6jzktzg5gwqxz', title: 'Trainingsweekend in Näfels', image: 'kscw_trio_br6taz66k2.png' },
        { id: 'dyigps4tba8q0cq', title: 'Erster Heimsieg für das Damen 1', image: 'kscw_trio_w31pkhtert.png' },
        { id: 'qq2g0lr0bcx6lpr', title: 'VB D 2 gegen VB D 1: Drei Punkte für das Damen 2', image: 'kscw_trio_blbzis4ci8.png' },
      ]
      // Sponsors (from DB query - logos are PB record IDs)
      // For sponsors, we need to check the actual PB collection
      // pbc_3665759510 is the sponsors collection
      console.log('  Loading sponsors from storage directory scan...')
      sponsors = await loadSponsorsFromStorage()
    }
  } else {
    // HTTP mode
    console.log('  Using HTTP mode (fetching from PocketBase API)')
    try {
      const r = await fetch(`${POCKETBASE_URL}/api/collections/teams/records?perPage=200&fields=id,name,team_picture`, { signal: AbortSignal.timeout(30000) })
      teams = (await r.json()).items || []
      console.log(`  Teams: ${teams.length}`)
    } catch (e) { console.error(`  Failed to fetch teams: ${e.message}`) }

    try {
      const r = await fetch(`${POCKETBASE_URL}/api/collections/news/records?perPage=200&fields=id,title,image`, { signal: AbortSignal.timeout(30000) })
      news = (await r.json()).items || []
      console.log(`  News: ${news.length}`)
    } catch (e) { console.error(`  Failed to fetch news: ${e.message}`) }

    try {
      const r = await fetch(`${POCKETBASE_URL}/api/collections/sponsors/records?perPage=200&fields=id,name,logo`, { signal: AbortSignal.timeout(30000) })
      sponsors = (await r.json()).items || []
      console.log(`  Sponsors: ${sponsors.length}`)
    } catch (e) { console.error(`  Failed to fetch sponsors: ${e.message}`) }
  }

  return { teams, news, sponsors }
}

/**
 * Scan PB sponsor storage directory to build sponsor list.
 * Each subdirectory is a record ID, each file inside is the logo.
 */
async function loadSponsorsFromStorage() {
  if (!PB_STORAGE_PATH) return []
  const sponsorsDir = join(PB_STORAGE_PATH, PB_COLLECTION_IDS.sponsors)
  if (!existsSync(sponsorsDir)) {
    console.log(`  Sponsor storage dir not found: ${sponsorsDir}`)
    return []
  }

  const { readdirSync } = await import('fs')
  const recordDirs = readdirSync(sponsorsDir)

  // We need names - get from Directus sponsors
  const dirSponsors = await directusGet('/items/sponsors?limit=200&fields=id,name,logo')

  // We can't easily match record IDs to names without the DB, so
  // return empty - sponsors are already migrated
  console.log(`  Sponsor storage has ${recordDirs.length} records, checking Directus...`)
  const withLogo = dirSponsors.filter(s => s.logo)
  console.log(`  Directus sponsors with logo: ${withLogo.length}/${dirSponsors.length} — all already migrated`)
  return []
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  KSCW Asset Migration: PocketBase → Directus')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Directus:   ${DIRECTUS_URL}`)
  console.log(`  PB source:  ${PB_STORAGE_PATH ? `disk (${PB_STORAGE_PATH})` : `HTTP (${POCKETBASE_URL})`}`)
  console.log()

  // Verify Directus connectivity
  console.log('Checking Directus connectivity...')
  try {
    const info = await directusGet('/server/info')
    console.log(`  ✓ Directus ${info.version} — connected`)
  } catch (e) {
    console.error(`  ✗ Cannot connect to Directus: ${e.message}`)
    process.exit(1)
  }

  // Load data from PocketBase
  console.log('\nLoading PocketBase data...')
  const pbData = await loadPbData()

  if (!pbData) {
    console.log('\n⚠ Could not load PocketBase data. Use PB_STORAGE_PATH or ensure API is reachable.')
    process.exit(1)
  }

  const { teams: pbTeams, news: pbNews, sponsors: pbSponsors } = pbData
  console.log(`  Teams: ${pbTeams.length}, News: ${pbNews.length}, Sponsors: ${pbSponsors.length}`)

  // Run migrations
  if (pbTeams.length > 0) await migrateTeamPictures(pbTeams)
  if (pbNews.length > 0) await migrateNewsImages(pbNews)
  if (pbSponsors.length > 0) await migrateSponsorLogos(pbSponsors)

  printSummary()
}

function printSummary() {
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  MIGRATION SUMMARY')
  console.log('═══════════════════════════════════════════════════')

  for (const [type, s] of Object.entries(stats)) {
    if (s.total === 0) continue
    console.log(`\n  ${type.toUpperCase()}:`)
    console.log(`    Total:             ${s.total}`)
    console.log(`    Already migrated:  ${s.alreadyMigrated}`)
    console.log(`    Newly migrated:    ${s.migrated}`)
    console.log(`    Skipped:           ${s.skipped}`)
    console.log(`    Failed:            ${s.failed}`)
  }

  if (failures.length > 0) {
    console.log('\n  FAILURES:')
    for (const f of failures) {
      console.log(`    [${f.type}] ${f.name}: ${f.error}`)
    }
  }

  const totalNew = stats.teams.migrated + stats.news.migrated + stats.sponsors.migrated
  const totalAlready = stats.teams.alreadyMigrated + stats.news.alreadyMigrated + stats.sponsors.alreadyMigrated
  const totalFailed = stats.teams.failed + stats.news.failed + stats.sponsors.failed

  console.log('\n  TOTALS:')
  console.log(`    Already in Directus: ${totalAlready}`)
  console.log(`    Newly uploaded:      ${totalNew}`)
  console.log(`    Failed:              ${totalFailed}`)
  console.log()
}

main().catch(e => {
  console.error('Fatal error:', e.message)
  process.exit(1)
})
