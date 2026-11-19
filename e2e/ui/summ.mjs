import fs from 'node:fs'
const all=['mobile','tablet','desktop'].flatMap(v=>JSON.parse(fs.readFileSync(`e2e/ui/sweep-${v}.json`)))
console.log('records',all.length,'errors',all.filter(x=>x.error).length)
console.log('redirected:',[...new Set(all.filter(x=>!x.error&&x.tag.split('-').slice(3).join('-').replace(/_/g,'/')!==x.url.slice(1)).map(x=>x.tag.split('-').slice(3).join('-')+'->'+x.url))].join(' ; '))
console.log('hOverflow:',all.filter(x=>x.hOverflow).map(x=>x.tag+'('+x.sw+'>'+x.cw+')').join('\n'))
const ax={};for(const r of all)for(const a of r.axe||[]){const k=a.id+'|'+a.impact;(ax[k]??={n:0,tags:new Set(),ex:a.ex[0]});ax[k].n+=a.n;ax[k].tags.add(r.tag.split('-').slice(3).join('-'))}
for(const [k,v] of Object.entries(ax))console.log('AXE',k,v.n,[...v.tags].slice(0,8).join(','),v.ex)
const sm={};for(const r of all.filter(x=>x.small)){if(!r.tag.startsWith('mobile-light-en'))continue;for(const s of r.small){const k=s.t+'|'+s.ew+'x'+s.eh;(sm[k]??=new Set()).add(r.tag.split('-').slice(3).join('-'))}}
console.log('SMALL (mobile light en, effective<44):');for(const [k,v] of Object.entries(sm))console.log(' ',k,[...v].join(','))
const tr=new Set();for(const r of all.filter(x=>x.trunc?.length))for(const t of r.trunc)tr.add(r.tag.split('-').slice(0,3).join('-')+':'+r.tag.split('-').slice(3).join('-')+' "'+t+'"');console.log('TRUNC',[...tr].slice(0,60).join('\n'))
const bd=new Set();for(const r of all.filter(x=>x.bidi?.length&&x.tag.includes('-ar-')))for(const t of r.bidi)bd.add(r.tag.split('-').slice(3).join('-')+': '+t);console.log('BIDI',[...bd].slice(0,60).join('\n'))
console.log('lang/dir',[...new Set(all.map(x=>x.tag.split('-')[2]+':'+x.htmlLang+'/'+x.dir))].join(' '),'dark ok',all.filter(x=>x.tag.includes('-dark-')&&!x.dark).length)
