import { DICE } from './rules.js';
import { racialEffects } from './templates.js';

export const defaultDice = () => ({weaponName:'', weaponDie:0, weaponCount:1, damageBonus:0});
const signed = n => n ? ` ${n < 0 ? '-' : '+'} ${Math.abs(n)}` : '';
export const safeLabel = text => String(text || '').replace(/[\r\n;!()]/g, ' ').replace(/\s+/g,' ').trim().slice(0,100);

export function traitCommand(c, name, {attribute=false, wild=true, modifier=0, climb=false}={}) {
  const die = attribute ? c.attributes[name] : c.skills[name];
  const untrained = !attribute && !die;
  const sides = DICE.includes(die) ? die : 4;
  const racial = racialEffects(c);
  const racialBonus = !attribute && name === 'Perceber' ? racial.notice : !attribute && name === 'Escalar' && climb ? racial.climb : 0;
  const bonus = modifier + racialBonus - (untrained ? 2 : 0);
  const expression = `${wild ? `sw${sides}` : `1d${sides} ie${sides}`}${signed(bonus)}`;
  const label = safeLabel(`${c.name || 'Personagem'} - ${name}${untrained ? ' sem treino' : ''}`);
  return {expression:`(${label}) ${expression}`, command:`/roll (${label}) ${expression}`, sides, bonus, untrained};
}

export function damageCommand(c, attack, {raise=false, modifier=0}={}) {
  const config = c.dice || defaultDice();
  if (!DICE.includes(config.weaponDie)) return null;
  const attr = attack === 'Atirar' ? 'Agilidade' : 'Força';
  const dice = [c.attributes[attr], ...Array.from({length:Math.max(1,Math.min(2,config.weaponCount))},()=>config.weaponDie), ...(raise ? [6] : [])];
  const label = safeLabel(`${c.name || 'Personagem'} - dano ${config.weaponName || attack}`);
  // Separate rolls keep every die exploding independently; the player adds their totals.
  const expression = dice.map((sides,i)=>`(${i===0 ? label : `Dano ${i+1}`}) 1d${sides} ie${sides}${i===0 ? signed(config.damageBonus + modifier) : ''}`).join(' ; ');
  return {expression, command:`/roll ${expression}`, attribute:attr};
}
