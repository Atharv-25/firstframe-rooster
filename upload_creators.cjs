const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const rawLinks = fs.readFileSync(path.join(__dirname, 'creators_links.md'), 'utf-8');
    
    // Handle both literal '\n' and actual newlines
    const lines = rawLinks.replace(/\\n/g, '\n').split('\n');
    
    const creatorsJson = [];
    const dbProfiles = [];
    
    for (const line of lines) {
      const match = line.match(/- \[(.+?)\]\((.+?)\)/);
      if (match) {
        let name = match[1].trim();
        let url = match[2].trim();
        
        if (url.includes('?')) url = url.split('?')[0];
        
        let handleMatch = url.match(/instagram\.com\/([^\/]+)/i);
        let handle = handleMatch ? handleMatch[1] : '';
        
        if (!handle && url.includes('instagram.com')) {
           const parts = url.split('/').filter(Boolean);
           handle = parts[parts.length - 1];
        }

        const id = `creator_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

        creatorsJson.push({
          id,
          name,
          handle,
          profileUrl: url,
          followers: '—',
          avgViews: '—',
          niches: ['UGC'],
          reels: [{
             id: `reel_${id}`,
             label: 'Demo Reel',
             videoUrl: ''
          }]
        });
        
        dbProfiles.push({
          name: name.replace(/'/g, "''"),
          handle: handle.replace(/'/g, "''")
        });
      }
    }

    console.log(`Parsed ${creatorsJson.length} creators`);
    fs.writeFileSync('parsed_creators_db.json', JSON.stringify(dbProfiles, null, 2));

    // Upload creators.json to storage bucket 'creator-data'
    console.log('Uploading to creator-data bucket...');
    const { error: upError } = await supabase.storage
      .from('creator-data')
      .upload('creators.json', JSON.stringify(creatorsJson, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    if (upError) throw new Error('Upload error: ' + upError.message);

    console.log('Success! Uploaded ' + creatorsJson.length + ' new creators to JSON bucket.');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
