// ── update-niches-and-videos.js ───────────────────────────────
// Run: node scripts/update-niches-and-videos.js
// Requires: @supabase/supabase-js, dotenv

import 'dotenv/config';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// load .env.local manually since dotenv/config only reads .env
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// ── Niche mapping from spreadsheet categories to current niche options ──
const NICHE_MAP = {
  'Beauty & Skincare':     ['Skincare'],
  'Fashion & Style':       ['Fashion'],
  'Fitness & Wellness':    ['Fitness', 'Wellness'],
  'Home & Lifestyle':      ['Lifestyle'],
  'Lifestyle':             ['Lifestyle'],
  'UGC / Product Demos':   ['UGC'],
  'UGC Ads':               ['UGC'],
  'Tech & Gadgets':        ['Tech'],
  'Food & Cooking':        ['Food'],
  'Travel & Outdoors':     ['Travel'],
  'Unboxing':              ['Unboxing'],
  'Comedy & Skits':        [],   // skip
  'Hair':                  ['Hair'],
  'Makeup':                ['Makeup'],
  'Nails':                 ['Nails'],
  'Skincare':              ['Skincare'],
};

// ── Source of truth: handle → niches from your spreadsheet ──
const SPREADSHEET_DATA = [
  { handle: 'ayushisingh.png',    niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle', 'UGC / Product Demos'] },
  { handle: 'aaryahibarde',       niches: ['Beauty & Skincare', 'Fashion & Style', 'Home & Lifestyle', 'Lifestyle'] },
  { handle: 'aadrikaa_acharya',   niches: ['Beauty & Skincare', 'Fashion & Style', 'Tech & Gadgets', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'gurnoorkaursethi08', niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle', 'Travel & Outdoors'] },
  { handle: '_sagewithcurls_',    niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'glowcheck_with_k',   niches: ['Beauty & Skincare', 'Fashion & Style', 'Home & Lifestyle'] },
  { handle: '_akanksha.x_',       niches: ['Beauty & Skincare', 'Fashion & Style', 'Food & Cooking', 'Home & Lifestyle', 'Lifestyle', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'allabout.astha',     niches: ['Beauty & Skincare', 'Fashion & Style', 'Home & Lifestyle', 'Lifestyle', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'negarmansuri_',      niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle', 'UGC / Product Demos'] },
  { handle: '__.riddhiimaa._',    niches: ['Beauty & Skincare', 'Fashion & Style', 'Travel & Outdoors', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'barely_aditi',       niches: ['Beauty & Skincare', 'Fashion & Style', 'Tech & Gadgets', 'UGC / Product Demos', 'Unboxing', 'Lifestyle'] },
  { handle: 'gunchachhibber',     niches: ['Beauty & Skincare', 'Fashion & Style'] },
  { handle: '__.bhargabikalita',  niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness', 'UGC / Product Demos'] },
  { handle: 'kanupriya.sharmaa',  niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: 'batchu_aishwarya',   niches: ['Beauty & Skincare', 'Fashion & Style', 'Food & Cooking', 'Lifestyle', 'UGC / Product Demos'] },
  { handle: '_fathima.noor_',     niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: '_.aparnaforsure._',  niches: ['Fashion & Style', 'Beauty & Skincare', 'Fitness & Wellness', 'Travel & Outdoors', 'UGC / Product Demos', 'Unboxing', 'Lifestyle', 'Tech & Gadgets'] },
  { handle: 'ektakumar_',         niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness', 'Travel & Outdoors', 'Lifestyle', 'UGC / Product Demos'] },
  { handle: '_aayushirawat_',     niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'megadrip__',         niches: ['Beauty & Skincare', 'Fashion & Style', 'Home & Lifestyle', 'Travel & Outdoors', 'UGC / Product Demos', 'Unboxing', 'Lifestyle'] },
  { handle: 'nandinii._.04',      niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: 'ridhichaudhary20_',  niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: 'khushi.santuka',     niches: ['Beauty & Skincare', 'Fashion & Style', 'Food & Cooking', 'Home & Lifestyle', 'Travel & Outdoors', 'UGC / Product Demos', 'Lifestyle', 'Unboxing'] },
  { handle: '_imrunjun_',         niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle', 'Unboxing'] },
  { handle: 'remsandhu',          niches: ['Beauty & Skincare', 'Fashion & Style', 'Home & Lifestyle', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: '___kashish',         niches: ['Beauty & Skincare'] },
  { handle: 'muskangupta13',      niches: ['Fashion & Style', 'Beauty & Skincare', 'Lifestyle'] },
  { handle: 'rhhytthhmm',         niches: ['Lifestyle', 'UGC / Product Demos', 'Unboxing', 'Fashion & Style', 'Beauty & Skincare'] },
  { handle: 'nehasadhwani_',      niches: ['Beauty & Skincare', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: 'simpllypearll',      niches: ['Beauty & Skincare', 'Fashion & Style'] },
  { handle: 'hasikhushie',        niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: '__taraaaaaa_',       niches: ['Lifestyle', 'UGC / Product Demos', 'Fashion & Style', 'Beauty & Skincare'] },
  { handle: 'shashanki_rawat',    niches: ['Beauty & Skincare'] },
  { handle: 'nishitachaubey',     niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness'] },
  { handle: 'yashika_vermaaa',    niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness', 'Food & Cooking', 'Home & Lifestyle', 'UGC / Product Demos', 'Unboxing', 'Lifestyle', 'Travel & Outdoors'] },
  { handle: 'affec.tion__',       niches: ['Lifestyle', 'UGC / Product Demos', 'Home & Lifestyle', 'Fashion & Style', 'Beauty & Skincare'] },
  { handle: 'thatobstinatemess',  niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos', 'Unboxing', 'Lifestyle'] },
  { handle: 'arpitaaa.mahajan',   niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle', 'UGC / Product Demos'] },
  { handle: 'yushii_ka',          niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos'] },
  { handle: 'kanchanthiside',     niches: ['Beauty & Skincare', 'Fashion & Style', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: 'jewel_lopes',        niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle'] },
  { handle: 'thisissuryaja',      niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness', 'Food & Cooking', 'Home & Lifestyle', 'Lifestyle', 'Travel & Outdoors', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'daydreamingclubb',   niches: ['Beauty & Skincare', 'Fashion & Style', 'Unboxing'] },
  { handle: 'adedokunadeoniye',   niches: ['Unboxing', 'Beauty & Skincare', 'UGC / Product Demos'] },
  { handle: 'ipshita_07__',       niches: ['Beauty & Skincare', 'Fashion & Style', 'Fitness & Wellness', 'Food & Cooking', 'Home & Lifestyle', 'Lifestyle', 'Tech & Gadgets', 'Travel & Outdoors', 'UGC / Product Demos', 'Unboxing'] },
  { handle: 'vimidssilva',        niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle'] },
  { handle: 'mahiig_23',          niches: ['Fashion & Style', 'Beauty & Skincare', 'Home & Lifestyle', 'Travel & Outdoors', 'UGC / Product Demos', 'Lifestyle'] },
  { handle: 'sumeedhhaa',         niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle'] },
  { handle: 'maanikakhawan',      niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle'] },
  { handle: 'shreyay_singh',      niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle'] },
  { handle: 'rishika.jain17',     niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle'] },
  { handle: 'punanyamehta',       niches: ['Beauty & Skincare', 'Fashion & Style', 'Lifestyle'] },
  { handle: 'ugcwithshiw',        niches: ['Tech & Gadgets', 'Fitness & Wellness', 'UGC / Product Demos'] },
  { handle: 'rodriguez1609_',     niches: ['Beauty & Skincare', 'Home & Lifestyle', 'Unboxing', 'Lifestyle', 'UGC / Product Demos', 'Tech & Gadgets'] },
];

// ── 17 Reel URLs to replace (in order given by the user) ──
const REEL_URLS = [
  'https://www.instagram.com/reel/DYoZSn3tOgu/',
  'https://www.instagram.com/reel/DX9nUd-t7o7/',
  'https://www.instagram.com/reel/DQ7NvoAEvuW/',
  'https://www.instagram.com/reel/DZriwzntSep/',
  'https://www.instagram.com/reel/DYe59o2hJa2/',
  'https://www.instagram.com/reel/DVNzOZ4Dect/',
  'https://www.instagram.com/reel/DZUZqmsMgnt/',
  'https://www.instagram.com/reel/DYxJxLOTCkX/',
  'https://www.instagram.com/reel/DX_034dhmMZ/',
  'https://www.instagram.com/reel/DYUabIXK6mM/',
  'https://www.instagram.com/reel/DUk-p8djJvS/',
  'https://www.instagram.com/reel/DZkeG0ayAh4/',
  'https://www.instagram.com/reel/DZ2aThoPyks/',
  'https://www.instagram.com/reel/DZxBlVAJ0ar/',
  'https://www.instagram.com/reel/DV_RWI4EdTN/',
  'https://www.instagram.com/reel/DYcV9NfsFmB/',
  'https://www.instagram.com/reel/DXesO1PEZGg/',
];

function mapNiches(rawNiches) {
  const result = new Set();
  for (const raw of rawNiches) {
    const mapped = NICHE_MAP[raw.trim()];
    if (mapped) mapped.forEach(n => result.add(n));
  }
  return Array.from(result);
}

async function getReelOwner(reelUrl) {
  const rapidKey = process.env.VITE_RAPID_API_KEY;
  if (!rapidKey) return null;
  try {
    const res = await fetch(
      `https://instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com/convert?url=${encodeURIComponent(reelUrl)}`,
      {
        headers: {
          'x-rapidapi-key': rapidKey,
          'x-rapidapi-host': 'instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com',
        },
      }
    );
    const data = await res.json();
    return {
      username: data?.username || data?.owner?.username || data?.data?.owner?.username || null,
      videoUrl: data?.url || data?.video_url || data?.data?.video_url || null,
      thumbnail: data?.thumbnail || data?.data?.thumbnail_url || null,
    };
  } catch (e) {
    console.warn(`  ⚠ Could not process ${reelUrl}:`, e.message);
    return null;
  }
}

async function run() {
  // 1. Load current creators
  const timestamp = Date.now();
  const { data: blob, error } = await supabase.storage
    .from('creator-data')
    .download(`creators.json?t=${timestamp}`);
  if (error) { console.error('Failed to load creators:', error); process.exit(1); }
  const creators = JSON.parse(await blob.text());
  console.log(`\n📋 Loaded ${creators.length} creators from database\n`);

  // 2. Update niches from spreadsheet
  let nicheUpdates = 0;
  const notInSpreadsheet = [];
  
  for (const creator of creators) {
    const handle = (creator.handle || '').toLowerCase().replace(/^@/, '');
    const match = SPREADSHEET_DATA.find(s =>
      s.handle.toLowerCase() === handle
    );
    if (match) {
      const newNiches = mapNiches(match.niches);
      if (newNiches.length > 0) {
        creator.niches = newNiches;
        nicheUpdates++;
      }
    } else {
      notInSpreadsheet.push({ name: creator.name, handle: creator.handle });
    }
  }

  console.log(`✅ Updated niches for ${nicheUpdates} creators\n`);
  console.log('⚠️  Creators NOT found in your spreadsheet (niches unchanged):');
  notInSpreadsheet.forEach(c => console.log(`   - ${c.name} (@${c.handle || 'no handle'})`));

  // 3. Process reel URLs and assign to matching creators
  console.log('\n🎬 Processing 17 reel URLs via RapidAPI...\n');
  let reelUpdates = 0;
  const unmatchedReels = [];

  for (const reelUrl of REEL_URLS) {
    console.log(`  Processing: ${reelUrl}`);
    const info = await getReelOwner(reelUrl);
    if (!info) { unmatchedReels.push(reelUrl); continue; }
    
    const { username, videoUrl } = info;
    console.log(`    → Owner: @${username || 'unknown'}, Video URL: ${videoUrl ? 'found' : 'missing'}`);
    
    if (!username || !videoUrl) { unmatchedReels.push(reelUrl); continue; }
    
    // Find creator by handle
    const creator = creators.find(c =>
      (c.handle || '').toLowerCase() === username.toLowerCase()
    );
    if (!creator) {
      console.log(`    ⚠ No creator found with handle @${username}`);
      unmatchedReels.push(reelUrl);
      continue;
    }
    
    // Replace first reel's videoUrl with this Instagram URL
    if (!creator.reels) creator.reels = [];
    if (creator.reels.length > 0) {
      creator.reels[0] = { ...creator.reels[0], videoUrl: reelUrl, thumbnailUrl: info.thumbnail || creator.reels[0].thumbnailUrl };
    } else {
      creator.reels = [{ id: `reel_${Date.now()}_0`, label: 'Demo Reel', videoUrl: reelUrl, thumbnailUrl: info.thumbnail }];
    }
    console.log(`    ✅ Updated reel for ${creator.name} (@${creator.handle})`);
    reelUpdates++;
    
    await new Promise(r => setTimeout(r, 500)); // rate limit
  }

  console.log(`\n✅ Updated reels for ${reelUpdates} creators`);
  if (unmatchedReels.length) {
    console.log(`\n⚠️  Could not auto-assign these ${unmatchedReels.length} reels (unknown owner):`)
    unmatchedReels.forEach(u => console.log(`   - ${u}`));
  }

  // 4. Save everything back to Supabase
  console.log('\n💾 Saving to Supabase...');
  const { error: saveError } = await supabase.storage
    .from('creator-data')
    .upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true });
  
  if (saveError) {
    console.error('❌ Save failed:', saveError);
  } else {
    console.log('✅ All changes saved to Supabase!\n');
  }
}

run().catch(console.error);
