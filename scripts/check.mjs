import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const worker=await readFile('dist/server/index.js','utf8');const match=worker.match(/const HTML = (.+);\n/);const html=JSON.parse(match[1]);
for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
if(!html.includes('function Pricing()')||!html.includes('function Library()'))throw Error('Missing product surfaces');
if(/__[A-Z_]+__/.test(worker))throw Error('Unresolved placeholder');
console.log('Embedded browser JavaScript syntax and product checks passed.');
