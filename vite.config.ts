import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { spawn } from 'child_process'

function apiPlugin() {
  return {
    name: 'vite-api-endpoints',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/save-creators' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const creatorsPath = path.resolve(__dirname, 'src/app/data/creators.json');
              fs.writeFileSync(creatorsPath, body, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url === '/api/upload-video' && req.method === 'POST') {
          const filename = req.headers['x-filename'] as string;
          if (!filename) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing X-Filename header' }));
            return;
          }
          try {
            const dirPath = path.resolve(__dirname, 'public/videos');
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }
            const filePath = path.resolve(dirPath, filename);
            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);
            req.on('end', () => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, filename }));
            });
            req.on('error', (err) => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            });
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url === '/api/download-reel' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { url } = JSON.parse(body);
              if (!url) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing Instagram URL' }));
                return;
              }
              const scriptPath = path.resolve(__dirname, 'scripts/download_reel.py');
              const pyProcess = spawn('python3', [scriptPath, url]);
              let stdoutData = '';
              let stderrData = '';
              
              pyProcess.stdout.on('data', data => { stdoutData += data; });
              pyProcess.stderr.on('data', data => { stderrData += data; });
              
              pyProcess.on('error', err => {
                console.error('Failed to spawn download_reel.py:', err);
                if (!res.writableEnded) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Spawn error: ${err.message}` }));
                }
              });
              
              pyProcess.on('close', code => {
                if (res.writableEnded) return;
                if (code === 0) {
                  try {
                    const result = JSON.parse(stdoutData.trim());
                    if (result.success) {
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: true, filename: result.filename }));
                    } else {
                      res.writeHead(500, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ error: result.error || 'Failed to download Reel' }));
                    }
                  } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Parse error: ${stdoutData.trim()}` }));
                  }
                } else {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: stderrData.trim() || 'Python script failed' }));
                }
              });
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
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
