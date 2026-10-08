import {readFile,mkdir,rm,writeFile,cp} from 'node:fs/promises';
const html=(await readFile('src/index.html','utf8')).replace('/* ---------- ROUTER ---------- */',(await readFile('src/product.js','utf8'))+'\n/* ---------- ROUTER ---------- */');
const source=(await readFile('worker/index.js','utf8')).replace("'__AFTERGLOW_HTML__'",JSON.stringify(html));
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',source);await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built AFTERGLOW Worker, embedded studio, and database migration.');
