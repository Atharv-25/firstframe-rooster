#!/usr/bin/env node
/**
 * Add creators from a Google Sheets / Excel export, videos and all.
 *
 *   node scripts/add_creators.mjs scripts/incoming/<file>.tsv           # dry run
 *   node scripts/add_creators.mjs scripts/incoming/<file>.tsv --apply   # do it
 *
 * For every new creator it will:
 *   1. normalise the row (handle out of a messy IG link, "8.2k" -> 8.2K, niches)
 *   2. skip anyone already in creators.json (matched on handle)
 *   3. resolve their Demo Reel Link to a real .mp4 via RapidAPI
 *   4. download it, re-encode to 720p, and write public/videos/<handle>.mp4
 *   5. grab a poster frame into public/covers/<handle>.jpg
 *   6. append the creator to src/app/data/creators.json
 *
 * Videos are deliberately kept as ordinary files under public/ so they ship
 * with the Vercel build -- see .gitattributes for why they are not in LFS.
 *
 * Flags:
 *   --apply          write files and creators.json (otherwise dry run)
 *   --no-video       add the creators but skip all downloading/encoding
 *   --limit=N        only process the first N new creators (handy for testing)
 *   --retry-missing  ignore the input file; instead re-attempt the video for
 *                    creators already in creators.json that have no reel.
 *                    Use this after transient API failures.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CREATORS = path.join(ROOT, 'src/app/data/creators.json');
const VIDEOS = path.join(ROOT, 'public/videos');
const COVERS = path.join(ROOT, 'public/covers');

const args = process.argv.slice(2);
const INPUT = args.find(a => !a.startsWith('--'));
const APPLY = args.includes('--apply');
const NO_VIDEO = args.includes('--no-video');
const RETRY_MISSING = args.includes('--retry-missing');
const LIMIT = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;

if (!INPUT && !RETRY_MISSING) {
  console.error('Usage: node scripts/add_creators.mjs <file.tsv|csv> [--apply] [--no-video] [--limit=N]');
  console.error('   or: node scripts/add_creators.mjs --retry-missing [--apply]');
  process.exit(1);
}

/* ── env ─────────────────────────────────────────────────────────── */

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const clean = line.replace(/ /g, '').trim();
  const i = clean.indexOf('=');
  if (i > 0) env[clean.slice(0, i).trim()] = clean.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const RAPID_KEY = env.VITE_RAPID_API_KEY;
const RAPID_HOST = 'instagram-looter2.p.rapidapi.com';

function findFfmpeg() {
  const candidates = [
    'ffmpeg',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe'),
  ];
  for (const c of candidates) {
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch { /* keep looking */ }
  }
  return null;
}
const FFMPEG = NO_VIDEO ? null : findFfmpeg();

/* ── parsing ─────────────────────────────────────────────────────── */

