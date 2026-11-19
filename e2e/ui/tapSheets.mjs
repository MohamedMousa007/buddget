// Hit-tests the 44x44 tap area of every control inside each Quick-add sheet and the Buddgy chat (the sheets sweep measures drawn boxes only).
import {chromium,open,BASE} from './lib.mjs'
import fs from 'node:fs'
const vp=process.env.VP||'mobile', loc=process.env.LOC||'en'
const ITEMS=[['fab',null],['Expense',/^(Expense|مصروف)/],['Money in',/^(Money in|دخل)/],['Pay debt',/^(Pay debt|سداد)/],['Subscription',/^(Subscription|اشتراك)/],['Pay method',/^(Pay method|وسيلة)/],['Receipt',/^(Receipt|إيصال)/]]
const probe=()=>{const d=[...document.querySelectorAll('[role=dialog]')].filter(x=>x.getBoundingClientRect().width>0).pop(); if(!d)return {none:true}
  const bad=[]; for(const e of d.querySelectorAll('button,a[href],[role=button],[role=switch],[role=radio],[role=tab],input:not([type=hidden])')){
    const s=getComputedStyle(e); if(s.visibility==='hidden'||e.disabled||e.closest('[aria-hidden=true]'))continue
    e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); if(!r.width||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue
    const cx=r.x+r.width/2,cy=r.y+r.height/2,dx=Math.min(r.width/2-2,20),dy=20; let miss=0
    for(const [x,y] of [[cx-dx,cy-dy],[cx+dx,cy-dy],[cx-dx,cy+dy],[cx+dx,cy+dy]]){const t=document.elementFromPoint(Math.max(1,Math.min(innerWidth-1,x)),Math.max(1,Math.min(innerHeight-1,y)));if(!(t&&(t===e||e.contains(t))))miss++}
    if(miss)bad.push((e.getAttribute('aria-label')||e.innerText||e.tagName).replace(/\s+/g,' ').slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' miss'+miss)}
  return {name:d.getAttribute('aria-label')||'',bad}}
const b=await chromium.launch(); const c=await open(b,vp,{locale:loc}); await c.addInitScript(([l])=>{try{const k='buddget-storage';const j=JSON.parse(localStorage.getItem(k)||'{"state":{}}');j.state=j.state||{};j.state.settings={...(j.state.settings||{}),theme:'light',language:l};localStorage.setItem(k,JSON.stringify(j));document.cookie='bdg-lang='+l+'; path=/';const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(s))}catch{}},[loc])
const p=await c.newPage(); const out=[]
const fabName=loc==='ar'?/إضافة سريعة/:/^Quick add$/
for(const [key,re] of ITEMS){
  await p.goto(BASE+'/flow',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500)
  try{ await p.getByRole('button',{name:fabName}).first().click({timeout:8000}); await p.waitForTimeout(600)
    if(re){await p.getByRole('dialog').getByRole('button',{name:re}).first().click({timeout:8000});await p.waitForTimeout(1200)}
    out.push({key,...await p.evaluate(probe)})}catch(e){out.push({key,error:String(e).slice(0,80)})}
}
// Buddgy chat
await p.goto(BASE+'/flow',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500)
try{await p.getByRole('button',{name:/Buddgy|بادجي/i}).first().click({timeout:8000});await p.waitForTimeout(1500);out.push({key:'buddgy',...await p.evaluate(probe)})}catch(e){out.push({key:'buddgy',error:String(e).slice(0,80)})}
await b.close(); fs.writeFileSync(`e2e/ui/out/tapSheets-${vp}-${loc}.json`,JSON.stringify(out,null,1))
for(const x of out)console.log(x.key,x.error||(x.none?'no dialog':JSON.stringify(x.bad)))
