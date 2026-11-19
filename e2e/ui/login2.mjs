import {chromium,login,ctx} from './lib.mjs'
const b=await chromium.launch(); const c=await ctx(b,'mobile'); const p=await c.newPage()
await login(p,'qa-ui-2@buddget-qa.test'); await p.waitForTimeout(3000)
console.log(p.url()); await c.storageState({path:'e2e/ui/.st2.json'}); await b.close()
