import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/product.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function galleryIntent'),source.indexOf('let galleryCleanup'));
const context=vm.createContext({});vm.runInContext(helpers,context);
test('swipe intent accepts both directions without hijacking scrolling or taps',()=>{
 for(const [dx,dy,expected] of [[0,0,false],[8,0,false],[20,35,false],[20,20,false],[50,4,true],[-50,4,true]])assert.equal(context.galleryIntent(dx,dy),expected);
});
test('four-room deck wraps reversibly and retains every room',()=>{
 const original=['golden','rain','midnight','focus'];let cards=original;
 for(let i=0;i<4;i++){cards=Array.from(context.galleryOrder(cards,1));assert.deepEqual([...cards].sort(),[...original].sort())}
 assert.deepEqual(cards,original);
 assert.deepEqual(Array.from(context.galleryOrder(context.galleryOrder(original,1),-1)),original);
});
function harness(){
 const listeners=new Map(),status={textContent:''};
 const cards=['golden','rain','midnight','focus'].map(room=>({dataset:{room},style:{setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}},classList:{add(){},remove(){}},offsetWidth:250,capture:false,setPointerCapture(){this.capture=true},hasPointerCapture(){return this.capture},releasePointerCapture(){this.capture=false},setAttribute(){},focus(){}}));
 const gallery={classList:{add(){}},querySelector(s){return s==='.gallery-stack'?{querySelectorAll:()=>cards}:status},querySelectorAll(){return []},addEventListener(type,fn){listeners.set(type,fn)}};
 const ctx=vm.createContext({document:{querySelector:()=>gallery},AbortController,setTimeout,clearTimeout,addEventListener(){},MOODS:Object.fromEntries(cards.map(c=>[c.dataset.room,{name:c.dataset.room}]))});
 vm.runInContext(source.slice(source.indexOf('function galleryIntent'),source.indexOf('let motionFrame')),ctx);ctx.wireGallery();
 const fire=(type,x,y,extra={})=>listeners.get(type)({pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,target:{closest:()=>cards[2]},preventDefault(){this.prevented=true},stopPropagation(){},...extra});
 return {ctx,cards,status,fire};
}
test('horizontal swipe changes rooms and consumes the following link click',()=>{
 const h=harness();h.fire('pointerdown',120,120);h.fire('pointermove',50,125);h.fire('pointerup',50,125);
 assert.equal(h.status.textContent,'focus');let prevented=false;h.fire('click',0,0,{preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(h.cards[2].capture,false);vm.runInContext('galleryCleanup()',h.ctx);
});
test('vertical scrolling and ordinary taps never change rooms or block links',()=>{
 const h=harness();h.fire('pointerdown',120,120);h.fire('pointermove',125,190);h.fire('pointerup',125,190);let prevented=false;h.fire('click',0,0,{preventDefault(){prevented=true}});assert.equal(prevented,false);assert.equal(h.status.textContent,'');assert.equal(h.cards[2].capture,false);vm.runInContext('galleryCleanup()',h.ctx);
});
test('canceled drag snaps back without changing the atmosphere',()=>{
 const h=harness();h.fire('pointerdown',120,120);h.fire('pointermove',200,125);h.fire('pointercancel',200,125);assert.equal(h.status.textContent,'');assert.equal(h.cards[2].style['--drag-x'],undefined);assert.equal(h.cards[2].capture,false);vm.runInContext('galleryCleanup()',h.ctx);
});
