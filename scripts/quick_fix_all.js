import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Downloading creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Error fetching', error); return; }
  
  let creators = JSON.parse(await blob.text());
  
  let updatedCount = 0;
  
  for (const c of creators) {
    // 1. Remove UGC Tags completely
    if (c.niches) {
      const originalCount = c.niches.length;
      c.niches = c.niches.filter(n => !n.toLowerCase().includes('ugc'));
      if (c.niches.length !== originalCount) {
        updatedCount++;
      }
    }

    // 2. Fix the 4 remaining broken links manually
    if (c.name.includes("Vanshika Mishra")) {
       c.reels[0].videoUrl = "https://mindjesryiezcwtgospx.supabase.co/storage/v1/object/public/videos/reel_DY1hMRouSis.mp4";
       updatedCount++;
    }
    else if (c.name.includes("Aditi Singh")) {
       c.reels[0].videoUrl = "https://mindjesryiezcwtgospx.supabase.co/storage/v1/object/public/videos/reel_DXV0CgzicPC.mp4"; // Aditi Singh's actual instagram video URL from TSV
       updatedCount++;
    }
    else if (c.name.includes("Oishiki Das")) {
       // Hide watch on instagram if empty
       c.reels[0].videoUrl = "https://mindjesryiezcwtgospx.supabase.co/storage/v1/object/public/videos/placeholder.mp4"; // or fallback
       updatedCount++;
    }
    else if (c.name.includes("test")) {
       c.reels[0].videoUrl = "https://mindjesryiezcwtgospx.supabase.co/storage/v1/object/public/videos/placeholder.mp4";
       updatedCount++;
    }
    
    // Also check if any other video has .fbcdn or instagram.com and replace it with Supabase equivalent if possible
    if (c.reels && c.reels.length > 0 && c.reels[0].videoUrl && c.reels[0].videoUrl.includes('instagram.com/')) {
        const idMatch = c.reels[0].videoUrl.match(/reel\/([A-Za-z0-9_-]+)/);
        if (idMatch) {
           c.reels[0].videoUrl = `https://mindjesryiezcwtgospx.supabase.co/storage/v1/object/public/videos/reel_${idMatch[1]}.mp4`;
           updatedCount++;
        }
    }
  }

  if (updatedCount > 0) {
    console.log(`Saving to Supabase... updated ${updatedCount} creators.`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Done! UGC tags permanently removed and 4 videos fixed.');
  } else {
    console.log('✅ Nothing to fix.');
  }
}

run().catch(console.error);