function parseDelimited(text) {
  const delim = text.slice(0, text.indexOf('\n')).includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

const COLUMNS = {
  name: /^name$/i, email: /^e-?mail$/i, phone: /^phone/i, city: /^(city|location)$/i,
  instagram: /instagram/i, followers: /follower/i, reel: /(demo|reel)/i,
  niche: /^niche/i, rate: /charge|rate|price/i,
};

function mapHeaders(header) {
  const idx = {};
  for (const [key, re] of Object.entries(COLUMNS)) {
    const found = header.findIndex((h, i) => re.test(h.trim()) && !Object.values(idx).includes(i));
    if (found !== -1) idx[key] = found;
  }
  return idx;
}

/* ── normalisers ─────────────────────────────────────────────────── */

const unwrapRedirect = (url) => {
  const m = url.match(/[?&]q=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : url;
};

const POST_PATHS = ['reel', 'reels', 'p', 'stories', 'tv', 'explore'];

function extractHandle(url) {
  if (!url || !url.trim()) return null;
  const m = unwrapRedirect(url.trim()).match(/instagram\.com\/([^/?#\s]+)/i);
  if (!m) return null;
  const h = m[1].replace(/^@/, '');
  return POST_PATHS.includes(h.toLowerCase()) ? null : h;
}

/** Pull the shortcode out of a /reel/<code>/ or /p/<code>/ link. */
function extractShortcode(url) {
  if (!url) return null;
  const m = unwrapRedirect(url.trim()).match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

function parseFollowersRaw(raw) {
  if (!raw) return 0;
  const m = raw.trim().replace(/,/g, '').match(/^([\d.]+)\s*([kKmM]?)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * (m[2].toLowerCase() === 'k' ? 1000 : m[2].toLowerCase() === 'm' ? 1e6 : 1));
}

/** creators.json stores followers as a display string like "1.2K". */
function formatFollowers(n) {
  if (!n) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// The sheet uses loose tags; creators.json uses a fixed vocabulary.
const NICHE_MAP = {
  beauty: 'Beauty & Skincare', skincare: 'Skincare', fashion: 'Fashion & Style',
  lifestyle: 'Lifestyle', ugc: 'UGC / Product Demos', unboxing: 'Unboxing',
  food: 'Food & Cooking', tech: 'Tech & Gadgets', travel: 'Travel & Outdoors',
  fitness: 'Fitness & Wellness', makeup: 'Makeup', hair: 'Hair', nails: 'Nails',
  wellness: 'Wellness', finance: 'Finance', comedy: 'Comedy & Skits',
};

function parseNiches(raw) {
  if (!raw) return [];
  const out = [];
  for (const part of raw.split(/[,/|]/)) {
    const key = part.trim().toLowerCase();
    if (!key) continue;
    const mapped = NICHE_MAP[key] || (part.trim()[0].toUpperCase() + part.trim().slice(1));
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}

/* ── instagram → mp4 ─────────────────────────────────────────────── */

async function rapid(pathname) {
  const r = await fetch(`https://${RAPID_HOST}${pathname}`, {
    headers: { 'x-rapidapi-key': RAPID_KEY, 'x-rapidapi-host': RAPID_HOST },
  });
  if (!r.ok) throw new Error(`RapidAPI HTTP ${r.status}`);
  return r.json();
}

function deepFindVideoUrl(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (typeof node === 'object') {
    if (typeof node.video_url === 'string') return node.video_url;
    for (const v of Array.isArray(node) ? node : Object.values(node)) {
      const hit = deepFindVideoUrl(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** Resolve a reel permalink to a direct .mp4, falling back to the creator's latest video. */
async function resolveVideo({ shortcode, handle }) {
  if (shortcode) {
    try {
      const data = await rapid(`/post?url=https://www.instagram.com/reel/${shortcode}/`);
      const url = deepFindVideoUrl(data);
      if (url) return { url: url.replace(/\\u0026/g, '&'), source: `reel ${shortcode}` };
    } catch (e) { /* fall through to the profile lookup */ }
  }
  if (handle) {
    const data = await rapid(`/profile?username=${encodeURIComponent(handle)}`);
    const edges = data?.edge_owner_to_timeline_media?.edges || [];
    const vid = edges.find(e => e?.node?.is_video);
    if (vid) return { url: (vid.node.video_url || '').replace(/\\u0026/g, '&'), source: 'latest post' };
  }
  return null;
}

async function download(url, dest) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.instagram.com/' } });
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

function encode(src, dest) {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src,
    '-vf', "scale=-2:'min(720,ih)'", '-c:v', 'libx264', '-profile:v', 'main',
    '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '28',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', dest]);
}

function poster(src, dest) {
  try {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '1', '-i', src,
      '-frames:v', '1', '-vf', 'scale=-2:640', '-q:v', '4', dest]);
  } catch {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src,
      '-frames:v', '1', '-vf', 'scale=-2:640', '-q:v', '4', dest]);
  }
}

/* ── main ────────────────────────────────────────────────────────── */

/* ── retry mode: re-attempt videos for creators already on the roster ── */

if (RETRY_MISSING) {
  const roster = JSON.parse(fs.readFileSync(CREATORS, 'utf8'));
  const targets = roster.filter(c => c.handle && (!c.reels || c.reels.length === 0));
  console.log(`\ncreators on roster: ${roster.length}   missing a video: ${targets.length}`);
  for (const t of targets) console.log(`    @${t.handle}`);

  if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply.'); process.exit(0); }
  if (!FFMPEG) { console.error('\nffmpeg not found.'); process.exit(1); }
  for (const d of [VIDEOS, COVERS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-reel-'));
  let recovered = 0;
  const still = [];

  for (const [i, c] of targets.slice(0, LIMIT).entries()) {
    process.stdout.write(`[${i + 1}/${Math.min(targets.length, LIMIT)}] @${c.handle} `);
    try {
      const found = await resolveVideo({ handle: c.handle, shortcode: null });
      if (!found?.url) throw new Error('no video found');
      const raw = path.join(tmp, c.handle + '.raw.mp4');
      await download(found.url, raw);
      const out = path.join(VIDEOS, c.handle + '.mp4');
      encode(raw, out);
      poster(out, path.join(COVERS, c.handle + '.jpg'));
      fs.unlinkSync(raw);
      c.reels = [{ id: `reel_${c.handle}`, label: 'Demo Reel', videoUrl: c.handle + '.mp4', coverUrl: `/covers/${c.handle}.jpg` }];
      recovered++;
      console.log(`✓ ${found.source} → ${(fs.statSync(out).size / 1048576).toFixed(1)}MB`);
    } catch (e) {
      still.push(`@${c.handle}: ${e.message}`);
      console.log(`✗ ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 900));
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(CREATORS, JSON.stringify(roster, null, 2), 'utf8');
  console.log(`\nrecovered ${recovered} of ${targets.length}.`);
  if (still.length) {
    console.log(`\nstill without a video (likely private, or no video posts):`);
    for (const s of still) console.log('    ' + s);
  }
  process.exit(0);
}

const rows = parseDelimited(fs.readFileSync(INPUT, 'utf8'));
const header = rows.shift();
const idx = mapHeaders(header);
if (idx.name === undefined || idx.instagram === undefined) {
  console.error(`Need at least a Name and an Instagram column. Saw: ${header.join(' | ')}`);
  process.exit(1);
}

const creators = JSON.parse(fs.readFileSync(CREATORS, 'utf8'));
const known = new Set(creators.map(c => (c.handle || '').toLowerCase()).filter(Boolean));
const seen = new Set();
const cell = (row, key) => (idx[key] !== undefined ? (row[idx[key]] ?? '').trim() : '');

const queue = [];
const skipped = { already_on_roster: [], duplicate_in_file: [], no_handle: [], junk: [] };

for (const row of rows) {
  const name = cell(row, 'name');
  if (!name) continue;

  const values = row.map(v => v.trim()).filter(Boolean);
  if (values.length > 3 && new Set(values).size <= 2) { skipped.junk.push(name); continue; }

  const handle = extractHandle(cell(row, 'instagram'));
  if (!handle) {
    skipped.no_handle.push(`${name} — ${cell(row, 'instagram').trim() ? 'post link, not a profile' : 'no Instagram link'}`);
    continue;
  }
  const key = handle.toLowerCase();
  if (known.has(key)) { skipped.already_on_roster.push(`${name} (@${handle})`); continue; }
  if (seen.has(key)) { skipped.duplicate_in_file.push(`${name} (@${handle})`); continue; }
  seen.add(key);

  queue.push({
    name, handle,
    followers: parseFollowersRaw(cell(row, 'followers')),
    niches: parseNiches(cell(row, 'niche')),
    reelLink: cell(row, 'reel'),
    shortcode: extractShortcode(cell(row, 'reel')),
  });
}

console.log(`\nrows: ${rows.length}   new creators: ${queue.length}`);
for (const [why, list] of Object.entries(skipped)) {
  if (!list.length) continue;
  console.log(`\nskipped — ${why.replace(/_/g, ' ')} (${list.length}):`);
  for (const s of list) console.log(`    ${s}`);
}
const withReel = queue.filter(q => q.shortcode).length;
console.log(`\n${withReel}/${queue.length} have a usable reel link; the rest fall back to their latest video post.`);

if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply.'); process.exit(0); }
if (!NO_VIDEO && !FFMPEG) { console.error('\nffmpeg not found. Install it, or re-run with --no-video.'); process.exit(1); }

for (const d of [VIDEOS, COVERS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const tmpDir = fs.mkdtempSync(path.join(ROOT, '.tmp-reel-'));
let added = 0, withVideo = 0;
const failures = [];

for (const [i, c] of queue.slice(0, LIMIT).entries()) {
  process.stdout.write(`[${i + 1}/${Math.min(queue.length, LIMIT)}] @${c.handle} `);
  let videoFile = null;

  if (!NO_VIDEO) {
    try {
      const found = await resolveVideo(c);
      if (!found?.url) throw new Error('no video found');
      const raw = path.join(tmpDir, c.handle + '.raw.mp4');
      await download(found.url, raw);
      const out = path.join(VIDEOS, c.handle + '.mp4');
      encode(raw, out);
      poster(out, path.join(COVERS, c.handle + '.jpg'));
      fs.unlinkSync(raw);
      videoFile = c.handle + '.mp4';
      withVideo++;
      console.log(`✓ ${found.source} → ${(fs.statSync(out).size / 1048576).toFixed(1)}MB`);
    } catch (e) {
      failures.push(`@${c.handle}: ${e.message}`);
      console.log(`✗ ${e.message} (added without video)`);
    }
    await new Promise(r => setTimeout(r, 700)); // be gentle with the API
  } else {
    console.log('(skipped video)');
  }

  creators.push({
    id: `creator_${Date.now()}_${Math.floor(Math.random() * 90000 + 10000)}`,
    name: c.name,
    handle: c.handle,
    profileUrl: `https://www.instagram.com/${c.handle}/`,
    followers: formatFollowers(c.followers),
    avgViews: '—',
    niches: c.niches,
    reels: videoFile
      ? [{ id: `reel_${c.handle}`, label: 'Demo Reel', videoUrl: videoFile, coverUrl: `/covers/${c.handle}.jpg` }]
      : [],
  });
  added++;
}

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.writeFileSync(CREATORS, JSON.stringify(creators, null, 2), 'utf8');

console.log(`\nadded ${added} creators (${withVideo} with video). creators.json now has ${creators.length}.`);
if (failures.length) {
  console.log(`\n${failures.length} without video. Retry them with:`);
  console.log('    node scripts/add_creators.mjs --retry-missing --apply\n');
  for (const f of failures) console.log('    ' + f);
}
