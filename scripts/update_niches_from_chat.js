import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function updateNiches() {
  const rawData = fs.readFileSync('scripts/latest_niches_from_chat.tsv', 'utf-8');
  const { data: blob } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  let creators = JSON.parse(await blob.text());

  const lines = rawData.trim().split('\n');
  let updatedCount = 0;

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 8) continue;
    
    const rawName = parts[1]?.trim();
    if (!rawName) continue;

    // find niche col:
    let nicheCol = -1;
    for (let i = 0; i < parts.length; i++) {
       if (parts[i].includes('Beauty') || parts[i].includes('Lifestyle') || parts[i].includes('Fashion') || parts[i].includes('Tech') || parts[i].includes('Unboxing')) {
           nicheCol = i;
           break;
       }
    }
    
    if (nicheCol === -1) continue;
    
    const parsedNiches = parts[nicheCol].split(',').map(n => n.trim()).filter(n => n);
    
    const match = creators.find(c => 
       c.name.toLowerCase().includes(rawName.toLowerCase()) || 
       rawName.toLowerCase().includes(c.name.toLowerCase())
    );

    if (match) {
        match.niches = parsedNiches;
        updatedCount++;
    }
  }

  if (updatedCount > 0) {
    console.log(`Updated niches for ${updatedCount} creators! Saving...`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Done!');
  } else {
    console.log('No matches found.');
  }
}

updateNiches().catch(console.error);
