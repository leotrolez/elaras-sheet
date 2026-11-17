import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from './index.js';
import {newCharacter} from '../src/rules.js';

test('salva, persiste, acompanha e impede sobrescrita concorrente ou sem chave',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'elara-test-'));
  let app=createApp({directory,masterKey:'test-master-key'});
  async function start(){await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${app.address().port}/api/characters`;}
  let base=await start();
  const json=(method,data,token)=>({method,headers:{'Content-Type':'application/json',...(token?{'X-Elara-Edit-Token':token}:{})},body:JSON.stringify(data)});
  try{
    const character={...newCharacter(),name:'Elara'};
    const created=await fetch(base,json('POST',{character}));assert.equal(created.status,201);
    const row=await created.json();assert.ok(row.editToken);
    const list=await (await fetch(base)).json();assert.equal(list[0].name,'Elara');assert.equal(list[0].editToken,undefined);
    const publicRow=await (await fetch(`${base}/${row.id}`)).json();assert.equal(publicRow.editToken,undefined);
    assert.equal((await fetch(`${base}/${row.id}`,json('PUT',{revision:1,character}))).status,403);
    const update=await fetch(`${base}/${row.id}`,json('PUT',{revision:1,character:{...character,xp:10}},row.editToken));assert.equal(update.status,200);
    assert.equal((await fetch(`${base}/${row.id}`,json('PUT',{revision:1,character},row.editToken))).status,409);
    await new Promise(resolve=>app.close(resolve));
    app=createApp({directory,masterKey:'test-master-key'});base=await start();
    const persisted=await (await fetch(`${base}/${row.id}`)).json();assert.equal(persisted.character.xp,10);assert.equal(persisted.revision,2);
    assert.equal((await fetch(base,json('POST',{character:newCharacter()}))).status,400);
    assert.equal((await fetch(base,json('POST',{character}))).status,409);
    assert.equal((await fetch(base,json('POST',{character:{...character,name:'  ELARA  '}}))).status,409);
    assert.equal((await fetch(base+'/master',{method:'POST',headers:{'X-Elara-Master-Key':'wrong'}})).status,403);
    assert.equal((await fetch(base+'/master',{method:'POST',headers:{'X-Elara-Master-Key':'test-master-key'}})).status,200);
    const masterSave=await fetch(`${base}/${row.id}`,{...json('PUT',{revision:2,character:{...character,xp:20}}),headers:{'Content-Type':'application/json','X-Elara-Master-Key':'test-master-key'}});
    assert.equal(masterSave.status,200);
    const updated=await masterSave.json();assert.equal(updated.character.xp,20);assert.equal(updated.revision,3);
    assert.equal((await fetch(`${base}/${row.id}`,{...json('PUT',{revision:2,character}),headers:{'Content-Type':'application/json','X-Elara-Master-Key':'test-master-key'}})).status,409);
    assert.equal((await fetch(base,{headers:{Origin:'https://other.example'}})).status,403);
  }finally{await new Promise(resolve=>app.close(resolve));await rm(directory,{recursive:true,force:true});}
});
