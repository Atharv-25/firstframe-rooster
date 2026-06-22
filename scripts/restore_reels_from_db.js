import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  // Fetch from PostgreSQL database
  const { data: dbCreators, error: dbError } = await supabase
    .from('creators')
    .select('*');
    
  if (dbError) {
    console.error("Failed to fetch from DB:", dbError);
    return;
  }
  
  // Download creators.json
  const timestamp = Date.now();
  const { data: blob, error: downloadError } = await supabase.storage
    .from('creator-data')
    .download(`creators.json?t=${timestamp}`);
    
  if (downloadError) {
    console.error("Failed to download creators.json:", downloadError);
    return;
  }
  
  const creatorsJson = JSON.parse(await blob.text());
  
  let restoredFromDbCount = 0;
  
  for (const c of creatorsJson) {
    // Find matching creator in DB by handle or name
    const handle = (c.handle || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    
    const dbMatch = dbCreators.find(row => 
      (row.instagram_handle && row.instagram_handle.toLowerCase() === handle) || 
      (row.name && row.name.toLowerCase() === name)
    );
    
    if (dbMatch) {
      if (dbMatch.followers && dbMatch.followers !== '—' && dbMatch.followers !== c.followers) {
        c.followers = dbMatch.followers;
      }
      if (dbMatch.avg_views && dbMatch.avg_views !== '—' && dbMatch.avg_views !== c.avgViews) {
        c.avgViews = dbMatch.avg_views;
      }
      
      const dbReelUrl = dbMatch.demo_reel_url || dbMatch.portfolio_video_url;
      if (dbReelUrl) {
        if (!c.reels) c.reels = [];
        if (c.reels.length === 0 || !c.reels[0].videoUrl || c.reels[0].videoUrl === '') {
          if (c.reels.length === 0) {
            c.reels.push({
              id: `reel_${Date.now()}_0`,
              label: "Demo Reel",
              videoUrl: dbReelUrl
            });
          } else {
            c.reels[0].videoUrl = dbReelUrl;
          }
          restoredFromDbCount++;
        }
      }
    }
  }
  
  console.log(`Restored reels from DB for ${restoredFromDbCount} creators.`);
  
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
    console.log("Successfully fixed creators.json using PostgreSQL data!");
  }
}

run();
