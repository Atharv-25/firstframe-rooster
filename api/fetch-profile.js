export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { profileUrl } = req.body;
    
    if (!profileUrl) {
      return res.status(400).json({ success: false, error: 'Missing profileUrl' });
    }

    const handleMatch = profileUrl.match(/instagram\.com\/([^\/?]+)/);
    if (!handleMatch) {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }
    
    const username = handleMatch[1];
    const apifyToken = process.env.VITE_APIFY_TOKEN;

    if (apifyToken) {
      // Use Apify Profile Scraper to bypass IP blocks reliably
      const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
      
      const apifyRes = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username] })
      });
      
      if (apifyRes.ok) {
        const data = await apifyRes.json();
        if (data && data.length > 0) {
          const profile = data[0];
          
          let followersStr = profile.followersCount;
          if (followersStr >= 1000000) followersStr = (followersStr / 1000000).toFixed(1) + 'M';
          else if (followersStr >= 1000) followersStr = (followersStr / 1000).toFixed(1) + 'K';
          else followersStr = followersStr.toString();
          
          return res.status(200).json({
            success: true,
            name: profile.fullName || username,
            followers: followersStr
          });
        }
      }
    }

    // Fallback to naive fetch if Apify fails or token missing
    let absoluteUrl = profileUrl;
    if (!/^https?:\/\//i.test(absoluteUrl)) absoluteUrl = 'https://' + absoluteUrl;

    const fetchRes = await fetch(absoluteUrl);
    const html = await fetchRes.text();
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    
    if (descMatch && titleMatch) {
      const desc = descMatch[1];
      const title = titleMatch[1];
      
      const fMatch = desc.match(/^([\d,.]+M?K?)\s+Followers/i);
      const nMatch = title.match(/^(.+?)\s*\(&#064;/);
      
      let followersStr = fMatch ? fMatch[1] : '';
      let nameStr = nMatch ? nMatch[1].trim() : 'Unknown';
      
      nameStr = nameStr.replace(/&#(x)?([a-zA-Z0-9]+);/g, (match, isHex, val) => {
        return String.fromCodePoint(parseInt(val, isHex ? 16 : 10));
      }).replace(/&amp;/g, '&');
      
      if (followersStr.includes(',')) {
        const num = parseInt(followersStr.replace(/,/g, ''), 10);
        if (num >= 1000000) followersStr = (num / 1000000).toFixed(1) + 'M';
        else if (num >= 1000) followersStr = (num / 1000).toFixed(1) + 'K';
      }
      
      return res.status(200).json({
        success: true,
        name: nameStr,
        followers: followersStr
      });
    } else {
      return res.status(500).json({ success: false, error: 'Instagram blocked the Vercel server IP. Please enter the Name and Followers manually.' });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: `Instagram blocked the Vercel server IP. Please enter the Name and Followers manually.` });
  }
}
