import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const RAPID_API_KEY = process.env.VITE_RAPID_API_KEY || 'ff83759c9fmsh2fd8dd20ef6d5a7p1e826bjsneb095a981be6';
const RAPID_API_HOST = 'instagram-looter2.p.rapidapi.com';

const rawData = `
Megha	https://www.instagram.com/reel/DXzOCOyS-c/
Kanchan	https://www.instagram.com/reel/DYpViypMkjs/
Aishwarya Batchu	https://www.instagram.com/reel/DUs3a5ejwq5/
Rhythm Gupta	https://www.instagram.com/reel/DV_RWI4EdTN/
Khushi	https://www.instagram.com/reel/DYoZSn3tOgu/
rem	https://www.instagram.com/reel/DX9nUd-t7o7/
AKANKSHA	https://www.instagram.com/reel/DQ7NvoAEvuW/
R 🦋	https://www.instagram.com/reel/DZriwzntSep/
MUSKAN GUPTA	https://www.instagram.com/reel/DYe59o2hJa2/
RASHMI REKHA BORA	https://www.instagram.com/reel/DVNzOZ4Dect/
Sliqtheory	https://www.instagram.com/reel/DZUZqmsMgnt/
Aadrika	https://www.instagram.com/reel/DYxJxLOTCkX/
canyoupriya	https://www.instagram.com/reel/DX_034dhmMZ/
fathima	https://www.instagram.com/reel/DYUabIXK6mM/
Sumedha	https://www.instagram.com/reel/DUk-p8djJvS/
Manjree Karn	https://www.instagram.com/reel/DZkeG0ayAh4/
Astha	https://www.instagram.com/reel/DZ2aThoPyks/
Aayushi Rawat	https://www.instagram.com/reel/DZxBlVAJ0ar/
Ekta Kumar	https://www.instagram.com/reel/DYcV9NfsFmB/
Gurnoor Kaur Sethi	https://www.instagram.com/reel/DXesO1PEZGg/
`;

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return await res.json();
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function run() {
  console.log('Downloading creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Error fetching', error); return; }
  
  let creators = JSON.parse(await blob.text());
  
  const updates = rawData.trim().split('\n').filter(Boolean).map(l => {
    const parts = l.split('\t');
    return { nameHint: parts[0].trim().toLowerCase(), targetUrl: parts[1].trim() };
  });

  let updatedCount = 0;
  
  for (const { nameHint, targetUrl } of updates) {
    let match = creators.find(c => 
       c.name.toLowerCase().includes(nameHint) || 
       c.handle?.toLowerCase().includes(nameHint) || 
       (nameHint === 'r 🦋' && c.name.toLowerCase().includes('runjun')) // mapping R 🦋 to runjun if needed
    );
    
    // specifically map some ambiguous names
    if (nameHint.includes('megha')) match = creators.find(c => c.name.toLowerCase().includes('megha baisoya'));
    if (nameHint.includes('kanchan')) match = creators.find(c => c.name.toLowerCase().includes('kanchan yadav'));
    if (nameHint.includes('fathima')) match = creators.find(c => c.name.toLowerCase().includes('fathima noor'));
    if (nameHint.includes('sumedha')) match = creators.find(c => c.name.toLowerCase().includes('sumedha goel'));
    if (nameHint.includes('aadrika')) match = creators.find(c => c.handle?.toLowerCase().includes('aadrikaa_acharya'));
    if (nameHint.includes('r 🦋')) match = creators.find(c => c.name.toLowerCase().includes('runjun')); // runjun is R 🦋 ?

    if (!match) {
       console.log(`❌ Could not find creator for hint: ${nameHint}`);
       continue;
    }
    
    console.log(`\nProcessing ${match.name}: Fetching ${targetUrl}`);
    const data = await fetchWithRetry(`https://${RAPID_API_HOST}/post?url=${encodeURIComponent(targetUrl)}`, {
      headers: { 'x-rapidapi-key': RAPID_API_KEY, 'x-rapidapi-host': RAPID_API_HOST }
    });
    
    if (data && data.status === true && data.is_video) {
        console.log(`   Downloading raw MP4...`);
        try {
          const videoRes = await fetch(data.video_url);
          const buffer = Buffer.from(await videoRes.arrayBuffer());
          
          const shortcode = data.shortcode || Date.now();
          const filename = `reel_${shortcode}.mp4`;
          
          console.log(`   Uploading to Supabase (videos/${filename})...`);
          const { error: upErr } = await supabase.storage.from('videos').upload(filename, buffer, {
            contentType: 'video/mp4',
            upsert: true
          });
          
          if (!upErr) {
            const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/videos/${filename}`;
            if (!match.reels) match.reels = [];
            if (match.reels.length === 0) match.reels.push({});
            match.reels[0].videoUrl = publicUrl;
            match.reels[0].thumbnailUrl = data.thumbnail_src || publicUrl;
            console.log(`   ✅ Success! Permanent URL created: ${publicUrl}`);
            updatedCount++;
          } else {
            console.log(`   ❌ Upload failed:`, upErr.message);
          }
        } catch(e) {
           console.log(`   ❌ Video download failed:`, e.message);
        }
    } else {
        console.log(`   ❌ API Error: Not a video or unavailable`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }

  if (updatedCount > 0) {
    console.log(`\nSaving to Supabase... updated ${updatedCount} creators.`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Done!');
  } else {
    console.log('✅ Nothing changed.');
  }
}

run().catch(console.error);
