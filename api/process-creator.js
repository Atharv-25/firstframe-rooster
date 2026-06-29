import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { profileUrl, reelUrl } = req.body;
    if (!profileUrl) {
      return res.status(400).json({ error: 'Missing profileUrl' });
    }

    const rapidApiKey = process.env.VITE_RAPID_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!rapidApiKey || !supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Missing RapidAPI or Supabase credentials in environment' });
    }

    // Connect to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    let targetUrl = reelUrl && reelUrl.trim() !== '' ? reelUrl.trim() : profileUrl.trim();
    
    if (targetUrl && (targetUrl.includes('instagram.com/reel/') || targetUrl.includes('instagram.com/p/'))) {
      console.log(`Fetching reel from RapidAPI: ${targetUrl}`);
      try {
        const rapidRes = await fetch(`https://instagram-downloader-v2-scraper-reels-igtv-posts-stories.p.rapidapi.com/get-post?url=${encodeURIComponent(targetUrl)}`, {
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'instagram-downloader-v2-scraper-reels-igtv-posts-stories.p.rapidapi.com'
          }
        });
        const rapidJson = await rapidRes.json();
        
        const firstMedia = rapidJson.media && rapidJson.media.length > 0 ? rapidJson.media[0] : null;
        if (firstMedia && firstMedia.is_video) {
          let videoUrl = firstMedia.url;
          const coverUrl = firstMedia.thumb || firstMedia.url;
          
          let shortcode = 'unknown';
          try {
            shortcode = targetUrl.split('reel/')[1]?.split('/')[0] || targetUrl.split('p/')[1]?.split('/')[0] || Date.now();
          } catch(e) {}
          
          // Download and permanently store video in Supabase so it doesn't expire
          try {
            console.log(`Downloading MP4 for permanent storage...`);
            const vidRes = await fetch(videoUrl);
            const arrayBuffer = await vidRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            const filename = `reel_${shortcode}_${Date.now()}.mp4`;
            const { error: upErr } = await supabase.storage.from('videos').upload(filename, buffer, {
              contentType: 'video/mp4',
              upsert: true
            });
            
            if (!upErr) {
               videoUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/videos/${filename}`;
               console.log(`Successfully stored in Supabase: ${videoUrl}`);
            }
          } catch(err) {
            console.error(`Failed to store video permanently:`, err.message);
          }
          
          let username = 'creator';
          try {
            username = profileUrl.split('instagram.com/')[1].split('/')[0].split('?')[0];
          } catch(e) {}
          
          const fullName = username;
          
          // Insert raw Instagram link into Postgres. The downstream logic will instantly auto-migrate it to Cloudinary!
          await supabase.from('instagram_creators').insert({
            instagram_username: username,
            full_name: fullName,
            post_id: shortcode,
            post_url: targetUrl,
            post_type: 'Video',
            original_video_url: videoUrl,
            original_image_url: coverUrl,
            scraped_at: new Date().toISOString()
          });
          console.log('Successfully scraped from RapidAPI and inserted into DB!');
        } else {
          console.error('RapidAPI returned unexpected data:', rapidJson);
        }
      } catch (err) {
        console.error('RapidAPI fetch failed:', err);
      }
    }

    console.log('Syncing database with frontend creators.json...');

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
      
      // Prioritize Supabase/Cloudinary permanent storage over temporary Instagram CDN to prevent expiring links
      let bestVideoUrl = row.storage_public_url || row.original_video_url || row.post_url;
      
      // Auto-migrate expiring Instagram links to Cloudinary if available
      if (process.env.VITE_CLOUDINARY_URL && bestVideoUrl && bestVideoUrl.includes('.fbcdn.net') && !bestVideoUrl.includes('res.cloudinary.com')) {
        try {
          console.log(`Uploading to Cloudinary for ${username}...`);
          const cloudUrl = process.env.VITE_CLOUDINARY_URL.trim();
          const parsed = new URL(cloudUrl);
          cloudinary.config({
            cloud_name: parsed.hostname,
            api_key: parsed.username,
            api_secret: parsed.password
          });
          
          const uploadRes = await cloudinary.uploader.upload(bestVideoUrl, {
            resource_type: 'video',
            folder: 'firstframe-creators'
          });
          
          bestVideoUrl = uploadRes.secure_url;
          console.log(`Successfully migrated to Cloudinary: ${bestVideoUrl}`);
          
          // Save back to Supabase so we don't upload it again next time
          await supabase.from('instagram_creators').update({ storage_public_url: bestVideoUrl }).eq('id', row.id);
        } catch (err) {
          console.error(`Failed to upload to Cloudinary for ${username}:`, err);
          // It will fallback to the original fbcdn.net link if it fails
        }
      }

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

      if (dbCreator.reels.length > 0) {
        // Enforce STRICTLY 1 video per creator. Overwrite any existing reels with the newly fetched one.
        existingCreator.reels = [dbCreator.reels[0]];
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
