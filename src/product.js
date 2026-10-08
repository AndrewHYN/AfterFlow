/* Cloud studio, subscription surfaces, and accessible dialogs. */
let cloud={user:null,plus:false,billingReady:false},cloudError='',session=null,cloudLoading=true;
const FREE_ROOMS=[...MOOD_ORDER];
const TEASERS=[['ocean-dusk','Ocean Dusk','The shore has nothing to ask of you.','ocean'],['forest-floor','Forest Floor','A clearing between everything else.','forest'],['velvet-night','Velvet Night','Let the day dissolve into the dark.','velvet'],['ember-room','Ember Room','A little warmth. A little less hurry.','ember']];
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function requestAPI(path,method='GET',body){const response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Please try again.');return data}
function loginLink(text='Sign in with ChatGPT'){return '<a class="btn primary" href="/signin-with-chatgpt?return_to='+encodeURIComponent('/#/account')+'" target="_top">'+text+'</a>'}
async function initCloud(){
 try{cloud=await requestAPI('me');cloudError='';Object.entries(cloud.rooms||{}).forEach(([slug,mood])=>{MOODS[slug]=mood;if(!MOOD_ORDER.includes(slug))MOOD_ORDER.push(slug)});}
 catch(error){cloudError=error.message;}finally{cloudLoading=false;updateHomeMixes();const r=location.hash;if(r.includes('/account')||r.includes('/saved')||r.includes('/pricing')||r.includes('/explore')||TEASERS.some(t=>r.includes(t[0])))route();}
 if(new URLSearchParams(location.search).get('checkout')==='success'){history.replaceState(null,'',location.pathname+'#/account');toast('Checkout returned. Access updates after payment verification.');if(!cloud.plus){let tries=0;const poll=setInterval(async()=>{tries++;try{const next=await requestAPI('me');if(next.plus){cloud=next;Object.assign(MOODS,next.rooms);Object.keys(next.rooms).forEach(s=>{if(!MOOD_ORDER.includes(s))MOOD_ORDER.push(s)});route();toast('Welcome to AFTERGLOW Plus.');clearInterval(poll)}}catch{}if(tries>=8)clearInterval(poll)},3000)}}
}
const nativePlay=AE.play.bind(AE),nativePause=AE.pause.bind(AE);
AE.play=function(slug){if(session)endSession();nativePlay(slug);if(this.playing){session={id:crypto.randomUUID(),mood:slug,started:Date.now()};store.set('lastPlayed',slug);trackEvent('play',slug)};};
AE.pause=function(fast){endSession();nativePause(fast)};
function endSession(){if(!session)return;const ended=session;session=null;const seconds=Math.min(21600,Math.floor((Date.now()-ended.started)/1000));if(seconds>=10)trackEvent('listen',ended.mood,seconds);if(cloud.user&&seconds>=10)requestAPI('sessions','POST',{id:ended.id,mood:ended.mood,seconds}).catch(()=>toast('Session history could not sync. Your sound settings stay on this device.'))}
addEventListener('pagehide',()=>{if(!session)return;const seconds=Math.min(21600,Math.floor((Date.now()-session.started)/1000));if(cloud.user&&seconds>=10)fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:session.id,mood:session.mood,seconds}),keepalive:true}).catch(()=>{});if(seconds>=10)trackEvent('listen',session.mood,seconds);session=null;});
function showDialog(title,description,content,onSubmit){
 document.querySelector('dialog')?.remove();const dialog=document.createElement('dialog');dialog.innerHTML='<form><h2>'+escapeHTML(title)+'</h2><p>'+escapeHTML(description)+'</p>'+content+'<p class="statusline" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Confirm</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>';document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=dialog.querySelector('[type=submit]');b.disabled=true;try{await onSubmit(dialog);dialog.close()}catch(error){dialog.querySelector('[role=alert]').textContent=error.message;b.disabled=false}};dialog.showModal();
}
function wireExtras(slug){
 $('#savemix').onclick=()=>{
 if(!cloud.user){toast('Sign in to save custom mixes across devices.');location.hash='/account';return}
 showDialog('Keep this feeling.','Your room, volume and all three layers will be saved to your account.','<label class="field" for="mixname">Mix name</label><input class="text" id="mixname" name="mixname" maxlength="60" required placeholder="My evening ritual" autocomplete="off">',async dialog=>{
 const layers={};MOODS[slug].layers.forEach(([id,,def])=>{const prefs=store.get('layers:'+slug,{})[id];layers[id]={on:prefs?.on!==false,vol:prefs?.vol??def}});
 await requestAPI('mixes','POST',{name:dialog.querySelector('input').value,mood:slug,settings:{volume:store.get('vol',.8),layers}});trackEvent('mix_saved',slug);toast('Custom mix saved to your cloud library.');});
 };
 $('#fullscreen').onclick=()=>{document.body.classList.add('immersive');$('.stage').onclick=exitImmersive};
}
function exitImmersive(){document.body.classList.remove('immersive');const stage=$('.stage');if(stage)stage.onclick=null}
addEventListener('keydown',event=>{if(event.key==='Escape')exitImmersive();if(event.code==='Space'&&currentRoute.startsWith('studio/')&&!document.querySelector('dialog')&&!['INPUT','BUTTON','A','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#playbtn')?.click()}});
addEventListener('hashchange',exitImmersive);
function teasers(){return '<div class="plus-preview">'+TEASERS.map(([slug,name,desc,art])=>'<article><a href="'+(cloud.plus?'#/studio/'+slug:'#/pricing')+'"><div class="art"><div class="art-'+art+'"></div></div><h3>'+name+'</h3><p class="bodycopy">'+desc+'</p><span class="badge">'+(cloud.plus?'Enter room ↗':'Plus room')+'</span></a></article>').join('')+'</div>'}
const originalExplore=Explore;
Explore=function(){originalExplore();if(!cloud.plus){const section=document.createElement('section');section.className='section';section.innerHTML='<div class="section-head"><h2 class="display">A little <em>further.</em></h2><a class="btn ghost" href="#/pricing">Explore Plus</a></div>'+teasers();app.querySelector('footer').before(section)}};
function Pricing(){
 setActiveNav('pricing');app.innerHTML='<section class="page"><span class="eyebrow">Afterglow Plus</span><h1>More room.<br>Same <em>quiet.</em></h1><p class="lead">Start with a free studio you can keep. Choose Plus when your daily ritual needs more space.</p><div class="billing-switch" role="group" aria-label="Billing period"><button data-period="monthly" aria-pressed="true">Monthly</button><button data-period="yearly" aria-pressed="false">Yearly · save 33%</button></div><div class="plans"><article class="plan"><span class="eyebrow">Your everyday studio</span><h2>Free</h2><p class="price">$0<span> / always</span></p><ul><li>Four original atmosphere rooms</li><li>Independent sound layers and focus timers</li><li>Unlimited listening, without advertising</li><li>Three cloud mixes when you sign in</li><li>Seven days of session history</li></ul><a class="btn ghost" href="#/studio/deep-focus">Enter the free studio</a></article><article class="plan plus"><span class="eyebrow">For the rituals you return to</span><h2>Plus</h2><p class="price" id="plusprice">$3<span> / month</span></p><p class="bodycopy" id="billdetail">Proposed pricing. Checkout is not available yet.</p><ul><li>All eight atmosphere rooms</li><li>Up to 200 custom cloud mixes</li><li>One year of session history</li><li>Your studio library across devices</li><li>Four exclusive soundscapes to explore</li></ul><button class="btn primary" id="upgrade">'+(cloud.plus?'Manage your subscription':cloud.billingReady?'Choose Plus':'Plus is coming soon')+'</button><p class="statusline" id="billstatus" role="status">'+(cloud.billingReady?'Prices in USD. Applicable tax is shown at checkout.':'The free studio is open. Paid subscriptions are not on sale yet.')+'</p></article></div><h2 class="display">Four more ways to <em>settle.</em></h2>'+teasers()+'<details><summary>Will the free rooms stay free?</summary><p>Yes. All four original rooms, their sound layers and timers belong to the Free plan. You can listen without a subscription.</p></details><details><summary>What happens if I cancel?</summary><p>Billing and renewal details will be shown before Plus goes on sale. When paid access ends, Free limits apply. Existing mixes remain available to view and delete; Plus rooms require an active subscription to open.</p></details><details><summary>Is this recorded music?</summary><p>No. AFTERGLOW creates original ambient textures using your browser’s sound engine. Suggested artist links open a separate service; we do not stream or sell their recordings.</p></details><details><summary>Can I listen on my phone?</summary><p>Yes. Tap Play to start. Mobile browsers can suspend audio when the device locks or the tab goes into the background. Keep the studio open for a dependable session.</p></details></section>'+FOOT;
 let interval='monthly';app.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{interval=b.dataset.period;app.querySelectorAll('[data-period]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#plusprice').innerHTML=interval==='monthly'?'$3<span> / month</span>':'$24<span> / year</span>';$('#billdetail').textContent=interval==='monthly'?'Proposed pricing. Checkout is not available yet.':'Proposed yearly pricing: $24, equivalent to $2/month. Not on sale yet.'});
 $('#upgrade').onclick=async()=>{
 if(!cloud.billingReady){toast('Plus is not on sale yet. Enjoy the free studio.');return}
 if(!cloud.user){location.hash='/account';return}
 const button=$('#upgrade');button.disabled=true;try{const response=await requestAPI(cloud.plus?'billing/portal':'billing/checkout','POST',cloud.plus?{}:{interval});location.assign(response.url)}catch(error){$('#billstatus').textContent=error.message;button.disabled=false}
 };
}
function Account(){
 setActiveNav('account');
 if(cloudLoading){app.innerHTML='<section class="empty"><h2>Opening your studio…</h2></section>';return}
 if(cloudError){app.innerHTML='<section class="empty"><h2>Cloud studio is unavailable.</h2><p class="bodycopy">'+escapeHTML(cloudError)+'</p><button class="btn ghost" id="retrycloud">Try again</button><a class="btn primary" href="#/studio/deep-focus">Use the free studio</a></section>';$('#retrycloud').onclick=()=>{cloudLoading=true;Account();initCloud()};return}
 if(!cloud.user){app.innerHTML='<section class="empty"><span class="eyebrow">Your personal studio</span><h2>Keep the sounds<br><strong>you come back to.</strong></h2><p class="bodycopy" style="max-width:48ch">Sign in to keep custom mixes across devices and see your listening sessions. Your four free rooms are always here.</p>'+loginLink()+'<a class="btn ghost" href="#/studio/deep-focus">Keep listening without an account</a></section>'+FOOT;return}
 app.innerHTML='<section class="page"><span class="eyebrow">Your studio account</span><h1>A place to <em>return.</em></h1><p class="lead">'+escapeHTML(cloud.user.email)+' · '+(cloud.plus?'Plus studio':'Free studio')+'</p><div class="account-grid"><article class="panel"><h2>Your membership</h2><p>'+membershipCopy()+'</p><a class="btn ghost" href="#/pricing">'+(cloud.plus?'Compare plans':'Discover Plus')+'</a> '+(cloud.subscription?'<button class="act" id="portal">Manage billing</button>':'')+'<p class="statusline" id="accountstatus" role="status"></p></article><article class="panel"><h2>Your data, your choice</h2><p>Export your mixes and session history, or delete your AFTERGLOW account data.</p><button class="act" id="export">Export data</button> <button class="act danger" id="deleteaccount">Delete account data</button><p class="statusline">Deletion removes AFTERGLOW data. It does not delete your ChatGPT account.</p></article><article class="panel" style="grid-column:1/-1"><h2>Your recent rhythm</h2><div id="history"><p>Loading your sessions…</p></div></article></div><div class="actions" style="margin-top:2rem"><a class="btn primary" href="#/saved">Open your library</a>'+(cloud.canViewInsights?'<a class="btn ghost" href="#/insights">Usage insights</a>':'')+'<a class="btn ghost" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></div></section>'+FOOT;
 if($('#portal'))$('#portal').onclick=async()=>{try{const result=await requestAPI('billing/portal','POST',{});location.assign(result.url)}catch(error){$('#accountstatus').textContent=error.message}};
 $('#export').onclick=async()=>{try{const data=await requestAPI('export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='afterglow-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(error){toast(error.message)}};
 $('#deleteaccount').onclick=()=>showDialog('Delete your studio data?','This permanently removes your custom mixes and session history. An active subscription must end first.','<label class="field" for="deleteconfirm">Type DELETE to confirm</label><input class="text" id="deleteconfirm" required pattern="DELETE" autocomplete="off">',async()=>{await requestAPI('account','DELETE',{});toast('Your studio data has been deleted.');location.assign('/signout-with-chatgpt?return_to=%2F')});
 const holder=$('#history');requestAPI('sessions').then(data=>{if(!holder.isConnected)return;if(!data.sessions.length){holder.innerHTML='<p>Your next quiet moment starts here. Sessions of at least 10 seconds appear after you pause or finish.</p><a class="act" href="#/studio/deep-focus">Start a session</a>';return}const minutes=Math.round(data.sessions.reduce((sum,row)=>sum+row.seconds,0)/60);holder.innerHTML='<div class="stats"><div><strong>'+minutes+'</strong><small>listening minutes</small></div><div><strong>'+data.sessions.length+'</strong><small>sessions · last '+data.days+' days</small></div></div>'+data.sessions.slice(0,20).map(row=>'<div class="history-row"><strong>'+escapeHTML(MOODS[row.mood]?.name||roomName(row.mood))+'</strong><span>'+Math.max(1,Math.round(row.seconds/60))+' min · '+new Date(row.created_at).toLocaleDateString()+'</span></div>').join('')}).catch(error=>{if(holder.isConnected)holder.innerHTML='<p>'+escapeHTML(error.message)+'</p>'});
}
function membershipCopy(){if(!cloud.subscription)return 'Four free rooms, three cloud mixes, and a week of session history. No card needed.';const sub=cloud.subscription;if(cloud.plus)return (sub.cancelAtPeriodEnd?'Your subscription ends on ':'Your next renewal is on ')+new Date(sub.periodEnd*1000).toLocaleDateString()+'.';return 'Subscription status: '+escapeHTML(sub.status)+'. Your free studio remains available. Use the billing portal to review payment details.'}
function roomName(slug){return TEASERS.find(row=>row[0]===slug)?.[1]||MOODS[slug]?.name||slug}
function Library(){
 Saved();app.querySelector('footer')?.remove();const section=document.createElement('section');section.className='section';section.innerHTML='<div class="section-head"><h2 class="display">Your custom <em>mixes</em></h2><p class="section-note">'+(cloud.plus?'200 cloud mix spaces':'Three free cloud mix spaces')+'</p></div><div id="cloudmixes">'+(cloudLoading?'<p class="bodycopy">Loading your studio…</p>':cloudError?'<p class="bodycopy">Cloud library is unavailable. Your device favourites are above.</p>':cloud.user?'<p class="bodycopy">Opening your cloud library…</p>':'<p class="lead">Save the exact balance of a room’s sounds, then open it on any device.</p>'+loginLink())+'</div>';app.append(section);app.insertAdjacentHTML('beforeend',FOOT);
 if(!cloud.user)return;const holder=$('#cloudmixes');requestAPI('mixes').then(data=>{if(!holder.isConnected)return;if(!data.mixes.length){holder.innerHTML='<p class="lead">No custom mixes yet. Shape a room’s sound, then choose Save custom mix.</p><a class="btn ghost" href="#/studio/deep-focus">Create your first mix</a>';return}
 holder.innerHTML='<div class="saved-grid">'+data.mixes.map(mix=>'<article class="saved-card"><span class="eyebrow">'+escapeHTML(roomName(mix.mood))+'</span><h3>'+escapeHTML(mix.name)+'</h3><span class="statusline">'+new Date(mix.created_at).toLocaleDateString()+'</span><button class="act" data-load="'+escapeHTML(mix.id)+'">'+(mix.locked?'Requires Plus':'Open mix')+'</button><button class="rm" data-delete="'+escapeHTML(mix.id)+'">Delete mix</button></article>').join('')+'</div>';
 holder.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{const mix=data.mixes.find(m=>m.id===b.dataset.load);if(mix.locked){location.hash='/pricing';return}store.set('vol',mix.settings.volume);store.set('layers:'+mix.mood,mix.settings.layers);if(location.hash==='#/studio/'+mix.mood)route();else location.hash='/studio/'+mix.mood;toast('Mix loaded. Press Play when you’re ready.')});
 holder.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>showDialog('Delete this mix?','This removes the mix from your cloud library.','',async()=>{await requestAPI('mixes/'+b.dataset.delete,'DELETE',{});Library();toast('Mix deleted.')}));
 }).catch(error=>{if(holder.isConnected)holder.innerHTML='<p class="bodycopy">'+escapeHTML(error.message)+'</p>'});
}
function Info(type){
 const content={
 help:['A little guidance.','<h2>Start in three steps</h2><p>Open a room, press Play, and adjust the three sound layers. Your volume and layer preferences stay on this device. Use headphones at a comfortable volume.</p><h2>Make a focus session</h2><p>Choose a timer to start listening immediately. The sound fades out when time is up. Pausing ends the current timer; you can choose a fresh one when you return. Press Space in a room to play or pause.</p><h2>Save and return</h2><p>Save a room as a device favourite with the heart button. Sign in and use Save custom mix to store the exact sound balance in your cloud library.</p><h2>Audio or cloud trouble?</h2><p>Sound needs a tap or click to start. If you cannot hear anything, check your device volume and layer switches. Mobile devices may suspend background sound. If a cloud request fails, try again later; the free rooms still work.</p><h2>Billing</h2><p>When Plus is available, checkout confirms the billing interval and amount. Account → Manage billing opens the secure portal for payment updates and cancellation. Access is granted after the provider verifies your subscription.</p>'],
 privacy:['Your quiet. Your privacy.','<p>Effective 8 October 2026. This page describes the current AFTERGLOW service.</p><h2>What we store</h2><p>When you sign in, we store your site-specific account ID and email address, custom mixes, listening duration and room names, and subscription references. We do not record microphone audio. We do not store card numbers.</p><h2>Device preferences</h2><p>Your volume, layer preferences, last room and saved room favourites use your browser’s local storage. Clearing site data removes these device preferences.</p><h2>Services involved</h2><p>ChatGPT provides sign-in and site access. Hosting and cloud data run on the platform’s Cloudflare infrastructure. Google Fonts receives font requests including network information such as your IP address. Artist links open YouTube only when you choose them. Payments are disabled. Linkwa is the intended payment provider; its integration and final membership terms must be verified before checkout opens.</p><h2>Purpose and retention</h2><p>We use account records to run your studio and enforce your subscription. Records remain until you delete your studio data; history views show seven days for Free and one year for Plus. A limited billing event ledger and payment provider records may remain for reconciliation and financial obligations.</p><h2>Your choices</h2><p>Use Account → Export data to download your studio records. Use Delete account data to remove mixes, sessions and your AFTERGLOW account record. Active subscriptions must end first. Deletion does not delete your ChatGPT account or the payment provider’s records.</p><h2>Analytics</h2><p>Optional first-party usage measurement is off by default. If enabled, we count visits, returns, play starts, preset choices, listening seconds and saved mixes. Aggregate counts contain no email address or account ID, remain for up to 90 days, and are visible only to the configured site owner. Temporary random event IDs prevent duplicate delivery. No advertising trackers or third-party analytics scripts are used. Hosting providers may retain operational and security logs.</p>'],
 terms:['The studio, clearly.','<p>Effective 8 October 2026. By using AFTERGLOW, you agree to these service terms.</p><h2>The service</h2><p>AFTERGLOW generates original ambient sound in your browser for personal listening, focus and relaxation. It is not a medical service and makes no promises about health or productivity. Artist suggestions are external links; their music is not included in a subscription.</p><h2>Free and Plus</h2><p>Free includes four rooms, unlimited listening, three cloud mixes and seven days of visible history. Plus includes eight rooms, up to 200 cloud mixes and a year of visible history. Timers and local favourites are available on both plans.</p><h2>Subscription charges</h2><p>Subscriptions are not currently on sale. When enabled, Plus costs USD 3 monthly or USD 24 yearly, billed in advance. Any applicable tax is displayed before payment. The provider must confirm payment before paid access begins.</p><h2>Renewal and cancellation</h2><p>Paid subscriptions are not available yet. Linkwa does not currently support recurring payments. Any future Linkwa membership would need explicit renewal payments, with its duration and total shown before checkout. No automatic renewal is promised. Free rooms remain available.</p><h2>Refunds and your rights</h2><p>Charges, disputes and refund requests are reviewed through the merchant’s support channel. Statutory consumer rights apply. The service does not automatically issue refunds.</p><h2>Responsible use</h2><p>Keep your account secure. Do not attempt to access another person’s library, bypass subscription controls, overload the service, or redistribute the service as your own product.</p><h2>Availability</h2><p>Browser restrictions, network interruptions and maintenance can affect sound and cloud features. We provide the service as available, subject to rights that applicable law does not allow us to exclude.</p><h2>Before paid launch</h2><p>The operating merchant’s legal identity, support contact and applicable billing policies will be supplied before paid subscriptions are enabled.</p>']
 };
 setActiveNav('');const [title,body]=content[type];app.innerHTML='<section class="page info-content"><span class="eyebrow">AFTERGLOW / '+type+'</span><h1>'+title+'</h1>'+body+(type==='privacy'?analyticsChoice():'')+'<a class="btn ghost" href="#/">Return to the studio</a></section>'+FOOT;wireAnalyticsChoice();
}

