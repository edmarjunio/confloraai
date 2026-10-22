const { test, expect } = require('@playwright/test');
test('closing guides conference, irreversible confirmation and required photo on mobile', async ({page}) => {
 await page.setViewportSize({width:390,height:844});
 await page.request.post('/api/admin/auth/login',{data:{userId:'usr-edmar',pin:'1234'}});
 await page.route('**/api/caixa/closing?*',route=>route.fulfill({json:{date:'2026-10-22',cashiers:[{id:'cashier',name:'Caixa teste',expected:{DINHEIRO:10,PIX:20,CREDITO:30,DEBITO:40},closing:null}]}}));
 let payload;
 await page.route('**/api/caixa/closing',async route=>{payload=route.request().postDataJSON(); await route.fulfill({json:{allClosed:true}});});
 await page.goto('/admin-gerencial');
 await page.getByRole('button',{name:'FECHAR CAIXA',exact:true}).click();
 const dialog=page.locator('#cashierClosingDialog'); await expect(dialog).toBeVisible();
 for(const [name,value] of Object.entries({DINHEIRO:'10',PIX:'20',CREDITO:'30',DEBITO:'40'})) await dialog.locator('[name='+name+']').fill(value);
 page.once('dialog', async confirm=>{expect(confirm.message()).toContain('não poderá ser desfeita');await confirm.accept();});
 await dialog.getByRole('button',{name:'Conferir e continuar'}).click();
 await expect(dialog.locator('[data-proof]')).toBeVisible(); expect(payload).toBeUndefined();
 await dialog.locator('input[type=file]').setInputFiles('public/storefront/brands/conflora-logo.png');
 await page.screenshot({path:'test-results/closing-mobile.png'});
 await dialog.getByRole('button',{name:'Anexar foto e finalizar fechamento'}).click();
 await expect(dialog.getByRole('status')).toContainText('Todos os caixas fechados');
 expect(payload.cashierId).toBe('cashier'); expect(payload.counted.DINHEIRO).toBe(10); expect(payload.proofDataUrl).toMatch(/^data:image/);
});
test('mobile cart locks background and restores the original scroll position', async ({page})=>{
 await page.setViewportSize({width:390,height:640});
 await page.goto('/shop/garden');
 await expect(page.locator('#products .product-card')).toHaveCount(2);
 if(await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
 await page.evaluate(()=>{window.scrollTo(0,150);});
 const before=await page.evaluate(()=>window.scrollY);
 await page.locator('#cartButton').click();
 await expect(page.locator('body')).toHaveCSS('position','fixed');
 await page.locator('#cartDialog').evaluate(dialog=>dialog.close());
 await expect(page.locator('body')).not.toHaveCSS('position','fixed');
 expect(await page.evaluate(()=>window.scrollY)).toBe(before);
});

test('command board renders with columns fifty percent wider', async ({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.request.post('/api/admin/auth/login',{data:{userId:'usr-caixa1',pin:'0000'}});
 await page.goto('/caixa?view=commands');
 await page.waitForTimeout(1500); expect(errors).toEqual([]);
 await expect(page.locator('.cf-cashier-board')).toBeVisible();
 const ratio=await page.locator('.cf-cashier-board').evaluate(node=>node.getBoundingClientRect().width/node.parentElement.getBoundingClientRect().width);
 expect(ratio).toBeCloseTo(1.5,1);
 await page.screenshot({path:'test-results/command-board-wide.png'});
});

test('cashier catalog loads without JavaScript errors', async ({page})=>{
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.request.post('/api/admin/auth/login',{data:{userId:'usr-caixa1',pin:'0000'}});
 await page.goto('/caixa'); await page.waitForTimeout(1000); expect(errors).toEqual([]);
 await expect(page.locator('render-product-card').first()).toBeVisible();
});
