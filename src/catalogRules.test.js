import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import catalog from './catalog.json' with { type:'json' };
import { newCharacter } from './rules.js';
import { checkAdvantage, normalize, powersFromBook, stageForXP } from './catalogRules.js';

const edges = catalog.filter(entry => entry.kind === 'advantages');
const check = (name, character) => checkAdvantage(edges.find(edge => normalize(edge.name) === normalize(name)), character, edges.map(edge => edge.name));

test('estágios seguem os limites de XP do livro', () => {
  assert.deepEqual([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(stageForXP),
    ['Novato','Novato','Experiente','Experiente','Veterano','Veterano','Heroico','Heroico','Lendário','Lendário']);
});

test('distingue requisitos por XP, dado, alternativa, vantagem anterior e revisão', () => {
  const character = newCharacter();
  assert.deepEqual(check('Bloquear', character).missing, ['Experiente (20 XP)', 'Lutar d8+']);
  character.xp = 20;
  character.skills.Lutar = 10;
  assert.deepEqual(check('Arma Predileta', character).missing, []);
  character.xp = 40;
  assert.deepEqual(check('Bloquear Aprimorado', character).missing, ['Bloquear']);
  character.advantages.push({name:'Bloquear'});
  assert.deepEqual(check('Bloquear Aprimorado', character).missing, []);
  assert.ok(check('Duro de Matar', character).manual.includes('Carta Selvagem'));
});

test('o custo usa o saldo real, a gratuidade e as vantagens anteriores', () => {
  const character = newCharacter();
  character.raceId = 'Humano';
  assert.equal(check('Prontidão', character).cost, 0);
  character.advantages.push({name:'Prontidão'});
  character.rules.ownedAdvantages = 2;
  character.rules.budget = 2;
  const result = check('Furioso', character);
  assert.equal(result.cost, 3);
  assert.match(result.missing.join(), /saldo: 2/);
  character.rules.advantageDiscount = 1;
  assert.equal(check('Furioso', character).cost, 2);
});

test('o livro fornece 50 poderes únicos com estágio e custo literal', () => {
  const book = JSON.parse(readFileSync(new URL('../public/assets/book.json', import.meta.url), 'utf8'));
  const powers = powersFromBook(book.pages);
  assert.equal(new Set(powers.map(power => power.name)).size, 50);
  const greaterHealing = powers.find(power => power.name === 'Cura maior');
  assert.deepEqual([greaterHealing.stage, greaterHealing.cost, greaterHealing.range, greaterHealing.page], ['Veterano', '10/20', 'Toque', 159]);
});
