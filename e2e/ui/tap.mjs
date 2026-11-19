// Real tap-area probe: scrolls each control into view and hit-tests a 44x44 box centred on it (elementFromPoint),
// so overlays clipped by scrollers or displaced by transforms show up. Off-screen scroller items are scrolled in first.
import {chromium,open,BASE} from './lib.mjs'
import fs from 'node:fs'
const ROUTES=(process.env.ROUTES||'flow,accounts,wealth,debts,budget-setup,budget-history,paydays,subscriptions,goals,reports,notifications,settings,settings/security,settings/pro,settings/profile,settings/memory,expenses,income,savings,investment').split(',')
const locs=(process.env.LOCS||'en,ar').split(','); const vp=process.env.VP||'mobile'
const out=[]; const b=await chromium.launch()
for(const loc of locs){
  const c=await open(b,vp,{locale:loc}); await c.addInitScript(([l])=>{try{const k='buddget-storage';const j=JSON.parse(localStorage.getItem(k)||'{"state":{}}');j.state=j.state||{};j.state.settings={...(j.state.settings||{}),theme:'light',language:l};localStorage.setItem(k,JSON.stringify(j));document.cookie='bdg-lang='+l+'; path=/';const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(s))}catch{}},[loc])
  const p=await c.newPage()
  for(const r of ROUTES){
    try{
      await p.goto(BASE+'/'+r,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(3500)
      const res=await p.evaluate(()=>{
        const els=[...document.querySelectorAll('button,a[href],[role=button],[role=switch],[role=tab],[role=radio],[role=checkbox],input:not([type=hidden])')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&!e.closest('[aria-hidden=true],nextjs-portal')&&!e.closest('.sr-only')&&!(e.className||'').toString().includes('sr-only')&&!e.disabled})
        const bad=[];const nav=document.querySelector('nav')
        for(const e of els){
          e.scrollIntoView({block:'center',inline:'center'})
          const r=e.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue
          const cx=r.x+r.width/2,cy=r.y+r.height/2,dx=Math.min(r.width/2-1,20),dy=20
          let miss=0;const tgt=new Set()
          for(const [x,y] of [[cx-dx,cy-dy],[cx+dx,cy-dy],[cx-dx,cy+dy],[cx+dx,cy+dy]]){const t=document.elementFromPoint(Math.max(1,Math.min(innerWidth-1,x)),Math.max(1,Math.min(innerHeight-1,y)));if(!(t&&(t===e||e.contains(t)))){miss++;tgt.add(t?(t.closest('button,a,[role=button]')?'other-control':'plain:'+t.tagName):'none')}}
          if(miss)bad.push({t:(e.getAttribute('aria-label')||e.innerText||e.tagName).replace(/\s+/g,' ').slice(0,36),w:Math.round(r.width),h:Math.round(r.height),miss,tgt:[...tgt].join('+')})
        }
        return {n:els.length,bad}
      })
      out.push({loc,route:r,...res})
    }catch(e){out.push({loc,route:r,error:String(e).slice(0,100)})}
  }
  await c.close()
}
await b.close(); fs.writeFileSync(`e2e/ui/out/tap-${vp}.json`,JSON.stringify(out,null,1))
const agg={};for(const x of out)for(const y of x.bad||[]){const k=y.t+'|'+y.w+'x'+y.h+'|'+y.tgt;(agg[k]??=new Set()).add(x.route+':'+x.loc)}
console.log('controls',out.reduce((a,x)=>a+(x.n||0),0),'errors',out.filter(x=>x.error).length);for(const [k,v] of Object.entries(agg))console.log(k,[...v].slice(0,6).join(','))
