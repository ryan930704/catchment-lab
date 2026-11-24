import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('../dist/', import.meta.url);
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', webp: 'image/webp', png: 'image/png', txt: 'text/plain' };
const port = Number(process.env.CATCHMENT_PORT || 4173);

const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!/^(?:assets\/)?[\w.-]+$/.test(file)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(new URL(file, root));
    res.writeHead(200, { 'Content-Type': types[file.split('.').at(-1)] || 'text/plain' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});

server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}`));
