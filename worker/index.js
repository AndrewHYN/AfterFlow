// HTML is embedded by scripts/build.mjs. Platform dispatch supplies trusted identity.
const HTML = '__AFTERGLOW_HTML__';
export const BASE_MOODS = ['midnight-drive','rainy-window','deep-focus','golden-hour'];
export const PLUS_MOODS = {
 'ocean-dusk':{n:'05',name:'Ocean Dusk',stage:'stage-ocean',art:'art-ocean',accent:'#76C9CD',tag:'Coast · spaciousness · letting go',desc:'The shore has nothing to ask of you.',layers:[['wind','Coastal Wind',.5],['brown','Deep Water',.35],['harm','Dusk Glow',.2]],tracks:[]},
 'forest-floor':{n:'06',name:'Forest Floor',stage:'stage-forest',art:'art-forest',accent:'#8CB39A',tag:'Green · grounding · slow mornings',desc:'A clearing between everything else.',layers:[['wind','Canopy',.45],['rain','Morning Mist',.3],['restraint','Still Air',.22]],tracks:[]},
 'velvet-night':{n:'07',name:'Velvet Night',stage:'stage-velvet',art:'art-velvet',accent:'#AC8ED6',tag:'Rest · soft edges · deep night',desc:'Let the day dissolve into the dark.',layers:[['brown','Night Noise',.4],['drone','Velvet Drone',.3],['atmos','Dream Field',.25]],tracks:[]},
 'ember-room':{n:'08',name:'Ember Room',stage:'stage-ember',art:'art-ember',accent:'#E99A68',tag:'Warmth · reading · quiet company',desc:'A little warmth. A little less hurry.',layers:[['brown','Ember Hush',.45],['harm','Firelight',.28],['hum','Room Tone',.2]],tracks:[]}
};
const ALL_MOODS=[...BASE_MOODS,...Object.keys(PLUS_MOODS)];
const security={
 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com; form-action 'self'"
};
const json=(body,status=200)=>Response.json(body,{status,headers:security});
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
function requireIdentity(request){const id=request.headers.get('oai-authenticated-user-id');if(!id)throw new HttpError(401,'Sign in to save your studio across devices.');return {id,email:request.headers.get('oai-authenticated-user-email')||''}}
async function userFor(request,env){const user=requireIdentity(request);if(!env.DB)throw new HttpError(503,'Cloud studio is temporarily unavailable.');await env.DB.prepare('INSERT INTO users(id,email,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind(user.id,user.email,Date.now()).run();return user}
export function hasPlus(sub,env,now=Date.now()){return !!(sub && sub.status==='active' && sub.period_end*1000>now && [env.STRIPE_PRICE_MONTHLY,env.STRIPE_PRICE_YEARLY].filter(Boolean).includes(sub.price_id))}
async function subscription(env,id){return env.DB.prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(id).first()}
const billingReady=env=>env.BILLING_ENABLED==='true'&&!!(env.STRIPE_RESTRICTED_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PRICE_MONTHLY&&env.STRIPE_PRICE_YEARLY&&env.SITE_ORIGIN);
function originFor(request,env){const origin=new URL(request.url).origin; if(env.SITE_ORIGIN&&new URL(env.SITE_ORIGIN).origin!==origin)throw new HttpError(403,'Unrecognized application origin.');return origin}
function writeGuard(request){if(request.headers.get('Origin')!==new URL(request.url).origin)throw new HttpError(403,'Request origin does not match.');if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'Send JSON data.');}
async function bodyFor(request){const text=await request.text();if(text.length>16384)throw new HttpError(413,'This request is too large.');try{return JSON.parse(text)}catch{throw new HttpError(400,'Invalid JSON data.')}}
export function cleanMix(input){
 const name=typeof input.name==='string'?input.name.trim():'';
 if(!name||name.length>60||!ALL_MOODS.includes(input.mood))throw new HttpError(400,'Enter a mix name of 1–60 characters and a valid room.');
 const settings=input.settings;
 if(!settings||!Number.isFinite(settings.volume)||settings.volume<0||settings.volume>1||!settings.layers||typeof settings.layers!=='object'||Array.isArray(settings.layers))throw new HttpError(400,'Invalid mix settings.');
 const allowed=['rain','brown','hum','drone','neon','restraint','harm','wind','atmos'];const layers={};
 for(const [key,value] of Object.entries(settings.layers)){if(!allowed.includes(key)||!value||typeof value.on!=='boolean'||!Number.isFinite(value.vol)||value.vol<0||value.vol>1)throw new HttpError(400,'Invalid sound layer.');layers[key]={on:value.on,vol:value.vol}}
 return {name,mood:input.mood,settings:{volume:settings.volume,layers}};
}
export async function stripeCall(env,path,method='GET',fields={},idempotencyKey){
 const headers={'Authorization':'Bearer '+env.STRIPE_RESTRICTED_KEY,'Stripe-Version':'2026-08-26.dahlia'};
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 if(method==='POST')headers['Content-Type']='application/x-www-form-urlencoded';
 const response=await fetch('https://api.stripe.com/v1/'+path,{method,headers,...(method==='POST'?{body:new URLSearchParams(fields)}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new HttpError(502,'Billing could not respond. Please try again later.');return response.json();
}
export async function verifySignature(raw,header,secret,now=Date.now()){
 if(!header||!secret)return false;
 const pairs=header.split(',').map(v=>v.split('='));const timestamp=pairs.find(([k])=>k==='t')?.[1];
 if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const [k,sig] of pairs){if(k!=='v1'||!/^\w{64}$/.test(sig)||!/^[0-9a-f]+$/i.test(sig))continue;const bytes=Uint8Array.from(sig.match(/../g).map(x=>parseInt(x,16)));if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(timestamp+'.'+raw)))return true}return false;
}
async function syncSubscription(env,subId,customerId){
 const user=await env.DB.prepare('SELECT id FROM users WHERE customer_id=?').bind(customerId).first();
 if(!user)return;
 // Retrieve current provider state: old deliveries cannot restore a canceled subscription.
 const sub=await stripeCall(env,'subscriptions/'+encodeURIComponent(subId));
 if((typeof sub.customer==='string'?sub.customer:sub.customer?.id)!==customerId)throw new HttpError(400,'Customer mismatch.');
 const current=await subscription(env,user.id);
 // Avoid an older subscription overwriting an unrelated active subscription.
 if(current&&current.subscription_id!==sub.id&&current.status==='active'&&current.period_end*1000>Date.now())throw new HttpError(409,'Resolve duplicate subscription before synchronization.');
 const item=sub.items?.data?.find(v=>[env.STRIPE_PRICE_MONTHLY,env.STRIPE_PRICE_YEARLY].includes(v.price?.id));
 await env.DB.prepare('INSERT INTO subscriptions(user_id,subscription_id,status,price_id,period_end,cancel_at_period_end) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET subscription_id=excluded.subscription_id,status=excluded.status,price_id=excluded.price_id,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end').bind(user.id,sub.id,sub.status,item?.price?.id||'',item?.current_period_end||0,sub.cancel_at_period_end?1:0).run();
}
async function webhook(request,env){
 if(!env.DB||!env.STRIPE_WEBHOOK_SECRET||!env.STRIPE_RESTRICTED_KEY)throw new HttpError(503,'Billing is not connected.');
 const raw=await request.text();if(raw.length>262144)throw new HttpError(413,'Event too large.');
 if(!await verifySignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))throw new HttpError(400,'Invalid webhook signature.');
 let event;try{event=JSON.parse(raw)}catch{throw new HttpError(400,'Invalid event.');}
 if(!event.id||!event.type||!event.data?.object)throw new HttpError(400,'Invalid event.');
 if(await env.DB.prepare('SELECT id FROM billing_events WHERE id=?').bind(event.id).first())return json({received:true});
 const obj=event.data.object;
 let subId=null;
 if(event.type.startsWith('customer.subscription.'))subId=obj.id;
 if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&obj.payment_status==='paid')subId=typeof obj.subscription==='string'?obj.subscription:obj.subscription?.id;
 if(['invoice.paid','invoice.payment_failed'].includes(event.type))subId=obj.parent?.subscription_details?.subscription||obj.subscription;
 if(subId&&obj.customer)await syncSubscription(env,typeof subId==='string'?subId:subId.id,typeof obj.customer==='string'?obj.customer:obj.customer.id);
 await env.DB.prepare('INSERT OR IGNORE INTO billing_events(id,created_at) VALUES(?,?)').bind(event.id,Date.now()).run();
 return json({received:true});
}
export async function api(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/billing/webhook'&&request.method==='POST')return webhook(request,env);
 if(!['GET','POST','DELETE'].includes(request.method))throw new HttpError(405,'Method not allowed.');
 if(request.method!=='GET')writeGuard(request);
 if(path==='/api/health'&&request.method==='GET')return json({ok:true,version:'1.0.0'});
 if(path==='/api/me'&&request.method==='GET'){
 const id=request.headers.get('oai-authenticated-user-id');if(!id)return json({user:null,plus:false,billingReady:billingReady(env),rooms:{}});
 const user=await userFor(request,env),sub=await subscription(env,user.id),plus=hasPlus(sub,env);
 return json({user,plus,billingReady:billingReady(env),subscription:sub?{status:sub.status,periodEnd:sub.period_end,cancelAtPeriodEnd:!!sub.cancel_at_period_end}:null,rooms:plus?PLUS_MOODS:{}});
 }
 const user=await userFor(request,env),sub=await subscription(env,user.id),plus=hasPlus(sub,env);
 if(path==='/api/mixes'&&request.method==='GET'){
 const result=await env.DB.prepare('SELECT id,name,mood,settings,created_at FROM mixes WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(user.id).all();return json({mixes:result.results.map(m=>({...m,settings:JSON.parse(m.settings),locked:!plus&&!BASE_MOODS.includes(m.mood)}))});
 }
 if(path==='/api/mixes'&&request.method==='POST'){
 const mix=cleanMix(await bodyFor(request));if(!plus&&!BASE_MOODS.includes(mix.mood))throw new HttpError(403,'This room is included with Plus.');
 const id=crypto.randomUUID(),cap=plus?200:3;
 // Count and insert in a single SQL statement to enforce the limit under races.
 const result=await env.DB.prepare('INSERT INTO mixes(id,user_id,name,mood,settings,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM mixes WHERE user_id=?) < ?').bind(id,user.id,mix.name,mix.mood,JSON.stringify(mix.settings),Date.now(),user.id,cap).run();
 if(!result.meta.changes)throw new HttpError(403,plus?'Your library is full (200 mixes). Remove a mix to save another.':'Your three free cloud mixes are full. Upgrade or remove a mix.');return json({id},201);
 }
 if(path.startsWith('/api/mixes/')&&request.method==='DELETE'){
 const result=await env.DB.prepare('DELETE FROM mixes WHERE id=? AND user_id=?').bind(path.split('/').pop(),user.id).run();if(!result.meta.changes)throw new HttpError(404,'Mix not found.');return json({ok:true});
 }
 if(path==='/api/sessions'&&request.method==='POST'){
 const data=await bodyFor(request);if(!ALL_MOODS.includes(data.mood)||!Number.isInteger(data.seconds)||data.seconds<10||data.seconds>21600||!/^[-\w]{36}$/.test(data.id||''))throw new HttpError(400,'Invalid session.');
 if(!plus&&!BASE_MOODS.includes(data.mood))throw new HttpError(403,'Plus is required for this room.');
 await env.DB.prepare('INSERT OR IGNORE INTO sessions(id,user_id,mood,seconds,created_at) VALUES(?,?,?,?,?)').bind(data.id,user.id,data.mood,data.seconds,Date.now()).run();return json({ok:true});
 }
 if(path==='/api/sessions'&&request.method==='GET'){
 const cutoff=Date.now()-(plus?365:7)*86400000;
 const result=await env.DB.prepare('SELECT id,mood,seconds,created_at FROM sessions WHERE user_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 500').bind(user.id,cutoff).all();return json({sessions:result.results,days:plus?365:7});
 }
 if(path==='/api/export'&&request.method==='GET'){
 const mixes=await env.DB.prepare('SELECT id,name,mood,settings,created_at FROM mixes WHERE user_id=?').bind(user.id).all();const sessions=await env.DB.prepare('SELECT mood,seconds,created_at FROM sessions WHERE user_id=?').bind(user.id).all();return json({exportedAt:new Date().toISOString(),user,mixes:mixes.results,sessions:sessions.results});
 }
 if(path==='/api/account'&&request.method==='DELETE'){
 if(sub&& !['canceled','incomplete_expired'].includes(sub.status))throw new HttpError(409,'Cancel your subscription and wait for its paid period to end before deleting your account.');
 await env.DB.batch([env.DB.prepare('DELETE FROM mixes WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM subscriptions WHERE user_id=?').bind(user.id),env.DB.prepare('DELETE FROM users WHERE id=?').bind(user.id)]);return json({ok:true});
 }
 if(path==='/api/billing/checkout'&&request.method==='POST'){
 if(!billingReady(env))throw new HttpError(503,'Plus subscriptions are not on sale yet. Your free studio is ready to use.');
 if(sub&& !['canceled','incomplete_expired'].includes(sub.status))throw new HttpError(409,'You already have a subscription. Use Manage billing.');
 const data=await bodyFor(request);if(!['monthly','yearly'].includes(data.interval))throw new HttpError(400,'Choose monthly or yearly billing.');
 const origin=originFor(request,env);let account=await env.DB.prepare('SELECT customer_id FROM users WHERE id=?').bind(user.id).first();
 if(!account.customer_id){const customer=await stripeCall(env,'customers','POST',{email:user.email},'afterglow-customer-'+user.id);await env.DB.prepare('UPDATE users SET customer_id=? WHERE id=?').bind(customer.id,user.id).run();account={customer_id:customer.id}}
 // Validate the provider price so the advertised USD total cannot drift silently.
 const priceId=data.interval==='monthly'?env.STRIPE_PRICE_MONTHLY:env.STRIPE_PRICE_YEARLY;
 const price=await stripeCall(env,'prices/'+encodeURIComponent(priceId));
 if(!price.active||price.currency!=='usd'||price.unit_amount!==(data.interval==='monthly'?300:2400)||price.recurring?.interval!==(data.interval==='monthly'?'month':'year')||price.recurring?.interval_count!==1)throw new HttpError(503,'The subscription price is not ready.');
 const random=Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>String.fromCharCode(97+v%26)).join('');
 const result=await stripeCall(env,'checkout/sessions','POST',{mode:'subscription',customer:account.customer_id,'line_items[0][price]':priceId,'line_items[0][quantity]':'1',success_url:origin+'/?checkout=success#/account',cancel_url:origin+'/#/pricing',integration_identifier:'afterglow-'+random},'afterglow-checkout-'+user.id+'-'+data.interval+'-'+Math.floor(Date.now()/1800000));
 return json({url:result.url});
 }
 if(path==='/api/billing/portal'&&request.method==='POST'){
 if(!billingReady(env))throw new HttpError(503,'Billing management is currently unavailable.');
 const row=await env.DB.prepare('SELECT customer_id FROM users WHERE id=?').bind(user.id).first();if(!row.customer_id)throw new HttpError(400,'No billing account yet.');
 const result=await stripeCall(env,'billing_portal/sessions','POST',{customer:row.customer_id,return_url:originFor(request,env)+'/#/account'});return json({url:result.url});
 }
 throw new HttpError(404,'This endpoint does not exist.');
}
export default {async fetch(request,env){try{
 const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return await api(request,env);
 if(url.pathname==='/favicon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#090909"/><circle cx="32" cy="32" r="17" fill="none" stroke="#ff7849" stroke-width="3"/><circle cx="32" cy="32" r="7" fill="#ff7849"/></svg>',{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=86400'}});
 if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /api/\n',{headers:{'Content-Type':'text/plain'}});
 if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Not found',{status:404,headers:security});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:security});
 return new Response(request.method==='HEAD'?null:HTML,{headers:{...security,'Content-Type':'text/html; charset=utf-8'}});
 }catch(error){return json({error:error.status?error.message:'The studio could not complete that request. Please try again.'},error.status||500)}}};
