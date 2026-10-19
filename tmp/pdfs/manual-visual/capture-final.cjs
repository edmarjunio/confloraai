const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const dir=path.resolve('tmp/pdfs/manual-visual');
const base='http://127.0.0.1:8111';
const captures=JSON.parse(fs.readFileSync(path.join(dir,'captures.json'),'utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:820},deviceScaleFactor:1.5,locale:'pt-BR'});
 await context.route(/https:\/\/.*/,r=>r.abort());
 const page=await context.newPage(); page.on('dialog',d=>d.accept()); page.setDefaultTimeout(7000);
 const post=async(url,data)=>{const r=await context.request.post(base+url,{data});const body=await r.json();if(!r.ok())throw new Error(url+': '+JSON.stringify(body));return body};
 const snap=async(name,selector=null,pins=[])=>{
  await page.waitForTimeout(350);
  let box=selector?await (typeof selector==='string'?page.locator(selector).first():selector).boundingBox():{x:0,y:0,width:1280,height:820};
  if(!box)throw new Error('sem região '+name); box={x:Math.max(0,box.x),y:Math.max(0,box.y),width:Math.min(box.width,1280-Math.max(0,box.x)),height:Math.min(box.height,820-Math.max(0,box.y))};
  const marks=[];for(let i=0;i<pins.length;i++){try{const b=await page.locator(pins[i]).first().boundingBox();if(b)marks.push({n:i+1,x:b.x-box.x+Math.min(12,b.width/2),y:b.y-box.y+Math.min(12,b.height/2)});}catch{}}
  await page.screenshot({path:path.join(dir,name+'.png'),clip:box}); captures[name]={...box,pins:marks}; fs.writeFileSync(path.join(dir,'captures.json'),JSON.stringify(captures,null,2));console.log('CAPTURA',name);
 };
 const step=async(name,fn)=>{try{await fn()}catch(e){console.log('FALHA',name,e.message);await page.screenshot({path:path.join(dir,'falha-'+name+'.png')});}};


 await post('/api/admin/auth/login',{userId:'usr-edmar',pin:'1234'});
 await page.goto(base+'/admin-gerencial');await page.locator('#selectedMonth').waitFor();await page.locator('#seasonalTitle').evaluate(e=>e.scrollIntoView({block:'start'}));await snap('mensal');
 await page.locator('#rankingUnit').evaluate(e=>e.parentElement.scrollIntoView({block:'start'}));await snap('rankings');
 await page.locator('.daily-closing summary').click();await page.locator('.daily-closing').evaluate(e=>e.scrollIntoView({block:'start'}));await snap('fechamento');
 await page.goto(base+'/caixa');await page.getByRole('button',{name:/F1.*Pagar/}).waitFor();
 await page.evaluate(async()=>{await window.ConfloraSession.apiFetch('/api/admin/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'demo-vendedor',pin:'7788'})})});
 await page.reload();await page.getByText('Alface crespa',{exact:true}).click();await page.getByRole('button',{name:/PAGAR - F1/}).click();await page.getByRole('button',{name:'Dinheiro',exact:true}).click();await snap('vendedor',page.getByRole('heading',{name:'Finalizar Pagamento',exact:true}).locator('..').locator('..').locator('..'));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

