/** Real browser gate. Authored, NOT RUN in the restricted local execution environment.
 * Run against an authorized public deployment or developer-local browser environment. */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const URL=process.env.RESUMEHERE_URL ?? 'http://127.0.0.1:4173/';
test('signed-out sample, branch rollback, reload, undo, and axe',async({page})=>{
 await page.goto(URL);
 await page.getByRole('button',{name:/Try the meetup/}).click();
 await page.getByRole('button',{name:'Yes',exact:true}).click();
 await page.getByRole('button',{name:'Confirm change'}).click();
 for(let i=0;i<5;i++)await page.getByRole('button',{name:/Mark complete/}).click();
 await expect(page.getByRole('heading',{name:'A clear place to finish.'})).toBeVisible();
 await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
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
