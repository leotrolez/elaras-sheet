import React from 'react';

export default function SheetTabs({session,onSelect,onClose,onNew,master,onMaster}) {
  function move(event,index) {
    const n=session.sheets.length;
    const target=event.key==='ArrowRight'?(index+1)%n:event.key==='ArrowLeft'?(index+n-1)%n:event.key==='Home'?0:event.key==='End'?n-1:null;
    if (target!==null) {event.preventDefault();onSelect(session.sheets[target].id);event.currentTarget.parentElement.parentElement.querySelectorAll('[role="tab"]')[target]?.focus();}
  }
  return <section className="sheet-workspace" aria-label="Fichas abertas">
    <div className="sheet-tabs" role="tablist" aria-label="Personagens">{session.sheets.map((s,i)=><div className={`sheet-tab ${s.id===session.activeId?'active':''}`} key={s.id} role="presentation">
      <button role="tab" aria-selected={s.id===session.activeId} tabIndex={s.id===session.activeId?0:-1} onClick={()=>onSelect(s.id)} onKeyDown={e=>move(e,i)}>{s.character.name || `Ficha ${i+1}`}</button>
      <button className="close-sheet" aria-label={`Fechar ${s.character.name || `Ficha ${i+1}`}`} onClick={()=>onClose(s.id)}>×</button>
    </div>)}</div>
    <div className="sheet-tools"><button className="outline" onClick={onNew}>+ Nova ficha</button><button className={master?'primary':'outline'} aria-pressed={master} onClick={onMaster}>{master?'Voltar ao editor':'Visão do mestre'}</button></div>
  </section>;
}
