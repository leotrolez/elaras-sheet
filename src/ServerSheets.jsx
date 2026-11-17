import React,{useEffect,useState} from 'react';

export async function api(path,options={}) {
  const response=await fetch(`/api/characters${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  let data;try{data=await response.json();}catch{throw new Error('Servidor de fichas indisponível. Esta função precisa do backend instalado.');}
  if(!response.ok)throw new Error(data.error||'Erro ao acessar o servidor.');
  return data;
}

export default function ServerSheets({sheet,onSaved,onOpen,masterKey,onMasterKey}) {
  const [list,setList]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(false);
  const [key,setKey]=useState(''),[login,setLogin]=useState(false);
  const remote=sheet.remote;
  const dirty=remote && JSON.stringify(sheet.character)!==remote.base;
  async function refresh(){try{setList(await api(''));setMessage('');}catch(e){setMessage(e.message);}}
  useEffect(()=>{if(!expanded)return;refresh();const timer=setInterval(refresh,5000);return()=>clearInterval(timer);},[expanded]);
  async function save(){setBusy(true);try{
    const snapshot=sheet.character;
    const data=remote?await api(`/${remote.id}`,{method:'PUT',headers:{'X-Elara-Edit-Token':remote.editToken||'','X-Elara-Master-Key':masterKey||''},body:JSON.stringify({revision:remote.revision,character:snapshot})}):await api('',{method:'POST',body:JSON.stringify({character:snapshot})});
    onSaved(sheet.id,data,remote?.editToken);setMessage('Ficha salva no servidor. Quem a abriu receberá a atualização.');
    if(expanded)await refresh();
  }catch(e){setMessage(e.message);}finally{setBusy(false);}}
  return <section className="server-sheets">
    <div className="sheet-tools"><button className="primary" disabled={busy || (remote && !remote.editToken && !masterKey)} onClick={save}>{busy?'Salvando…':'Salvar no servidor'}</button><button className="outline" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>Fichas do grupo</button>
      <button className="outline" onClick={()=>masterKey?onMasterKey(''):setLogin(v=>!v)}>{masterKey?'Sair do acesso mestre':'Entrar como mestre'}</button>
      {remote && <span className="muted">{masterKey?'Mestre (pode editar)':remote.editToken?'Editor':'Acompanhando'} · versão {remote.revision} · #{remote.id.slice(0,8)}{dirty?' · alterações locais pendentes':''}</span>}
    </div>
    {login && !masterKey && <form className="master-login" onSubmit={async e=>{e.preventDefault();try{await api('/master',{method:'POST',headers:{'X-Elara-Master-Key':key}});onMasterKey(key);setKey('');setLogin(false);setMessage('Acesso de mestre ativo: você pode salvar qualquer ficha do grupo.');}catch(err){setMessage(err.message);}}}><label className="field"><span>Chave do mestre</span><input type="password" autoComplete="off" required value={key} onChange={e=>setKey(e.target.value)} /></label><button className="primary">Ativar acesso</button><p className="muted">Use a chave privada configurada no servidor. A visão do mestre, sozinha, não concede edição.</p></form>}
    {remote && !remote.editToken && !masterKey && <p className="muted">Você está acompanhando esta ficha. Entre como mestre para publicar alterações, ou use o navegador que a criou. Alterações locais não são publicadas sem acesso.</p>}
    <p role="status" className="muted">{message}</p>
    {expanded && <div className="server-list">{list.map(row=><button className="outline" key={row.id} aria-pressed={remote?.id===row.id} onClick={async()=>{try{onOpen(await api(`/${row.id}`));}catch(e){setMessage(e.message);}}}>{row.name} · #{row.id.slice(0,8)} · v{row.revision} · {new Date(row.updatedAt).toLocaleString('pt-BR')}{remote?.id===row.id?' · Aberta':''}</button>)}{!list.length && <p className="muted">Nenhuma ficha disponível.</p>}</div>}
  </section>;
}
