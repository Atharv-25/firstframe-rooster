import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const UPDATES = [
  { name: 'Sutapa', url: 'https://www.instagram.com/reel/DY88JFtR_wo/' },
  { name: 'Ridhi', url: 'https://www.instagram.com/reel/DZriwzntSep/' },
  { name: 'Aadrika', url: 'https://www.instagram.com/reel/DYxJxLOTCkX/' }
];

async function run() {
  console.log('Fetching creators...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download('creators.json');
  if (error) { console.error('Error', error); return; }
  
  const creators = JSON.parse(await blob.text());

  for (const update of UPDATES) {
    const creator = creators.find(c => c.name.toLowerCase().includes(update.name.toLowerCase()));
    if (creator) {
      console.log(`Found ${update.name}, fetching video...`);
      try {
        const rapidRes = await fetch(`https://instagram-looter2.p.rapidapi.com/post?url=${encodeURIComponent(update.url)}`, {
          headers: {
            'x-rapidapi-key': 'a6cfc29d80msh896f1c3b9a061c8p14ca69jsn98ae1317b1df',
            'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com'
          }
        });
        const rapidJson = await rapidRes.json();
        
        if (rapidJson.status === true && rapidJson.is_video) {
          creator.reels = [{
            id: `reel_${Date.now()}_0`,
            label: 'Demo Reel',
            videoUrl: rapidJson.video_url,
            thumbnailUrl: rapidJson.thumbnail_src || rapidJson.video_url
          }];
          console.log(`✅ ${update.name} reel updated`);
        } else {
          console.log(`❌ Failed to fetch ${update.name} video`, rapidJson);
        }
      } catch(e) {
        console.error(e);
      }
    } else {
      console.log(`⚠️ Creator ${update.name} not found`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Saving to Supabase...');
  await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true });
  console.log('✅ Done! All 3 creators updated.');
}

run().catch(console.error);
