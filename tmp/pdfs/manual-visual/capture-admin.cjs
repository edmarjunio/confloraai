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
  let box=selector?await page.locator(selector).first().boundingBox():{x:0,y:0,width:1280,height:820};
  if(!box)throw new Error('sem região '+name); box={x:Math.max(0,box.x),y:Math.max(0,box.y),width:Math.min(box.width,1280-Math.max(0,box.x)),height:Math.min(box.height,820-Math.max(0,box.y))};
  const marks=[];for(let i=0;i<pins.length;i++){try{const b=await page.locator(pins[i]).first().boundingBox();if(b)marks.push({n:i+1,x:b.x-box.x+Math.min(12,b.width/2),y:b.y-box.y+Math.min(12,b.height/2)});}catch{}}
  await page.screenshot({path:path.join(dir,name+'.png'),clip:box}); captures[name]={...box,pins:marks}; fs.writeFileSync(path.join(dir,'captures.json'),JSON.stringify(captures,null,2));console.log('CAPTURA',name);
 };
 const step=async(name,fn)=>{try{await fn()}catch(e){console.log('FALHA',name,e.message);await page.screenshot({path:path.join(dir,'falha-'+name+'.png')});}};

 await post('/api/admin/auth/login',{userId:'usr-edmar',pin:'1234'});
 const order={};const customer={};
 await page.goto(base+'/caixa'); await page.getByRole('button',{name:/F9.*Histórico/}).click();await page.getByRole('heading',{name:'Histórico de vendas'}).first().waitFor();await snap('historico');
 for(const tab of ['cashier','products','stock','team','status','analytics']){await page.goto(base+'/admin?tab='+tab);await page.locator('#tab-'+tab+'.active').waitFor();await snap('admin-'+tab);}
 await page.goto(base+'/admin?tab=products');await page.getByRole('button',{name:/ADICIONAR PRODUTO/}).click();await snap('produto','#productEditorDialog');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Importar planilha de produtos',exact:true}).click();await page.getByLabel('Arquivo de produtos (CSV ou JSON)').setInputFiles({name:'produtos.csv',mimeType:'text/csv',buffer:Buffer.from('codigo;nome;preco;categoria;unidade;estoque\nHORTA01;Alface americana;4,50;Horta;UN;40\nHORTA02;Tomate cereja;9,90;Horta;KG;12,5')});await page.getByRole('button',{name:'Validar e mostrar prévia',exact:true}).click();await page.getByRole('button',{name:'Confirmar importação',exact:true}).waitFor();await snap('importacao','dialog[open]');
 await page.goto(base+'/admin?tab=team');await page.locator('[onclick="openNewUserModal()"]').click();await snap('equipe-cadastro','#userModal');
 await page.goto(base+'/admin?tab=stock');await page.locator('#stockSearchInput').fill('ALFACE');await page.getByRole('button',{name:'Baixa ou ajuste com motivo'}).first().click();await snap('estoque-ajuste','#stockAdjustmentModal .modal-card');
 await page.goto(base+'/admin-gerencial');await page.locator('#selectedMonth').waitFor();await snap('gerencial');
 await step('rankings',async()=>{const el=page.getByText('Produtos que mais vendem',{exact:false}).first();if(await el.count())await el.scrollIntoViewIfNeeded();else await page.evaluate(()=>window.scrollTo(0,650));await snap('rankings');});
 await page.locator('.daily-closing summary').click();await page.locator('#btnCloseCash').scrollIntoViewIfNeeded();await snap('fechamento');
 await page.goto(base+'/caixa');await page.getByRole('button',{name:/Entregas/,exact:false}).first().click();await snap('entregas');
 fs.writeFileSync(path.join(dir,'orders.json'),JSON.stringify({order,customer},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

