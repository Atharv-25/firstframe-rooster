import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: blob, error } = await supabase.storage
    .from('creator-data')
    .download(`creators.json?t=${Date.now()}`);
  
  if (error) { console.error(error); return; }
  
  const creators = JSON.parse(await blob.text());
  console.log('| Creator Name | Profile Handle | Reel URL |');
  console.log('| :--- | :--- | :--- |');
  creators.forEach(c => {
    let reelUrl = 'N/A';
    if (c.reels && c.reels.length > 0) {
      reelUrl = c.reels[0].videoUrl || c.reels[0].url || 'N/A';
    } else if (c.demoReel) {
      reelUrl = c.demoReel;
    }
    console.log(`| ${c.name} | ${c.handle || ''} | ${reelUrl} |`);
  });
}
run();
