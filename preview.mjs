import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {dirname,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'_site');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
const server=createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    let file=resolve(root,'.'+pathname);
    if(file!==root && !file.startsWith(root+sep)){response.writeHead(403);response.end();return;}
    let status=200;
    try{if(statSync(file).isDirectory())file=resolve(file,'index.html');statSync(file);}catch{file=resolve(root,'404.html');status=404;}
    const data=readFileSync(file);
    response.writeHead(status,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(request.method==='HEAD'?undefined:data);
  }catch{response.writeHead(400);response.end('Bad request');}
});
const port=Number(process.env.PORT || 4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
server.listen(port,'127.0.0.1',()=>console.log(`Blog preview: http://127.0.0.1:${port}`));
