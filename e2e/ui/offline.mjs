// Offline: in-app tab navigation after the network drops (no reload: the dev server has no service worker), and the /offline page itself.
import {chromium,open,BASE,SHOTS} from './lib.mjs'
import fs from 'node:fs'
const axeSrc=fs.readFileSync('node_modules/axe-core/axe.min.js','utf8')
const b=await chromium.launch(); const c=await open(b,'mobile'); const p=await c.newPage(); const errs=[]
p.on('pageerror',e=>errs.push(String(e).slice(0,100)))
await c.addInitScript(()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(s))})
await p.goto(BASE+'/flow',{waitUntil:'networkidle',timeout:60000}); await p.waitForTimeout(2500)
await c.setOffline(true); await p.waitForTimeout(1500)
const res=[]
for(const [name,re] of [['Accounts',/^Accounts$/],['Wealth',/^Wealth$/],['Debts',/^Debts$/],['Flow',/^Flow$/]]){
  await p.getByRole('navigation').getByRole('link',{name:re}).first().click().catch(()=>{}); await p.waitForTimeout(2500)
  await p.screenshot({path:SHOTS+`offline-nav-${name}.png`})
  res.push({to:name,url:p.url().replace(BASE,''),text:(await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,80)))})
}
const banner=await p.evaluate(()=>/offline|no connection|لا يوجد اتصال|غير متصل/i.test(document.body.innerText))
console.log(JSON.stringify({res,offlineBannerText:banner,pageerrors:errs}))
await c.setOffline(false)
await p.goto(BASE+'/offline',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1500); await p.screenshot({path:SHOTS+'offline-page.png'}); await p.addScriptTag({content:axeSrc})
console.log('offline page axe',JSON.stringify(await p.evaluate(async()=>(await axe.run(document,{resultTypes:['violations']})).violations.map(v=>v.id+':'+v.impact))),await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,120)))
await b.close()
