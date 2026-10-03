import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Content-address the complete precache, including index.html and its ./ alias.
 * No timestamps, file-size shortcuts, or dependency on Vite's filename hashing. */
export async function buildOffline(distDir = 'dist') {
  async function walk(relative = '') {
    const entries = await readdir(join(distDir, relative), { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const path = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) files.push(...await walk(path));
      else if (entry.isFile() && path !== 'sw.js') files.push(path);
    }
    return files.sort();
  }
  const paths = await walk();
  if (!paths.includes('index.html')) throw new Error('Offline build requires dist/index.html.');
  const manifest = [];
  for (const path of paths) {
    const digest = createHash('sha256').update(await readFile(join(distDir, path))).digest('hex');
    const url = './' + path.split('/').map(encodeURIComponent).join('/');
    manifest.push({ url, sha256: digest });
    if (path === 'index.html') manifest.push({ url: './', sha256: digest });
  }
  manifest.sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  const revision = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const files = manifest.map(entry => entry.url);
  const source = `// ResumeHere precache revision: ${revision}
const PREFIX='resumehere-scope:'+encodeURIComponent(self.registration.scope)+':';
const CACHE=PREFIX+${JSON.stringify(revision)};
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>{
  // Reload avoids seeding a new content revision from stale HTTP-cache responses.
  const requests=FILES.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(requests)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(response=>response||fetch(event.request)));
});
`;
  await writeFile(join(distDir, 'sw.js'), source);
  return { revision, files, manifest, source };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildOffline();
}
