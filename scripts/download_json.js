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
    .download(`creators.json`);
  
  if (error) { console.error(error); return; }
  
  const text = await blob.text();
  fs.writeFileSync('creators_downloaded.json', text, 'utf-8');
  console.log('Downloaded to creators_downloaded.json');
}
run();
