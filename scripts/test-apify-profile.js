require('dotenv').config({path:'.env.local'});
const token = process.env.VITE_APIFY_TOKEN;
const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}`;
fetch(url, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ usernames: ['ugcwithshiw'] })
}).then(r=>r.json()).then(j=>console.log(j));
