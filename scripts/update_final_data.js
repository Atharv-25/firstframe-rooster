import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function formatFollowers(numStr) {
  if (!numStr || numStr.trim() === '') return '—';
  const num = parseInt(numStr.replace(/,/g, ''), 10);
  if (isNaN(num)) return '—';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

async function fix() {
  const rawData = fs.readFileSync('scripts/final_data.tsv', 'utf-8');
  const { data: blob } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  let creators = JSON.parse(await blob.text());

  const lines = rawData.trim().split('\n');
  let updatedCount = 0;

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 8) continue;
    
    const rawName = parts[1]?.trim();
    if (!rawName) continue;

    const rawInsta = parts[7]?.trim() || '';
    let handle = null;
    if (rawInsta.includes('instagram.com/')) {
        let h = rawInsta.split('instagram.com/')[1];
        if (h) {
            h = h.split('?')[0].split('/')[0].trim();
            handle = h;
        }
    }
    
    let match = null;
    if (handle) {
        match = creators.find(c => c.handle?.toLowerCase() === handle.toLowerCase());
    }
    if (!match) {
        match = creators.find(c => 
           c.name.toLowerCase().includes(rawName.toLowerCase()) || 
           rawName.toLowerCase().includes(c.name.toLowerCase())
        );
    }

    if (match) {
        let madeChanges = false;

        // update niches
        let nicheCol = -1;
        for (let i = 0; i < parts.length; i++) {
           if (parts[i].includes('Beauty') || parts[i].includes('Lifestyle') || parts[i].includes('Fashion') || parts[i].includes('Tech') || parts[i].includes('Unboxing')) {
               nicheCol = i;
               break;
           }
        }
        if (nicheCol !== -1) {
            match.niches = parts[nicheCol].split(',').map(n => n.trim()).filter(n => n);
            madeChanges = true;
        }

        // update followers
        // followers usually next col after niches
        if (nicheCol !== -1 && parts.length > nicheCol + 1) {
             const rawFollowers = parts[nicheCol + 1]?.trim();
             // Only update if the cell is a number, OR if the current follower is broken (contains http/instagram)
             if (/\d/.test(rawFollowers)) {
                 const formatted = formatFollowers(rawFollowers);
                 match.followers = formatted;
                 madeChanges = true;
             } else if (match.followers && (match.followers.includes('http') || match.followers.includes('instagram'))) {
                 // Remove ugly broken links if the TSV is empty
                 match.followers = '—';
                 madeChanges = true;
             }
        } else if (match.followers && (match.followers.includes('http') || match.followers.includes('instagram'))) {
             // Remove ugly broken links if we couldn't parse the TSV
             match.followers = '—';
             madeChanges = true;
        }

        if (madeChanges) updatedCount++;
    }
  }

  // Final sweep: manually wipe ANY creator that still has "http" in followers
  for (const c of creators) {
      if (c.followers && (c.followers.includes('http') || c.followers.includes('instagram'))) {
          c.followers = '—';
          updatedCount++;
      }
  }

  if (updatedCount > 0) {
    console.log(`Fixed data for ${updatedCount} creators! Saving...`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Done!');
  } else {
    console.log('No matches or fixes needed.');
  }
}

fix().catch(console.error);
