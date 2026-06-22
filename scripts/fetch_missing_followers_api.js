import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const RAPIDAPI_KEY = 'ff83759c9fmsh2fd8dd20ef6d5a7p1e826bjsneb095a981be6';
const RAPIDAPI_HOST = 'instagram-api-fast-reliable-data-scraper.p.rapidapi.com';

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

async function bulkFetch() {
  console.log('Downloading creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Failed to download creators.json', error); return; }
  
  let creators = JSON.parse(await blob.text());
  
  // Find all creators missing followers or having corrupted URL followers
  const missing = creators.filter(c => !c.followers || c.followers === '—' || c.followers.includes('http'));
  console.log(`Found ${missing.length} creators needing followers updated. Starting bulk fetch...`);

  let updatedCount = 0;

  for (let i = 0; i < missing.length; i++) {
    const c = missing[i];
    
    // Extract IG username
    let igHandle = '';
    try {
      if (c.profileUrl) {
         igHandle = c.profileUrl.split('instagram.com/')[1]?.replace(/[^a-z0-9_.]/gi, '');
      } else if (c.handle) {
         igHandle = c.handle;
      }
    } catch(e) {}

    if (!igHandle) {
      console.log(`[${i+1}/${missing.length}] Skipping ${c.name} - No valid IG handle`);
      continue;
    }

    console.log(`[${i+1}/${missing.length}] Fetching followers for @${igHandle} (${c.name})...`);
    
    try {
      const res = await fetch(`https://${RAPIDAPI_HOST}/profile?username=${igHandle}`, {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      });
      
      const data = await res.json();
      
      if (data.follower_count !== undefined) {
         const countStr = formatNumber(data.follower_count);
         c.followers = countStr;
         updatedCount++;
         console.log(` ✅ Success: ${data.follower_count} -> ${countStr}`);
      } else {
         console.error(` ❌ Failed for @${igHandle}: Rate limit or invalid response`, data);
         // If we hit a rate limit, stop the loop to save API calls
         if (data.message && data.message.includes('quota')) {
            console.log('Stopping due to API quota limits.');
            break;
         }
      }
    } catch (err) {
      console.error(` ❌ Network error for @${igHandle}:`, err.message);
    }
    
    // Slight delay to avoid aggressive rate limits on the new API
    await new Promise(r => setTimeout(r, 1000));
  }

  if (updatedCount > 0) {
    console.log(`\nBulk fetch complete! Saving ${updatedCount} new followers to Supabase...`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log(`✅ Successfully updated database!`);
  } else {
    console.log(`✅ No followers updated. Check API limits or handles.`);
  }
}

bulkFetch().catch(console.error);
