const fs = require('fs');
const http = require('http');
const path = require('path');

const port = Number(process.env.PORT) || 3000;
const buildPath = path.join(__dirname, 'build');
const indexPath = path.join(buildPath, 'index.html');

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  let requestPath = '/';
  try {
    requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    requestPath = '/';
  }

  const safePath = path
    .normalize(requestPath)
    .replace(/^([/\\])+/, '')
    .replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(buildPath, safePath === '/' ? 'index.html' : safePath);

  fs.readFile(filePath, (fileError, data) => {
    if (!fileError) {
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
      return;
    }

    fs.readFile(indexPath, (indexError, indexData) => {
      if (indexError) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Build output not found. Run npm run build before starting the server.');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexData);
    });
  });
});

server.listen(port, () => {
  console.log(`HotelOS frontend listening on port ${port}`);
});
