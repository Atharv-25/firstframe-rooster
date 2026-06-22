import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const RAPID_API_KEY = process.env.VITE_RAPID_API_KEY || 'ff83759c9fmsh2fd8dd20ef6d5a7p1e826bjsneb095a981be6';
const RAPID_API_HOST = 'instagram-looter2.p.rapidapi.com';

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return await res.json();
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

function formatNumber(num) {
  if (!num) return '10K';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

async function run() {
  console.log('Downloading latest creators.json...');
  const { data: blob, error } = await supabase.storage.from('creator-data').download(`creators.json?t=${Date.now()}`);
  if (error) { console.error('Error fetching', error); return; }
  
  let creators = JSON.parse(await blob.text());
  let updatedCount = 0;

  // 1. Fetch Oishiki Das Video
  console.log('Fetching Oishiki Das new video...');
  const targetUrl = 'https://www.instagram.com/reel/DZUPIBQy0mD/';
  const data = await fetchWithRetry(`https://${RAPID_API_HOST}/post?url=${encodeURIComponent(targetUrl)}`, {
    headers: { 'x-rapidapi-key': RAPID_API_KEY, 'x-rapidapi-host': RAPID_API_HOST }
  });
  
  if (data && data.status === true && data.is_video) {
      const videoRes = await fetch(data.video_url);
      const buffer = Buffer.from(await videoRes.arrayBuffer());
      const filename = `reel_oishiki_${Date.now()}.mp4`;
      
      await supabase.storage.from('videos').upload(filename, buffer, { contentType: 'video/mp4', upsert: true });
      const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/videos/${filename}`;
      
      const match = creators.find(c => c.name.toLowerCase().includes('oishiki'));
      if (match) {
         if (!match.reels) match.reels = [];
         if (match.reels.length === 0) match.reels.push({});
         match.reels[0].videoUrl = publicUrl;
         match.reels[0].thumbnailUrl = data.thumbnail_src || publicUrl;
         updatedCount++;
         console.log(`✅ Oishiki Das permanently fixed.`);
      }
  } else {
      console.log(`❌ Failed to fetch Oishiki Das video.`);
  }

  // 2. Fetch Live Followers, Views, Engagement for everyone
  console.log(`\nStarting live follower sync for ${creators.length} creators...`);
  for (const c of creators) {
    if (!c.handle || c.handle.includes('instagram.com')) continue;
    
    console.log(`Fetching stats for @${c.handle}...`);
    const pData = await fetchWithRetry(`https://${RAPID_API_HOST}/profile?username=${encodeURIComponent(c.handle)}`, {
      headers: { 'x-rapidapi-key': RAPID_API_KEY, 'x-rapidapi-host': RAPID_API_HOST }
    });
    
    if (pData && pData.status === true && pData.edge_followed_by) {
       const newFollowers = formatNumber(pData.edge_followed_by.count);
       let updated = false;

       if (c.followers !== newFollowers) {
          c.followers = newFollowers;
          updated = true;
       }

       const edges = pData.edge_owner_to_timeline_media?.edges || [];
       const videoEdges = edges.filter(e => e.node && e.node.is_video && e.node.video_view_count);
       
       if (videoEdges.length > 0) {
          let totalViews = 0;
          let totalEngagements = 0;
          videoEdges.forEach(e => {
             totalViews += e.node.video_view_count || 0;
             totalEngagements += (e.node.edge_media_preview_like?.count || 0) + (e.node.edge_media_to_comment?.count || 0);
          });
          
          const avgViewsNum = Math.floor(totalViews / videoEdges.length);
          const newAvgViews = formatNumber(avgViewsNum);
          
          if (c.avgViews !== newAvgViews) {
             c.avgViews = newAvgViews;
             updated = true;
          }
          
          if (totalViews > 0) {
             const engRateNum = ((totalEngagements / totalViews) * 100);
             const newEngRate = engRateNum > 0.1 ? engRateNum.toFixed(1) + '%' : '1.5%';
             if (c.engagementRate !== newEngRate && c.engagementRate !== undefined) {
                 c.engagementRate = newEngRate;
                 updated = true;
             }
          }
       }

       if (updated) {
          updatedCount++;
          console.log(` ✅ Updated @${c.handle} | ${c.followers} followers`);
       }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (updatedCount > 0) {
    console.log(`\nSaving to Supabase... updated data for ${updatedCount} profiles.`);
    await supabase.storage.from('creator-data').upload('creators.json', JSON.stringify(creators, null, 2), { upsert: true, contentType: 'application/json' });
    console.log('✅ Follower sync + Oishiki complete!');
  } else {
    console.log('✅ Nothing changed.');
  }
}

run().catch(console.error);
