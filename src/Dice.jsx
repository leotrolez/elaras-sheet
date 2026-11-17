import React, {useState} from 'react';
import {ATTRIBUTES, DICE, SKILLS} from './rules.js';
import {defaultDice, traitCommand, damageCommand} from './dice.js';

function Command({title, roll}) {
  const [message,setMessage]=useState('');
  const expression=roll.expression.replace(/\([^)]*\)\s*/g, '').trim();
  async function copy(text) {
    try {await navigator.clipboard.writeText(text);setMessage('Copiado!');}
    catch {setMessage('Selecione o texto abaixo e copie com Ctrl+C.');}
  }
  return <article className="item-card dice-command"><h3>{title}</h3><label className="field"><span>Expressão para o campo dice</span><textarea readOnly rows={3} value={expression} onFocus={e=>e.target.select()} /></label><div className="catalog-actions"><button className="primary" onClick={()=>copy(expression)}>Copiar expressão</button></div><small role="status">{message}</small></article>;
}

export default function Dice({character:c,onChange}) {
  const [mode,setMode]=useState('attack');
  const [attack,setAttack]=useState('Atirar');
  const [skill,setSkill]=useState('Perceber');
  const [attribute,setAttribute]=useState('Agilidade');
  const [wild,setWild]=useState(true);
  const [modifier,setModifier]=useState(0);
  const [damageMod,setDamageMod]=useState(0);
  const [raise,setRaise]=useState(false);
  const [climb,setClimb]=useState(false);
  const config=c.dice || defaultDice();
  const update=(key,value)=>onChange({...config,[key]:value});
  const number=e=>Math.max(-100,Math.min(100,Math.trunc(Number(e.target.value)||0)));
  const name=mode==='attack'?attack:mode==='attribute'?attribute:skill;
  const roll=traitCommand(c,name,{attribute:mode==='attribute',wild,modifier,climb});
  const damage=damageCommand(c,attack,{raise,modifier:damageMod});
  return <section className="dice-panel">
    <p className="intro">O mestre pede o teste, você copia o comando da sua ficha.</p>
    <div className="callout"><b>Como usar no Discord</b><p>No Discord: digite /roll, selecione o comando do bot Dice Maiden na lista e cole a expressão no campo dice. Não cole /roll nesse campo e não envie o comando como mensagem comum. Se houver outros bots com /roll, confira o nome do bot na sugestão.</p></div>
    <div className="form-grid">
      <label className="field"><span>O que o mestre pediu?</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="attack">Ataque</option><option value="skill">Perícia / conjuração</option><option value="attribute">Atributo</option></select></label>
      <label className="field"><span>{mode==='attack'?'Tipo de ataque':mode==='skill'?'Perícia':'Atributo'}</span>{mode==='attack'?<select value={attack} onChange={e=>setAttack(e.target.value)}><option>Atirar</option><option>Lutar</option><option>Arremessar</option></select>:mode==='skill'?<select value={skill} onChange={e=>setSkill(e.target.value)}>{SKILLS.map(([s])=><option key={s}>{s}</option>)}</select>:<select value={attribute} onChange={e=>setAttribute(e.target.value)}>{ATTRIBUTES.map(a=><option key={a}>{a}</option>)}</select>}</label>
      <label className="field"><span>Modificador do teste</span><input type="number" min={-100} max={100} value={modifier} onChange={e=>setModifier(number(e))}/><small>Some aqui bônus de vantagens e penalidades de alcance, cobertura, ferimentos, ações múltiplas e efeitos temporários.</small></label>
      <label className="check"><input type="checkbox" checked={wild} onChange={e=>setWild(e.target.checked)}/>Usar Dado Selvagem d6</label>
    </div>
    {name==='Escalar' && c.raceId==='Rakashano' && <label className="check"><input type="checkbox" checked={climb} onChange={e=>setClimb(e.target.checked)}/>Aplicar +2 das garras em superfície apropriada</label>}
    <p className="muted">Base: d{roll.sides}{wild?' e Selvagem d6, fica com o maior':''}; modificador total: {roll.bonus}. {roll.untrained?'Perícia não comprada: d4−2. ':''}Perceber inclui o +2 racial dos sáurios quando aplicável. Outros efeitos situacionais devem ser informados.</p>
    <Command title={mode==='attack'?`Acertar — ${name}`:`Teste — ${name}`} roll={roll}/>
    {mode==='attack' && <>
      <p className="muted">{attack==='Lutar'?'Compare o resultado com o Aparar do alvo.':'Pela mesa, o resultado precisa superar a Movimentação do alvo.'} O comando não conhece a defesa do inimigo nem decide se acertou.</p>
      <h3>Dano da arma</h3><p className="muted">Configure conforme o equipamento aprovado pelo mestre. Dados da arma e bônus ficam salvos na ficha e no PDF. Não extraímos dados automaticamente da bagagem em texto.</p>
      <div className="form-grid">
        <label className="field"><span>Nome da arma</span><input value={config.weaponName} maxLength={100} onChange={e=>update('weaponName',e.target.value)}/></label>
        <label className="field"><span>Dado de dano da arma</span><select value={config.weaponDie} onChange={e=>update('weaponDie',Number(e.target.value))}><option value={0}>Selecione conforme a arma</option>{DICE.map(d=><option key={d} value={d}>d{d}</option>)}</select></label>
        <label className="field"><span>Quantidade de dados da arma</span><select value={config.weaponCount} onChange={e=>update('weaponCount',Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option></select></label>
        <label className="field"><span>Bônus fixo da arma</span><input type="number" min={-100} max={100} value={config.damageBonus} onChange={e=>update('damageBonus',number(e))}/></label>
        <label className="field"><span>Modificador temporário do dano</span><input type="number" min={-100} max={100} value={damageMod} onChange={e=>setDamageMod(number(e))}/></label>
        <label className="check"><input type="checkbox" checked={raise} onChange={e=>setRaise(e.target.checked)}/>Adicionar d6 de ampliação (se usado pela mesa)</label>
      </div>
      {damage?<><Command title={`Dano — ${damage.attribute} + arma`} roll={damage}/><p className="muted">O bot mostra cada dado separadamente: some os totais. Todos explodem; dano não usa Dado Selvagem. Role o dano só depois de acertar. Para Atirar usamos Agilidade; para Lutar e Arremessar, Força.</p></>:<p>Escolha o dado da arma para gerar o dano.</p>}
    </>}
    <p className="muted">Conjuração usa o teste da perícia escolhida. Dano e efeitos de feitiços dependem do poder. Explosões e falhas críticas seguem Savage Worlds; vantagens e condições especiais devem ser revisadas com o mestre.</p>
    <a href="https://github.com/Humblemonk/dicemaiden-rs/blob/main/roll_syntax.md" target="_blank" rel="noreferrer">Consultar sintaxe oficial</a>
  </section>;
}
