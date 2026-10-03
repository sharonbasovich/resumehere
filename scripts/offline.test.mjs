import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildOffline } from './offline.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'resumehere-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'assets'));
  await writeFile(join(dir, 'index.html'), '<title>First version</title>');
  await writeFile(join(dir, 'assets', 'app.js'), 'console.log("first")');
  return dir;
}
test('identical precache bytes produce identical revision and worker', async t => {
  const dir = await fixture(t);
  const first = await buildOffline(dir), second = await buildOffline(dir);
  assert.equal(first.revision, second.revision);
  assert.equal(first.source, second.source);
  assert.match(first.revision, /^[a-f0-9]{64}$/);
});
test('HTML-only title/CSP change invalidates worker even with identical asset filenames and bytes', async t => {
  const dir = await fixture(t), first = await buildOffline(dir);
  await writeFile(join(dir, 'index.html'), '<meta http-equiv="Content-Security-Policy" content="default-src self"><title>Second version</title>');
  const second = await buildOffline(dir);
  assert.deepEqual(first.files, second.files);
  assert.notEqual(first.revision, second.revision);
  assert.notEqual(first.source, second.source);
  assert.equal(second.manifest.find(x=>x.url==='./').sha256, second.manifest.find(x=>x.url==='./index.html').sha256);
});
test('changed asset bytes invalidate revision without changing the asset filename', async t => {
  const dir = await fixture(t), first = await buildOffline(dir);
  await writeFile(join(dir, 'assets', 'app.js'), 'console.log("other")');
  const second = await buildOffline(dir);
  assert.deepEqual(first.files, second.files);
  assert.notEqual(first.revision, second.revision);
});
test('nested assets and root static files are included and content-addressed', async t => {
  const dir = await fixture(t);
  await mkdir(join(dir, 'assets', 'fonts'));
  await writeFile(join(dir, 'assets', 'fonts', 'local font.woff2'), 'synthetic-font-bytes');
  await writeFile(join(dir, 'icon.svg'), '<svg/>');
  const first = await buildOffline(dir);
  assert.ok(first.files.includes('./assets/fonts/local%20font.woff2'));
  assert.ok(first.files.includes('./icon.svg'));
  await writeFile(join(dir, 'icon.svg'), '<svg>changed</svg>');
  assert.notEqual(first.revision, (await buildOffline(dir)).revision);
});
test('previous generated sw.js is excluded from its own revision; file removal changes identity', async t => {
  const dir = await fixture(t), first = await buildOffline(dir);
  await writeFile(join(dir, 'sw.js'), 'arbitrary previous worker');
  assert.equal(first.revision, (await buildOffline(dir)).revision);
  await rm(join(dir, 'assets', 'app.js'));
  assert.notEqual(first.revision, (await buildOffline(dir)).revision);
});
test('missing index fails rather than producing a broken offline shell', async t => {
  const dir = await fixture(t);
  await rm(join(dir, 'index.html'));
  await assert.rejects(buildOffline(dir), /requires dist\/index.html/);
});
test('generated worker resolves project-site URLs, reloads install requests and preserves other deployment and legacy caches', async t => {
  const dir = await fixture(t), result = await buildOffline(dir);
  const handlers={}, removed=[], installed=[]; let claimed=false;
  const prefix='resumehere-scope:'+encodeURIComponent('https://example.test/resumehere/')+':';
  const cacheName=prefix+result.revision;
  const otherScope='resumehere-scope:'+encodeURIComponent('https://example.test/another-deployment/')+':old';
  const current={addAll:async requests=>installed.push(...requests),match:async()=>undefined};
  const context={URL,Request,self:{registration:{scope:'https://example.test/resumehere/'},location:{origin:'https://example.test'},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,handler)=>{handlers[name]=handler;}},caches:{open:async name=>{assert.equal(name,cacheName);return current;},keys:async()=>[cacheName,prefix+'old',otherScope,'resumehere-old','unrelated-app'],delete:async key=>{removed.push(key);return true;}},fetch:async()=>{throw new Error('Network not expected in install/activation VM test');}};
  vm.runInNewContext(await readFile(join(dir,'sw.js'),'utf8'),context);
  let pending;handlers.install({waitUntil:promise=>{pending=promise;}});await pending;
  assert.ok(installed.some(r=>r.url==='https://example.test/resumehere/'));
  assert.ok(installed.some(r=>r.url==='https://example.test/resumehere/index.html'));
  assert.ok(installed.every(r=>r.cache==='reload'));
  assert.ok(installed.every(r=>r.url.startsWith('https://example.test/resumehere/')));
  handlers.activate({waitUntil:promise=>{pending=promise;}});await pending;
  assert.deepEqual(removed,[prefix+'old']);assert.equal(claimed,true);
});
test('generated fetch handler reads only its own revision and falls back to network on a miss', async t => {
  const dir=await fixture(t), result=await buildOffline(dir), handlers={};let networks=0,hit=true;
  const cacheName='resumehere-scope:'+encodeURIComponent('https://example.test/resumehere/')+':'+result.revision;
  const context={URL,Request,self:{registration:{scope:'https://example.test/resumehere/'},location:{origin:'https://example.test'},addEventListener:(name,handler)=>{handlers[name]=handler;}},caches:{open:async name=>{assert.equal(name,cacheName);return {match:async()=>hit?'current-version-response':undefined};}},fetch:async()=>{networks++;return 'network-response';}};
  vm.runInNewContext(result.source,context);
  const request=new Request('https://example.test/resumehere/index.html');let pending;
  handlers.fetch({request,respondWith:promise=>{pending=promise;}});
  assert.equal(await pending,'current-version-response');assert.equal(networks,0);
  hit=false;handlers.fetch({request,respondWith:promise=>{pending=promise;}});
  assert.equal(await pending,'network-response');assert.equal(networks,1);
  let responded=false;handlers.fetch({request:new Request('https://another.test/'),respondWith:()=>{responded=true;}});
  assert.equal(responded,false);
});
