import type {Page} from '@playwright/test';
export const camera=async(page:Page)=>JSON.parse((await page.locator('.city-canvas canvas').getAttribute('data-camera'))!);
export async function drag(page:Page,button:'left'|'right',dx=130,dy=45){await page.mouse.move(760,350);await page.mouse.down({button});for(let i=1;i<=15;i++){await page.mouse.move(760+dx*i/15,350+dy*i/15);await page.waitForTimeout(30);}await page.mouse.up({button});await page.waitForTimeout(350);}
