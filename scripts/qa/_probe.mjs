// usage: node _probe.mjs [off] goto:/x tap:Label shot:name dump wait:ms eval:js
import fs from 'fs'
import { launch, phoneContext, seededState, go, tap, dump, settle } from './light-touch-lib.mjs'
const S = process.env.S
const b = await launch()
const st = fs.existsSync(S + '/state.json') ? JSON.parse(fs.readFileSync(S + '/state.json')) : await seededState(b)
fs.writeFileSync(S + '/state.json', JSON.stringify(st))
const args = process.argv.slice(2)
const { page } = await phoneContext(b, { storageState: st, offline: args[0] === 'off' })
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 120)))
for (const a of args) {
  const [k, ...r] = a.split(':'); const v = r.join(':')
  try {
    if (k === 'goto') await go(page, v)
    else if (k === 'tap') await tap(page, v)
    else if (k === 'shot') await page.screenshot({ path: `${S}/p-${v}.png`, scale: 'css' })
    else if (k === 'dump') console.log('DUMP', (await dump(page)).join(' | '))
    else if (k === 'wait') await page.waitForTimeout(+v)
    else if (k === 'eval') console.log('EVAL', JSON.stringify(await page.evaluate(v)))
  } catch (e) { console.log('ERR', a, e.message.split('\n')[0]) }
}
await b.close()
