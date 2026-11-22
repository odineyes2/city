import {test,expect,type Page} from '@playwright/test';
import {camera,drag} from './helpers';
test('실제 왼쪽/오른쪽 드래그와 휠, 렌더 갱신 이후 입력',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('.city-canvas canvas[data-camera]').waitFor();
 const before=await camera(page),selected=await page.locator('.selection-heading').textContent();await drag(page,'left');const pan=await camera(page);expect(pan.target).not.toEqual(before.target);expect(await page.locator('.selection-heading').textContent()).toBe(selected);
 await drag(page,'right');const rotate=await camera(page);const offset=(c:typeof before)=>c.position.map((n:number,i:number)=>n-c.target[i]);expect(offset(rotate)).not.toEqual(offset(pan));await page.mouse.wheel(0,-400);await page.waitForTimeout(300);const zoom=await camera(page);expect(zoom.zoom).toBeGreaterThan(rotate.zoom);
 await page.waitForTimeout(1700);await drag(page,'right',-100,0);const later=await camera(page);expect(offset(later)).not.toEqual(offset(zoom));expect(later.target[0]).toBeGreaterThanOrEqual(-65);expect(later.target[0]).toBeLessThanOrEqual(65);expect(later.zoom).toBeLessThanOrEqual(18);expect(errors).toEqual([]);console.log(JSON.stringify({before,pan,rotate,zoom,later}));
});
