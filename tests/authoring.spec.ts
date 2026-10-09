import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Guide, Session } from '../src/engine';

const URL=process.env.RESUMEHERE_URL ?? 'http://127.0.0.1:4173/';
type Snapshot = {guide: Guide; session: Session};
async function snapshot(page:Page):Promise<Snapshot> {
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const open=indexedDB.open('resumehere-original-v1',1);
  open.onupgradeneeded=()=>open.transaction?.abort();open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const db=open.result;const tx=db.transaction('workspace','readonly');const read=tx.objectStore('workspace').get('active');tx.oncomplete=()=>{db.close();resolve(JSON.parse(read.result));};tx.onabort=()=>{db.close();reject(tx.error);};};
 }));
}
async function finished(page:Page){
 await page.goto(URL);await page.getByRole('button',{name:/Try the meetup/}).click();
 await page.getByRole('button',{name:'Yes',exact:true}).click();await page.getByRole('button',{name:'Confirm change'}).click();
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'Mark complete'}).click();
 await expect.poll(async()=>(await snapshot(page)).session.completed.length).toBe(5);
 return snapshot(page);
}
const editorNode=(page:Page,id:string)=>page.locator('.editor-node').filter({has:page.locator('#text-'+id)});
const preview=(page:Page)=>page.getByRole('button',{name:'Preview guide'});
const dialog=(page:Page)=>page.getByRole('dialog',{name:'Review before continuing'});
async function review(page:Page){await preview(page).click();await page.getByRole('button',{name:'Review changes & run'}).click();}
async function restoredExactly(page:Page,before:Snapshot){
 await page.getByRole('button',{name:'Undo last transition'}).click();
 await expect.poll(()=>snapshot(page)).toEqual(before);
 await page.reload();await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();
 expect(await snapshot(page)).toEqual(before);
}

test('repair a deleted action explicitly; cancel, reset only its closure, Undo and reload exactly',async({page},info)=>{
 const before=await finished(page);await page.getByRole('button',{name:'Edit instructions'}).click();
 await page.getByRole('button',{name:'Remove step 1',exact:true}).click();
 const checkin=editorNode(page,'checkin');const missing=checkin.getByRole('checkbox',{name:/Missing step: Save your fictional booking code/});
 await expect(missing).toBeChecked();await expect(preview(page)).toBeDisabled();expect(await snapshot(page)).toEqual(before);
 await missing.press('Space');await expect(checkin.getByRole('checkbox',{name:'Pack a notebook.',exact:true})).toBeFocused();
 await page.keyboard.press('Space');await expect(checkin.getByRole('checkbox',{name:'Pack a notebook.',exact:true})).toBeChecked();
 await expect(preview(page)).toBeEnabled();expect(await snapshot(page)).toEqual(before);
 await checkin.screenshot({path:info.outputPath('action-repair.png')});
 await review(page);await expect(dialog(page).getByRole('region',{name:'Completed steps to reset (4)'})).toContainText('Save your fictional booking code');
 await expect(dialog(page).getByRole('region',{name:'Still complete (1)'})).toContainText('Pack a notebook.');expect(await snapshot(page)).toEqual(before);
 await page.keyboard.press('Escape');await expect(dialog(page)).not.toBeVisible();
 await page.getByRole('button',{name:'Review changes & run'}).click();await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Back to editor'}).click();await page.getByRole('button',{name:'Cancel editing'}).click();
 await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();expect(await snapshot(page)).toEqual(before);
 // Cancel discarded the draft: repeat the intended deletion and reassignment.
 await page.getByRole('button',{name:'Edit instructions'}).click();await page.getByRole('button',{name:'Remove step 1',exact:true}).click();
 await missing.click();await expect(missing).toHaveCount(0);await checkin.getByRole('checkbox',{name:'Pack a notebook.',exact:true}).check();await review(page);
 await page.screenshot({path:info.outputPath('action-reset-preview.png')});await dialog(page).getByRole('button',{name:'Confirm change'}).click();
 await expect.poll(async()=>(await snapshot(page)).session.completed).toEqual(['notebook']);
 const changed=await snapshot(page);expect(changed.guide.nodes.some(n=>n.id==='code')).toBe(false);
 expect(changed.guide.nodes.find(n=>n.id==='checkin')!.prerequisites).toEqual(['notebook']);expect(changed.session.answers).toEqual({kit:'yes'});
 await page.reload();await expect(page.locator('.resume-strip strong')).toHaveText('1 of 5 actions complete');expect(await snapshot(page)).toEqual(changed);
 await restoredExactly(page,before);
});

