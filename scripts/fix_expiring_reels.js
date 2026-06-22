import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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
  console.log('Fetching creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Error fetching creators.json', error); return; }
  
  const creators = JSON.parse(await blob.text());
  let updatedCount = 0;

  for (const creator of creators) {
    if (!creator.reels || creator.reels.length === 0) continue;
    
    // Enforce 1 video maximum
    if (creator.reels.length > 1) {
      creator.reels = [creator.reels[0]];
    }

    const reel = creator.reels[0];
    const url = reel.videoUrl || '';
    
    // If it's already a permanent Supabase link, skip!
    if (url.includes('supabase.co/storage/v1/object/public/videos/')) {
      continue;
    }

    // It's either an expiring fbcdn link, or an instagram.com link. We must fetch the actual video file.
    let targetLink = url;
    if (url.includes('fbcdn.net')) {
       // We can't re-fetch from fbcdn if it expired. We need the original instagram link.
       // Check if creator has a profileUrl. If not, we might be out of luck unless we have the shortcode.
       targetLink = creator.profileUrl; // this is just their profile, not the reel!
       
       // Try to extract shortcode if we saved it in ID
       // reel_DYxJxLOTCkX_178...
       const idMatch = reel.id.match(/reel_([A-Za-z0-9_-]{10,12})/);
       if (idMatch) {
         targetLink = `https://www.instagram.com/reel/${idMatch[1]}/`;
       } else {
         console.log(`⚠️ Cannot find original reel URL for ${creator.name}, skipping.`);
         continue;
       }
    } else if (url.includes('instagram.com/')) {
       targetLink = url;
    } else {
       // Might be Cloudinary, keep it
       if (url.includes('res.cloudinary.com')) continue;
       console.log(`⚠️ Unrecognized url for ${creator.name}: ${url.substring(0, 50)}...`);
       continue;
    }

    console.log(`\nProcessing ${creator.name}: Fetching ${targetLink}`);
    const rapidJson = await fetchWithRetry(`https://instagram-looter2.p.rapidapi.com/post?url=${encodeURIComponent(targetLink)}`, {
      headers: {
        'x-rapidapi-key': 'a6cfc29d80msh896f1c3b9a061c8p14ca69jsn98ae1317b1df',
        'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com'
      }
    });

    if (rapidJson && rapidJson.status === true && rapidJson.is_video) {
      const rawMp4Url = rapidJson.video_url;
      const shortcode = rapidJson.shortcode || targetLink.split('reel/')[1]?.split('/')[0] || Date.now();
      const filename = `reel_${shortcode}.mp4`;
      
      console.log(`   Downloading raw MP4...`);
      try {
        const videoRes = await fetch(rawMp4Url);
        const arrayBuffer = await videoRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`   Uploading to Supabase (videos/${filename})...`);
        const { error: upErr } = await supabase.storage.from('videos').upload(filename, buffer, {
          contentType: 'video/mp4',
          upsert: true
        });

        if (!upErr) {
          const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/videos/${filename}`;
          creator.reels[0].videoUrl = publicUrl;
          creator.reels[0].thumbnailUrl = rapidJson.thumbnail_src || rapidJson.thumbnail_url || publicUrl;
          console.log(`   ✅ Success! Permanent URL created: ${publicUrl}`);
          updatedCount++;
        } else {
          console.log(`   ❌ Upload failed:`, upErr.message);
        }
      } catch (err) {
        console.log(`   ❌ Video download failed:`, err.message);
      }
    } else {
      console.log(`   ❌ API Error: ${rapidJson?.errorMessage || 'Unknown error'}`);
    }
    
    // Sleep to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  if (updatedCount > 0) {
    console.log(`\nSaving to Supabase... updated ${updatedCount} creators.`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true });
    console.log('✅ Done! Videos are now completely permanent.');
  } else {
    console.log('\n✅ No expiring videos needed updating.');
  }
}

run().catch(console.error);
