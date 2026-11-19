import { chromium as pwChromium } from '@playwright/test'
// Cloud sandboxes ship a Chromium that differs from the pinned Playwright build: PW_CHROMIUM_EXECUTABLE points at it.
export const chromium={launch:(o={})=>pwChromium.launch({...(process.env.PW_CHROMIUM_EXECUTABLE?{executablePath:process.env.PW_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{}),...o})}
export const BASE='http://localhost:3100'
export const SHOTS='e2e/ui/out/'
export const PW='QaUi!Pass-7391xZ'
export const VP={mobile:{width:375,height:812},tablet:{width:768,height:1024},landscape:{width:1024,height:768},desktop:{width:1440,height:900}}
export async function login(p,email){
  await p.goto(BASE+'/flow',{waitUntil:'networkidle'})
  await p.fill('input[type=email]',email)
  await p.getByRole('button',{name:'Continue',exact:true}).click()
  await p.waitForSelector('input[type=password]',{timeout:15000})
  await p.fill('input[type=password]',PW)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(5000)
}
export async function ctx(b,vp,{dark=false,locale='en'}={}){
  const c=await b.newContext({viewport:VP[vp],locale:locale==='ar'?'ar-EG':'en-US',colorScheme:dark?'dark':'light',bypassCSP:true})
  await c.route('https://buddget.app/api/**',async r=>{try{const u=r.request().url().replace('https://buddget.app',BASE);const res=await r.fetch({url:u});await r.fulfill({response:res})}catch{}})
  return c
}

import fs from 'node:fs'
export async function session(b,vp,opts={}){
  const c=await ctx(b,vp,opts)
  const st='e2e/ui/.cookies-'+(opts.user||1)+'.json'
  return c
}
export async function open(b,vp,{user=1,dark=false,locale='en'}={}){
  const c=await b.newContext({viewport:VP[vp],locale:locale==='ar'?'ar-EG':'en-US',bypassCSP:true,storageState:`e2e/ui/.st${user}.json`})
  await c.route('https://buddget.app/api/**',async r=>{try{const u=r.request().url().replace('https://buddget.app',BASE);await r.fulfill({response:await r.fetch({url:u})})}catch{}})
  return c
}
export async function dump(p,sel='[role=dialog]'){
  return p.$$eval(sel+' input, '+sel+' button, '+sel+' textarea, '+sel+' select',e=>e.filter(x=>x.offsetParent).map(x=>x.tagName+'|'+(x.type||'')+'|'+(x.getAttribute('aria-label')||x.innerText||x.placeholder||'?').replace(/\n/g,' ').slice(0,40)+'|'+Math.round(x.getBoundingClientRect().height)).join('\n'))
}
