import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const localCreators = JSON.parse(readFileSync('src/app/data/creators.json', 'utf-8'));
  
  // Download fresh creators.json from Supabase
  const timestamp = Date.now();
  const { data: blob, error: downloadError } = await supabase.storage
    .from('creator-data')
    .download(`creators.json?t=${timestamp}`);
    
  if (downloadError) {
    console.error("Failed to download creators.json:", downloadError);
    return;
  }
  
  const creatorsJson = JSON.parse(await blob.text());
  
  let restoredFromLocalCount = 0;
  
  for (const c of creatorsJson) {
    const handle = (c.handle || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    
    // Find match in local DB by handle or name
    const localMatch = localCreators.find(row => 
      (row.handle && row.handle.toLowerCase() === handle) || 
      (row.name && row.name.toLowerCase() === name)
    );
    
    if (localMatch) {
      if (localMatch.followers && localMatch.followers !== '—' && localMatch.followers !== c.followers) {
        c.followers = localMatch.followers;
      }
      if (localMatch.avgViews && localMatch.avgViews !== '—' && localMatch.avgViews !== c.avgViews) {
        c.avgViews = localMatch.avgViews;
      }
      
      const localReels = localMatch.reels;
      if (localReels && localReels.length > 0 && localReels[0].videoUrl) {
        if (!c.reels || c.reels.length === 0 || !c.reels[0].videoUrl || c.reels[0].videoUrl === '') {
          c.reels = localReels;
          restoredFromLocalCount++;
        }
      }
    }
  }
  
  console.log(`Restored reels from local backup for ${restoredFromLocalCount} creators.`);
  
  // Upload back
  const { error } = await supabase.storage
    .from('creator-data')
    .upload('creators.json', JSON.stringify(creatorsJson, null, 2), {
      contentType: 'application/json',
      upsert: true,
    });
    
  if (error) {
    console.error("Upload failed:", error);
  } else {
    console.log("Successfully fixed creators.json using local backup data!");
  }
}

run();
