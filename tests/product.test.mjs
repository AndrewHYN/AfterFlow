import {test,beforeEach} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import worker,{hasPlus,cleanMix,verifySignature} from '../worker/index.js';
let sqlite,env;
beforeEach(()=>{
 sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../drizzle/0000_afterglow.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const DB={
  prepare(sql){return {bind(...args){return {
   async first(){return sqlite.prepare(sql).get(...args)||null},
   async all(){return {results:sqlite.prepare(sql).all(...args)}},
   async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}
  }}}},
  async batch(statements){sqlite.exec('BEGIN');try{const results=await Promise.all(statements.map(s=>s.run()));sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}
 };
 env={DB,STRIPE_PRICE_MONTHLY:'price_month',STRIPE_PRICE_YEARLY:'price_year'};
});
const origin='https://afterglow.example';
function req(path,method='GET',body,user='alice',extra={}){return new Request(origin+path,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'}:{}),...(method==='GET'?{}:{'Content-Type':'application/json','Origin':origin}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})}
const send=(...args)=>worker.fetch(req(...args),env);
const mix={name:'Evening ritual',mood:'deep-focus',settings:{volume:.7,layers:{brown:{on:true,vol:.5}}}};
async function user(id='alice'){await send('/api/me','GET',undefined,id)}
function active(id='alice',status='active',price='price_month',end=Math.floor(Date.now()/1000)+3600){sqlite.prepare('INSERT INTO subscriptions VALUES(?,?,?,?,?,?)').run(id,'sub_'+id,status,price,end,0)}

test('anonymous catalog contains no protected rooms or identity',async()=>{const data=await (await send('/api/me','GET',undefined,null)).json();assert.equal(data.user,null);assert.deepEqual(data.rooms,{});assert.equal(data.plus,false)});
test('cloud writes require identity',async()=>assert.equal((await send('/api/mixes','POST',mix,null)).status,401));
test('cross-origin writes rejected',async()=>assert.equal((await send('/api/mixes','POST',mix,'alice',{'Origin':'https://attacker.example'})).status,403));
test('JSON type required for mutations',async()=>assert.equal((await send('/api/mixes','POST',mix,'alice',{'Content-Type':'text/plain'})).status,415));
test('only verified active known unexpired subscriptions grant Plus',()=>{for(const status of ['trialing','past_due','unpaid','canceled','incomplete','paused'])assert.equal(hasPlus({status,price_id:'price_month',period_end:9999999999},env),false);assert.equal(hasPlus({status:'active',price_id:'unknown',period_end:9999999999},env),false);assert.equal(hasPlus({status:'active',price_id:'price_month',period_end:1},env),false);assert.equal(hasPlus({status:'active',price_id:'price_month',period_end:9999999999},env),true)});
test('active Plus receives all four additional rooms',async()=>{await user();active();assert.equal(Object.keys((await(await send('/api/me')).json()).rooms).length,4)});
test('past-due subscription cannot retrieve protected room definitions',async()=>{await user();active('alice','past_due');assert.deepEqual((await(await send('/api/me')).json()).rooms,{})});
test('mix payload strips extra subscription claims',()=>{assert.deepEqual(cleanMix({...mix,plus:true,settings:{...mix.settings,subscription:'active'}}),mix)});
test('invalid volume and layers rejected',()=>{for(const volume of [-1,2,NaN])assert.throws(()=>cleanMix({...mix,settings:{...mix.settings,volume}}));assert.throws(()=>cleanMix({...mix,settings:{volume:.4,layers:{arbitrary:{on:true,vol:.5}}}}));assert.throws(()=>cleanMix({...mix,name:''}));assert.throws(()=>cleanMix({...mix,mood:'missing'}))});
test('Free can save exactly three cloud mixes',async()=>{for(let i=0;i<3;i++)assert.equal((await send('/api/mixes','POST',mix)).status,201);assert.equal((await send('/api/mixes','POST',mix)).status,403)});
test('mix ownership enforced on read and delete',async()=>{const id=(await(await send('/api/mixes','POST',mix)).json()).id;assert.equal((await(await send('/api/mixes','GET',undefined,'bob')).json()).mixes.length,0);assert.equal((await send('/api/mixes/'+id,'DELETE',{},'bob')).status,404);assert.equal((await send('/api/mixes/'+id,'DELETE',{})).status,200)});
test('Free cannot save Plus rooms even with a forged plus flag',async()=>assert.equal((await send('/api/mixes','POST',{...mix,mood:'ocean-dusk',plus:true})).status,403));
test('Plus can save additional mixes and premium rooms',async()=>{await user();active();for(let i=0;i<5;i++)assert.equal((await send('/api/mixes','POST',{...mix,mood:'ocean-dusk'})).status,201)});
test('canceled users retain mixes but protected mixes are marked locked',async()=>{await user();active();await send('/api/mixes','POST',{...mix,mood:'ocean-dusk'});sqlite.prepare('UPDATE subscriptions SET status=?').run('canceled');assert.equal((await(await send('/api/mixes')).json()).mixes[0].locked,true)});
test('history insertion rejects forged premium sessions',async()=>assert.equal((await send('/api/sessions','POST',{id:crypto.randomUUID(),mood:'ocean-dusk',seconds:10})).status,403));
test('session retries are idempotent',async()=>{const data={id:crypto.randomUUID(),mood:'deep-focus',seconds:100};for(let i=0;i<2;i++)assert.equal((await send('/api/sessions','POST',data)).status,200);assert.equal((await(await send('/api/sessions')).json()).sessions.length,1)});
test('short invalid and excessive sessions rejected',async()=>{for(const seconds of [0,9,21601,1.5])assert.equal((await send('/api/sessions','POST',{id:crypto.randomUUID(),mood:'deep-focus',seconds})).status,400)});
test('Free history is seven days and Plus is one year',async()=>{await user();sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(crypto.randomUUID(),'alice','deep-focus',100,Date.now()-8*86400000);assert.equal((await(await send('/api/sessions')).json()).sessions.length,0);active();assert.equal((await(await send('/api/sessions')).json()).sessions.length,1)});
test('export is scoped to the authenticated owner',async()=>{await send('/api/mixes','POST',mix);const data=await(await send('/api/export','GET',undefined,'bob')).json();assert.equal(data.mixes.length,0);assert.equal(data.user.id,'bob')});
test('account deletion removes only the user’s cloud data',async()=>{await send('/api/mixes','POST',mix);await send('/api/mixes','POST',mix,'bob');assert.equal((await send('/api/account','DELETE',{})).status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM mixes').get().n,1)});
test('account deletion blocks active and canceled-at-period-end subscriptions',async()=>{await user();active();assert.equal((await send('/api/account','DELETE',{})).status,409);sqlite.prepare('UPDATE subscriptions SET cancel_at_period_end=1').run();assert.equal((await send('/api/account','DELETE',{})).status,409)});
test('billing stays unavailable without merchant configuration',async()=>{const data=await(await send('/api/me')).json();assert.equal(data.billingReady,false);assert.equal((await send('/api/billing/checkout','POST',{interval:'monthly'})).status,503)});
async function signed(raw,secret='whsec_test',timestamp=Math.floor(Date.now()/1000)){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw));const sig=Buffer.from(bytes).toString('hex');return 't='+timestamp+',v1='+sig}
test('webhook signature accepts valid raw payload',async()=>{const raw='{"id":"evt_1"}';assert.equal(await verifySignature(raw,await signed(raw),'whsec_test'),true)});
test('webhook signature rejects tampering stale timestamps and wrong secrets',async()=>{const raw='{}',sig=await signed(raw);assert.equal(await verifySignature(raw+' ',sig,'whsec_test'),false);assert.equal(await verifySignature(raw,sig,'wrong'),false);assert.equal(await verifySignature(raw,await signed(raw,'whsec_test',1),'whsec_test'),false);assert.equal(await verifySignature(raw,'t=abc,v1=garbage','whsec_test'),false)});
test('unsigned webhook cannot grant access',async()=>{env.STRIPE_WEBHOOK_SECRET='whsec_test';env.STRIPE_RESTRICTED_KEY='test-config';assert.equal((await send('/api/billing/webhook','POST',{id:'evt_forged'},null)).status,400)});
async function billEvent(event,providerSub){env.STRIPE_WEBHOOK_SECRET='whsec_test';env.STRIPE_RESTRICTED_KEY='test-config';const raw=JSON.stringify(event),signature=await signed(raw);const original=globalThis.fetch;globalThis.fetch=async()=>Response.json(providerSub);try{return await worker.fetch(new Request(origin+'/api/billing/webhook',{method:'POST',body:raw,headers:{'stripe-signature':signature}}),env)}finally{globalThis.fetch=original}}
const providerSub=status=>({id:'sub_alice',customer:'cus_alice',status,cancel_at_period_end:false,items:{data:[{price:{id:'price_month'},current_period_end:Math.floor(Date.now()/1000)+3600}]}});
const event=(id,type,object)=>({id,type,data:{object}});
async function billingUser(){await user();sqlite.prepare('UPDATE users SET customer_id=? WHERE id=?').run('cus_alice','alice')}
test('paid checkout resolves customer ownership and retrieves subscription',async()=>{await billingUser();const response=await billEvent(event('evt_paid','checkout.session.completed',{customer:'cus_alice',subscription:'sub_alice',payment_status:'paid'}),providerSub('active'));assert.equal(response.status,200);assert.equal((await(await send('/api/me')).json()).plus,true)});
test('unpaid checkout cannot grant access',async()=>{await billingUser();await billEvent(event('evt_pending','checkout.session.completed',{customer:'cus_alice',subscription:'sub_alice',payment_status:'unpaid'}),providerSub('active'));assert.equal((await(await send('/api/me')).json()).plus,false)});
test('renewal and failure invoice events use current provider state',async()=>{await billingUser();for(const [id,type,status]of [['evt_renew','invoice.paid','active'],['evt_fail','invoice.payment_failed','past_due']]){assert.equal((await billEvent(event(id,type,{customer:'cus_alice',parent:{subscription_details:{subscription:'sub_alice'}}}),providerSub(status))).status,200);assert.equal((await(await send('/api/me')).json()).plus,status==='active')}});
test('late active webhook cannot restore canceled access',async()=>{await billingUser();active();await billEvent(event('evt_late','customer.subscription.updated',{...providerSub('active')}),providerSub('canceled'));assert.equal((await(await send('/api/me')).json()).plus,false)});
test('webhook redelivery has no duplicate ledger entry',async()=>{await billingUser();const e=event('evt_same','customer.subscription.updated',providerSub('active'));for(let i=0;i<2;i++)assert.equal((await billEvent(e,providerSub('active'))).status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM billing_events').get().n,1)});
test('billing return query never grants Plus',async()=>{await user();assert.equal((await(await send('/api/me?checkout=success&plus=true')).json()).plus,false)});
test('security headers and real not found responses',async()=>{const response=await send('/');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.ok(response.headers.get('content-security-policy').includes("object-src 'none'"));assert.equal((await send('/missing')).status,404)});
