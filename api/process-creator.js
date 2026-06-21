import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { profileUrl, reelUrl } = req.body;
    if (!profileUrl) {
      return res.status(400).json({ error: 'Missing profileUrl' });
    }

    const apifyToken = process.env.VITE_APIFY_TOKEN;
    const apifyActorId = process.env.VITE_APIFY_ACTOR_ID || 'potent_sarod~instagram-supabase-pipeline';
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!apifyToken || !supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Missing Apify or Supabase credentials in environment' });
    }

    const targetUrl = reelUrl && reelUrl.trim() !== '' ? reelUrl : profileUrl;
    
    const payload = JSON.stringify({
      profileUrls: [targetUrl],
      scrapeReels: true,
      scrapeImages: false,
      supabaseUrl: supabaseUrl,
      supabaseKey: supabaseKey
    });

    // Call Apify API synchronously (waitForFinish=120)
    console.log('Triggering Apify...');
    const apifyRes = await fetch(`https://api.apify.com/v2/acts/${apifyActorId}/runs?token=${apifyToken}&waitForFinish=120`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload
    });

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      return res.status(500).json({ error: `Apify failed: ${errText}` });
    }

    console.log('Apify finished. Syncing database with Supabase Storage bucket...');
    
    // Connect to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch raw scraped data from postgres
    const { data: dbRows, error: dbError } = await supabase
      .from('instagram_creators')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;

    // 2. Fetch current creators.json from Storage bucket
    let creatorsData = [];
    const { data: bucketData, error: bucketError } = await supabase.storage
      .from('creator-data')
      .download('creators.json');

    if (!bucketError && bucketData) {
      const text = await bucketData.text();
      creatorsData = JSON.parse(text);
      if (!Array.isArray(creatorsData)) creatorsData = creatorsData.creators || [];
    }

    // 3. Merge data
    const grouped = {};
    for (const row of dbRows) {
      const username = row.instagram_username;
      if (!grouped[username]) {
        grouped[username] = {
          username: username,
          full_name: row.full_name,
          profile_url: `https://www.instagram.com/${username}/`,
          followers_count: row.followers_count || 0,
          reels: []
        };
      }
      
      const bestVideoUrl = row.original_video_url || row.storage_public_url || row.post_url;
      if (bestVideoUrl) {
        grouped[username].reels.push({
          id: `reel_${row.post_id || row.id}`,
          label: 'Demo Reel',
          videoUrl: bestVideoUrl,
          coverUrl: row.displayUrl || row.display_url || row.original_image_url || row.thumbnail_url || undefined
        });
      }
    }

    function formatNumber(num) {
      if (!num) return '—';
      if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return num.toString();
    }

    for (const username in grouped) {
      const dbCreator = grouped[username];
      let existingCreator = creatorsData.find(c => 
        c.handle === username || 
        (c.profileUrl && c.profileUrl.toLowerCase().includes(username.toLowerCase()))
      );

      const formattedFollowers = formatNumber(dbCreator.followers_count);

      if (!existingCreator) {
        existingCreator = {
          id: `creator_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: dbCreator.full_name || username,
          handle: username,
          profileUrl: `https://www.instagram.com/${username}/`,
          followers: formattedFollowers,
          niches: [],
          reels: []
        };
        creatorsData.push(existingCreator);
      } else {
        if (!existingCreator.name || existingCreator.name === existingCreator.handle) {
          existingCreator.name = dbCreator.full_name || existingCreator.name;
        }
        if (existingCreator.followers === '—' && formattedFollowers !== '—') {
          existingCreator.followers = formattedFollowers;
        }
      }

      const existingReelIds = existingCreator.reels.map(r => r.id);
      for (const reel of dbCreator.reels) {
        const idx = existingReelIds.indexOf(reel.id);
        if (idx === -1) {
          existingCreator.reels.push(reel);
          existingReelIds.push(reel.id);
        } else {
          existingCreator.reels[idx] = reel;
        }
      }
    }

    // 4. Upload merged data back to Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from('creator-data')
      .upload('creators.json', JSON.stringify(creatorsData, null, 2), {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) throw uploadError;

    return res.status(200).json({ success: true, message: 'Actor finished and sync complete' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
