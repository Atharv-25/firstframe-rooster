import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Map of handle or name substrings to new reel URLs
const REEL_UPDATES = [
  { match: 'megadrip__', url: 'https://www.instagram.com/reel/DXzOCOyS-c/' }, // Megha
  { match: 'kanchanthiside', url: 'https://www.instagram.com/reel/DYpViypMkjs/' }, // Kanchan
  { match: 'batchu_aishwarya', url: 'https://www.instagram.com/reel/DUs3a5ejwq5/' }, // Aishwarya Batchu
  { match: 'rhhytthhmm', url: 'https://www.instagram.com/reel/DV_RWI4EdTN/' }, // Rhythm Gupta
  { match: 'khushi', url: 'https://www.instagram.com/reel/DYoZSn3tOgu/', isName: true }, // Khushi (will check which khushi later, assuming santuka)
  { match: 'remsandhu', url: 'https://www.instagram.com/reel/DX9nUd-t7o7/' }, // rem
  { match: '_akanksha.x_', url: 'https://www.instagram.com/reel/DQ7NvoAEvuW/' }, // AKANKSHA
  { match: 'ridhichaudhary', url: 'https://www.instagram.com/reel/DZriwzntSep/' }, // R 🦋 (Assuming Ridhi Chaudhary)
  { match: 'muskangupta13', url: 'https://www.instagram.com/reel/DYe59o2hJa2/' }, // MUSKAN GUPTA
  { match: '_imrunjun_', url: 'https://www.instagram.com/reel/DVNzOZ4Dect/' }, // RASHMI REKHA BORA
  { match: 'mahiig_23', url: 'https://www.instagram.com/reel/DZUZqmsMgnt/' }, // mahi gupta
  { match: 'aadrikaa_acharya', url: 'https://www.instagram.com/reel/DYxJxLOTCkX/' }, // Aadrika
  { match: 'kanupriya.sharmaa', url: 'https://www.instagram.com/reel/DX_034dhmMZ/' }, // canyoupriya (Kanupriya)
  { match: '_fathima.noor_', url: 'https://www.instagram.com/reel/DYUabIXK6mM/' }, // fathima
  { match: 'sumeedhhaa', url: 'https://www.instagram.com/reel/DUk-p8djJvS/' }, // Sumedha
  { match: 'manjrayyy', url: 'https://www.instagram.com/reel/DZkeG0ayAh4/' }, // Manjree Karn
  { match: 'allabout.astha', url: 'https://www.instagram.com/reel/DZ2aThoPyks/' }, // Astha
  { match: '_aayushirawat_', url: 'https://www.instagram.com/reel/DZxBlVAJ0ar/' }, // Aayushi Rawat
  { match: 'ektakumar_', url: 'https://www.instagram.com/reel/DYcV9NfsFmB/' }, // Ekta Kumar
  { match: 'gurnoorkaursethi08', url: 'https://www.instagram.com/reel/DXesO1PEZGg/' }, // Gurnoor Kaur Sethi
];

async function run() {
  console.log('Fetching creators...');
  const timestamp = Date.now();
  const { data: blob, error } = await supabase.storage
    .from('creator-data')
    .download(`creators.json?t=${timestamp}`);
    
  if (error) { console.error('Error fetching creators', error); return; }
  
  const creators = JSON.parse(await blob.text());
  let updateCount = 0;

  for (const update of REEL_UPDATES) {
    let creator;
    if (update.isName) {
       creator = creators.find(c => c.name.toLowerCase().includes('khushi'));
    } else {
       creator = creators.find(c => (c.handle || '').toLowerCase().includes(update.match));
       if (!creator) creator = creators.find(c => c.name.toLowerCase().includes(update.match));
    }

    if (creator) {
      console.log(`Matched: ${creator.name} -> Fetching ${update.url}`);
      
      try {
        const rapidRes = await fetch(`https://instagram-looter2.p.rapidapi.com/post?url=${encodeURIComponent(update.url)}`, {
          headers: {
            'x-rapidapi-key': 'a6cfc29d80msh896f1c3b9a061c8p14ca69jsn98ae1317b1df',
            'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com'
          }
        });
        const rapidJson = await rapidRes.json();
        
        if (rapidJson.status === true && rapidJson.is_video) {
          const videoUrl = rapidJson.video_url;
          const coverUrl = rapidJson.thumbnail_src || rapidJson.thumbnail_url || rapidJson.video_url;
          
          if (!creator.reels || creator.reels.length === 0) {
            creator.reels = [{ id: `reel_${Date.now()}_0`, label: 'Demo Reel', videoUrl, thumbnailUrl: coverUrl }];
          } else {
            creator.reels[0].videoUrl = videoUrl;
            creator.reels[0].thumbnailUrl = coverUrl;
          }
          console.log(`   ✅ Extracted MP4 successfully!`);
          updateCount++;
        } else {
          console.log(`   ❌ API Error: ${rapidJson.errorMessage || 'Unknown error'}`);
        }
      } catch (e) {
        console.error(`   ❌ Request failed:`, e.message);
      }
      
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    } else {
      console.log(`⚠️  Could not find creator for match: ${update.match}`);
    }
  }

  console.log(`\nUpdated ${updateCount} reels. Saving to Supabase...`);
  const { error: saveError } = await supabase.storage
    .from('creator-data')
    .upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true });

  if (saveError) {
    console.error('Failed to save to Supabase', saveError);
  } else {
    console.log('✅ Success! Saved to Supabase.');
  }
}

run().catch(console.error);
