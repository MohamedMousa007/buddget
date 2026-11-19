// Empty, API-error and offline states. Needs e2e/ui/.st1.json (seeded user, `seed.ts`) and creates one empty synthetic user (.st2.json).
// Output: e2e/ui/out/states.json + screenshots. Reports page errors, console errors, and whether the screen shows any text.
import {chromium,open,BASE,SHOTS,PW} from './lib.mjs'
import fs from 'node:fs'
import {createRequire} from 'node:module'
const axeSrc=fs.readFileSync('node_modules/axe-core/axe.min.js','utf8')
const ROUTES=(process.env.ROUTES||'flow,accounts,wealth,debts,subscriptions,goals,reports,budget-setup,notifications,settings').split(',')
const out=[]
async function probe(p,tag,extra={}){
  await p.screenshot({path:SHOTS+`state-${tag}.png`})
  await p.addScriptTag({content:axeSrc}).catch(()=>{})
  const m=await p.evaluate(async()=>{let ax=[];try{ax=(await axe.run(document,{resultTypes:['violations'],exclude:[['nextjs-portal']]})).violations.map(v=>v.id+':'+v.nodes.length)}catch{}
    const txt=document.body.innerText.replace(/\s+/g,' ').trim()
    return {textLen:txt.length,hOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,skeleton:document.querySelectorAll('[class*=animate-pulse]').length,ax,head:txt.slice(0,90)}})
  out.push({tag,...m,...extra})
}
const b=await chromium.launch()
const hook=(p,log)=>{p.on('pageerror',e=>log.push('pageerror:'+String(e).slice(0,100)));p.on('console',m=>{if(m.type()==='error'&&!/Download the React|Sentry|Failed to load resource|net::ERR/.test(m.text()))log.push('console:'+m.text().slice(0,100))})}
// 1) empty: a brand-new synthetic user (no rows). Created by seedEmpty (admin API) and signed in through the UI.
if(fs.existsSync('e2e/ui/.st2.json')){
  for(const loc of ['en','ar']){
    const c=await open(b,'mobile',{user:2,locale:loc}); await c.addInitScript(([l])=>{try{const k='buddget-storage';const j=JSON.parse(localStorage.getItem(k)||'{"state":{}}');j.state=j.state||{};j.state.settings={...(j.state.settings||{}),theme:'light',language:l};localStorage.setItem(k,JSON.stringify(j));document.cookie='bdg-lang='+l+'; path=/'}catch{}},[loc])
    const p=await c.newPage(); const log=[]; hook(p,log)
    for(const r of ROUTES){try{await p.goto(BASE+'/'+r,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(3500);await probe(p,`empty-${loc}-${r.replace(/\//g,'_')}`,{log:log.splice(0)})}catch(e){out.push({tag:`empty-${loc}-${r}`,error:String(e).slice(0,100)})}}
    await c.close()
  }
}
// 2) server errors: every Supabase REST call and our /api calls fail (500), seeded user.
{
  const c=await open(b,'mobile',{user:1}); await c.route(/\/rest\/v1\//,r=>r.fulfill({status:500,contentType:'application/json',body:'{"message":"boom"}'})); await c.route(/localhost:3100\/api\/(?!flags|auth)/,r=>r.fulfill({status:500,contentType:'application/json',body:'{"error":"boom"}'}))
  const p=await c.newPage(); const log=[]; hook(p,log)
  for(const r of ROUTES){try{await p.goto(BASE+'/'+r,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(3500);await probe(p,`error-en-${r.replace(/\//g,'_')}`,{log:log.splice(0)})}catch(e){out.push({tag:`error-en-${r}`,error:String(e).slice(0,100)})}}
  await c.close()
}
// 3) offline: load online (warm cache), go offline, reload and in-app navigate.
{
  const c=await open(b,'mobile',{user:1}); const p=await c.newPage(); const log=[]; hook(p,log)
  await p.goto(BASE+'/flow',{waitUntil:'networkidle',timeout:60000}); await p.waitForTimeout(2500)
  await c.setOffline(true)
  for(const r of ROUTES){try{await p.goto(BASE+'/'+r,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});await p.waitForTimeout(3000);await probe(p,`offline-en-${r.replace(/\//g,'_')}`,{log:log.splice(0)})}catch(e){out.push({tag:`offline-en-${r}`,error:String(e).slice(0,100)})}}
  await c.close()
}
await b.close(); fs.writeFileSync('e2e/ui/out/states.json',JSON.stringify(out,null,1))
for(const x of out)console.log(x.tag,x.error||`text=${x.textLen} skel=${x.skeleton} hov=${x.hOverflow} ax=[${x.ax}] log=${(x.log||[]).length}`)
