import {chromium,open,SHOTS,BASE} from './lib.mjs'
const b=await chromium.launch()
for(const loc of ['en','ar']){
 const c=await open(b,'mobile',{locale:loc}); await c.addInitScript((l)=>{try{const k='buddget-storage';const j=JSON.parse(localStorage.getItem(k)||'{"state":{}}');j.state.settings={...(j.state.settings||{}),theme:'light',language:l};localStorage.setItem(k,JSON.stringify(j));document.cookie='bdg-lang='+l+'; path=/'}catch{}},loc)
 const p=await c.newPage(); await p.goto(BASE+'/settings',{waitUntil:'load'}); await p.waitForTimeout(7000); if((await p.evaluate(()=>document.documentElement.lang))!==loc){await p.reload({waitUntil:'load'});await p.waitForTimeout(7000)}
 console.log(loc,JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('[role=switch]')].slice(0,6).map(s=>{const t=s.getBoundingClientRect();const th=s.firstElementChild?.getBoundingClientRect();return {on:s.getAttribute('aria-checked'),track:[Math.round(t.left),Math.round(t.right)],thumb:th&&[Math.round(th.left),Math.round(th.right)]}}))))
 await c.close()
}
await b.close()
