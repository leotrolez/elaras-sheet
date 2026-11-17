import test from "node:test";
import assert from "node:assert/strict";
import { applyRace, archetypes, loadArchetype, races } from './templates.js';
import { createPdfBlob, importPdf } from './pdf.js';
import {
  calculate,
  elaraCharacter,
  newCharacter,
  validateCharacter,
} from "./rules.js";

test('raças aplicam bases gratuitas, escolhas e derivados sem acumular bônus', () => {
  const blank = newCharacter();
  const elf = applyRace(blank, 'Elfo');
  assert.equal(elf.attributes.Agilidade, 6);
  assert.equal(calculate(elf).attributeCost, 0);
  const dwarf = applyRace(elf, 'Anão');
  assert.equal(dwarf.attributes.Agilidade, 4);
  assert.equal(dwarf.attributes.Vigor, 6);
  assert.deepEqual(applyRace(dwarf, 'Anão'), dwarf);
  const atlante = applyRace(blank, 'Atlante');
  assert.equal(calculate(atlante).skillCost, 0);
  assert.equal(calculate(atlante).toughness, 5);
  assert.equal(atlante.skills.Nadar, 6);
  const half = applyRace(blank, 'Meio-elfo', 'Vantagem');
  half.advantages = [{name:'A'}, {name:'B'}];
  assert.equal(calculate(half).advantageCost, 1);
  assert.equal(calculate(half).extra, 0);
  for (const race of races) {
    const c = applyRace(blank, race.id);
    assert.deepEqual(validateCharacter(JSON.parse(JSON.stringify(c))), c);
  }
});

test('todos os arquétipos preservam atributos e perícias ao reabrir a ficha', () => {
  for (const template of archetypes) {
    const c = loadArchetype(newCharacter(), template, newCharacter());
    assert.deepEqual(validateCharacter(JSON.parse(JSON.stringify(c))), c, template.id);
    assert.equal(c.raceId, 'Humano');
    assert.equal(c.name, '');
    assert.equal(c.history, '');
    assert.ok(c.advantages.length);
    assert.ok(Number.isFinite(calculate(c).spent));
  }
});

test('PDF exportado preserva raça, escolhas e arquétipo na reimportação', async () => {
  const template = archetypes.find(a => a.id === 'Mago');
  const mage = loadArchetype(newCharacter(), template, newCharacter());
  const c = applyRace(mage, 'Androide', 'Agilidade', 'Ciência Estranha');
  c.name = 'Teste de ficha';
  c.xp = 14;
  const blob = createPdfBlob(c);
  assert.equal(blob.type, 'application/pdf');
  assert.ok((await blob.text()).startsWith('%PDF-'));
  assert.deepEqual(await importPdf(blob), c);
});

test('progressão segue os limites de XP e mantém Aparar ligado a Lutar', () => {
  const c = newCharacter();
  for (const [xp, level, points] of [[0,0,30],[4,0,30],[5,1,32],[9,1,32],[10,2,34]]) {
    c.xp = xp;
    const d = calculate(c);
    assert.equal(d.level, level);
    assert.equal(d.remaining, points);
  }
  c.skills = {Lutar:8, Jogar:12};
  assert.equal(calculate(c).parry, 6);
  assert.equal(calculate(c).movement, 1);
  c.advantages = [{name:'Arcano',power:true}];
  assert.equal(calculate(c).mana, 18);
  const old = {...newCharacter(),rules:{...newCharacter().rules,budget:''}};
  delete old.xp;
  const migrated = validateCharacter(old);
  assert.equal(migrated.rules.budget, 30);
  assert.equal(migrated.xp, 0);
});

test("Elara usa os custos raciais e os derivados da mesa", () => {
  const d = calculate(elaraCharacter());
  assert.deepEqual(
    [d.attributeCost, d.skillCost, d.movement, d.parry, d.toughness, d.mana],
    [10, 12, 2, 4, 5, 26],
  );
  assert.equal(d.remaining, 8);
});
test("vantagens crescentes, pontos extras e bônus de mana são contados", () => {
  const c = newCharacter();
  c.rules.budget = 20;
  c.advantages = [
    { name: "A", power: true },
    { name: "B", power: false },
  ];
  c.hindrances = [{ severity: "Maior" }, { severity: "Menor" }];
  const d = calculate(c);
  assert.equal(d.advantageCost, 3);
  assert.equal(d.extra, 8);
  assert.equal(d.remaining, 25);
  assert.equal(d.mana, 18);
});
test("importação normaliza dados e rejeita atributos inválidos", () => {
  const original = elaraCharacter();
  assert.deepEqual(
    validateCharacter(JSON.parse(JSON.stringify(original))),
    original,
  );
  assert.throws(() =>
    validateCharacter({
      ...original,
      attributes: { ...original.attributes, Vigor: 100 },
    }),
  );
});
