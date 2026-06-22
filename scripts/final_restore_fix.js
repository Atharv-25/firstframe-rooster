import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Fetching database backup...');
  // 1. Fetch from instagram_creators table
  const { data: dbCreators, error: dbError } = await supabase
    .from('instagram_creators')
    .select('*');
    
  if (dbError) {
    console.error("Failed to fetch from DB:", dbError);
    return;
  }
  
  // 2. Download creators.json
  console.log('Downloading creators.json...');
  const { data: blob, error: downloadError } = await supabase.storage
    .from('creator-data')
    .download(`creators.json?t=${Date.now()}`);
    
  if (downloadError) {
    console.error("Failed to download creators.json:", downloadError);
    return;
  }
  
  const creatorsJson = JSON.parse(await blob.text());
  let restoredCount = 0;
  
  for (const c of creatorsJson) {
    // Check if their current video URL is missing or points to fbcdn (expiring) or instagram.com
    let currentUrl = '';
    if (c.reels && c.reels.length > 0) currentUrl = c.reels[0].videoUrl || '';
    
    const isBroken = currentUrl === '' || currentUrl.includes('fbcdn.net') || currentUrl.includes('instagram.com/');
    
    if (isBroken) {
      // Find matching creator in instagram_creators
      const handle = (c.handle || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      
      // DB rows might have multiple posts for one user, find the one with a storage URL
      const dbMatches = dbCreators.filter(row => 
        (row.instagram_username && row.instagram_username.toLowerCase() === handle) || 
        (row.full_name && row.full_name.toLowerCase() === name)
      );
      
      const bestMatch = dbMatches.find(row => row.storage_public_url) || dbMatches[0];
      
      if (bestMatch && bestMatch.storage_public_url) {
        if (!c.reels || c.reels.length === 0) {
          c.reels = [{
            id: `reel_${Date.now()}_0`,
            label: "Demo Reel",
            videoUrl: bestMatch.storage_public_url,
            thumbnailUrl: bestMatch.storage_public_url
          }];
        } else {
          // ensure exactly 1 video limit
          c.reels = [c.reels[0]];
          c.reels[0].videoUrl = bestMatch.storage_public_url;
          if (!c.reels[0].thumbnailUrl) c.reels[0].thumbnailUrl = bestMatch.storage_public_url;
        }
        restoredCount++;
        console.log(`Restored ${c.name} -> ${bestMatch.storage_public_url}`);
      }
    }
  }
  
  console.log(`Restored reels from Database backup for ${restoredCount} creators.`);
  
  // Upload back
  console.log('Uploading fixed creators.json...');
  const { error } = await supabase.storage
    .from('creator-data')
    .upload('creators.json', JSON.stringify(creatorsJson, null, 2), {
      contentType: 'application/json',
      upsert: true,
    });
    
  if (error) {
    console.error("Upload failed:", error);
  } else {
    console.log("✅ Successfully fixed creators.json using Database Backup!");
  }
}

run();
