const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { CashierClosingService } = require('../src/orders/cashier-closing.service');
const { PaymentProofStorage } = require('../src/orders/payment-proof');
const proofDataUrl = 'data:image/png;base64,' + Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
const counted = {DINHEIRO:10,PIX:0,CREDITO:0,DEBITO:0};
function setup() {
 const repository = new FirestoreRepository({isInMemory:true});
 const users = ['a','b'].map(id => ({id,name:id,role:'CAIXA',active:true}));
 repository.getAllUsers = async () => users;
 const store = new PdvRepository(repository);
 const snapshot = async () => ({cashierOrders:users.map(u=>({receivedBy:u,paymentMethod:'DINHEIRO',total:10})),cashierSettlements:[],closing:{byPayment:{DINHEIRO:{total:10}}}});
 const service = new CashierClosingService({store,repository,snapshot,proofStorage:new PaymentProofStorage({inMemory:true})});
 return {store,service,users};
}
test('closing requires counted values, photo, own scope; closes once and queues only after all cashiers', async () => {
 const {service,store,users} = setup(); const date='2026-10-22';
 await assert.rejects(service.close(users[0], {date,counted,proofDataUrl,cashierId:'b'}), /próprio/);
 await assert.rejects(service.close(users[0], {date,counted}), /foto/);
 await assert.rejects(service.close(users[0], {date,counted:{},proofDataUrl}), /quatro/);
 await assert.rejects(service.close(users[0], {date,counted,expected:{...counted,DINHEIRO:5},proofDataUrl}), /mudaram/);
 const first=await service.close(users[0],{date,counted,proofDataUrl}); assert.equal(first.allClosed,false);
 assert.equal(await store.read('pdv_outbox','cashier-day-'+date+'-owner'), null);
 const result = await Promise.all([service.close(users[1],{date,counted,proofDataUrl}),service.close(users[1],{date,counted,proofDataUrl})]);
 assert.equal(result.filter(r=>r.alreadyClosed).length,1);
 assert.equal((await store.list('pdv_outbox','kind','closing')).length,1);
 const retry=await service.close(users[0],{date,counted:{...counted,DINHEIRO:50},proofDataUrl});
 assert.equal(retry.closing.counted.DINHEIRO,10);
});
test('closing rejects a new receipt arriving during the conference', async () => {
 const {service,store,users}=setup(); const original=service.snapshot;
 service.snapshot=async (...args)=>{await store.transaction(async tx=>tx.set('cashier_day_revisions','2026-10-22',{version:1}));return original(...args);};
 await assert.rejects(service.close(users[0],{date:'2026-10-22',counted,proofDataUrl}), /novos recebimentos/);
 assert.equal((await store.list('cashier_daily_closings','status','CLOSED')).length,0);
});

test('a closed cashier cannot register another receipt', async () => {
 const {service,store,users}=setup(); const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
 await service.close(users[0],{date,counted,proofDataUrl});
 await store.transaction(async tx=>tx.set('orders','pending',{id:'pending',source:'PDV',status:'AWAITING_PAYMENT'}));
 await assert.rejects(store.receive('pending',users[0]),/fechado/);
});
test('customer completion and review notifications deliver once to the registered phone', async () => {
 const {store}=setup(); const sent=[];
 const service=new (require('../src/orders/pdv.service').PdvService)({repository:store,whatsapp:{sendTextMessage:async(phone,text)=>{sent.push({phone,text});return {messages:[{id:'test-'+sent.length}]};}}});
 await store.transaction(async tx=>{tx.set('orders','order',{id:'order',ticketNumber:'123',customerPhone:'64999991234',completedAt:new Date().toISOString()}); for(const kind of ['customer-completed','customer-review']) tx.set('pdv_outbox',kind,{id:kind,kind,orderId:'order',status:'PENDING',attempts:0});});
 for(let i=0;i<2;i++) for(const kind of ['customer-completed','customer-review']) await service.deliver(kind);
 assert.equal(sent.length,2); assert.equal(sent[0].phone,'5564999991234'); assert.match(sent[0].text,/Obrigado/); assert.match(sent[1].text,/Avalie/);
});
