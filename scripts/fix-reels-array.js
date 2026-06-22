import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const SUTAPA_URL = 'https://www.instagram.com/reel/DY88JFtR_wo/';

async function run() {
  console.log('Fetching creators...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download('creators.json');
  if (error) { console.error('Error', error); return; }
  
  const creators = JSON.parse(await blob.text());

  // 1. Process Sutapa's video
  const sutapa = creators.find(c => c.name.toLowerCase().includes('sutapa'));
  if (sutapa) {
    console.log('Found Sutapa, fetching video...');
    try {
      const rapidRes = await fetch(`https://instagram-looter2.p.rapidapi.com/post?url=${encodeURIComponent(SUTAPA_URL)}`, {
        headers: {
          'x-rapidapi-key': 'a6cfc29d80msh896f1c3b9a061c8p14ca69jsn98ae1317b1df',
          'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com'
        }
      });
      const rapidJson = await rapidRes.json();
      
      if (rapidJson.status === true && rapidJson.is_video) {
        sutapa.reels = [{
          id: `reel_${Date.now()}_0`,
          label: 'Demo Reel',
          videoUrl: rapidJson.video_url,
          thumbnailUrl: rapidJson.thumbnail_src || rapidJson.video_url
        }];
        console.log('✅ Sutapa reel updated');
      } else {
        console.log('❌ Failed to fetch Sutapa video', rapidJson);
      }
    } catch(e) {
      console.error(e);
    }
  }

  // 2. Ensure ALL creators have exactly 1 reel MAXIMUM
  let truncatedCount = 0;
  for (const c of creators) {
    if (c.reels && c.reels.length > 1) {
      c.reels = [c.reels[0]]; // keep only the first one
      truncatedCount++;
    }
  }
  
  console.log(`\nTruncated extra reels for ${truncatedCount} creators.`);

  // 3. Save to Supabase
  console.log('Saving to Supabase...');
  await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true });
  console.log('✅ Done! All creators now have exactly 1 video.');
}

run().catch(console.error);
