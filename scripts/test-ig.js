// No import needed for fetch in Node 18+

async function test() {
  const url = 'https://www.instagram.com/reel/DYoZSn3tOgu/';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const html = await res.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    console.log('Title:', titleMatch ? titleMatch[1] : 'not found');
    console.log('Description:', descMatch ? descMatch[1] : 'not found');
    
    // Look for "@username"
    const atMatches = html.match(/@[a-zA-Z0-9._]+/g);
    if (atMatches) {
        console.log('Potential usernames:', [...new Set(atMatches)].slice(0, 10));
    }
  } catch(e) {
    console.error(e);
  }
}
test();
