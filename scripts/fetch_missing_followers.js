import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const rapidApiKey = process.env.VITE_RAPID_API_KEY;

function formatNumber(num) {
  if (!num) return '—';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

async function run() {
  console.log('Downloading latest creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Error fetching', error); return; }
  
  let creators = JSON.parse(await blob.text());

  const missingCreators = creators.filter(c => !c.followers || c.followers === '—' || c.followers === '0');
  console.log(`Found ${missingCreators.length} creators with missing followers...`);

  let updated = false;

  for (const c of missingCreators) {
     if (!c.handle) continue;
     console.log(`Fetching stats for @${c.handle}...`);
     try {
       const res = await fetch(`https://instagram-looter2.p.rapidapi.com/profile?username=${c.handle}`, {
         headers: {
           'x-rapidapi-key': rapidApiKey,
           'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com'
         }
       });
       const json = await res.json();
       
       if (json.edge_followed_by && json.edge_followed_by.count) {
          const newFollowers = formatNumber(json.edge_followed_by.count);
          if (c.followers !== newFollowers) {
             c.followers = newFollowers;
             updated = true;
             console.log(` ✅ Updated @${c.handle} | ${newFollowers} followers`);
          }
       } else {
          console.log(` ❌ No follower count found for @${c.handle}`);
       }
     } catch (err) {
       console.log(` ❌ Error fetching @${c.handle}`);
     }
     
     // Be nice to API limits
     await new Promise(r => setTimeout(r, 600));
  }

  if (updated) {
    console.log(`\nSaving to Supabase... updated data for missing profiles.`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Missing sync complete!');
  } else {
    console.log('✅ No missing ones could be updated.');
  }
}

run().catch(console.error);
