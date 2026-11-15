import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const requestedPort = Number(process.argv[2] || process.env.PORT || 4173);
let activePort = requestedPort;
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', `http://127.0.0.1:${activePort}`).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(filePath);
    if (!info.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mime.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch (error) {
    console.error('Local request failed:', error);
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error instanceof URIError) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(500).end('Local server error');
  }
});

function listenOnAvailablePort(port) {
  const onError = (error) => {
    server.removeListener('listening', onListening);
    if (error.code === 'EADDRINUSE' && port < requestedPort + 20) {
      listenOnAvailablePort(port + 1);
      return;
    }
    console.error(`PDF Studio could not start on 127.0.0.1:${port}: ${error.message}`);
    process.exitCode = 1;
  };
  const onListening = () => {
    server.removeListener('error', onError);
    const address = server.address();
    activePort = address.port;
    console.log(`PDF Studio is ready at http://127.0.0.1:${address.port}`);
    console.log('Only this computer can reach the local server. Press Ctrl+C to stop it.');
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '127.0.0.1');
}

listenOnAvailablePort(requestedPort);
