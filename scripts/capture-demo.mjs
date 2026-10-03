// Capture-only tooling: no application edits or direct DOM/storage/result injection.
// Genuine app controls intentionally update progress.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {chromium, expect} from '@playwright/test';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(ROOT);
const OUT=path.join(ROOT,'demo-capture');
const BASE='http://127.0.0.1:4173/';
const BASELINE='1063f75d472bef6262f14bca356ac4a867540056';
const VIEWPORT={width:1920,height:1080};
const TIMING=JSON.parse(await fs.readFile('scripts/demo-narration-timing.json','utf8'));
const HASHES=JSON.parse(await fs.readFile('scripts/demo-source-hashes.json','utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const json=(file,data)=>fs.writeFile(path.join(OUT,file),JSON.stringify(data,null,2)+'\n');
async function verifyInputs(){
 for(const [file,hash] of Object.entries(HASHES))assert.equal(digest(await fs.readFile(file)),hash,`Reviewed source changed: ${file}`);
 assert.equal(TIMING.durationSeconds,165);
 assert.deepEqual(TIMING.scenes.map(s=>s.id),['01-place','02-start','03-resume','04-correct','05-undo','06-authored','07-next']);
 assert.equal(JSON.parse(await fs.readFile('package-lock.json','utf8')).packages['node_modules/@playwright/test'].version,'1.63.0');
 assert.match(await fs.readFile('vite.config.ts','utf8'),/base: '\.\/'/);
 console.log('PASS: reviewed source hashes, relative Vite base, seven scenes and 165-second narration.');
}
await verifyInputs();
if(process.argv.includes('--verify-only'))process.exit(0);
await fs.mkdir(path.join(OUT,'screenshots'),{recursive:true});
await fs.mkdir(path.join(OUT,'raw'),{recursive:true});
const manifest={status:'running',baselineCommit:BASELINE,captureCommit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,viewport:VIEWPORT,url:BASE,sourceHashes:HASHES,narrationSeconds:165,scenes:[],events:[],screenshots:[],errors:[],limits:['Real Chromium capture only; no full offline lifecycle or accessibility certification.','One fresh context and one page throughout; only genuine controls change progress.','Event timestamps are monotonic milliseconds from immediately before newPage; allow video startup offset when trimming.','No visible cursor overlay is injected. Mouse movements are genuine, but Playwright video may omit the OS cursor.','Raw scene lengths include extra holds; retime narration and captions after frame review.']};
await json('manifest.json',manifest);
const browser=await chromium.launch();
const context=await browser.newContext({viewport:VIEWPORT,recordVideo:{dir:path.join(OUT,'raw'),size:VIEWPORT},locale:'en-US',timezoneId:'UTC'});
const epoch=performance.now();
const stamp=()=>Math.round(performance.now()-epoch);
const event=async(type,details={})=>{const e={type,ms:stamp(),...details};manifest.events.push(e);await fs.appendFile(path.join(OUT,'events.jsonl'),JSON.stringify(e)+'\n');return e;};
const page=await context.newPage();
const video=page.video();
page.on('pageerror',e=>manifest.errors.push({type:'pageerror',ms:stamp(),message:e.message}));
page.on('requestfailed',r=>manifest.errors.push({type:'requestfailed',ms:stamp(),url:r.url(),message:r.failure()?.errorText}));
page.on('response',r=>{if(r.status()>=400)manifest.errors.push({type:'http',ms:stamp(),url:r.url(),status:r.status()});});
const savedStatus=()=>page.getByRole('banner').getByText('◉ Saved on this device',{exact:true});
async function savedProgress(){
 const raw=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('resumehere-original-v1',1);
  request.onupgradeneeded=()=>request.transaction?.abort();
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result;try{const tx=db.transaction('workspace','readonly');const read=tx.objectStore('workspace').get('active');tx.oncomplete=()=>{db.close();resolve(read.result);};tx.onabort=()=>{db.close();reject(tx.error??new Error('Snapshot read aborted.'));};tx.onerror=()=>{db.close();reject(tx.error);};}catch(e){db.close();reject(e);}};
 }));
 if(typeof raw!=='string')return null;
 const s=JSON.parse(raw);return {guideId:s.guide?.id,answers:s.session?.answers,completed:s.session?.completed?.sort()};
}
async function persisted(label,answer,completed){
 const expected={guideId:'fictional-meetup',answers:{kit:answer},completed:[...completed].sort()};
 await expect(savedStatus()).toBeVisible();
 await expect.poll(savedProgress,{timeout:15000,message:label}).toEqual(expected);
 await event('persisted-snapshot',{label,snapshot:await savedProgress()});
}
async function shot(name){const file=`screenshots/${name}.png`;await page.screenshot({path:path.join(OUT,file)});manifest.screenshots.push({file,ms:stamp(),sha256:digest(await fs.readFile(path.join(OUT,file)))});await event('screenshot',{file});}
async function click(locator,label){await locator.scrollIntoViewIfNeeded();await locator.hover();await sleep(450);await event('click-before',{label});await locator.click();await event('click-after',{label});await sleep(650);}
async function top(){await page.keyboard.press('Control+Home');await sleep(700);}
async function hold(seconds,label){const start=stamp();await event('idle-start',{label});await sleep(seconds*1000);await event('idle-end',{label,start});}
async function scene(index,run){const s=TIMING.scenes[index];const start=stamp();const item={id:s.id,startMs:start,narrationStartSeconds:s.startSeconds,narrationEndSeconds:s.endSeconds,minimumSeconds:s.endSeconds-s.startSeconds+s.followingPauseSeconds+3};manifest.scenes.push(item);await event('scene-start',{id:s.id});await run();const remaining=item.minimumSeconds-(stamp()-start)/1000;if(remaining>0)await hold(remaining,`${s.id}-end-hold`);item.endMs=stamp();await event('scene-end',{id:s.id});await json('manifest.json',manifest);}
const CODE='Save your fictional booking code: DEMO-42.';
const NOTE='Pack a notebook.';
const CHECK='Check in at the community desk after 10:00.';
const KIT='Collect your reserved kit from the blue shelf.';
const SHEET='Pick up a blank activity sheet from the green shelf.';
const TABLE='Bring your kit or activity sheet to table 4.';
const THREE=['checkin','code','notebook'];const FIVE=[...THREE,'collect','table'];
const row=text=>page.getByRole('complementary').getByRole('listitem').filter({has:page.getByText(text,{exact:true})});
async function state(text,value){await expect(row(text).locator('.state-label')).toHaveText(value);}
async function complete(text){await expect(page.getByRole('heading',{name:text,exact:true})).toBeVisible();await click(page.getByRole('button',{name:/Mark complete/}),`Complete: ${text}`);}
let failure;
try{
 for(let attempt=0;attempt<60;attempt++){try{const r=await fetch(BASE);if(r.ok)break;}catch{}if(attempt===59)throw Error('Preview server unavailable');await sleep(500);}
 await event('navigation-before');await page.goto(BASE,{waitUntil:'networkidle'});await event('navigation-after');
 await scene(0,async()=>{await expect(page.getByRole('heading',{name:/Plans change/})).toBeVisible();await shot('01-landing');await hold(9,'landing');await click(page.getByRole('button',{name:/Try the meetup/}),'Try fictional meetup');await expect(page.getByRole('heading',{name:'The whole path'})).toBeVisible();await expect(page.getByText(/Fictional demonstration sample/)).toBeVisible();await top();await shot('01-fictional-guide');});
 await scene(1,async()=>{await click(page.getByRole('button',{name:'Yes',exact:true}),'Choose Yes');await click(page.getByRole('button',{name:'Confirm change'}),'Confirm Yes');await complete(CODE);await complete(NOTE);await complete(CHECK);await persisted('three before reload','yes',THREE);await expect(page.getByText('3 of 6 actions complete',{exact:true})).toBeVisible();await expect(page.getByText('Last completed: '+CHECK,{exact:true})).toBeVisible();await state(SHEET,'Not needed');await top();await shot('02-three-complete');await row(SHEET).scrollIntoViewIfNeeded();await shot('02-sheet-not-needed');await hold(3,'not-needed-is-not-complete');await top();});
 await scene(2,async()=>{await top();await persisted('reload precondition','yes',THREE);await hold(4,'saved-before-reload');await event('reload-before');await page.reload({waitUntil:'networkidle'});await event('reload-after');await expect(page.getByRole('status')).toHaveText('Your saved place is restored. Review your choices and continue.');await expect(page.locator('.choice-buttons button').filter({hasText:/^Yes$/})).toHaveAttribute('aria-pressed','true');await expect(page.getByText('3 of 6 actions complete',{exact:true})).toBeVisible();await expect(page.getByText('Last completed: '+CHECK,{exact:true})).toBeVisible();await persisted('reload restored three','yes',THREE);await shot('03-restored-three');await hold(9,'restoration-visible');await complete(KIT);await complete(TABLE);await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();await persisted('finished five','yes',FIVE);await top();await shot('03-finished-five');});
 await scene(3,async()=>{await click(page.getByRole('button',{name:'No',exact:true}),'Choose No');const dialog=page.getByRole('dialog',{name:'Review before continuing'});await expect(dialog.getByRole('heading',{name:'Completed steps to reset (2)'})).toBeVisible();await expect(dialog.getByRole('heading',{name:'Still complete (3)'})).toBeVisible();await expect(dialog.locator('ul').nth(0).getByRole('listitem')).toHaveText([KIT,TABLE]);await expect(dialog.locator('ul').nth(1).getByRole('listitem')).toHaveText([CODE,NOTE,CHECK]);await shot('04-reset-two-retain-three');await hold(13,'review-reset-and-retained-lists');await click(page.getByRole('button',{name:'Confirm change'}),'Confirm No');await persisted('corrected branch','no',THREE);await state(KIT,'Not needed');await state(SHEET,'Ready');await state(TABLE,'Waiting');await expect(page.getByText('3 of 6 actions complete',{exact:true})).toBeVisible();await top();await shot('04-corrected-three');await row(TABLE).scrollIntoViewIfNeeded();await shot('04-sheet-ready-table-waiting');await hold(4,'corrected-branch-states');await top();});
 await scene(4,async()=>{await click(page.getByRole('button',{name:'Undo last transition'}),'Undo last transition');await persisted('undo restores five and Yes','yes',FIVE);await expect(page.locator('.choice-buttons button').filter({hasText:/^Yes$/})).toHaveAttribute('aria-pressed','true');await expect(page.getByText('5 of 6 actions complete',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();await state(SHEET,'Not needed');await state(KIT,'Complete');await state(TABLE,'Complete');await top();await shot('05-full-state-undo');await row(TABLE).scrollIntoViewIfNeeded();await shot('05-restored-branch-states');await hold(4,'restored-complete-versus-not-needed');await top();});
 await scene(5,async()=>{await click(page.getByRole('button',{name:'Edit instructions'}),'Inspect authored instructions');await expect(page.getByLabel('Original instructions',{exact:true})).toBeVisible();await expect(page.getByText('Linked source: characters 0–42',{exact:true})).toBeVisible();await top();await shot('06-original-and-source');await hold(5,'source-link');
 await page.locator('#gate-collect').scrollIntoViewIfNeeded();await expect(page.locator('#gate-collect')).toHaveValue('kit');await expect(page.getByLabel('Required answer for step 5')).toHaveValue('yes');await expect(page.locator('.editor-node').nth(4).getByRole('checkbox',{name:CHECK,exact:true})).toBeChecked();await shot('06-explicit-prerequisite-and-condition');await hold(7,'authored-condition');await click(page.getByRole('button',{name:'Cancel editing'}),'Cancel without editing');await persisted('editor did not alter progress','yes',FIVE);await page.locator('.privacy-row').scrollIntoViewIfNeeded();await expect(page.getByText(/Saved in this browser, without encryption/)).toBeVisible();await shot('06-local-privacy');await hold(5,'privacy-note');});
 await scene(6,async()=>{await top();await shot('07-finished-app-for-editorial-limits');await hold(12,'closing-real-app');});
 assert.deepEqual(manifest.errors,[],'Capture contained browser or network errors');
 manifest.status='captured';
}catch(error){failure=error;manifest.status='failed';manifest.failure=String(error?.stack??error);console.error(manifest.failure);await json('manifest.json',manifest);try{await shot('failure');}catch{}}
finally{
 try{await event('context-close-before');await context.close();if(video)await fs.rename(await video.path(),path.join(OUT,'resumehere-continuous.webm'));await event('context-close-after');}
 catch(error){failure??=error;manifest.status='failed';manifest.finalizationFailure=String(error?.stack??error);}
 finally{await browser.close();await json('manifest.json',manifest);}
}
try{
 const file=path.join(OUT,'resumehere-continuous.webm');
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
 await json('ffprobe.json',probe);const stream=probe.streams.find(s=>s.codec_type==='video');assert.equal(stream.width,VIEWPORT.width);assert.equal(stream.height,VIEWPORT.height);assert.ok(Number(probe.format.duration)>0);
 execFileSync('ffmpeg',['-v','error','-xerror','-i',file,'-f','null','-'],{stdio:'pipe'});
 manifest.video={file:'resumehere-continuous.webm',sha256:digest(await fs.readFile(file)),durationSeconds:Number(probe.format.duration),fullDecodePassed:true};
 if(!failure){assert.ok(Number(probe.format.duration)>165);assert.equal(manifest.scenes.length,7);for(const s of manifest.scenes)assert.ok((s.endMs-s.startMs)/1000>=s.minimumSeconds-0.05);manifest.status='passed';}
}catch(error){failure??=error;manifest.status='failed';manifest.decodeFailure=String(error?.stack??error);}
await json('manifest.json',manifest);
if(failure)throw failure;
console.log('PASS: continuous real-browser capture, persistence/rollback/undo assertions, seven scenes, and full video decode. Frame inspection and narration assembly remain.');
