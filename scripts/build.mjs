import { cp, mkdir } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
await cp(new URL('../src/', import.meta.url), dist, { recursive: true });
await cp(new URL('../../LICENSE', import.meta.url), new URL('LICENSE', dist));
console.log('Static site built in app/dist');
