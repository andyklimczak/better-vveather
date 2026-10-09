import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
// Each build needs its own origin: WXT emits root-relative asset URLs.
for (const [build, port] of [['chrome-mv3', 4173], ['firefox-mv2', 4174]]) {
  const root = resolve('.output', build);
  createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const path = resolve(root, `.${decodeURIComponent(pathname)}`);
      if (!path.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(path);
      response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream' });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  }).listen(port, '127.0.0.1');
}
