import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
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
  let output = '# All Creators and Demo Reels\n\n';
  output += '| Creator Name | Profile Handle | Reel URL |\n';
  output += '| :--- | :--- | :--- |\n';
  creators.forEach(c => {
    let reelUrl = 'N/A';
    if (c.reels && c.reels.length > 0) {
      reelUrl = c.reels[0].videoUrl || c.reels[0].url || 'N/A';
    } else if (c.demoReel) {
      reelUrl = c.demoReel;
    }
    
    // Check if it's an actual URL to convert to markdown link
    let displayReel = reelUrl;
    if (reelUrl.startsWith('http')) {
       displayReel = `[Link](${reelUrl})`;
    }
    output += `| **${c.name || 'Unknown'}** | \`${c.handle || 'N/A'}\` | ${displayReel} |\n`;
  });
  
  fs.writeFileSync('C:\\Users\\lenovo\\.gemini\\antigravity-ide\\brain\\4096ac7e-141c-4ad7-b8bd-92a17cf50d30\\all_creators_reels.md', output, 'utf-8');
  console.log('Done writing artifact.');
}
run();
