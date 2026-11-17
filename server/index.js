import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateCharacter} from '../src/rules.js';

const hash = value => createHash('sha256').update(value).digest('hex');
export function createApp({directory=resolve('data'),staticRoot=resolve('dist'),masterKey=process.env.ELARA_MASTER_KEY}={}) {
  const db=resolve(directory,'characters.json');
  let queue=Promise.resolve();
  async function masterSecret() {
    if(masterKey)return masterKey;
    await mkdir(directory,{recursive:true});
    const path=resolve(directory,'master-key');
    try{await writeFile(path,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
    return (await readFile(path,'utf8')).trim();
  }
  async function isMaster(req) {
    const key=req.headers['x-elara-master-key'];
    return typeof key==='string' && timingSafeEqual(Buffer.from(hash(key)),Buffer.from(hash(await masterSecret())));
  }
  async function records() {try{return JSON.parse(await readFile(db,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
  async function commit(data) {await mkdir(directory,{recursive:true});const temp=db+'.tmp';await writeFile(temp,JSON.stringify(data),{mode:0o600});await rename(temp,db);}
  function serial(fn) {const run=queue.then(fn);queue=run.catch(()=>{});return run;}
  const publicRecord = row => ({id:row.id,revision:row.revision,updatedAt:row.updatedAt,character:row.character});
  const error=(status,message)=>Object.assign(new Error(message),{status});
  async function body(req) {let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024*1024)throw error(413,'Ficha muito grande.');}try{return JSON.parse(raw);}catch{throw error(400,'Dados inválidos.');}}
  const server=http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {
        if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)throw error(403,'Origem não permitida.');
        await masterSecret();
        if(req.method==='POST' && url.pathname==='/api/characters/master') {
          if(!await isMaster(req))throw error(403,'Chave do mestre incorreta.');
          return send(200,{master:true});
        }
        if(req.method==='GET' && url.pathname==='/api/characters') {
          const data=await records();return send(200,Object.values(data).map(r=>({id:r.id,name:r.character.name,revision:r.revision,updatedAt:r.updatedAt})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));
        }
        const match=url.pathname.match(/^\/api\/characters\/([a-f0-9-]{36})$/);
        if(req.method==='GET' && match) {const row=(await records())[match[1]];if(!row)throw error(404,'Ficha não encontrada.');return send(200,publicRecord(row));}
        if(req.method==='POST' && url.pathname==='/api/characters') {
          if(!req.headers['content-type']?.startsWith('application/json'))throw error(415,'Envie JSON.');
          const raw=await body(req);let character;try{character=validateCharacter(raw.character);}catch{throw error(400,'Ficha inválida.');}
          if(!character.name.trim())throw error(400,'Preencha o nome do personagem antes de salvar.');
          const editToken=randomBytes(32).toString('hex');
          const row={id:randomUUID(),character,revision:1,updatedAt:new Date().toISOString(),tokenHash:hash(editToken)};
          await serial(async()=>{const data=await records();
            const name=character.name.trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
            if(Object.values(data).some(r=>r.character.name.trim().normalize('NFKC').toLocaleLowerCase('pt-BR')===name))throw error(409,'Já existe uma ficha com este nome. Abra-a em Fichas do grupo para atualizar; use a chave do mestre se não tiver a chave de edição. Para outro personagem, use um nome diferente.');
            data[row.id]=row;await commit(data);});
          return send(201,{...publicRecord(row),editToken});
        }
        if(req.method==='PUT' && match) {
          const raw=await body(req);
          const result=await serial(async()=>{
            const data=await records(),row=data[match[1]];
            if(!row)throw error(404,'Ficha não encontrada.');
            const token=req.headers['x-elara-edit-token']||(req.headers.authorization||'').replace(/^Bearer /,'');
            if(!timingSafeEqual(Buffer.from(hash(token)),Buffer.from(row.tokenHash)) && !await isMaster(req))throw error(403,'Este navegador não tem a chave de edição desta ficha. Use o acesso do mestre para editar fichas do grupo.');
            if(raw.revision!==row.revision)throw error(409,'Existe uma versão mais recente. Abra a ficha do servidor para comparar antes de salvar.');
            try{row.character=validateCharacter(raw.character);}catch{throw error(400,'Ficha inválida.');}
            if(!row.character.name.trim())throw error(400,'O nome do personagem é obrigatório.');
            row.revision++;row.updatedAt=new Date().toISOString();await commit(data);return publicRecord(row);
          });
          return send(200,result);
        }
        throw error(404,'Operação não encontrada.');
      }
      if(!['GET','HEAD'].includes(req.method))throw error(405,'Método não permitido.');
      const relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),path=resolve(staticRoot,relative || 'index.html');
      if(path!==staticRoot && !path.startsWith(staticRoot+sep))throw error(403,'Caminho inválido.');
      let bytes;try{bytes=await readFile(path);}catch{throw error(404,'Arquivo não encontrado.');}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp'};
      res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
    } catch(e) {send(e.status||500,e.status?{error:e.message}:{error:'Não foi possível acessar as fichas.'});}
  });
  return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||8788),host=process.env.HOST||'127.0.0.1';
  createApp({directory:process.env.DATA_DIR||resolve('data')}).listen(port,host,()=>console.log(`Fichas: http://${host}:${port}`));
}
