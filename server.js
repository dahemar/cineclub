const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = 8002; // Puerto diferente para no conflictos

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function withCharset(contentType) {
  if (!contentType) return contentType;
  if (contentType.startsWith('text/')) return `${contentType}; charset=utf-8`;
  if (contentType === 'application/javascript') return `${contentType}; charset=utf-8`;
  if (contentType === 'application/json') return `${contentType}; charset=utf-8`;
  return contentType;
}

function cacheControlForExt(ext) {
  // HTML: prefer revalidation so prerender updates show up quickly.
  if (ext === '.html') return 'no-cache';
  // Static assets: cache aggressively.
  if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

function shouldGzip(req, contentType) {
  const ae = (req.headers['accept-encoding'] || '').toLowerCase();
  if (!ae.includes('gzip')) return false;
  return (
    contentType.startsWith('text/') ||
    contentType === 'application/javascript' ||
    contentType === 'application/json' ||
    contentType === 'image/svg+xml'
  );
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Parsear la URL
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      let output = content;

      if (filePath === './index.html') {
        try {
          const prerenderPath = path.join(__dirname, 'posts.html');
          if (fs.existsSync(prerenderPath)) {
            const prerenderHtml = fs.readFileSync(prerenderPath, 'utf-8');
            const htmlString = content.toString('utf-8');
            const injected = htmlString.replace(
              /<main\s+class="col-left"[^>]*>[\s\S]*?<\/main>/i,
              (match) => {
                const openTagMatch = match.match(/<main\s+class="col-left"[^>]*>/i);
                const openTag = openTagMatch ? openTagMatch[0] : '<main class="col-left">';
                return `${openTag}\n${prerenderHtml}\n</main>`;
              }
            );
            output = injected;
          }
        } catch (e) {
          console.warn('Prerender injection failed:', e.message);
        }
      }

      const headers = {
        'Content-Type': withCharset(contentType),
        'Cache-Control': cacheControlForExt(extname),
        'Vary': 'Accept-Encoding',
      };

      const bodyBuffer = Buffer.isBuffer(output) ? output : Buffer.from(String(output), 'utf-8');

      if (shouldGzip(req, contentType)) {
        zlib.gzip(bodyBuffer, (zipErr, gz) => {
          if (zipErr) {
            res.writeHead(200, headers);
            res.end(bodyBuffer);
            return;
          }
          res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
          res.end(gz);
        });
        return;
      }

      res.writeHead(200, headers);
      res.end(bodyBuffer);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📂 Sirviendo archivos desde: ${__dirname}`);
  console.log(`\n🌐 Abre en tu navegador: http://localhost:${PORT}`);
});

