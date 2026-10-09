import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const URL=process.env.RESUMEHERE_URL ?? 'http://127.0.0.1:4173/';
const receipt=(page:Page)=>page.getByRole('region',{name:'Latest change in this guide'});
const progress=(page:Page,complete:number,inactive:number,remaining:number)=>page.getByRole('img',{name:`Action progress: ${complete} complete, ${inactive} not needed, ${remaining} remaining, out of 6.`});
async function start(page:Page){await page.goto(URL);await page.getByRole('button',{name:/Try the meetup/}).click();}
async function answer(page:Page,value:'Yes'|'No'){await page.getByRole('button',{name:value,exact:true}).click();await page.getByRole('button',{name:'Confirm change'}).click();}
async function saved(page:Page){
 await expect(page.getByRole('banner').getByText('◉ Saved on this device',{exact:true})).toBeVisible();
 const completed=Number((await page.locator('.resume-strip strong').innerText()).split(' ')[0]);
 const answer=await page.getByRole('button',{name:'Yes',exact:true}).getAttribute('aria-pressed')==='true'?'yes':await page.getByRole('button',{name:'No',exact:true}).getAttribute('aria-pressed')==='true'?'no':null;
 await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{
  const request=indexedDB.open('resumehere-original-v1',1);
  request.onupgradeneeded=()=>request.transaction?.abort();
  request.onerror=()=>resolve(null);
  request.onsuccess=()=>{const db=request.result;const tx=db.transaction('workspace','readonly');const read=tx.objectStore('workspace').get('active');tx.oncomplete=()=>{db.close();const snapshot=JSON.parse(read.result);resolve({completed:snapshot.session.completed.length,answer:snapshot.session.answers.kit??null});};tx.onabort=()=>{db.close();resolve(null);};};
 }))).toEqual({completed,answer});
}

test('truthful action progress, cancel/Escape, no-op answers, receipt reload and repeated Undo',async({page},info)=>{
 await start(page);await expect(progress(page,0,0,6)).toBeVisible();
 await answer(page,'Yes');await expect(progress(page,0,1,5)).toBeVisible();
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'Mark complete'}).click();
 await expect(progress(page,5,1,0)).toBeVisible();
 await expect(receipt(page)).toContainText('Completed: Bring your kit or activity sheet to table 4.');
 await page.screenshot({path:info.outputPath('complete.png'),fullPage:true});
 await page.getByRole('button',{name:'No',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review before continuing'});
 await expect(dialog.getByRole('region',{name:'Completed steps to reset (2)'})).toContainText('Collect your reserved kit');
 await expect(dialog.getByRole('region',{name:'Still complete (3)'})).toContainText('Pack a notebook.');
 await page.screenshot({path:info.outputPath('consequences.png')});
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('button',{name:'No',exact:true})).toBeFocused();
 await expect(progress(page,5,1,0)).toBeVisible();
 await page.getByRole('button',{name:'No',exact:true}).click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Yes',exact:true})).toHaveAttribute('aria-pressed','true');
 await answer(page,'Yes');await expect(page.getByRole('status')).toHaveText('This answer is already selected. No progress changed.');
 await expect(receipt(page)).toContainText('Completed: Bring your kit or activity sheet to table 4.');
 await answer(page,'No');await expect(progress(page,3,1,2)).toBeVisible();
 await expect(receipt(page)).toContainText('from Yes to No.');await expect(receipt(page)).toContainText('2 completed actions reset; 3 kept complete.');
 await saved(page);await page.reload();await expect(receipt(page)).toContainText('from Yes to No.');await expect(progress(page,3,1,2)).toBeVisible();
 await page.screenshot({path:info.outputPath('change-receipt.png'),fullPage:true});
 const undo=page.getByRole('button',{name:'Undo last transition'});
 await undo.click();await expect(progress(page,5,1,0)).toBeVisible();await expect(receipt(page)).toContainText('Completed: Bring your kit or activity sheet to table 4.');
 await expect(undo).toBeFocused();await saved(page);await page.reload();await expect(progress(page,5,1,0)).toBeVisible();
 for(let i=0;i<6;i++)await undo.click();await expect(undo).toBeDisabled();await expect(receipt(page)).toContainText('No changes to undo yet.');await expect(progress(page,0,0,6)).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('reduced motion keeps immediate meaning and native keyboard focus',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await start(page);await answer(page,'Yes');
 await page.getByRole('button',{name:'Mark complete'}).click();await expect(progress(page,1,1,4)).toBeVisible();
 expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
 await page.getByRole('button',{name:'No',exact:true}).click();
 await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Confirm change'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Confirm change'})).toHaveCSS('outline-width','3px');
 await page.screenshot({path:info.outputPath('keyboard-focus.png')});
 // Await focus after every key. Browser-chrome traversal at the edge of the
 // native tab cycle differs by engine; inspect the dialog's own controls.
 const cancel=page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true});
 await page.keyboard.press('Shift+Tab');await expect(cancel).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.getByRole('dialog').locator('summary')).toBeFocused();
 await page.keyboard.press('Tab');await expect(cancel).toBeFocused();
 expect(await page.getByRole('dialog').evaluate(e=>e.matches(':modal'))).toBe(true);
 expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Undo last transition'}).click();await expect(progress(page,0,1,5)).toBeVisible();
 await page.screenshot({path:info.outputPath('reduced-motion.png'),fullPage:true});
});

