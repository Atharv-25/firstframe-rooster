const fs = require('fs');
const md = fs.readFileSync('C:/Users/lenovo/.gemini/antigravity-ide/brain/4096ac7e-141c-4ad7-b8bd-92a17cf50d30/all_creators_reels.md', 'utf-8');
const lines = md.split('\n').filter(l => l.startsWith('|') && !l.includes(':---') && !l.includes('Creator Name'));
const reelMap = {};
for (const line of lines) {
  const parts = line.split('|').map(p => p.trim());
  if (parts.length >= 4) {
    const rawName = parts[1].replace(/\*\*/g, '').trim();
    const handle = parts[2].replace(/`/g, '').trim();
    let link = parts[3];
    const linkMatch = link.match(/\[Link\]\((.*?)\)/);
    const url = linkMatch ? linkMatch[1] : null;
    
    // Some handles are N/A. Let's map by name and handle.
    if (url) {
      reelMap[rawName.toLowerCase()] = url;
      if (handle !== 'N/A') {
        reelMap[handle.toLowerCase()] = url;
      }
    }
  }
}

const creators = JSON.parse(fs.readFileSync('parsed_creators_db.json', 'utf-8'));
for (const c of creators) {
  const nameKey = c.name.toLowerCase();
  const handleKey = c.handle.replace('@', '').toLowerCase();
  c.demo_video_url = reelMap[handleKey] || reelMap[nameKey] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Fallback
}

fs.writeFileSync('parsed_creators_db.json', JSON.stringify(creators, null, 2));
console.log('Merged demo_video_url into parsed_creators_db.json');
