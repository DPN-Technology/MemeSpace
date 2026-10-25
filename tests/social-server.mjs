import http from 'node:http';
import next from 'next';
import {openDatabase} from '../lib/local-database.mjs';

process.env.MEMESPACE_LOCAL_MODE='1';
process.env.NODE_ENV=process.env.MEMESPACE_TEST_MODE==='serve'?'production':'development';
const db=openDatabase();db.close();
const app=next({dev:process.env.NODE_ENV==='development',webpack:true,dir:process.env.MEMESPACE_TEST_PROJECT||process.cwd(),hostname:'127.0.0.1',port:Number(process.env.MEMESPACE_PORT)});
await app.prepare();
const server=http.createServer(app.getRequestHandler());
server.listen(Number(process.env.MEMESPACE_PORT),'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.closeAllConnections();server.close();void app.close().finally(()=>process.exit(0))});
