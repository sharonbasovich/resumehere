/** Real browser gate. Authored, NOT RUN in the restricted local execution environment.
 * Run against an authorized public deployment or developer-local browser environment. */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