test('deleted decision conditions stay visibly invalid until explicitly cleared or reassigned; preserve No',async({page},info)=>{
 const before=await finished(page);await page.getByRole('button',{name:'Edit instructions'}).click();await page.getByRole('button',{name:'Remove step 3',exact:true}).click();
 const collect=editorNode(page,'collect');const sheet=editorNode(page,'sheet');
 await expect(preview(page)).toBeDisabled();
 for(const node of [collect,sheet]){await expect(node.getByLabel('Only needed when')).toHaveValue('kit');await expect(node.getByLabel('Only needed when')).toHaveAttribute('aria-invalid','true');await expect(node.getByRole('option',{name:/Missing choice:/})).toHaveAttribute('disabled','');}
 await expect(sheet.getByRole('combobox',{name:'Required answer for step 5'})).toHaveValue('no');expect(await snapshot(page)).toEqual(before);
 await sheet.screenshot({path:info.outputPath('missing-choice.png')});
 await page.getByRole('button',{name:'+ Choice',exact:true}).click();await page.getByLabel('Question',{exact:true}).fill('Have you reserved a replacement kit?');
 await collect.getByLabel('Only needed when').selectOption('');await expect(preview(page)).toBeDisabled();
 await sheet.getByLabel('Only needed when').selectOption({label:'Have you reserved a replacement kit?'});
 await expect(sheet.getByRole('combobox',{name:'Required answer for step 5'})).toHaveValue('no');await expect(preview(page)).toBeEnabled();
 await review(page);await expect(dialog(page).getByRole('region',{name:'Completed steps to reset (2)'})).toContainText('Collect your reserved kit');
 await expect(dialog(page).getByRole('region',{name:'Still complete (3)'})).toContainText('Pack a notebook.');
 await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();expect(await snapshot(page)).toEqual(before);
 await page.getByRole('button',{name:'Review changes & run'}).click();await dialog(page).getByRole('button',{name:'Confirm change'}).click();
 await expect.poll(async()=>(await snapshot(page)).session.completed).toEqual(['code','notebook','checkin']);
 const changed=await snapshot(page);expect(changed.session.answers).toEqual({});expect(changed.guide.nodes.find(n=>n.id==='collect')!.condition).toBeUndefined();
 const replacement=changed.guide.nodes.find(n=>n.text==='Have you reserved a replacement kit?')!;
 expect(changed.guide.nodes.find(n=>n.id==='sheet')!.condition).toEqual({decisionId:replacement.id,answer:'no'});
 await page.reload();await expect(page.locator('.resume-strip strong')).toHaveText('3 of 6 actions complete');expect(await snapshot(page)).toEqual(changed);
 await restoredExactly(page,before);
});

test('repair controls reflow at 320px and work with native keyboard focus on desktop and narrow layouts',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(URL);await page.getByRole('button',{name:/Try the meetup/}).click();
 await page.getByRole('button',{name:'Edit instructions'}).click();await page.getByRole('button',{name:'Remove step 1',exact:true}).click();
 const checkin=editorNode(page,'checkin');const missing=checkin.getByRole('checkbox',{name:/Missing step:/});
 await checkin.getByRole('textbox').press('Tab');await expect(missing).toBeFocused();await expect(missing).toHaveCSS('outline-width','3px');
 await checkin.screenshot({path:info.outputPath('desktop-keyboard.png')});
 await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await checkin.screenshot({path:info.outputPath('narrow-action-repair.png')});
 const small=await checkin.locator('button,select,.check-label').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<44).map(n=>n.textContent));expect(small).toEqual([]);
 await missing.press('Space');await expect(checkin.getByRole('checkbox',{name:'Pack a notebook.',exact:true})).toBeFocused();
 await page.keyboard.press('Space');await page.getByRole('button',{name:'Remove step 2',exact:true}).click();
 const sheet=editorNode(page,'sheet');const gate=sheet.getByLabel('Only needed when');await sheet.getByRole('combobox',{name:/Required answer/}).press('Shift+Tab');await expect(gate).toBeFocused();await expect(gate).toHaveCSS('outline-width','3px');
 await sheet.screenshot({path:info.outputPath('narrow-choice-repair.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 // Native select keyboard operation removes the condition only after explicit selection.
 await gate.press('Home');await gate.press('ArrowDown');await gate.press('Enter');
 await expect(gate).toHaveValue('');await expect(sheet.getByRole('combobox',{name:/Required answer/})).toHaveCount(0);
 await page.emulateMedia({forcedColors:'active'});await sheet.screenshot({path:info.outputPath('forced-colors-repair.png')});
 await page.getByRole('button',{name:'Cancel editing'}).click();await expect(page.locator('.resume-strip strong')).toHaveText('0 of 6 actions complete');
});
