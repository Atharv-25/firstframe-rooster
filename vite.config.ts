import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { spawn } from 'child_process'
import https from 'node:https'
import http from 'node:http'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

function apiPlugin() {
  return {
    name: 'vite-api-endpoints',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // --- RAPIDAPI QUICK FETCH FOR "FETCH DETAILS" BUTTON ---
        if (req.url === '/api/fetch-profile' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const { profileUrl } = JSON.parse(body);
              const handleMatch = profileUrl.match(/instagram\.com\/([^\/]+)/);
              if (!handleMatch) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Invalid URL' }));
              }
              
              let absoluteUrl = profileUrl;
              if (!/^https?:\/\//i.test(absoluteUrl)) {
                absoluteUrl = 'https://' + absoluteUrl;
              }
              
              const username = handleMatch[1];
              const apifyToken = process.env.VITE_APIFY_TOKEN;

              if (apifyToken) {
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
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, name: profile.fullName || username, followers: followersStr }));
                  }
                }
              }

              if (!/^https?:\/\//i.test(absoluteUrl)) {
                absoluteUrl = 'https://' + absoluteUrl;
              }
              
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
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, name: nameStr, followers: followersStr }));
              } else {
                throw new Error('Instagram blocked the request. Please enter the Name and Followers manually.');
              }
            } catch (e: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        // --- APIFY AUTOMATED SCRAPING TRIGGER ---
        if (req.url === '/api/process-creator' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { profileUrl, reelUrl } = JSON.parse(body);
              
              // Load the vercel handler dynamically
              const { default: handler } = await import('./api/process-creator.js');
              
              // Create mock req and res for the vercel handler
              const mockReq = {
                method: 'POST',
                body: { profileUrl, reelUrl }
              };
              
              const mockRes = {
                status: function(code) {
                  this.statusCode = code;
                  return this;
                },
                json: function(data) {
                  res.writeHead(this.statusCode || 200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(data));
                  return this;
                }
              };
              
              await handler(mockReq, mockRes);

            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // --- DIRECT CLOUDINARY UPLOAD PIPELINE ---
        if (req.url === '/api/upload-video' && req.method === 'POST') {
          const cloudUrl = process.env.VITE_CLOUDINARY_URL?.trim();
          if (!cloudUrl) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing Cloudinary config' }));
            return;
          }
          const parsed = new URL(cloudUrl);
          cloudinary.config({
            cloud_name: parsed.hostname,
            api_key: parsed.username,
            api_secret: parsed.password
          });

          const uploadStream = cloudinary.uploader.upload_stream({ resource_type: 'video', folder: 'firstframe-creators' }, (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: error.message }));
            } else {
              console.log('Successfully uploaded to Cloudinary:', result.secure_url);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, url: result.secure_url }));
            }
          });
          
          req.pipe(uploadStream);
          return;
        }

        // --- DIRECT CLOUDINARY DELETE PIPELINE ---
        if (req.url === '/api/delete-video' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { url } = JSON.parse(body);
              if (!url || !url.includes('cloudinary.com')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid Cloudinary URL' }));
                return;
              }

              const cloudUrl = process.env.VITE_CLOUDINARY_URL?.trim();
              const parsed = new URL(cloudUrl);
              cloudinary.config({ cloud_name: parsed.hostname, api_key: parsed.username, api_secret: parsed.password });

              // Extract public_id from secure_url (e.g. https://res.cloudinary.com/dqkfarwzn/video/upload/v1782140360/firstframe-creators/rkcuax6gsf5gnddr5wsv.mp4)
              const parts = url.split('/');
              const filename = parts.pop();
              const publicId = 'firstframe-creators/' + filename.split('.')[0];

              console.log('Deleting from Cloudinary:', publicId);
              cloudinary.uploader.destroy(publicId, { resource_type: 'video' }, (error, result) => {
                 res.writeHead(200, { 'Content-Type': 'application/json' });
                 res.end(JSON.stringify({ success: true, result }));
              });
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (req.url === '/api/add-to-campaign' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const scriptPath = path.resolve(__dirname, 'scripts/append_to_sheet.py');
              const pyProcess = spawn('python3', [scriptPath, '-']);
              let stdoutData = '';
              let stderrData = '';
              
              pyProcess.stdout.on('data', data => { stdoutData += data; });
              pyProcess.stderr.on('data', data => { stderrData += data; });
              
              pyProcess.on('error', err => {
                console.error('Failed to spawn Python script:', err);
                if (!res.writableEnded) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Spawn error: ${err.message}` }));
                }
              });
              
              pyProcess.on('close', code => {
                if (res.writableEnded) return;
                if (code === 0) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, message: stdoutData.trim() }));
                } else {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: stderrData.trim() || 'Python script failed' }));
                }
              });

              pyProcess.stdin.write(body);
              pyProcess.stdin.end();
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  }
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    apiPlugin(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
