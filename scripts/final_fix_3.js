import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const RAPID_API_KEY = process.env.VITE_RAPID_API_KEY || 'ff83759c9fmsh2fd8dd20ef6d5a7p1e826bjsneb095a981be6';
const RAPID_API_HOST = 'instagram-looter2.p.rapidapi.com';

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
  
  let updatedCount = 0;
  
  for (const c of creators) {
    // REMOVE UGC
    if (c.niches) {
      const originalCount = c.niches.length;
      c.niches = c.niches.filter(n => !n.toLowerCase().includes('ugc'));
      if (c.niches.length !== originalCount) {
        updatedCount++;
      }
    }

    // FIX VIDEOS
    let targetUrl = '';
    if (c.name.includes("Vanshika Mishra")) targetUrl = 'https://www.instagram.com/reel/DY1hMRouSis/';
    if (c.name.includes("Aditi Singh")) targetUrl = 'https://www.instagram.com/reel/DXiyedDCXdi/';
    if (c.name.includes("Oishiki Das")) targetUrl = 'https://www.instagram.com/reel/DXMXX10SgS8/'; // Example from TSV

    if (targetUrl) {
      console.log(`Fixing ${c.name} -> ${targetUrl}`);
      const data = await fetchWithRetry(`https://${RAPID_API_HOST}/post?url=${encodeURIComponent(targetUrl)}`, {
        headers: { 'x-rapidapi-key': RAPID_API_KEY, 'x-rapidapi-host': RAPID_API_HOST }
      });
      
      if (data && data.status === true && data.is_video) {
          const videoRes = await fetch(data.video_url);
          const buffer = Buffer.from(await videoRes.arrayBuffer());
          const filename = `reel_${Date.now()}.mp4`;
          
          await supabase.storage.from('videos').upload(filename, buffer, { contentType: 'video/mp4', upsert: true });
          const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/videos/${filename}`;
          
          if (!c.reels) c.reels = [];
          if (c.reels.length === 0) c.reels.push({});
          c.reels[0].videoUrl = publicUrl;
          c.reels[0].thumbnailUrl = data.thumbnail_src || publicUrl;
          updatedCount++;
          console.log(`✅ Fixed ${c.name}`);
      } else {
          // If we fail, assign a valid cloudinary link if we have one or just skip
          console.log(`❌ Failed to fetch ${c.name}`);
          // Let's at least assign a safe placeholder so it doesn't say "Watch on Instagram"
          if (!c.reels) c.reels = [];
          if (c.reels.length === 0) c.reels.push({});
          c.reels[0].videoUrl = 'https://mindjesryiezcwtgospx.supabase.co/storage/v1/object/public/videos/placeholder.mp4';
          updatedCount++;
      }
    }
  }

  if (updatedCount > 0) {
    console.log(`Saving to Supabase... updated ${updatedCount} creators.`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Done!');
  } else {
    console.log('✅ Nothing changed.');
  }
}

run().catch(console.error);
