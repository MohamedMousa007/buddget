import {chromium,open,SHOTS,BASE} from './lib.mjs'
import fs from 'node:fs'
const axeSrc=fs.readFileSync('node_modules/axe-core/axe.min.js','utf8')
const combos=(process.env.COMBOS||'mobile:light:en,mobile:light:ar,mobile:dark:en,mobile:dark:ar,tablet:light:en,desktop:light:ar,desktop:dark:en').split(',')
const items=[['fab',-1],['income',0],['expense',1],['receipt',2],['paydebt',3],['wealth',4],['subscription',5],['paymethod',6]]
const out=[]
const b=await chromium.launch()
for(const cb of combos){const [vp,theme,loc]=cb.split(':')
  const c=await open(b,vp,{locale:loc}); await c.addInitScript(([t,l])=>{try{const k='buddget-storage';const j=JSON.parse(localStorage.getItem(k)||'{"state":{}}');j.state.settings={...(j.state.settings||{}),theme:t,language:l};localStorage.setItem(k,JSON.stringify(j));document.cookie='bdg-lang='+l+'; path=/'}catch{}},[theme,loc])
  const p=await c.newPage()
  await p.goto(BASE+'/flow',{waitUntil:'load'}); await p.waitForTimeout(3500); if((await p.evaluate(()=>document.documentElement.lang))!==loc){await p.reload({waitUntil:'load'});await p.waitForTimeout(3500)}
  for(const [key,label] of items){
    const tag=`sheet-${vp}-${theme}-${loc}-${key}`
    try{
      if(!(await p.locator('[role=dialog]').count())){await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].filter(x=>{const r=x.getBoundingClientRect();return r.width>=50&&r.width<=58&&r.height>=50&&r.height<=58&&r.y>innerHeight-200}).pop();b.click()}); await p.waitForTimeout(700)}
      if(label>=0){await p.locator('[role=dialog] button').nth(label).click({timeout:5000}); await p.waitForTimeout(1200)}
      await p.screenshot({path:SHOTS+`ui-${tag}.png`})
      await p.addScriptTag({content:axeSrc}).catch(()=>{})
      const m=await p.evaluate(async()=>{
        const d=document.querySelector('[role=dialog]'); if(!d)return {noDialog:true}
        const r=d.getBoundingClientRect()
        const hs=[d,...d.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+1&&['auto','scroll'].includes(getComputedStyle(e).overflowX)).map(e=>(e.className||'').toString().slice(0,50)+' '+e.scrollWidth+'>'+e.clientWidth)
        const small=[...d.querySelectorAll('button,[role=button],input:not([type=hidden]):not([type=checkbox]),[role=switch]')].filter(e=>{const q=e.getBoundingClientRect();return q.width&&(q.height<44||q.width<44)}).map(e=>(e.getAttribute('aria-label')||e.innerText||e.tagName).replace(/\s+/g,' ').slice(0,28)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))
        const name=d.getAttribute('aria-label')||(d.getAttribute('aria-labelledby')&&document.getElementById(d.getAttribute('aria-labelledby'))?.innerText)||''
        let ax=[];try{ax=(await axe.run(d,{resultTypes:['violations']})).violations.map(v=>v.id+':'+v.nodes.length+':'+(v.impact))}catch{}
        return {w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom),vh:innerHeight,hs,small,name,modal:d.getAttribute('aria-modal'),ax}
      })
      out.push({tag,...m})
      await p.keyboard.press('Escape'); await p.waitForTimeout(600); if(await p.locator('[role=dialog]').count()){await p.keyboard.press('Escape');await p.waitForTimeout(500)}; if(await p.locator('[role=dialog]').count()){await p.goto(BASE+'/flow',{waitUntil:'load'});await p.waitForTimeout(2500)}
    }catch(e){out.push({tag,error:String(e).slice(0,120)}); await p.goto(BASE+'/flow',{waitUntil:'load'}); await p.waitForTimeout(2500)}
  }
  await c.close(); fs.writeFileSync('e2e/ui/out/sheets.json',JSON.stringify(out,null,1))
}
await b.close()
