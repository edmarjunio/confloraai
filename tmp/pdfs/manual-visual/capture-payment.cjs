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
 await step('pagamento',async()=>{
  await page.goto(base+'/caixa');await page.getByText('Alface crespa',{exact:true}).click();await page.getByRole('button',{name:/PAGAR - F1/}).click();await page.getByRole('button',{name:'Dinheiro',exact:true}).click();
  await snap('pagamento',page.getByRole('heading',{name:'Finalizar Pagamento',exact:true}).locator('..').locator('..').locator('..'));
  await page.getByLabel('Usar mais de uma forma de pagamento').check();await snap('pagamento-dividido');await page.getByLabel('Usar mais de uma forma de pagamento').uncheck();
  await page.getByRole('button',{name:'Finalizar venda',exact:true}).click();await page.getByRole('dialog',{name:'Venda finalizada',exact:true}).waitFor();await snap('recibo','[role=dialog]');
 });
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});