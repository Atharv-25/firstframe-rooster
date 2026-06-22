import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function parseTSV(tsv) {
  let rows = [];
  let cols = [];
  let cur = '';
  let inQuote = false;
  for(let i=0; i<tsv.length; i++) {
    let char = tsv[i];
    if (inQuote) {
      if (char === '"') {
        if (tsv[i+1] === '"') { cur += '"'; i++; }
        else { inQuote = false; }
      } else { cur += char; }
    } else {
      if (char === '"') { inQuote = true; }
      else if (char === '\t') { cols.push(cur.trim()); cur = ''; }
      else if (char === '\n') { cols.push(cur.trim()); rows.push(cols); cols = []; cur = ''; }
      else if (char === '\r') { /* ignore */ }
      else { cur += char; }
    }
  }
  if (cols.length > 0 || cur !== '') { cols.push(cur.trim()); rows.push(cols); }
  return rows;
}

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return await res.json();
    } catch (e) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  return null;
}

async function run() {
  console.log('Downloading creators.json...');
  const { data: blob, error: downloadError } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (downloadError) { console.error("Failed to download creators.json:", downloadError); return; }
  
  let creators = JSON.parse(await blob.text());
  
  const tsvData = await fs.readFile(path.join(process.cwd(), 'scripts', 'new_creators.tsv'), 'utf-8');
  const lines = parseTSV(tsvData);
  
  // Create a map from TSV
  const tsvMap = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    if (cols.length < 5) continue;
    let firstNameIdx = 0;
    if (cols[0] && cols[0].match(/^\d{4}-\d{2}-\d{2}/)) firstNameIdx = 1;
    
    const firstName = cols[firstNameIdx] || '';
    const lastName = cols[firstNameIdx+1] || '';
    const name = `${firstName} ${lastName}`.trim().toLowerCase();
    
    const instagram = cols[firstNameIdx+6] || '';
    let handle = instagram.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0] || '';
    handle = handle.replace(/[@]/g, '').toLowerCase();
    if (!handle) handle = name.replace(/\s+/g, '');
    
    const nichesStr = cols[firstNameIdx+5] || '';
    let niches = nichesStr.split(',').map(n => n.trim()).filter(Boolean);
    
    // REMOVE UGC TAG
    niches = niches.filter(n => !n.toLowerCase().includes('ugc'));
    
    const rawReels = (cols[firstNameIdx+8] || '').split(/[\n, ]+/).filter(u => u.includes('http'));
    
    tsvMap.set(handle, { name, niches, reels: rawReels });
    tsvMap.set(name, { name, niches, reels: rawReels });
  }
  
  console.log(`Syncing data and repairing videos...`);
  let updatedCount = 0;
  
  for (const c of creators) {
    const handle = (c.handle || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    
    const tsvMatch = tsvMap.get(handle) || tsvMap.get(name);
    
    if (tsvMatch) {
      // Sync Niches
      if (JSON.stringify(c.niches) !== JSON.stringify(tsvMatch.niches)) {
         c.niches = tsvMatch.niches;
         updatedCount++;
      }
      
      // Remove UGC tags just in case
      const originalNichesCount = c.niches.length;
      c.niches = c.niches.filter(n => !n.toLowerCase().includes('ugc'));
      if (c.niches.length !== originalNichesCount) updatedCount++;

      // Check if video is broken
      let currentUrl = '';
      if (c.reels && c.reels.length > 0) currentUrl = c.reels[0].videoUrl || '';
      
      const isBroken = !currentUrl || currentUrl.includes('fbcdn.net') || currentUrl.includes('instagram.com/');
      
      if (isBroken && tsvMatch.reels.length > 0) {
        const targetLink = tsvMatch.reels[0];
        console.log(`\nFixing broken video for ${c.name} -> ${targetLink}`);
        
        const rapidJson = await fetchWithRetry(`https://instagram-looter2.p.rapidapi.com/post?url=${encodeURIComponent(targetLink)}`, {
          headers: {
            'x-rapidapi-key': 'a6cfc29d80msh896f1c3b9a061c8p14ca69jsn98ae1317b1df',
            'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com'
          }
        });
        
        if (rapidJson && rapidJson.status === true && rapidJson.is_video) {
          console.log(`   Downloading raw MP4...`);
          try {
            const videoRes = await fetch(rapidJson.video_url);
            const buffer = Buffer.from(await videoRes.arrayBuffer());
            
            const shortcode = rapidJson.shortcode || Date.now();
            const filename = `reel_${shortcode}.mp4`;
            
            console.log(`   Uploading to Supabase (videos/${filename})...`);
            const { error: upErr } = await supabase.storage.from('videos').upload(filename, buffer, {
              contentType: 'video/mp4',
              upsert: true
            });
            
            if (!upErr) {
              const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/videos/${filename}`;
              if (!c.reels) c.reels = [];
              if (c.reels.length === 0) c.reels.push({});
              c.reels[0].videoUrl = publicUrl;
              c.reels[0].thumbnailUrl = rapidJson.thumbnail_src || publicUrl;
              console.log(`   ✅ Success! Permanent URL created: ${publicUrl}`);
              updatedCount++;
            } else {
              console.log(`   ❌ Upload failed:`, upErr.message);
            }
          } catch(e) {
             console.log(`   ❌ Video download failed:`, e.message);
          }
        } else {
          console.log(`   ❌ API Error: ${rapidJson?.errorMessage || 'Not a video'}`);
        }
      }
    } else {
       // Just strip UGC tag if no TSV match
       const originalNichesCount = c.niches.length;
       c.niches = c.niches.filter(n => !n.toLowerCase().includes('ugc'));
       if (c.niches.length !== originalNichesCount) updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    console.log(`\nSaving synced creators to Supabase...`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), {
      contentType: 'application/json',
      upsert: true
    });
    console.log('✅ Done! Niches synced, UGC removed, and missing videos fetched.');
  } else {
    console.log('\n✅ Everything is already perfectly synced!');
  }
}

run().catch(console.error);