/* Motion edition: room postcards with restrained, input-driven depth. */
function heroGallery(last){
 const front=FREE_ROOMS.includes(last)?last:'midnight-drive';
 const others=[...new Set(['golden-hour','rainy-window',...FREE_ROOMS])].filter(slug=>slug!==front);
 const picks=[others[0],others[1],front,others[2]];
 return '<div class="hero-gallery" aria-label="Preview atmosphere rooms"><div class="gallery-orbit" aria-hidden="true"></div><div class="gallery-stack">'+picks.map((slug,i)=>{const m=MOODS[slug];return '<a class="gallery-card gallery-card-'+i+'" data-room="'+slug+'" href="#/studio/'+slug+'" aria-label="Open '+m.name+'" tabindex="'+(i===2?'0':'-1')+'"'+(i===3?' aria-hidden="true"':'')+'><div class="postcard-art '+m.art+'" aria-hidden="true"><span class="postcard-light"></span><span class="postcard-frame"></span></div><div class="postcard-bottom"><span><small>AFTERGLOW / '+m.n+'</small><strong>'+m.name+'</strong></span><span class="postcard-arrow" aria-hidden="true">↗</span></div></a>'}).join('')+'</div><div class="gallery-caption"><button class="gallery-step" data-direction="-1" aria-label="Previous atmosphere">←</button><span class="gallery-instruction">Swipe to explore. Tap to enter.</span><button class="gallery-step" data-direction="1" aria-label="Next atmosphere">→</button><span class="gallery-status sr-only" aria-live="polite">'+MOODS[picks[2]].name+'</span></div></div>';
}
// Horizontal intent preserves page scrolling; cycling always retains every room.
function galleryIntent(dx,dy){return Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.25}
function galleryOrder(cards,direction){return direction>0?[cards[1],cards[2],cards[3],cards[0]]:[cards[3],cards[0],cards[1],cards[2]]}
let galleryCleanup=()=>{};
function wireGallery(){
 galleryCleanup();
 const gallery=document.querySelector('.hero-gallery');if(!gallery)return;
 const stack=gallery.querySelector('.gallery-stack'),abort=new AbortController();
 let cards=[...stack.querySelectorAll('.gallery-card')],gesture=null,suppress=false,suppressTimer;
 const listen=(el,type,fn,extra={})=>el.addEventListener(type,fn,{signal:abort.signal,...extra});
 const settle=()=>{for(const card of cards){card.classList.remove('dragging');card.style.removeProperty('--drag-x');card.style.removeProperty('--drag-turn')}gesture=null};
 const move=direction=>{
  gallery.classList.add('gallery-touched');settle();cards=galleryOrder(cards,direction);
  cards.forEach((card,i)=>{card.className='gallery-card gallery-card-'+i;card.tabIndex=i===2?0:-1;card.setAttribute('aria-hidden',String(i===3))});
  gallery.querySelector('.gallery-status').textContent=MOODS[cards[2].dataset.room].name;
 };
 listen(gallery,'pointerdown',e=>{
  if(!e.isPrimary||e.button!==0||!e.target.closest('.gallery-card-2'))return;
  gallery.classList.add('gallery-touched');gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,locked:false,vertical:false,card:cards[2]};
 });
 listen(gallery,'pointermove',e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(!gesture.locked&&!gesture.vertical){
   if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx))gesture.vertical=true;
   else if(galleryIntent(dx,dy)){gesture.locked=true;gesture.card.classList.add('dragging');gesture.card.setPointerCapture(e.pointerId)}
  }
  if(!gesture.locked)return;e.preventDefault();gesture.dx=dx;
  gesture.card.style.setProperty('--drag-x',dx+'px');gesture.card.style.setProperty('--drag-turn',Math.max(-8,Math.min(8,dx/25))+'deg');
 },{passive:false});
 const finish=(e,cancelled)=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const current=gesture;
  if(current.locked){suppress=true;clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>suppress=false,400)}
  const change=!cancelled&&current.locked&&Math.abs(current.dx)>Math.max(35,current.card.offsetWidth*.16);
  if(current.card.hasPointerCapture(e.pointerId))current.card.releasePointerCapture(e.pointerId);
  settle();if(change)move(current.dx<0?1:-1);
 };
 listen(gallery,'pointerup',e=>finish(e,false));listen(gallery,'pointercancel',e=>finish(e,true));
 listen(gallery,'click',e=>{if(suppress&&e.target.closest('.gallery-card')){e.preventDefault();e.stopPropagation();suppress=false}},{capture:true});
 gallery.querySelectorAll('.gallery-step').forEach(button=>listen(button,'click',()=>move(Number(button.dataset.direction))));
 listen(gallery,'keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);cards[2].focus({preventScroll:true})}});
 galleryCleanup=()=>{abort.abort();clearTimeout(suppressTimer);settle()};
}
addEventListener('hashchange',()=>galleryCleanup());
let motionFrame=0,lastTilt=null;
const motionAllowed=()=>matchMedia('(hover: hover) and (pointer: fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
function resetTilt(card){if(!card)return;card.style.removeProperty('--tilt-x');card.style.removeProperty('--tilt-y');card.style.removeProperty('--glow-x');card.style.removeProperty('--glow-y');}
document.addEventListener('pointermove',event=>{
 if(!motionAllowed())return;
 const card=event.target.closest('.tilt-card');if(lastTilt&&lastTilt!==card)resetTilt(lastTilt);lastTilt=card;
 if(!card)return;cancelAnimationFrame(motionFrame);
 const x=event.clientX,y=event.clientY;
 motionFrame=requestAnimationFrame(()=>{if(!card.isConnected)return;const r=card.getBoundingClientRect();const px=Math.max(0,Math.min(1,(x-r.left)/r.width)),py=Math.max(0,Math.min(1,(y-r.top)/r.height));card.style.setProperty('--tilt-x',((.5-py)*7).toFixed(2)+'deg');card.style.setProperty('--tilt-y',((px-.5)*7).toFixed(2)+'deg');card.style.setProperty('--glow-x',(px*100).toFixed(1)+'%');card.style.setProperty('--glow-y',(py*100).toFixed(1)+'%');});
},{passive:true});
document.addEventListener('pointerout',event=>{const card=event.target.closest('.tilt-card');if(card&&!card.contains(event.relatedTarget)){cancelAnimationFrame(motionFrame);resetTilt(card);if(lastTilt===card)lastTilt=null}},{passive:true});
addEventListener('hashchange',()=>{cancelAnimationFrame(motionFrame);resetTilt(lastTilt);lastTilt=null});

/* Ready-made rituals stay free and start inside the original user gesture. */
const QUICK_STARTS={
 study:{name:'Study for 25 minutes',mood:'deep-focus',minutes:25,volume:.65,layers:{brown:{on:true,vol:.5},hum:{on:true,vol:.2},restraint:{on:false,vol:.15}},note:'Brown noise. Fewer distractions. A clear finish.'},
 unwind:{name:'Wind down',mood:'golden-hour',minutes:15,volume:.55,layers:{wind:{on:true,vol:.4},harm:{on:true,vol:.25},atmos:{on:true,vol:.18}},note:'Warm light and softer sound for the end of the day.'},
 rain:{name:'Rain without music',mood:'rainy-window',minutes:0,volume:.65,layers:{rain:{on:true,vol:.65},drone:{on:false,vol:.42},atmos:{on:false,vol:.3}},note:'Just the rain. No timer. Stay as long as you like.'}
};
function analyticsChoice(){return '<div class="usage-choice"><label><input type="checkbox" id="usage-consent" '+(store.get('usageConsent',false)?'checked':'')+'> Help improve AFTERGLOW with anonymous usage counts</label><p>No advertising trackers. Optional and off by default. <a href="#/privacy">Privacy details</a></p></div>'}
function wireAnalyticsChoice(){const input=$('#usage-consent');if(input)input.onchange=()=>{store.set('usageConsent',input.checked);if(input.checked)trackVisit();toast(input.checked?'Optional usage counts enabled.':'Optional usage counts disabled.')}}
function quickStartSection(){return '<section class="section quick-start"><div class="section-head"><h2 class="display">A little less choosing.<br><em>A little more quiet.</em></h2><p class="section-note">Three free rituals. One tap to begin.</p></div><div class="ritual-grid">'+Object.entries(QUICK_STARTS).map(([key,p],i)=>'<button class="ritual-card" data-preset="'+key+'"><span class="eyebrow">0'+(i+1)+' / '+(p.minutes?p.minutes+' minutes':'Unhurried')+'</span><strong>'+p.name+'</strong><span>'+p.note+'</span><span class="ritual-start">Start listening ↗</span></button>').join('')+'</div><div class="home-mixes" id="home-mixes"></div>'+analyticsChoice()+'</section>'}
function startListening(mood,preset){
 if(!MOODS[mood])return;
 if(AE.playing)AE.pause(true);
 if(preset){store.set('vol',preset.volume);store.set('layers:'+mood,structuredClone(preset.layers));trackEvent('preset',mood,0,Object.keys(QUICK_STARTS).find(k=>QUICK_STARTS[k]===preset)||'')}
 history.pushState(null,'','#/studio/'+mood);route();$('#playbtn')?.click();
 if(preset?.minutes&&AE.playing)app.querySelector('[data-min="'+preset.minutes+'"]')?.click();
}
function wireQuickStarts(){app.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=QUICK_STARTS[b.dataset.preset];startListening(p.mood,p)});app.querySelectorAll('[data-listen-room]').forEach(b=>b.onclick=()=>startListening(b.dataset.listenRoom))}
function openCloudMix(mix){if(mix.locked){location.hash='/pricing';return}store.set('vol',mix.settings.volume);store.set('layers:'+mix.mood,mix.settings.layers);startListening(mix.mood)}
async function updateHomeMixes(){
 const holder=$('#home-mixes');if(!holder||cloudLoading)return;
 if(!cloud.user){holder.innerHTML='<div class="return-note"><p>Found your favourite balance?</p><a href="#/account">Sign in to keep three custom mixes →</a></div>';return}
 try{const data=await requestAPI('mixes');if(!holder.isConnected)return;
 holder.innerHTML='<div class="return-heading"><h3>Your familiar <em>feelings.</em></h3><a href="#/saved">Open library →</a></div>'+(data.mixes.length?'<div class="home-mix-grid">'+data.mixes.slice(0,3).map(m=>'<button class="home-mix" data-home-mix="'+escapeHTML(m.id)+'"><small>'+escapeHTML(roomName(m.mood))+'</small><strong>'+escapeHTML(m.name)+'</strong><span>'+(m.locked?'Requires Plus':'Listen again ↗')+'</span></button>').join('')+'</div>':'<p class="bodycopy">Your saved mixes will appear here. Shape a room, then choose Save custom mix.</p>');
 holder.querySelectorAll('[data-home-mix]').forEach(b=>b.onclick=()=>openCloudMix(data.mixes.find(m=>m.id===b.dataset.homeMix)));
 }catch{if(holder.isConnected)holder.innerHTML='<p class="bodycopy">Your cloud mixes could not load. <a href="#/saved">Try your library again →</a></p>'}
}
function trackEvent(event,mood='',seconds=0,preset=''){
 if(!store.get('usageConsent',false)||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
 fetch('/api/events',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),event,mood,seconds,preset}),keepalive:true}).catch(()=>{});
}
function trackVisit(){
 const day=new Date().toISOString().slice(0,10);if(store.get('usageVisitDay','')===day)return;
 const previous=store.get('usageVisitDay','');trackEvent('visit');if(previous)trackEvent('return');if(store.get('usageConsent',false)&&!navigator.globalPrivacyControl&&navigator.doNotTrack!=='1')store.set('usageVisitDay',day);
}
trackVisit();
async function Insights(){
 setActiveNav('account');app.innerHTML='<section class="page"><span class="eyebrow">Owner insights</span><h1>See what brings<br>people <em>back.</em></h1><p class="lead">Optional usage counts · last 30 days. These signals exclude people who opt out and are not audited billing figures.</p><div id="insight-data" role="status">Loading usage counts…</div><a class="btn ghost" href="#/account">Back to account</a></section>'+FOOT;
 const holder=$('#insight-data');try{const data=await requestAPI('insights');if(!holder.isConnected)return;const totals=data.rows.reduce((a,r)=>(a[r.event]=(a[r.event]||0)+r.count,a.seconds+=r.seconds,a),{seconds:0});
 holder.innerHTML='<div class="insight-grid">'+[['visit','Visit days'],['return','Return days'],['play','Listening starts'],['mix_saved','Mixes saved']].map(([k,label])=>'<article><strong>'+Number(totals[k]||0)+'</strong><span>'+label+'</span></article>').join('')+'<article><strong>'+Math.round(totals.seconds/60)+'</strong><span>Listening minutes</span></article></div><h2>What people choose</h2><div class="insight-table"><table><thead><tr><th>Signal</th><th>Room / preset</th><th>Count</th></tr></thead><tbody>'+data.rows.filter(r=>r.event==='preset'||r.event==='play').map(r=>'<tr><td>'+escapeHTML(r.event)+'</td><td>'+escapeHTML(r.preset?QUICK_STARTS[r.preset]?.name:roomName(r.mood))+'</td><td>'+Number(r.count)+'</td></tr>').join('')+'</tbody></table></div>'+(data.rows.length?'':'<p>No usage counts yet. Measurement is optional and disabled by default.</p>');
 }catch(error){if(holder.isConnected)holder.textContent=error.message}
}
