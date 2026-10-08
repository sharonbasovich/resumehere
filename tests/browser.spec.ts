/** Real-browser gate. Run against a production build; PR CI provisions reference browsers. */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { buildOffline } from '../scripts/offline.mjs';
const URL=process.env.RESUMEHERE_URL ?? 'http://127.0.0.1:4173/';
// Text locators include aria-hidden icon text; exact-match the complete header status.
const savedStatus=(page:Page)=>page.getByRole('banner').getByText('◉ Saved on this device',{exact:true});
async function savedProgress(page:Page) {
 const raw=await page.evaluate(()=>new Promise<unknown>((resolve,reject)=>{
  const request=indexedDB.open('resumehere-original-v1',1);
  // This assertion only reads an existing database; never create a missing one.
  request.onupgradeneeded=()=>request.transaction?.abort();
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result;
   try {
    const tx=db.transaction('workspace','readonly');
    const read=tx.objectStore('workspace').get('active');
    tx.oncomplete=()=>{db.close();resolve(read.result);};
    tx.onabort=()=>{db.close();reject(tx.error??new Error('Snapshot read aborted.'));};
    tx.onerror=()=>{db.close();reject(tx.error);};
   } catch(error) {db.close();reject(error);}
  };
 }));
 if(typeof raw!=='string')return null;
 const snapshot=JSON.parse(raw);
 return {guideId:snapshot.guide?.id,answers:snapshot.session?.answers,completed:snapshot.session?.completed?.sort()};
}
test('saved-status selector rejects pending, failure, and non-header text',async({page})=>{
 for(const status of ['Local to this browser','Saving on this device…','Not saved. Browser storage is unavailable.','Saved on this device (older guide)']) {
  await page.setContent(`<header><div class="local"><span aria-hidden="true">◉</span> ${status}</div></header><main><span aria-hidden="true">◉</span> Saved on this device</main>`);
  await expect(savedStatus(page)).toHaveCount(0);
 }
 await page.setContent('<header><div class="local"><span aria-hidden="true">◉</span> Saved on this device</div></header>');
 await expect(savedStatus(page)).toBeVisible();
});
test('signed-out sample, branch rollback, reload, undo, and axe',async({page})=>{
 await page.goto(URL);
 await page.getByRole('button',{name:/Try the meetup/}).click();
 await page.getByRole('button',{name:'Yes',exact:true}).click();
 await page.getByRole('button',{name:'Confirm change'}).click();
 for(let i=0;i<5;i++)await page.getByRole('button',{name:/Mark complete/}).click();
 await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();
 await expect(savedStatus(page)).toBeVisible();
 await expect.poll(()=>savedProgress(page),{message:'The completed Yes branch must be committed in IndexedDB before reload.'}).toEqual({guideId:'fictional-meetup',answers:{kit:'yes'},completed:['checkin','code','collect','notebook','table']});
 await page.reload();
 await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();
 await page.getByRole('button',{name:'No',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Completed steps to reset (2)'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Still complete (3)'})).toBeVisible();
 await page.getByRole('button',{name:'Confirm change'}).click();
 await expect(page.getByText('3 of 6 actions complete')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Pick up a blank activity sheet from the green shelf.'})).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.getByRole('button',{name:'Undo last transition'}).click();
 await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();
});
test('narrow 320px viewport and inert source',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.goto(URL);
 await page.getByRole('button',{name:'Create a guide'}).click();
 await page.getByRole('button',{name:'+ Action'}).click();
 await page.getByLabel('Exact instructions').fill('<script>alert(1)</script> Pack a pen.');
 await page.getByRole('button',{name:/Preview guide/}).click();
 await page.getByRole('button',{name:'Review changes & run'}).click();
 await expect(page.getByRole('heading',{name:'<script>alert(1)</script> Pack a pen.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});


test('Chromium service worker controls the app, restores offline progress, and activates shell-only updates safely', async ({ browser }, testInfo) => {
 test.skip(testInfo.project.name !== 'chromium', 'Per-context offline emulation is exercised in Chromium only.');
 const buildDirectory=resolve('dist');
 const temporaryRoot=await mkdtemp(join(tmpdir(),'resumehere-browser-lifecycle-'));
 const oldDirectory=join(temporaryRoot,'old');
 const nextDirectory=join(temporaryRoot,'next');
 let context;
 let server;
 let activeDirectory=oldDirectory;
 try {
  await Promise.all([
   cp(buildDirectory,oldDirectory,{recursive:true}),
   cp(buildDirectory,nextDirectory,{recursive:true})
  ]);
  const originalShell=await readFile(join(nextDirectory,'index.html'),'utf8');
  const updatedShell=originalShell.replace(/<head>/i,'<head><meta name="resumehere-qa-shell-revision" content="two">');
  if(updatedShell===originalShell)throw new Error('Could not mark the second shell-only build.');
  await writeFile(join(nextDirectory,'index.html'),updatedShell);
  const oldBuild=await buildOffline(oldDirectory);
  const nextBuild=await buildOffline(nextDirectory);
  expect(nextBuild.files).toEqual(oldBuild.files);
  const nonShellEntries=manifest=>manifest.filter(entry=>entry.url!=='./'&&entry.url!=='./index.html');
  expect(nonShellEntries(nextBuild.manifest)).toEqual(nonShellEntries(oldBuild.manifest));
  expect(nextBuild.revision).not.toBe(oldBuild.revision);

  const contentTypes={
   '.css':'text/css; charset=utf-8',
   '.html':'text/html; charset=utf-8',
   '.ico':'image/x-icon',
   '.js':'text/javascript; charset=utf-8',
   '.json':'application/json; charset=utf-8',
   '.png':'image/png',
   '.svg':'image/svg+xml',
   '.webp':'image/webp',
   '.woff2':'font/woff2'
  };
  server=createServer((request,response)=>{
   const pathname=new globalThis.URL(request.url??'/','http://127.0.0.1').pathname;
   if(pathname==='/outside.html'){
    response.statusCode=200;
    response.setHeader('Content-Type','text/html; charset=utf-8');
    response.setHeader('Cache-Control','no-store');
    response.end('<!doctype html><title>Update observer</title>');
    return;
   }
   if(!pathname.startsWith('/resumehere/')){
    response.statusCode=404;
    response.end('Not found');
    return;
   }
   let relativePath;
   try { relativePath=decodeURIComponent(pathname.slice('/resumehere/'.length)); }
   catch { response.statusCode=400; response.end('Bad path'); return; }
   const root=resolve(activeDirectory);
   const file=resolve(root,relativePath||'index.html');
   if(file!==root&&!file.startsWith(root+sep)){
    response.statusCode=403;
    response.end('Outside test build');
    return;
   }
   void readFile(file).then(bytes=>{
    response.statusCode=200;
    response.setHeader('Content-Type',contentTypes[extname(file)]??'application/octet-stream');
    response.setHeader('Cache-Control','no-store');
    response.end(bytes);
   }).catch(()=>{
    response.statusCode=404;
    response.end('Not found');
   });
  });
  const port=await new Promise((resolvePort,reject)=>{
   server.once('error',reject);
   server.listen(0,'127.0.0.1',()=>{
    const address=server.address();
    if(address&&typeof address!=='string')resolvePort(address.port);
    else reject(new Error('The isolated static server did not expose a TCP port.'));
   });
  });
  const origin='http://127.0.0.1:'+port;
  const scope=origin+'/resumehere/';
  const workerUrl=scope+'sw.js';
  const cachePrefix='resumehere-scope:'+encodeURIComponent(scope)+':';
  const oldCache=cachePrefix+oldBuild.revision;
  const nextCache=cachePrefix+nextBuild.revision;
  const otherCache='resumehere-scope:'+encodeURIComponent(origin+'/another-deployment/')+':preserve';
  const expectedProgress={guideId:'fictional-meetup',answers:{kit:'yes'},completed:['checkin','code','notebook']};

  context=await browser.newContext({serviceWorkers:'allow'});
  const monitor=await context.newPage();
  await monitor.goto(origin+'/outside.html');
  const page=await context.newPage();
  await page.goto(scope);
  await expect(page.getByRole('heading',{name:/Plans change/})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL??null),{timeout:15000}).toBe(workerUrl);
  await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.ready).scope),{timeout:15000}).toBe(scope);

  await page.getByRole('button',{name:/Try the meetup/}).click();
  await page.getByRole('button',{name:'Yes',exact:true}).click();
  await page.getByRole('button',{name:'Confirm change'}).click();
  for(let i=0;i<3;i++)await page.getByRole('button',{name:/Mark complete/}).click();
  await expect(page.getByText('3 of 6 actions complete',{exact:true})).toBeVisible();
  await expect.poll(()=>savedProgress(page),{message:'Fictional mid-guide progress must be saved before going offline.'}).toEqual(expectedProgress);

  await context.setOffline(true);
  expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'The whole path'})).toBeVisible();
  await expect(page.getByText('3 of 6 actions complete',{exact:true})).toBeVisible();
  await expect.poll(()=>savedProgress(page),{message:'Offline reload must restore the IndexedDB progress.'}).toEqual(expectedProgress);
  await context.setOffline(false);

  await page.evaluate(cacheName=>caches.open(cacheName).then(()=>true),otherCache);
  await expect.poll(()=>page.evaluate(()=>caches.keys())).toContain(oldCache);
  await expect.poll(()=>page.evaluate(()=>caches.keys())).toContain(otherCache);
  activeDirectory=nextDirectory;
  await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.ready;
   await registration.update();
  });
  const waitingState=()=>page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration('/resumehere/');
   return {active:registration?.active?.state??null,waiting:registration?.waiting?.state??null};
  });
  await expect.poll(waitingState,{timeout:20000,message:'The changed shell should wait while the old page is open.'}).toEqual({active:'activated',waiting:'installed'});
  const cachesWhileWaiting=await page.evaluate(()=>caches.keys());
  expect(cachesWhileWaiting).toContain(oldCache);
  expect(cachesWhileWaiting).toContain(nextCache);
  expect(cachesWhileWaiting).toContain(otherCache);

  await page.close();
  const activationState=()=>monitor.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration('/resumehere/');
   return {active:registration?.active?.state??null,waiting:registration?.waiting?.state??null};
  });
  await expect.poll(activationState,{timeout:20000,message:'The waiting worker should activate after its last controlled client closes.'}).toEqual({active:'activated',waiting:null});
  const cachesAfterActivation=await monitor.evaluate(()=>caches.keys());
  expect(cachesAfterActivation).toContain(nextCache);
  expect(cachesAfterActivation).not.toContain(oldCache);
  expect(cachesAfterActivation).toContain(otherCache);

  await monitor.goto(scope);
  await expect.poll(()=>monitor.evaluate(()=>navigator.serviceWorker.controller?.scriptURL??null),{timeout:15000}).toBe(workerUrl);
  await expect(monitor.locator('meta[name="resumehere-qa-shell-revision"]')).toHaveAttribute('content','two');
  await expect(monitor.getByRole('heading',{name:'The whole path'})).toBeVisible();
  await expect.poll(()=>savedProgress(monitor),{message:'Progress must survive the shell-only worker update.'}).toEqual(expectedProgress);
 } finally {
  try { if(context)await context.close(); }
  finally {
   try {
    if(server?.listening)await new Promise((resolveClose,rejectClose)=>server.close(error=>error?rejectClose(error):resolveClose()));
   } finally {
    await rm(temporaryRoot,{recursive:true,force:true});
   }
  }
 }
});
