const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const dir=path.resolve('tmp/pdfs/manual-visual');
const base='http://127.0.0.1:8111';
const captures={};
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
 await page.goto(base+'/caixa'); await page.getByRole('heading',{name:'Frente de caixa'}).waitFor(); await snap('login',null,['select','input[type=password]','button[type=submit]']);
 await post('/api/admin/auth/login',{userId:'usr-edmar',pin:'1234'});
 for(const p of [{id:'demo-alface',name:'Alface crespa',price:4.5,category:'Horta',unit:'UN'},{id:'demo-tomate',name:'Tomate KG',price:8.9,category:'Hortifrutti',unit:'KG'},{id:'demo-alecrim',name:'Alecrim',price:12,category:'Plantas / Mudas',unit:'UN'},{id:'demo-suculenta',name:'Suculenta',price:15,category:'Plantas / Mudas',unit:'UN'}])await post('/api/admin/products',{...p,stockQuantity:60,status:'ATIVO'});
 await post('/api/admin/users',{id:'demo-vendedor',name:'Vendedor - demonstração',email:'vendedor@example.test',role:'VENDEDOR',pin:'7788'});
 await post('/api/admin/users',{id:'demo-entregador',name:'Entregador - demonstração',email:'entregador@example.test',role:'ENTREGADOR',pin:'7788'});
 const customer=(await post('/api/caixa/customers',{name:'Cliente demonstração',phone:'64999990000',email:'cliente@example.test',address:'Rua das Flores, 100 - Centro, Mineiros - GO'})).customer;
 for(const [method,qty] of [['DINHEIRO',3],['DEBITO',2],['FIADO',1]])await step('seed-'+method,()=>post('/api/caixa/orders',{requestId:randomUUID(),items:[{productId:'demo-alface',quantity:qty}],paymentMethod:method,customerId:customer.id,customerName:customer.name,customerPhone:customer.phone,discountPercent:0,cashReceived:50}));
 const pix=(await post('/api/storefront/orders',{customer:{name:'Cliente demonstração',phone:'64999990000'},fulfillment:'pickup',paymentMethod:'PIX',items:[{productId:'demo-alface',quantity:2}]}).catch(()=>({}))).order;
 // Storefront checkout requires an idempotency header.
 let order=pix;
 if(!order){const r=await context.request.post(base+'/api/storefront/orders',{headers:{'Idempotency-Key':randomUUID()},data:{customer:{name:'Cliente demonstração',phone:'64999990000'},fulfillment:'pickup',paymentMethod:'PIX',items:[{productId:'demo-alface',quantity:2}]}});order=(await r.json()).order;}
 await page.goto(base+'/'); await page.locator('#products .product-card').first().waitFor(); if(await page.locator('#coachSkip').isVisible())await page.locator('#coachSkip').click(); await snap('inicio',null,['#search','#cartButton','#adminSettingsButton']);
 await page.locator('#adminSettingsButton').click(); await snap('menu','#siteNavigationDrawer'); await page.keyboard.press('Escape');
 await step('cliente-sacola',async()=>{await page.locator('#products .product-card').filter({hasText:'Alface'}).locator('[data-action=add]').last().click(); await page.locator('#cartButton').click(); await snap('sacola','#cartDialog');await page.locator('#cartCloseButton').click()});
 await step('pix-cliente',async()=>{await page.goto(base+'/#'+new URLSearchParams({pedido:order.id,acesso:order.accessToken}));await page.getByRole('dialog',{name:'Acompanhar pedido'}).waitFor();await snap('pix-cliente','dialog[open]');await page.getByLabel('Comprovante do pagamento Pix').setInputFiles({name:'comprovante-demonstracao.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nDemonstracao\n%%EOF')});await page.getByRole('button',{name:'Enviar comprovante',exact:true}).click();await page.getByRole('status').filter({hasText:'aguardando conferência'}).waitFor();await snap('pix-enviado','dialog[open]');});
 await page.goto(base+'/caixa');
 if(await page.getByLabel('Usuário',{exact:true}).isVisible()){await page.getByLabel('Usuário',{exact:true}).selectOption('usr-edmar');await page.getByLabel('PIN',{exact:true}).fill('1234');await page.getByRole('button',{name:'Entrar',exact:true}).click();}
 await page.getByRole('button',{name:/F2.*Comandas/}).waitFor();
 await page.getByText('Alface crespa',{exact:true}).click();await page.getByText('Alecrim',{exact:true}).click();await snap('caixa',null,['button[aria-label="Informações de Alface crespa"]','button:has-text("Adicionar cliente")','button:has-text("PAGAR - F1")']);
 await step('cliente',async()=>{await page.getByRole('button',{name:'Adicionar cliente',exact:true}).click();await snap('cliente','[role=dialog]');await page.getByRole('button',{name:'Fechar',exact:true}).last().click();});
 await step('desconto',async()=>{await page.keyboard.press('F4');await snap('desconto','[role=dialog]');await page.getByRole('button',{name:'Fechar',exact:true}).last().click();});
 await step('pagamento',async()=>{await page.getByRole('button',{name:/PAGAR - F1/}).click();await page.getByRole('button',{name:'Dinheiro',exact:true}).click();await snap('pagamento','[role=dialog]');await page.getByRole('button',{name:'Finalizar venda',exact:true}).click();await page.getByRole('dialog',{name:'Venda finalizada',exact:true}).waitFor();await snap('recibo','[role=dialog]');await page.getByRole('button',{name:'Nova venda',exact:true}).click();});
 await page.keyboard.press('F2');await page.getByRole('heading',{name:'Comandas',exact:true}).waitFor();await snap('comandas');
 await step('pix-conferencia',async()=>{await page.getByRole('button',{name:'Abrir recibo e detalhes da comanda '+order.ticketNumber,exact:true}).click();await page.getByLabel('Conferi o recebimento na conta bancária e o valor da parcela Pix.').check();await page.getByLabel('Observação ou motivo').fill('Valor e beneficiário conferidos no extrato da conta.');await snap('pix-conferencia','[role=dialog]');await page.getByRole('button',{name:'Fechar',exact:true}).last().click();});
 await page.goto(base+'/caixa');await page.getByRole('button',{name:/F3.*Relatório/}).click();await page.getByRole('heading',{name:/Relatório/}).waitFor();await snap('relatorio');
 await step('receber',async()=>{await page.getByRole('button',{name:'Receber pagamento',exact:true}).click();await page.getByLabel('Buscar cliente cadastrado').fill('Cliente');await page.getByRole('button',{name:/Cliente demonstração/}).first().click();await snap('receber','[role=dialog]');});
 await page.goto(base+'/caixa');await page.keyboard.press('F9');await page.getByRole('heading',{name:'Histórico de vendas'}).waitFor();await snap('historico');
 for(const tab of ['cashier','products','stock','team','status','analytics']){await page.goto(base+'/admin?tab='+tab);await page.locator('#tab-'+tab+'.active').waitFor();await snap('admin-'+tab);}
 await page.goto(base+'/admin?tab=products');await page.getByRole('button',{name:/ADICIONAR PRODUTO/}).click();await snap('produto','#productEditorDialog');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Importar planilha de produtos',exact:true}).click();await page.getByLabel('Arquivo de produtos (CSV ou JSON)').setInputFiles({name:'produtos.csv',mimeType:'text/csv',buffer:Buffer.from('codigo;nome;preco;categoria;unidade;estoque\nHORTA01;Alface americana;4,50;Horta;UN;40\nHORTA02;Tomate cereja;9,90;Horta;KG;12,5')});await page.getByRole('button',{name:'Validar e mostrar prévia',exact:true}).click();await page.getByRole('button',{name:'Confirmar importação',exact:true}).waitFor();await snap('importacao','dialog[open]');
 await page.goto(base+'/admin?tab=team');await page.locator('[onclick="openNewUserModal()"]').click();await snap('equipe-cadastro','#userModal .modal-content');
 await page.goto(base+'/admin?tab=stock');await page.locator('#stockSearchInput').fill('ALFACE');await page.getByRole('button',{name:'Baixa ou ajuste com motivo'}).first().click();await snap('estoque-ajuste','#stockAdjustmentDialog');
 await page.goto(base+'/admin-gerencial');await page.locator('#selectedMonth').waitFor();await snap('gerencial');
 await step('rankings',async()=>{const el=page.getByText('Produtos que mais vendem',{exact:false}).first();if(await el.count())await el.scrollIntoViewIfNeeded();else await page.evaluate(()=>window.scrollTo(0,650));await snap('rankings');});
 await page.locator('.daily-closing summary').click();await page.locator('#btnCloseCash').scrollIntoViewIfNeeded();await snap('fechamento');
 await page.goto(base+'/caixa');await page.getByRole('button',{name:/Entregas/,exact:false}).first().click();await snap('entregas');
 fs.writeFileSync(path.join(dir,'orders.json'),JSON.stringify({order,customer},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
