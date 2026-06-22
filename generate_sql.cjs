const fs = require('fs');
const crypto = require('crypto');
const data = JSON.parse(fs.readFileSync('parsed_creators_db.json'));

let creatorsSQL = [];

data.forEach((c, i) => {
  const safeName = c.name.replace(/'/g, "''");
  const safeHandle = c.handle.replace(/'/g, "''");
  
  const email = `roster_${i}_${Date.now()}@example.com`;
  const phone = `+1555${String(i).padStart(6, '0')}`;
  
  const userId = crypto.randomUUID();
  const creatorId = crypto.randomUUID();
  const adminId = crypto.randomUUID();

  // Use a fallback for nulls
  const bio = c.bio ? `'${c.bio.replace(/'/g, "''")}'` : "''";
  const demoUrl = c.demo_video_url ? `'${c.demo_video_url.replace(/'/g, "''")}'` : "'https://www.youtube.com/watch?v=dQw4w9WgXcQ'";

  creatorsSQL.push(`(
    '${creatorId}', 
    '${userId}', 
    '${safeName}',     
    '${phone}',        
    '${email}',        
    '${safeHandle}',   
    '',                
    '',                
    ${demoUrl},        
    '',                
    ARRAY['UGC']::text[], 
    true,              
    '${adminId}', 
    0,                 
    0,                 
    0                  
  )`);
});

const sql = `
-- Disable foreign key checks and triggers temporarily
SET session_replication_role = 'replica';

DELETE FROM public.creator_profiles WHERE is_on_roster = true;

INSERT INTO public.creator_profiles (
  id, 
  user_id, 
  full_name, 
  phone, 
  email, 
  instagram_handle, 
  youtube_handle,
  profile_photo_url,
  demo_video_url,
  experience,
  niche, 
  is_on_roster,
  added_by_admin_id,
  follower_count_youtube,
  avg_views_instagram,
  avg_views_youtube
) VALUES
${creatorsSQL.join(',\n')};

-- Re-enable foreign key checks and triggers
SET session_replication_role = 'origin';
`;

fs.writeFileSync('insert_creators.sql', sql);
