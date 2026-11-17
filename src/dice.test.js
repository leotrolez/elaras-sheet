import test from 'node:test';
import assert from 'node:assert/strict';
import {traitCommand, damageCommand} from './dice.js';
import {elaraCharacter, newCharacter} from './rules.js';
import {applyRace} from './templates.js';
import {createPdfBlob, importPdf} from './pdf.js';

test('Elara usa Atirar d8 e Conjurar d6 com Selvagem sem somar os dados',()=>{
  const c=elaraCharacter();
  assert.equal(traitCommand(c,'Atirar').command,'/roll (Elara Windrunner - Atirar) sw8');
  assert.ok(traitCommand(c,'Conjurar',{modifier:-2}).expression.endsWith('sw6 - 2'));
  assert.ok(traitCommand(c,'Jogar').expression.endsWith('sw4 - 2'));
  assert.ok(traitCommand(c,'Vigor',{attribute:true,wild:false}).expression.endsWith('1d6 ie6'));
});
test('bônus racial de Perceber e Escalar respeitam o contexto',()=>{
  const saurio=applyRace(newCharacter(),'Sáurio');
  saurio.skills.Perceber=6;
  assert.equal(traitCommand(saurio,'Perceber').bonus,2);
  const cat=applyRace(newCharacter(),'Rakashano');
  cat.skills.Escalar=6;
  assert.equal(traitCommand(cat,'Escalar').bonus,0);
  assert.equal(traitCommand(cat,'Escalar',{climb:true}).bonus,2);
});
test('dano usa o atributo da mesa, explosões por dado e nenhum Selvagem',()=>{
  const c=elaraCharacter();
  assert.equal(damageCommand(c,'Atirar'),null);
  c.dice={weaponName:'Arco',weaponDie:6,weaponCount:2,damageBonus:1};
  const roll=damageCommand(c,'Atirar',{raise:true,modifier:-2});
  assert.equal(roll.attribute,'Agilidade');
  assert.ok(roll.expression.startsWith('(Elara Windrunner - dano Arco) 1d8 ie8 - 1'));
  assert.equal(roll.expression.split(';').length,4);
  assert.ok(!roll.expression.includes('sw'));
  assert.equal(damageCommand(c,'Arremessar').attribute,'Força');
});
test('configuração da arma é preservada ao reabrir o PDF', async()=>{
  const c=newCharacter();
  c.dice={weaponName:'Arco',weaponDie:8,weaponCount:1,damageBonus:2};
  assert.deepEqual((await importPdf(createPdfBlob(c))).dice,c.dice);
  c.name='Teste; 100d100 !\n(Injected)';
  assert.equal(traitCommand(c,'Atirar').expression.split(';').length,1);
});
