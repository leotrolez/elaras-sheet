import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ATTRIBUTES,
  DICE,
  SKILLS,
  MASTER_RULES,
  newCharacter,
  elaraCharacter,
  calculate,
  validateCharacter,
} from "./rules.js";
import { exportPdf, importPdf } from "./pdf.js";
import "./style.css";
import Book from "./Book.jsx";
import Templates from "./Templates.jsx";
import { racialEffects } from "./templates.js";
import Catalog from "./Catalog.jsx";
import PowerCatalog from "./PowerCatalog.jsx";
import { stageForXP } from "./catalogRules.js";
import Dice from "./Dice.jsx";

import {SHEETS_STORAGE, restoreSheets, openSheet, editSheet, closeSheet, openServerSheet} from './sheets.js';
import SheetTabs from './SheetTabs.jsx';
import MasterView from './MasterView.jsx';
import ServerSheets, {api} from './ServerSheets.jsx';
const TABS = [
  "Identidade",
  "Atributos",
  "Perícias",
  "Vantagens",
  "Magia e bagagem",
  "História",
  "Livro e regras",
  "Dados para Discord",
];
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function NumberField({ label, value, onChange, min = 0, max = 1000, hint }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(
            v === "" ? 0 : Math.min(max, Math.max(min, Math.trunc(Number(v)))),
          );
        }}
      />
    </Field>
  );
}
function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('manrakora-theme', theme); } catch { /* Theme still works without storage. */ }
  }, [theme]);
  const [session, setSession] = useState(() => {
    try { return restoreSheets(localStorage); }
    catch { return restoreSheets({getItem:()=>null}); }
  });
  const activeId = session.activeId;
  const sessionRef=useRef(session);
  sessionRef.current=session;
  useEffect(()=>{
    let disposed=false;
    async function sync(){
      const tracked=sessionRef.current.sheets.filter(s=>s.remote && JSON.stringify(s.character)===s.remote.base);
      for(const sheet of tracked){
        try {
          const row=await api(`/${sheet.remote.id}`);
          if(disposed)return;
          setSession(prev=>({...prev,sheets:prev.sheets.map(current=>current.id===sheet.id && current.remote?.id===row.id && row.revision>current.remote.revision && JSON.stringify(current.character)===current.remote.base
            ? {...current,character:row.character,remote:{...current.remote,revision:row.revision,base:JSON.stringify(row.character)}}:current)}));
        }catch{/* Keep local drafts available if disconnected. */}
      }
    }
    const timer=setInterval(sync,5000);
    return()=>{disposed=true;clearInterval(timer);};
  },[]);
  const c = session.sheets.find(s => s.id === activeId).character;
  const setC = value => setSession(prev => editSheet(prev, activeId, value));
  const [master, setMaster] = useState(false);
  const [masterKey, setMasterKey] = useState('');
  const addCharacter = character => {setSession(prev => openSheet(prev, character));setMaster(false);setTab(0);};
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [requestedPage, setRequestedPage] = useState(null);
  const file = useRef();
  const d = calculate(c);
  const update = (key, value) => setC((prev) => ({ ...prev, [key]: value }));
  const rule = (key, value) =>
    setC((prev) => ({ ...prev, rules: { ...prev.rules, [key]: value } }));
  useEffect(() => {
    try {
      localStorage.setItem(SHEETS_STORAGE, JSON.stringify(session));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [session]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  function changeItem(key, index, field, value) {
    update(
      key,
      c[key].map((x, i) => (i === index ? { ...x, [field]: value } : x)),
    );
  }
  function addItem(key) {
    const item =
      key === "advantages"
        ? { name: "", description: "", power: false }
        : key === "hindrances"
          ? { name: "", description: "", severity: "Menor" }
          : { name: "", description: "", cost: "" };
    update(key, [...c[key], item]);
  }
  async function loadPdf(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selected.length) return;
    let count = 0;
    const errors = [];
    for (const file of selected) {
      try {
        const loaded = await importPdf(file);
        setSession(prev => openSheet(prev, loaded));
        count++;
      } catch (error) { errors.push(`${file.name}: ${error.message}`); }
    }
    if (count) {setMaster(false);setTab(0);}
    setToast(`${count} ficha(s) aberta(s) em novas abas.${errors.length ? ' ' + errors.join(' ') : ''}`);
  }
  function save(character = c) {
    try {
      exportPdf(character);
      setToast(
        "PDF gerado com a ficha completa e os dados para reabrir neste aplicativo.",
      );
    } catch (error) {
      setToast("Não foi possível gerar o PDF. " + error.message);
    }
  }
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab(0);
          }}
        >
          <span className="brand-mark">✦</span>
          <span>
            Crônicas de
            <br />
            <b>Manrakora</b>
          </span>
        </a>
        <div className="top-actions">
          <button className="outline theme-toggle" aria-label="Modo escuro" aria-pressed={theme === 'dark'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
          <button className="quiet" onClick={() => file.current.click()}>
            Abrir PDF
          </button>
          <button className="primary" onClick={() => save()}>
            Salvar PDF <span aria-hidden="true">↗</span>
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={loadPdf}
        />
      </header>
      <ServerSheets key={activeId} sheet={session.sheets.find(s=>s.id===activeId)} masterKey={masterKey} onMasterKey={setMasterKey}
        onSaved={(id,row,token)=>setSession(prev=>{
          const editToken=row.editToken||token||prev.editKeys?.[row.id]||'';
          return {...prev,...(editToken?{editKeys:{...prev.editKeys,[row.id]:editToken}}:{}),sheets:prev.sheets.map(s=>s.id===id?{...s,remote:{id:row.id,revision:row.revision,base:JSON.stringify(row.character),editToken}}:s)};
        })}
        onOpen={row=>{setSession(prev=>openServerSheet(prev,row));setMaster(false);setTab(0);}} />
      <SheetTabs session={session} onSelect={id => setSession(prev => ({...prev,activeId:id}))}
        onNew={() => addCharacter(newCharacter())} master={master} onMaster={() => setMaster(value => !value)}
        onClose={id => setConfirm({title:"Fechar esta ficha?",text:"Ela será removida dos rascunhos deste navegador. Salve o PDF antes de fechar se quiser guardá-la.",action:() => setSession(prev => closeSheet(prev,id))})} />
      {master ? <MasterView sheets={session.sheets} onEdit={id => {setSession(prev => ({...prev,activeId:id}));setMaster(false);}} onSave={save} /> : <main className="layout">
        <aside className="sidebar">
          <p className="eyebrow">SEU PERSONAGEM</p>
          <h1>{c.name || "Uma nova história"}</h1>
          <p className="muted">{c.concept || "Dê forma à próxima aventura."}</p>
          <nav aria-label="Etapas da ficha">
            {TABS.map((name, i) => (
              <button
                key={name}
                aria-current={tab === i ? "step" : undefined}
                className={tab === i ? "selected" : ""}
                onClick={() => setTab(i)}
              >
                {name}
                <span aria-hidden="true">{tab === i ? "↗" : "›"}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              className="quiet"
              onClick={() =>
                setConfirm({
                  title: "Carregar Elara Windrunner?",
                  text: "Abre a Elara em uma nova aba, preservando as outras fichas.",
                  action: () => {
                    addCharacter(elaraCharacter());
                    setTab(0);
                  },
                })
              }
            >
              Usar exemplo da Elara
            </button>
            <button className="text-button" onClick={() => addCharacter(newCharacter())}>Nova ficha em outra aba</button>
            <small>
              {storageError
                ? "Rascunho local indisponível. Salve seu PDF."
                : "Todas as abas salvas neste navegador."}
              <br />O PDF permite levar sua ficha para outro computador.
            </small>
          </div>
        </aside>
        <section className="editor" key={activeId}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">SAVAGE WORLDS · REGRAS DA MESA</p>
              <h2>{TABS[tab]}</h2>
            </div>
            <span className="chapter">
              {String(tab + 1).padStart(2, "0")} / {String(TABS.length).padStart(2, "0")}
            </span>
          </div>
          {tab === 0 && (
            <>
              <p className="intro">
                Toda aventura começa com alguém que decide partir.
              </p>
              <div className="form-grid">
                <Field label="Nome do personagem">
                  <input
                    value={c.name}
                    maxLength={100}
                    placeholder="Como vão lembrar de você?"
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field label="Jogador">
                  <input
                    value={c.player}
                    maxLength={100}
                    onChange={(e) => update("player", e.target.value)}
                  />
                </Field>
                <Field label="Raça atual" hint="Escolha no catálogo abaixo para aplicar os traços do livro.">
                  <input value={c.race} maxLength={100} onChange={e => update("race", e.target.value)} disabled={Boolean(c.raceId)} />
                </Field>
                <Field label="Vila de origem">
                  <select
                    value={c.village}
                    onChange={(e) => update("village", e.target.value)}
                  >
                    {[
                      "Miryndol",
                      "Seylara",
                      "Eldwën",
                      "Tirashae",
                      "Lorandel",
                      "Valmyra",
                      "Outra origem",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <div className="wide">
                  <Field label="Conceito">
                    <input
                      maxLength={200}
                      placeholder="Barda elfa · arco e canções arcanas"
                      value={c.concept}
                      onChange={(e) => update("concept", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Templates character={c} onChange={setC} onLoad={(title, action) => setConfirm({title, text:"A ficha atual será substituída. Salve seu PDF antes de continuar se quiser guardá-la.", action})} />
              <div className="callout">
                <b>As florestas de Sylvargan</b>
                <p>
                  A campanha começa em uma das seis vilas do leste. Miryndol e
                  Seylara ficam perto de Vaelyndra, Eldwën e Tirashae a uma
                  distância normal, Lorandel e Valmyra ficam longe.
                </p>
              </div>
              <div className="form-grid">
                <NumberField label="Experiência (XP)" value={c.xp} max={1000000} onChange={v => update("xp", v)} hint="A cada 5 XP, sobe um nível e recebe 2 pontos." />
                <Field label="Nível calculado"><output>{d.level} · +{d.progressionPoints} pontos de progressão</output></Field>
              </div>
              <h3>Acordos de criação</h3>
              <p className="muted">
                A ficha começa com 30 pontos e recebe 2 pontos por nível. O contador usa um
                orçamento compartilhado para atributos, perícias e vantagens.
                Estágio do livro: {stageForXP(c.xp)}. Nível da mesa = piso(XP / 5).
              </p>
              <div className="form-grid">
                <Field
                  label="Pontos iniciais"
                  hint="Padrão da mesa: 30 pontos. Vazio também considera 30."
                >
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={c.rules.budget}
                    placeholder="A definir"
                    onChange={(e) =>
                      rule(
                        "budget",
                        e.target.value === ""
                          ? ""
                          : Math.max(
                              0,
                              Math.min(
                                10000,
                                Math.trunc(Number(e.target.value)),
                              ),
                            ),
                      )
                    }
                  />
                </Field>
                <NumberField
                  label="Pontos extras acordados"
                  value={c.rules.extraPoints}
                  onChange={(v) => rule("extraPoints", v)}
                />
                <NumberField
                  label="Pontos gastos em outros avanços"
                  value={c.rules.spentElsewhere}
                  onChange={(v) => rule("spentElsewhere", v)}
                />

              </div>
            </>
          )}
          {tab === 1 && (
            <>
              <p className="intro">
                Cada estágio custa 2 pontos. Quanto maior o dado, maior o
                potencial.
              </p>
              <div className="attribute-list">
                {ATTRIBUTES.map((name, i) => (
                  <div className="attribute" key={name}>
                    <div>
                      <h3>{name}</h3>
                      <p>
                        {
                          [
                            "Mobilidade, destreza e ataques com arco.",
                            "Aprendizado, investigação e conhecimentos.",
                            "Vontade, perícias arcanas e mana.",
                            "Impacto corpo a corpo e capacidade de carga.",
                            "Vida, stamina e resistência física.",
                          ][i]
                        }
                      </p>
                    </div>
                    <select
                      aria-label={name}
                      value={c.attributes[name]}
                      onChange={(e) =>
                        update("attributes", {
                          ...c.attributes,
                          [name]: Number(e.target.value),
                        })
                      }
                    >
                      {DICE.filter(
                        (v) =>
                          v >= (racialEffects(c).base[name] || 4) && !(
                            name === "Agilidade" &&
                            c.rules.racialAgility &&
                            v < 6
                          ),
                      ).map((v) => (
                        <option value={v} key={v}>
                          d{v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <h3>Ajustes de equipamento e campanha</h3>
              <div className="form-grid">
                {[
                  ["Armadura", "armor"],
                  ["Bônus de Aparar", "parryBonus"],
                  ["Ajuste de Movimentação", "movementBonus"],
                  ["Mana adicional", "manaBonus"],
                ].map(([label, key]) => (
                  <NumberField
                    key={key}
                    label={label}
                    value={c[key]}
                    min={key === "armor" ? 0 : -100}
                    onChange={(v) => update(key, v)}
                  />
                ))}
              </div>
              <p className="muted">
                Os traços raciais escolhidos em Identidade são aplicados automaticamente.
                Bônus situacionais aparecem no painel da raça; ajustes abaixo são adicionais.
              </p>
            </>
          )}
          {tab === 2 && (
            <>
              <p className="intro">
                Escolha o que você sabe fazer. Cada estágio inicial custa 1
                ponto.
              </p>
              <p className="muted">
                Conjurar e Meditar aparecem nos treinos do mestre. Confirme como
                essas perícias ficam disponíveis. A compra de novas perícias
                durante a campanha tem custo próprio.
              </p>
              <div className="skills-grid">
                {SKILLS.map(([name, attribute]) => (
                  <label className="skill" key={name}>
                    <span>
                      {name}
                      <small>{attribute}</small>
                    </span>
                    <select
                      aria-label={`Perícia ${name}`}
                      value={c.skills[name] || 0}
                      onChange={(e) =>
                        update("skills", {
                          ...c.skills,
                          [name]: Number(e.target.value),
                        })
                      }
                    >
                      <option value="0">—</option>
                      {DICE.filter(v => v >= (racialEffects(c).skill === name ? 6 : 4)).map((v) => (
                        <option value={v} key={v}>
                          d{v}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {(!c.skills.Nadar || !c.skills.Perceber) && (
                <div className="callout">
                  <b>Atenção às regras da mesa</b>
                  <p>
                    {!c.skills.Nadar &&
                      "Sem Nadar, a planilha prevê afogamento ao submergir. "}
                    {!c.skills.Perceber &&
                      "Sem Perceber, você não identifica armadilhas e afins."}
                  </p>
                </div>
              )}
            </>
          )}
          {tab === 3 && (
            <>
              <p className="intro">
                Talentos e dificuldades dão personalidade à sua ficha.
              </p>
              <Catalog character={c}
                onAdd={(key, item) => {
                  setC(prev => ({...prev, [key]: [...prev[key], item]}));
                  setToast(`${item.name} adicionada à ficha.`);
                }}
                onOpenPage={page => {setRequestedPage(page);setTab(6);}}
              />
              <h3>Opções selecionadas e personalizadas</h3>
              <h3>Vantagens</h3>
              {c.advantages.map((x, i) => (
                <div className="item-card" key={i}>
                  <Field label="Nome">
                    <input
                      value={x.name}
                      maxLength={200}
                      onChange={(e) =>
                        changeItem("advantages", i, "name", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Requisitos e efeitos">
                    <textarea
                      maxLength={10000}
                      rows="2"
                      value={x.description}
                      onChange={(e) =>
                        changeItem(
                          "advantages",
                          i,
                          "description",
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <div className="row">
                    <span className="muted">Bônus específicos de mana: use Mana adicional em Atributos.</span>
                    <button
                      className="text-button danger"
                      onClick={() =>
                        update(
                          "advantages",
                          c.advantages.filter((_, j) => i !== j),
                        )
                      }
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              <button className="outline" onClick={() => addItem("advantages")}>
                + Criar vantagem personalizada
              </button>
              <div className="form-grid compact">
                <NumberField
                  label="Vantagens anteriores ao custo atual"
                  max={100}
                  value={c.rules.ownedAdvantages}
                  onChange={(v) => rule("ownedAdvantages", v)}
                  hint="Ajusta o primeiro custo. Confirme o efeito das raciais."
                />
                <NumberField
                  label="Desconto de pontos em vantagens"
                  value={c.rules.advantageDiscount}
                  onChange={(v) => rule("advantageDiscount", v)}
                  hint="Para vantagens gratuitas acordadas com o mestre."
                />
              </div>
              <h3>Desvantagens</h3>
              {c.hindrances.map((x, i) => (
                <div className="item-card" key={i}>
                  <div className="form-grid">
                    <Field label="Nome">
                      <input
                        value={x.name}
                        maxLength={200}
                        onChange={(e) =>
                          changeItem("hindrances", i, "name", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Impacto">
                      <select
                        value={x.severity}
                        onChange={(e) =>
                          changeItem(
                            "hindrances",
                            i,
                            "severity",
                            e.target.value,
                          )
                        }
                      >
                        <option>Menor</option>
                        <option>Maior</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Como afeta o personagem">
                    <textarea
                      maxLength={10000}
                      rows="2"
                      value={x.description}
                      onChange={(e) =>
                        changeItem(
                          "hindrances",
                          i,
                          "description",
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <button
                    className="text-button danger"
                    onClick={() =>
                      update(
                        "hindrances",
                        c.hindrances.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button className="outline" onClick={() => addItem("hindrances")}>
                + Criar desvantagem personalizada
              </button>
              <p className="muted">
                Menor concede 3 pontos. Maior concede 5. Registre aqui apenas as
                que dão pontos de criação. Desvantagens raciais já compensadas
                ficam nas Anotações.
              </p>
            </>
          )}
          {tab === 4 && (
            <>
              <p className="intro">
                O que você carrega e a magia que aprendeu.
              </p>
              <h3>Poderes e canções</h3>
              <p className="muted">
                Busque um poder do livro ou adicione um poder personalizado aprovado pelo mestre.
              </p>
              <PowerCatalog character={c}
                onAdd={item => {
                  setC(prev => ({...prev, powers:[...prev.powers, item]}));
                  setToast(`${item.name} adicionado à ficha.`);
                }}
                onOpenPage={page => {setRequestedPage(page);setTab(6);}}
              />
              {c.powers.map((x, i) => (
                <div className="item-card" key={i}>
                  <div className="form-grid">
                    <Field label="Nome">
                      <input
                        value={x.name}
                        maxLength={200}
                        onChange={(e) =>
                          changeItem("powers", i, "name", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Custo de mana">
                      <input
                        value={x.cost}
                        maxLength={100}
                        onChange={(e) =>
                          changeItem("powers", i, "cost", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Efeito, alcance e conjuração">
                    <textarea
                      maxLength={10000}
                      rows="3"
                      value={x.description}
                      onChange={(e) =>
                        changeItem("powers", i, "description", e.target.value)
                      }
                    />
                  </Field>
                  <button
                    className="text-button danger"
                    onClick={() =>
                      update(
                        "powers",
                        c.powers.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button className="outline" onClick={() => addItem("powers")}>
                + Adicionar poder personalizado
              </button>
              <h3>Equipamento</h3>
              <Field
                label="Armas, armadura e bagagem"
                hint="Anote dano, alcance, munição, dinheiro e outros detalhes."
              >
                <textarea
                  maxLength={10000}
                  rows="9"
                  value={c.equipment}
                  onChange={(e) => update("equipment", e.target.value)}
                />
              </Field>
            </>
          )}
          {tab === 5 && (
            <>
              <p className="intro">
                Os motivos para partir. As promessas para voltar.
              </p>
              <Field label="História do personagem">
                <textarea
                  maxLength={10000}
                  rows="10"
                  value={c.history}
                  onChange={(e) => update("history", e.target.value)}
                  placeholder="De onde você veio? O que procura? Por que está com o grupo?"
                />
              </Field>
              <Field label="Anotações, traços raciais e acordos com o mestre">
                <textarea
                  maxLength={10000}
                  rows="8"
                  value={c.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </Field>
            </>
          )}
          {tab === 6 && (
            <>
              <p className="intro">
                Consulte o livro e confira as mudanças da sua mesa.
              </p>
              <details className="rules-panel" open>
                <summary>Regras do mestre</summary>
                <p className="muted">
                  Transcrição resumida da planilha consultada em 16/11/2026.{" "}
                  <a
                    href="https://docs.google.com/spreadsheets/d/1_Ja3ozvLSkSPQ6GeCzjdUmY_0fY4_h5b6wL1PHwk8GY/edit?gid=0"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir a planilha original ↗
                  </a>
                </p>
                {MASTER_RULES.map(([title, text]) => (
                  <details key={title}>
                    <summary>{title}</summary>
                    <p>{text}</p>
                  </details>
                ))}
              </details>
              <Book requestedPage={requestedPage} />
            </>
          )}
          {tab === 7 && <Dice character={c} onChange={value => update('dice', value)} />}
          {tab < TABS.length - 1 && (
            <div className="editor-footer">
              <button
                className="quiet"
                disabled={tab === 0}
                onClick={() => setTab(tab - 1)}
              >
                ← Voltar
              </button>
              <button className="primary" onClick={() => setTab(tab + 1)}>
                Continuar →
              </button>
            </div>
          )}
        </section>
        <aside className="summary">
          <p className="eyebrow">FICHA EM TEMPO REAL</p>
          <div className="crest" aria-hidden="true">
            ✧
          </div>
          <h2>{c.name || "Seu personagem"}</h2>
          <p className="muted">
            {c.race} · {c.village}
          </p>
          <div className="stats">
            {[
              ["Vida", d.life, "health"],
              ["Stamina", d.stamina, "health"],
              ["Mana", d.mana, "mana"],
              ["Movimento", d.movement],
              ["Aparar", d.parry],
              ["Resistência", d.toughness],
            ].map(([name, v, resource]) => (
              <div key={name} data-resource={resource}>
                <strong>{v}</strong>
                <span>{name}</span>
              </div>
            ))}
          </div>
          <div className="points">
            <div className="row" data-deficit={d.remaining < 0}>
              <h3>Pontos de criação</h3>
              <strong
                className={
                  d.remaining !== null && d.remaining < 0 ? "negative" : ""
                }
              >
                {d.remaining ?? "—"}
              </strong>
            </div>
            <p className="muted">
              {d.remaining === null
                ? "Defina os pontos iniciais em Identidade."
                : d.remaining < 0
                  ? "Você ultrapassou o orçamento definido."
                  : "pontos disponíveis"}
            </p>
            {[
              ["Atributos", d.attributeCost, true],
              ["Perícias", d.skillCost, true],
              ["Vantagens", d.advantageCost, true],
              ["Outros gastos", c.rules.spentElsewhere, true],
              ["Nível " + d.level, "+" + d.progressionPoints],
              ["Pontos extras", "+" + d.extra],
            ].map(([name, value, isCost]) => (
              <div className="point-line" key={name} data-cost={isCost}>
                <span>{name}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
          <p className="summary-note">
            O mestre confirma os requisitos, as regras raciais e os poderes.
            Revise a ficha antes de jogar.
          </p>
          <button className="outline full" onClick={() => save()}>
            Salvar ficha em PDF
          </button>
        </aside>
      </main>}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <h2 id="dialog-title">{confirm.title}</h2>
            <p>{confirm.text}</p>
            <div className="row">
              <button
                autoFocus
                className="quiet"
                onClick={() => setConfirm(null)}
              >
                Cancelar
              </button>
              <button
                className="primary"
                onClick={() => {
                  confirm.action();
                  setConfirm(null);
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
