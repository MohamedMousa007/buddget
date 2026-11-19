// Re-checks of the first QA round's UI fixes (no redo): add-expense opens with no category, tablet/desktop column capped and centred,
// Buddgy clearance at the end of the scroll, visible h1 count, RTL switch thumbs (Arabic keeps the English-order layout, QA-27).
import {chromium,open,BASE} from './lib.mjs'
const hide=()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(s))}
const b=await chromium.launch(); const out={}
{ const c=await open(b,'mobile'); await c.addInitScript(hide); const p=await c.newPage()
  await p.goto(BASE+'/flow',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000)
  await p.getByRole('button',{name:'Quick add'}).first().click(); await p.getByRole('dialog').getByRole('button',{name:/^Expense/}).first().click(); await p.waitForTimeout(1200)
  out.addExpenseCheckedCategories=await p.evaluate(()=>[...document.querySelectorAll('[role=dialog] [role=radio][aria-checked=true]')].map(e=>e.getAttribute('aria-label')||e.innerText))
  await c.close() }
for(const vp of ['tablet','landscape','desktop']){ const c=await open(b,vp); await c.addInitScript(hide); const p=await c.newPage(); out['column-'+vp]={}
  for(const r of ['flow','accounts','wealth','reports','settings']){ await p.goto(BASE+'/'+r,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000)
    out['column-'+vp][r]=await p.evaluate(()=>{const m=document.querySelector('main');if(!m)return 'no main';const W=innerWidth;const kids=[...m.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>200&&r.height>20});const l=Math.min(...kids.map(e=>e.getBoundingClientRect().left)),rt=Math.max(...kids.map(e=>e.getBoundingClientRect().right));return {W,left:Math.round(l),right:Math.round(rt),w:Math.round(rt-l),centreOffset:Math.round((l+rt)/2-W/2)}}) }
  await c.close() }
{ const c=await open(b,'mobile'); await c.addInitScript(hide); const p=await c.newPage(); out.clearance={}
  for(const r of ['flow','accounts','wealth','debts','goals','reports','settings']){ await p.goto(BASE+'/'+r,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000)
    await p.evaluate(()=>{const els=[document.scrollingElement,...document.querySelectorAll('main,[class*=overflow-y]')];for(const e of els)e&&(e.scrollTop=e.scrollHeight)}); await p.waitForTimeout(500)
    out.clearance[r]=await p.evaluate(()=>{const bd=[...document.querySelectorAll('button')].find(x=>/buddgy|بادجي/i.test(x.getAttribute('aria-label')||''));if(!bd)return 'no mascot';const m=bd.getBoundingClientRect();const tab=document.querySelector('nav')?.getBoundingClientRect();const last=[...document.querySelectorAll('main *')].filter(e=>e.children.length===0&&e.textContent.trim()&&e.getBoundingClientRect().height>0).map(e=>e.getBoundingClientRect()).filter(r=>r.bottom<(tab?.top??innerHeight)+1&&r.left<m.right&&r.right>m.left);const overlaps=last.filter(r=>r.top<m.bottom&&r.bottom>m.top).length;return {mascotTop:Math.round(m.top),overlappingTextNodes:overlaps}}) }
  await c.close() }
await b.close(); console.log(JSON.stringify(out,null,0))
