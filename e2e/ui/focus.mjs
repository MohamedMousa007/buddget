import {chromium,open,SHOTS,BASE} from './lib.mjs'
const b=await chromium.launch(); const c=await open(b,'mobile'); const p=await c.newPage()
await p.goto(BASE+'/flow',{waitUntil:'networkidle'}); await p.waitForTimeout(1500)
const desc=()=>p.evaluate(()=>{const a=document.activeElement;return a?(a.tagName+':'+(a.getAttribute('aria-label')||a.innerText||a.id||'').replace(/\s+/g,' ').slice(0,30)+(a.closest('[role=dialog]')?' [in-dialog]':' [OUTSIDE]')):'none'})
const sheets=[['Quick add',null],['Quick add','Expense'],['Quick add','Money in'],['Quick add','Pay debt'],['Quick add','Wealth'],['Quick add','Subscription'],['Quick add','Pay method'],['Quick add','Receipt scan']]
for(const [fab,item] of sheets){
  await p.goto(BASE+'/flow',{waitUntil:'networkidle'}); await p.waitForTimeout(1000)
  const trig=p.getByRole('button',{name:fab}).first()
  await trig.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600)
  if(item){await p.getByRole('button',{name:new RegExp('^'+item)}).first().click();await p.waitForTimeout(800)}
  const log=[]; let outside=0
  for(let i=0;i<25;i++){await p.keyboard.press('Tab');const d=await desc();if(d.includes('OUTSIDE'))outside++;log.push(d)}
  const dlg=await p.locator('[role=dialog]').count()
  const lab=await p.evaluate(()=>{const d=document.querySelector('[role=dialog]');return d&&(d.getAttribute('aria-label')||d.getAttribute('aria-labelledby')||d.getAttribute('aria-modal'))})
  await p.keyboard.press('Escape'); await p.waitForTimeout(700)
  const after=await desc(); const still=await p.locator('[role=dialog]').count()
  console.log(JSON.stringify({sheet:item||'fab-menu',dialogs:dlg,outsideTabs:outside,ariaNameOrModal:lab,closedByEsc:still===0,focusAfterClose:after}))
}
await b.close()
