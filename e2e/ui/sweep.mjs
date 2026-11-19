import {chromium,open,SHOTS,BASE,VP} from './lib.mjs'
import fs from 'node:fs'
const axeSrc=fs.readFileSync('node_modules/axe-core/axe.min.js','utf8')
const ROUTES=['flow','accounts','wealth','debts','budget-setup','budget-history','paydays','subscriptions','goals','reports','notifications','settings','settings/security','settings/pro','settings/pro/sparks','settings/founders','settings/profile','settings/sms','settings/memory','profile','expenses','income','savings','investment']
const user=+(process.env.U||1)
const vps=(process.env.VPS||'mobile,tablet,desktop').split(',')
const themes=(process.env.THEMES||'light,dark').split(',')
const locs=(process.env.LOCS||'en,ar').split(',')
const routes=process.env.ROUTES?process.env.ROUTES.split(','):ROUTES
const out=[]
const b=await chromium.launch()
for(const vp of vps)for(const theme of themes)for(const loc of locs){
  const c=await open(b,vp,{user,locale:loc})
  await c.addInitScript(([t,l])=>{try{const k='buddget-storage';const j=JSON.parse(localStorage.getItem(k)||'{"state":{},"version":0}');j.state=j.state||{};j.state.settings={...(j.state.settings||{}),theme:t,language:l};localStorage.setItem(k,JSON.stringify(j));document.cookie='bdg-lang='+l+'; path=/'}catch{}},[theme,loc])
  const p=await c.newPage()
  for(const r of routes){
    const tag=`${vp}-${theme}-${loc}-${r.replace(/\//g,'_')}`
    try{
      await p.goto(BASE+'/'+r,{waitUntil:'networkidle',timeout:45000}); await p.waitForTimeout(1500)
      await p.screenshot({path:SHOTS+`ui-${tag}.png`})
      const m=await p.evaluate(()=>{
        const de=document.documentElement
        const eff=(el)=>{const r=el.getBoundingClientRect();const cx=r.x+r.width/2,cy=r.y+r.height/2;const hit=(x,y)=>{const t=document.elementFromPoint(x,y);return t&&(t===el||el.contains(t)||t.contains(el)&&t!==document.body&&t.tagName!=='MAIN'&&t.getBoundingClientRect().width<=r.width+80)}
          let w=r.width,h=r.height; // expand
          let l=0;while(l<30&&hit(r.x-l-1,cy))l++;let rr=0;while(rr<30&&hit(r.right+rr+1,cy))rr++;let u=0;while(u<30&&hit(cx,r.y-u-1))u++;let d=0;while(d<30&&hit(cx,r.bottom+d+1))d++
          return [Math.round(r.width+l+rr),Math.round(r.height+u+d)]}
        const small=[...document.querySelectorAll('button,a[href],[role=button],[role=switch],[role=tab],input:not([type=hidden])')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&r.y<innerHeight*3&&!e.closest('[aria-hidden=true]')&&e.id!=='nextjs-portal'&&!e.closest('nextjs-portal')&&(r.width<44||r.height<44)}).map(e=>{const r=e.getBoundingClientRect();const [ew,eh]=eff(e);return {t:(e.getAttribute('aria-label')||e.innerText||e.tagName).replace(/\s+/g,' ').slice(0,40),w:Math.round(r.width),h:Math.round(r.height),ew,eh,cls:(e.className||'').toString().slice(0,60)}}).filter(x=>x.ew<44||x.eh<44)
        const trunc=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&e.scrollWidth>e.clientWidth+1&&e.clientWidth>0&&['hidden','clip'].includes(getComputedStyle(e).overflowX)&&e.innerText?.trim()).slice(0,12).map(e=>e.innerText.trim().slice(0,50))
        const bidi=[...document.body.innerText.split('\n')].filter(s=>/[؀-ۿ]/.test(s)&&/[0-9٠-٩]/.test(s)&&/[\/%]/.test(s)).slice(0,10)
        return {htmlLang:de.lang,dir:de.dir,dark:de.classList.contains('dark'),sw:de.scrollWidth,cw:de.clientWidth,hOverflow:de.scrollWidth>de.clientWidth+1,small,trunc,bidi,title:document.title,h1:[...document.querySelectorAll('h1')].length}
      })
      await p.addScriptTag({content:axeSrc})
      const ax=await p.evaluate(async()=>{const r=await axe.run(document,{resultTypes:['violations'],exclude:[['nextjs-portal']]});return r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,ex:v.nodes.slice(0,2).map(n=>n.target.join(' ').slice(0,90))}))})
      out.push({tag,url:p.url().replace(BASE,''),...m,axe:ax})
    }catch(e){out.push({tag,error:String(e).slice(0,200)})}
  }
  await c.close()
  fs.writeFileSync('e2e/ui/sweep-'+(process.env.OUT||'all')+'.json',JSON.stringify(out,null,1))
}
await b.close()
