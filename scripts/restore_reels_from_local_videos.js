import { readFileSync, readdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabase = createClient(
  supabaseUrl,
  process.env.VITE_SUPABASE_ANON_KEY
);

function normalizeString(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
  const creators = JSON.parse(readFileSync('creators_downloaded.json', 'utf-8'));
  const localVideos = readdirSync(path.join(process.cwd(), 'public', 'videos'))
    .filter(f => f.endsWith('.mp4') || f.endsWith('.MOV') || f.endsWith('.MP4') || f.endsWith('.mov'));
    
  let restoredCount = 0;
  
  for (const c of creators) {
    // Only check if reel is missing
    if (!c.reels || c.reels.length === 0 || !c.reels[0].videoUrl || c.reels[0].videoUrl === '') {
      const handle = (c.handle || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      const normName = normalizeString(name);
      
      // Try to find a matching local video
      let bestMatch = null;
      for (const video of localVideos) {
        const videoName = normalizeString(video.split('.')[0]);
        if (normName.includes(videoName) || videoName.includes(normName) || (handle && videoName.includes(handle))) {
          bestMatch = video;
          break;
        }
      }
      
      if (bestMatch) {
        const fullUrl = `${supabaseUrl}/storage/v1/object/public/videos/${encodeURIComponent(bestMatch)}`;
        if (!c.reels) c.reels = [];
        if (c.reels.length === 0) {
          c.reels.push({
            id: `reel_${Date.now()}_0`,
            label: "Demo Reel",
            videoUrl: fullUrl
          });
        } else {
          c.reels[0].videoUrl = fullUrl;
        }
        restoredCount++;
        console.log(`Matched ${c.name} -> ${bestMatch}`);
      } else {
        console.log(`No match found for ${c.name}`);
      }
    }
  }
  
  console.log(`Restored reels from local videos for ${restoredCount} creators.`);
  
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
