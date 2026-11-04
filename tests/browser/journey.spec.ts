import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('field session survives offline reload, exports, then clears durably', async ({ page, context }, testInfo) => {
 const errors: string[]=[]; page.on('pageerror', e=>errors.push(e.message));
 await page.goto('./');
 await page.evaluate(async()=>{ await navigator.serviceWorker.ready; });
 await page.reload();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);
 await page.getByRole('button',{name:'Enter manually',exact:true}).click();
 await page.getByLabel('Participant ID').fill('SYNTHETIC-001');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Start questionnaire'}).click();
 await page.getByRole('radio',{name:'4',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('radio',{name:'8 out of 10',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Saving changes'})).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('radio',{name:'8 out of 10',exact:true})).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('radio').first().click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('radio',{name:'Yes',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('textbox').fill('Simple & useful 🧪');
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('spinbutton').fill('42');
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('button',{name:'Review answers',exact:true}).click();
 await page.getByRole('button',{name:'Submit and export'}).click();
 await expect(page.getByText('Session complete',{exact:true})).toBeVisible();
 await page.evaluate(()=>{
  const original=URL.createObjectURL;
  URL.createObjectURL=()=>{URL.createObjectURL=original;throw new Error('Synthetic download failure');};
 });
 await page.getByRole('button',{name:'JSON',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Your answers are still available');
 for(const format of ['JSON','CSV','XLSX','TXT','XML']) {
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:format,exact:true}).click();
  const file=await download;
  expect(await file.failure()).toBeNull();
  expect(file.suggestedFilename()).toContain('SYNTHETIC-001');
  const bytes=await readFile((await file.path())!);
  expect(bytes.length).toBeGreaterThan(100);
  if(format!=='XLSX') expect(bytes.toString()).toContain('SYNTHETIC-001');
 }
 await page.screenshot({path:testInfo.outputPath('mobile-export.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'New session'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Clear and start over'}).click();
 await expect(page.getByRole('button',{name:'Enter manually',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('button',{name:'Enter manually',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('incompatible saved data is preserved until explicit durable clear', async ({ page }) => {
 await page.goto('./');
 await expect(page.getByRole('button',{name:'Enter manually',exact:true})).toBeVisible();
 await page.evaluate(async()=> {
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('pwa-quest',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put({participantId:'SYNTHETIC-INVALID',currentIndex:-1},'session');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
 });
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('incompatible');
 await page.getByRole('button',{name:'Retry saved session'}).click();
 await expect(page.getByRole('alert')).toContainText('incompatible');
 await page.evaluate(()=>{IDBObjectStore.prototype.delete=function(){throw new DOMException('Synthetic deletion failure','InvalidStateError');};});
 await page.getByRole('button',{name:'Clear saved session',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Clear saved session',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Could not clear');
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('incompatible');
 await page.getByRole('button',{name:'Clear saved session',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Clear saved session',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('alert')).toHaveCount(0);
});

test('camera denial offers manual entry without losing setup',async({page})=>{
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied for test','NotAllowedError');};});
 await page.goto('./');
 await page.getByRole('button',{name:'Scan QR',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(/Camera/);
 await page.getByRole('button',{name:'Enter manually instead'}).click();
 await expect(page.getByLabel('Participant ID')).toBeVisible();
});
