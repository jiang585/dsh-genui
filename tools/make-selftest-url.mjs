/** Build the self-test URL for the frame page (base64-encoded DIL document). */
import fs from 'node:fs'

const SOURCE = [
  '{@body const [n,setN] = DIL.useState(3)}',
  '{@body const [plan,setPlan] = DIL.useState("pro")}',
  '{@body const PLANS = [{label:"Plus",value:"plus",price:20},{label:"Pro",value:"pro",price:200}]}',
  '{@body const rows = PLANS.map(p=>({name:p.label, cost:p.price*n}))}',
  '<box gap={4}>',
  '  <row justify="between" align="center">',
  '    <title size="lg">智能界面自检</title>',
  '    <badge color={n>=8?"warning":"success"}>{n>=8?"偏高":"正常"}</badge>',
  '  </row>',
  '  <segmented-control value={plan} onChange={setPlan} options={PLANS}/>',
  '  <slider label="席位数" value={n} onChange={setN} min={1} max={20}/>',
  '  <text color="secondary" size="xs">当前方案 {plan} · {n} 席</text>',
  '  <Chart content={{"chartType":"bar","xKey":"name","series":[{"dataKey":"cost","label":"年费","valuePrefix":"$"}],"data":rows}}/>',
  '  <row gap={2}>',
  '    <button onClick={()=>setN(n+1)}>加一席</button>',
  '    <button variant="outline" onClick={()=>setN(1)}>重置</button>',
  '  </row>',
  '</box>',
].join('\n')

const base64 = Buffer.from(SOURCE, 'utf8').toString('base64url')
const url = `http://127.0.0.1:19387/genui-live/frame.html?title=${encodeURIComponent('自检 · 智能界面')}&source_b64=${base64}`
fs.writeFileSync('E:/chat/dsh-genui/tools/selftest-url.txt', url, 'utf8')
fs.writeFileSync('E:/chat/dsh-genui/tools/selftest-source.dil', SOURCE, 'utf8')
console.log(url)