test('320px layout, 200% text zoom equivalent, 44px controls and forced colors',async({page},info)=>{
 await page.setViewportSize({width:320,height:800});await page.goto(URL);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('home-320px.png'),fullPage:true});
 await page.getByRole('button',{name:/Try the meetup/}).click();await answer(page,'Yes');
 await page.getByRole('button',{name:'Mark complete'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const shortControls=await page.locator('button:visible, summary:visible, a:visible').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().height<44).map(e=>e.textContent));
 expect(shortControls).toEqual([]);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('320px.png'),fullPage:true});
 await page.getByRole('button',{name:'No',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.keyboard.press('Escape');
 // Playwright has no cross-browser native zoom API. Double the root type size at
 // 640 CSS px to exercise text reflow; this is explicitly not a native zoom claim.
 await page.setViewportSize({width:640,height:900});await page.addStyleTag({content:':root{font-size:32px}'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('200pct-text.png'),fullPage:true});
 await page.emulateMedia({forcedColors:'active'});
 await expect(progress(page,1,1,4)).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('forced-colors.png'),fullPage:true});
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('motion responds only to changes and interruption leaves the latest state',async({page},info)=>{
 await start(page);expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
 await page.getByRole('button',{name:'Mark complete'}).click();
 // Slow active effects to 10% for inspection; neither their playback nor their
 // cancellation controls the app's authoritative state or persistence.
 const timings=await page.evaluate(()=>document.getAnimations().map(a=>{a.updatePlaybackRate(.1);return a.effect?.getTiming().duration;}));
 expect(timings).toContain(180);expect(timings).toContain(260);
 await page.screenshot({path:info.outputPath('motion-at-10pct.png')});
 await expect(progress(page,1,0,5)).toBeVisible();
 await page.getByRole('button',{name:'Undo last transition'}).click();await expect(progress(page,0,0,6)).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect.poll(()=>page.evaluate(()=>document.getAnimations().length)).toBe(0);
 await saved(page);await page.reload();await expect(progress(page,0,0,6)).toBeVisible();
});

test('dialog keyboard paging keeps the guide still and restored focus visible',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:640,height:450});
 await start(page);await answer(page,'Yes');
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'Mark complete'}).click();
 await saved(page);
 const no=page.getByRole('button',{name:'No',exact:true});
 await no.click();
 const dialog=page.getByRole('dialog',{name:'Review before continuing'});
 await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
 const backgroundY=await page.evaluate(()=>window.scrollY);
 // Page beyond each dialog boundary, as a keyboard reader can do. The brief
 // pause lets the browser's own scrolling settle; it does not control app state.
 for(let i=0;i<8;i++)await page.keyboard.press('PageUp');
 await page.waitForTimeout(250);
 await expect.poll(()=>dialog.evaluate(e=>e.scrollTop)).toBe(0);
 expect(await page.evaluate(()=>window.scrollY)).toBe(backgroundY);
 for(let i=0;i<8;i++)await page.keyboard.press('PageDown');
 await page.waitForTimeout(250);
 expect(await page.evaluate(()=>window.scrollY)).toBe(backgroundY);
 await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();await expect(no).toBeFocused();
 await expect(no).toBeInViewport();
 await expect(progress(page,5,1,0)).toBeVisible();
 await saved(page);
});
