import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Setup Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Setup Cloudinary properly by parsing the connection string
const cloudUrl = process.env.VITE_CLOUDINARY_URL.trim();
const parsed = new URL(cloudUrl);
cloudinary.config({
  cloud_name: parsed.hostname,
  api_key: parsed.username,
  api_secret: parsed.password
});

async function runMigration() {
  console.log('Downloading latest creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Failed to download creators.json', error); return; }
  
  let creators = JSON.parse(await blob.text());
  let updatedCount = 0;

  for (let i = 0; i < creators.length; i++) {
    const c = creators[i];
    if (!c.reels || !c.reels[0]) continue;
    
    let currentUrl = c.reels[0].videoUrl;
    const localFallback = c.reels[0].localVideoPath;
    
    // If we have an instagram link, try to use the local fallback if it exists, since Cloudinary can't download from an instagram webpage
    if (currentUrl && currentUrl.includes('instagram.com') && localFallback) {
      currentUrl = localFallback;
    }
    
    if (!currentUrl) continue;
    
    // Only migrate if it's NOT already on Cloudinary
    if (!currentUrl.includes('cloudinary.com')) {
      console.log(`[${i+1}/${creators.length}] Migrating @${c.handle} to Cloudinary...`);
      try {
        const uploadRes = await cloudinary.uploader.upload(currentUrl, {
          resource_type: 'video',
          folder: 'firstframe-creators'
        });
        
        c.reels[0].videoUrl = uploadRes.secure_url;
        
        // Clean up legacy properties so the schema is clean
        delete c.reels[0].localVideoPath;
        delete c.videoUrl; // Delete top level videoUrl if it existed
        
        updatedCount++;
        console.log(` ✅ Success: ${uploadRes.secure_url}`);
      } catch (err) {
        console.error(` ❌ Failed for @${c.handle}:`, err.message);
      }
    } else {
      // It's already Cloudinary, just clean up legacy props
      if (c.reels[0].localVideoPath) {
        delete c.reels[0].localVideoPath;
        updatedCount++;
      }
    }
  }

  if (updatedCount > 0) {
    console.log(`\nMigration complete! Saving updated JSON to Supabase...`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log(`✅ Successfully updated ${updatedCount} profiles!`);
  } else {
    console.log(`✅ All videos are already unified on Cloudinary!`);
  }
}

runMigration().catch(console.error);
