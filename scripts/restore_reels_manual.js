import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabase = createClient(
  supabaseUrl,
  process.env.VITE_SUPABASE_ANON_KEY
);

const MANUAL_MATCHES = {
  "Vaishnavi Khurana": "vanshika.mp4", // fallback if any
  "Sayra Taneja": "siya.MP4",
  "Nitisha Jhamb ⭐️": null,
  "Prapti Bisht": null,
  "Arfa": "arfa.mp4",
  "DR. इप्शिता महाजन 🦋 | UGC": "IPSHITA MAHAJAN.mp4",
  "Shivani": "shiwanshi pandey.mp4",
  "Shaloma Aranha": "shashanki.mp4",
  "Purnanshi Chhibber": null,
  "Vanshika♡": "vanshika.mp4", // wait there is no vanshika.mp4
  "Twinkle chaudhary": null,
  "Oishiki Das": null,
  "Kashvii": "KAVYA.mp4",
  "Bhavika Chandak": null,
  "WeandMe": null,
  "Suryaja Mowade": "suryajaya.mp4",
  "arp!ta": "arpita.MP4",
  "Kanishka Shishodia": "KAVYA.mp4"
};

// Also let's check update-20-reels.js match mappings
const REEL_UPDATES = [
  { match: 'megadrip__', url: 'https://www.instagram.com/reel/DXzOCOyS-c/' },
  { match: 'kanchanthiside', url: 'https://www.instagram.com/reel/DYpViypMkjs/' },
  { match: 'batchu_aishwarya', url: 'https://www.instagram.com/reel/DUs3a5ejwq5/' },
  { match: 'rhhytthhmm', url: 'https://www.instagram.com/reel/DV_RWI4EdTN/' },
  { match: 'khushi', url: 'https://www.instagram.com/reel/DYoZSn3tOgu/' },
  { match: 'remsandhu', url: 'https://www.instagram.com/reel/DX9nUd-t7o7/' },
  { match: '_akanksha.x_', url: 'https://www.instagram.com/reel/DQ7NvoAEvuW/' },
  { match: 'glowcheck_with_k', url: 'https://www.instagram.com/reel/DZriwzntSep/' },
  { match: 'aaryahibarde', url: 'https://www.instagram.com/reel/DYe59o2hJa2/' },
  { match: 'allabout.astha', url: 'https://www.instagram.com/reel/DVNzOZ4Dect/' },
  { match: 'negarmansuri_', url: 'https://www.instagram.com/reel/DZUZqmsMgnt/' },
  { match: '__.riddhiimaa._', url: 'https://www.instagram.com/reel/DYxJxLOTCkX/' },
  { match: 'barely_aditi', url: 'https://www.instagram.com/reel/DX_034dhmMZ/' },
  { match: 'gunchachhibber', url: 'https://www.instagram.com/reel/DYUabIXK6mM/' },
  { match: '__.bhargabikalita', url: 'https://www.instagram.com/reel/DUk-p8djJvS/' },
  { match: 'kanupriya.sharmaa', url: 'https://www.instagram.com/reel/DZkeG0ayAh4/' },
  { match: '_.aparnaforsure._', url: 'https://www.instagram.com/reel/DZ2aThoPyks/' },
  { match: '_aayushirawat_', url: 'https://www.instagram.com/reel/DZxBlVAJ0ar/' },
  { match: 'ektakumar_', url: 'https://www.instagram.com/reel/DYcV9NfsFmB/' },
  { match: 'gurnoorkaursethi08', url: 'https://www.instagram.com/reel/DXesO1PEZGg/' },
];

async function run() {
  const creators = JSON.parse(readFileSync('creators_downloaded.json', 'utf-8'));
    
  let restoredCount = 0;
  
  for (const c of creators) {
    // Only check if reel is missing or empty
    if (!c.reels || c.reels.length === 0 || !c.reels[0].videoUrl || c.reels[0].videoUrl === '') {
      let matchedUrl = null;
      
      const manualName = MANUAL_MATCHES[c.name];
      if (manualName) {
        matchedUrl = `${supabaseUrl}/storage/v1/object/public/videos/${encodeURIComponent(manualName)}`;
      }
      
      // Also check REEL_UPDATES
      const handle = (c.handle || '').toLowerCase();
      const updateMatch = REEL_UPDATES.find(u => handle.includes(u.match.toLowerCase()));
      if (updateMatch) {
         matchedUrl = updateMatch.url;
      }
      
      if (matchedUrl) {
        if (!c.reels) c.reels = [];
        if (c.reels.length === 0) {
          c.reels.push({
            id: `reel_${Date.now()}_0`,
            label: "Demo Reel",
            videoUrl: matchedUrl
          });
        } else {
          c.reels[0].videoUrl = matchedUrl;
        }
        restoredCount++;
        console.log(`Matched ${c.name} -> ${matchedUrl}`);
      }
    }
  }
  
  console.log(`Restored reels for ${restoredCount} additional creators.`);
  
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
