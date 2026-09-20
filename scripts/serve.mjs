import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),port=Number(process.argv[process.argv.indexOf('--port')+1])||Number(process.env.PORT)||3000;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(p===root)p=path.join(root,'index.html');fs.readFile(p,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});}).listen(port,'0.0.0.0',()=>console.log(`GYM CLUB: http://localhost:${port}`));
