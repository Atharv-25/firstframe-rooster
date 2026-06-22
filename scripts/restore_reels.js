import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

function parseTSV(tsv) {
  let rows = [];
  let cols = [];
  let cur = '';
  let inQuote = false;
  for(let i=0; i<tsv.length; i++) {
    let char = tsv[i];
    if (inQuote) {
      if (char === '"') {
        if (tsv[i+1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === '\t') {
        cols.push(cur);
        cur = '';
      } else if (char === '\n') {
        cols.push(cur);
        rows.push(cols);
        cols = [];
        cur = '';
      } else if (char === '\r') {
      } else {
        cur += char;
      }
    }
  }
  if (cols.length > 0 || cur !== '') {
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

async function run() {
  const tsvData = readFileSync('scripts/new_creators.tsv', 'utf-8');
  const lines = parseTSV(tsvData);
  
  const creators = JSON.parse(readFileSync('creators_downloaded.json', 'utf-8'));
  
  let restoredCount = 0;
  
  for (const c of creators) {
    const handle = (c.handle || '').toLowerCase();
    
    // Find match in TSV by looking at all columns for the handle
    const matchLine = lines.find(line => {
      return line.some(col => col.toLowerCase().includes(handle) && handle.length > 2);
    });
    
    if (matchLine) {
      // Find the column that has multiple URLs (comma/space separated) or looks like a demo reel
      let rawReels = [];
      for (const col of matchLine) {
        if (col.includes('http') && (col.includes('/reel/') || col.includes('/p/') || col.includes('drive.google') || col.split('http').length > 2)) {
          const extracted = col.split(/[\n, ]+/).filter(u => u.includes('http') && !u.includes('youtube') && (!u.includes('instagram.com/') || u.includes('/reel/') || u.includes('/p/')));
          if (extracted.length > 0) {
            rawReels = rawReels.concat(extracted);
          }
        }
      }
      
      if (rawReels.length === 0) {
        // Fallback: look for ANY link that is an instagram reel
        for (const col of matchLine) {
          const links = col.split(/[\n, ]+/).filter(u => u.includes('http'));
          for (const l of links) {
            if (l.includes('instagram.com/reel') || l.includes('instagram.com/p/')) {
               rawReels.push(l);
            }
          }
        }
      }
      
      // Still zero? We had a fallback of 17 reels in update-niches script.
      if (rawReels.length > 0 && (!c.reels || !c.reels[0] || !c.reels[0].videoUrl)) {
        if (!c.reels) c.reels = [];
        if (c.reels.length === 0) {
          c.reels.push({
            id: `reel_${Date.now()}_0`,
            label: "Demo Reel",
            videoUrl: rawReels[0]
          });
        } else {
          c.reels[0].videoUrl = rawReels[0];
        }
        restoredCount++;
      }
    }
  }
  
  console.log(`Restored reels for ${restoredCount} creators.`);
  
  // Upload back to Supabase
  const { error } = await supabase.storage
    .from('creator-data')
    .upload('creators.json', JSON.stringify(creators, null, 2), {
      contentType: 'application/json',
      upsert: true,
    });
    
  if (error) {
    console.error("Failed to upload:", error);
  } else {
    console.log("Successfully uploaded fixed creators.json to Supabase!");
  }
}

run();
