// ============================================================
// Gera data/core/*-suplementos.json a partir de um checkout do Fichas de Nimb.
//
// Enquanto sync-core.mjs *confere* o que já tínhamos do livro básico, este
// script traz o conteúdo dos suplementos que a ficha ainda não conhecia:
// as raças e classes de Heróis de Arton, Ameaças de Arton e Deuses de Arton,
// as origens de Heróis de Arton e os deuses menores.
//
// O QUE ENTRA E O QUE NÃO ENTRA
// -----------------------------
// Entram FATOS DE REGRA: nome, bônus de atributo, tamanho, deslocamento,
// PV/PM por nível, perícias, proficiências, e o nome de cada traço/habilidade.
//
// NÃO entra o texto descritivo. O campo `traços` de cada raça é montado por
// este script a partir dos números — "Cascos (arma natural 1d8), +2 Sabedoria,
// +1 Força, −1 Inteligência, tamanho Grande, deslocamento 12m" — no mesmo
// formato resumido que o resto de data/core usa. Nenhuma frase do livro ou do
// Nimb é copiada.
//
// COMO RODAR
//   git clone --depth 1 https://github.com/YuriAlessandro/gerador-ficha-tormenta20 /tmp/nimb
//   npm i esbuild lodash uuid
//   node sync-suplementos.mjs /tmp/nimb --write
// ============================================================
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ_NIMB = process.argv[2] || process.env.NIMB_PATH || "/tmp/nimb";
const APLICAR = process.argv.includes("--write");
const CORE = path.join(import.meta.dirname, "data/core");
const RAW = path.join(import.meta.dirname, "data/raw");

if (!fs.existsSync(path.join(RAIZ_NIMB, "src/data/systems/tormenta20"))) {
  console.error(`Checkout do Fichas de Nimb não encontrado em ${RAIZ_NIMB}. Veja o cabeçalho deste arquivo.`);
  process.exit(1);
}

const esbuild = require("esbuild");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t20-sup-"));

async function carregar(modulo) {
  const saida = path.join(tmp, `${modulo.replace(/\W/g, "_")}.cjs`);
  await esbuild.build({
    entryPoints: [path.join(RAIZ_NIMB, "src/data/systems/tormenta20", `${modulo}.ts`)],
    bundle: true, format: "cjs", platform: "node", outfile: saida, logLevel: "silent",
    alias: { "@": path.join(RAIZ_NIMB, "src") },
    nodePaths: [path.join(import.meta.dirname, "node_modules")],
    plugins: [{
      name: "stub-premium",
      setup(b) {
        b.onResolve({ filter: /premium\// }, (a) => ({ path: a.path, namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "module.exports = new Proxy({}, { get: () => () => undefined });", loader: "js",
        }));
      },
    }],
  });
  const src = fs.readFileSync(saida, "utf8")
    .replace(/Object\.values\((\w+_default)\)/g, "Object.values($1 || {})")
    .replace(/Object\.keys\((\w+_default)\)/g, "Object.keys($1 || {})");
  fs.writeFileSync(saida, src);
  return require(saida);
}

// ---------- helpers ----------
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ATRIBUTOS = { forca: "for", destreza: "des", constituicao: "con", inteligencia: "int", sabedoria: "sab", carisma: "car" };
const paraAtributo = (n) => ATRIBUTOS[semAcento(n)] ?? null;
const idDe = (nome) => semAcento(nome).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
const primeiroArray = (mod) => Object.values(mod).find((v) => Array.isArray(v) && v.length) || [];

// Resumo mecânico de um traço: só o nome, mais o efeito numérico QUANDO ele
// está declarado em dado estruturado. Nunca a descrição em prosa.
function resumoDoTraco(hab) {
  const partes = [];
  for (const b of hab.sheetBonuses || []) {
    const alvo = b.target?.type;
    const valor = b.modifier?.type === "Fixed" ? b.modifier.value : null;
    if (alvo === "Defense" && valor != null) partes.push(`${fmt(valor)} Defesa`);
    else if (alvo === "PV" && valor != null) partes.push(`${fmt(valor)} PV`);
    else if (alvo === "PM" && valor != null) partes.push(`${fmt(valor)} PM`);
    else if (alvo === "Skill" && valor != null && b.target.name) partes.push(`${fmt(valor)} em ${b.target.name}`);
  }
  for (const a of hab.sheetActions || []) {
    const acao = a.action || {};
    if (acao.type === "addSense" && acao.sense) partes.push(String(acao.sense).toLowerCase());
    if (acao.type === "addEquipment") {
      for (const arma of acao.equipment?.Arma || []) {
        if (arma.nome && arma.dano) partes.push(`arma natural ${arma.dano}`);
      }
    }
  }
  const unicos = [...new Set(partes)];
  return unicos.length ? `${hab.name} (${unicos.join(", ")})` : hab.name;
}

let paraIdPericia = () => null; // preenchido na execução, quando pericias.json é lido

function converterRaca(r, fonte) {
  const fixos = {}; let escolhas = 0; const excluir = [];
  for (const a of r.attributes?.attrs || []) {
    if (a.attr === "any") escolhas += 1;
    else {
      const id = paraAtributo(a.attr);
      if (id) fixos[id] = (fixos[id] || 0) + a.mod;
    }
  }
  for (const a of r.attributes?.attrs || []) if (a.attr === "any" && a.excludes) excluir.push(...a.excludes.map(paraAtributo).filter(Boolean));

  let desloc = 9;
  try { const d = r.getDisplacement?.(r); if (typeof d === "number") desloc = d; } catch { /* depende da ficha */ }

  const tamanho = r.size?.name || "Médio";
  const tracos = (r.abilities || []).map(resumoDoTraco);
  const atributosTexto = [
    ...Object.entries(fixos).map(([k, v]) => `${fmt(v)} ${k.toUpperCase()}`),
    escolhas ? `${fmt(1)} em ${escolhas} atributo(s) à escolha` : "",
  ].filter(Boolean).join(", ");

  // Heranças (Moreau) são o mesmo padrão dos legados do Suraggel: escolhas
  // que trocam os bônus de atributo e de perícia da raça. A ficha já sabe
  // tratar `auto.legados`, então elas entram por lá.
  const legados = Object.entries(r.heritages || {}).map(([chave, h]) => {
    const atributos = {}; let livres = 0;
    for (const a of h.attributes || []) {
      if (a.attr === "any") livres += 1;
      else { const id = paraAtributo(a.attr); if (id) atributos[id] = (atributos[id] || 0) + a.mod; }
    }
    const bonusPericias = {};
    for (const hab of h.abilities || []) {
      for (const b of hab.sheetBonuses || []) {
        if (b.target?.type === "Skill" && b.target.name && b.modifier?.type === "Fixed") {
          const idPericia = paraIdPericia(b.target.name);
          if (idPericia) bonusPericias[idPericia] = (bonusPericias[idPericia] || 0) + b.modifier.value;
        }
      }
    }
    return {
      id: idDe(chave), nome: h.name || chave, atributos,
      ...(livres ? { atributosLivres: livres } : {}),
      ...(Object.keys(bonusPericias).length ? { bonusPericias } : {}),
    };
  });

  // Variantes de atributo (Kallyanach): a raça deixa escolher COMO distribuir
  // o bônus, em vez de fixar quais atributos sobem.
  const variantes = (r.attributeVariants || []).map((v, i) => ({
    id: `variante-${i + 1}`,
    nome: v.label || `Variante ${i + 1}`,
    livres: (v.attrs || []).filter((a) => a.attr === "any").length,
    valor: (v.attrs || [])[0]?.mod ?? 1,
  }));

  if (legados.length) tracos.push(`${legados.length} heranças à escolha (${legados.map((l) => l.nome.replace(/^Herança d[eoa]s? /i, "")).join(", ")})`);
  if (variantes.length) tracos.push(`bônus de atributo à escolha: ${variantes.map((v) => v.nome).join(" ou ")}`);

  const raca = {
    id: idDe(r.name),
    nome: r.name,
    atributos: escolhas ? { ...fixos, escolha: escolhas } : fixos,
    deslocamento: `${desloc}m`,
    tamanho,
    // Resumo montado a partir dos números acima — não é texto do livro.
    traços: [atributosTexto, tracos.join("; ")].filter(Boolean).join(". "),
    fonte,
    suplemento: true,
    // O autor do Fichas de Nimb marca algumas raças como obsoletas (a Mashin
    // virou outra coisa em errata). Elas ficam na ficha, mas escondidas do
    // seletor a menos que o personagem já use.
    ...(r.deprecated ? { obsoleta: true } : {}),
    // Raça que "conta como" outra para pré-requisito de poder.
    ...(r.countsAsRaces?.length ? { contaComo: r.countsAsRaces } : {}),
    auto: {},
  };
  if (escolhas) raca.auto.atributosEscolha = { quantidade: escolhas, excluir: [...new Set(excluir)] };
  if (legados.length) raca.auto.legados = legados;
  if (variantes.length) raca.auto.variantesAtributos = variantes;
  // Traços numéricos que a ficha sabe aplicar sozinha.
  for (const hab of r.abilities || []) {
    for (const b of hab.sheetBonuses || []) {
      const valor = b.modifier?.type === "Fixed" ? b.modifier.value : null;
      if (valor == null) continue;
      if (b.target?.type === "Defense") raca.auto.defesa = (raca.auto.defesa || 0) + valor;
    }
  }
  if (!Object.keys(raca.auto).length) delete raca.auto;
  return raca;
}

function converterClasse(c, fonte, paraId) {
  const fixas = (c.periciasbasicas || []).flatMap((g) => (Array.isArray(g) ? g : g.list || []));
  const grupos = (c.periciasbasicas || []).filter((g) => g.type === "or").map((g) => (g.list || []).map(paraId).filter(Boolean));
  return {
    id: idDe(c.name),
    nome: c.name,
    pvInicial: c.pv, pvPorNivel: c.addpv,
    pmInicial: c.pm, pmPorNivel: c.addpm,
    atributoChave: (c.attrPriority || []).map(paraAtributo).find(Boolean) || "for",
    periciasFixas: (c.periciasbasicas || []).filter((g) => g.type !== "or").flatMap((g) => (Array.isArray(g) ? g : g.list || [])).map(paraId).filter(Boolean),
    periciasFixasEscolha: grupos,
    treinosIniciais: c.periciasrestantes?.qtd ?? 2,
    periciasDeClasse: [...new Set([...fixas, ...(c.periciasrestantes?.list || [])].map(paraId).filter(Boolean))].sort(),
    proficiencias: (c.proficiencias || []).slice().sort(),
    atributosPrioritarios: (c.attrPriority || []).map(paraAtributo).filter(Boolean),
    // Uma linha só, montada dos dados: quantos poderes de classe existem.
    iniciais: `Classe de ${fonte}. ${(c.abilities || []).length} habilidade(s) de classe e ${(c.powers || []).length} poder(es) próprios no compêndio.`,
    fonte,
    suplemento: true,
    dinheiroInicial: 60,
  };
}

// ---------- execução ----------
const pericias = JSON.parse(fs.readFileSync(path.join(CORE, "pericias.json"), "utf8"));
const mapaPericia = new Map(pericias.map((p) => [semAcento(p.nome), p.id]));
const paraId = (nome) => mapaPericia.get(semAcento(nome).replace(/\s*\(.*\)$/, "")) ?? null;
paraIdPericia = paraId;

const FONTES_RACAS = [
  ["herois-de-arton/races/index", "Heróis de Arton"],
  ["ameacas-de-arton/races/index", "Ameaças de Arton"],
  ["deuses-de-arton/races/index", "Deuses de Arton"],
];
const FONTES_CLASSES = [
  ["herois-de-arton/classes/index", "Heróis de Arton"],
  ["deuses-de-arton/classes/index", "Deuses de Arton"],
  ["ameacas-de-arton/classes/index", "Ameaças de Arton"],
];

const racasBase = new Set(JSON.parse(fs.readFileSync(path.join(CORE, "racas.json"), "utf8")).map((r) => semAcento(r.nome)));
const racas = [];
for (const [mod, fonte] of FONTES_RACAS) {
  let lista = [];
  try { lista = primeiroArray(await carregar(mod)); } catch { continue; }
  for (const r of lista) {
    if (!r?.name || racasBase.has(semAcento(r.name)) || racas.some((x) => semAcento(x.nome) === semAcento(r.name))) continue;
    racas.push(converterRaca(r, fonte));
  }
}

const classesBase = new Set(JSON.parse(fs.readFileSync(path.join(CORE, "classes.json"), "utf8")).map((c) => semAcento(c.nome)));
const classes = [];
for (const [mod, fonte] of FONTES_CLASSES) {
  let lista = [];
  try { lista = primeiroArray(await carregar(mod)); } catch { continue; }
  for (const c of lista) {
    if (!c?.name || classesBase.has(semAcento(c.name)) || classes.some((x) => semAcento(x.nome) === semAcento(c.name))) continue;
    classes.push(converterClasse(c, fonte, paraId));
  }
}

// Origens de Heróis de Arton, no mesmo formato das nossas.
const origensBase = new Set(JSON.parse(fs.readFileSync(path.join(CORE, "origens.json"), "utf8")).map((o) => semAcento(o.id)));
const origens = [];
try {
  const mod = await carregar("herois-de-arton/origins/index");
  // As origens do básico vêm num objeto indexado pelo nome; as de Heróis de
  // Arton vêm num array. Normaliza os dois para pares [nome, origem].
  const bruto = Object.values(mod).find((v) => v && typeof v === "object") || {};
  const lista = Array.isArray(bruto) ? bruto.map((o) => [o?.name, o]) : Object.entries(bruto);
  for (const [nome, o] of lista) {
    if (!nome || !o || origensBase.has(semAcento(nome))) continue;
    let itens = [];
    try { itens = (o.getItems?.() || []).map((i) => i.equipment).filter((x) => typeof x === "string"); } catch { /* depende da ficha */ }
    origens.push({
      id: o.name || nome,
      periciasSugeridas: (o.pericias || []).map(paraId).filter(Boolean),
      ...(itens.length ? { itensIniciais: itens } : {}),
      fonte: "Heróis de Arton",
      suplemento: true,
    });
  }
} catch { /* módulo indisponível */ }

// Deuses menores: só nome e a fonte — a descrição de cada um é lore do livro.
const deusesMenores = [];
try {
  const mod = await carregar("deuses-menores/divindades/index");
  const lista = Object.values(mod).find((v) => v && typeof v === "object") || {};
  for (const [chave, d] of Object.entries(lista)) {
    const nome = d?.name || chave;
    if (typeof nome === "string") deusesMenores.push({ nome, tipo: "Deus menor", fonte: "Deuses de Arton", descricao: "" });
  }
} catch { /* módulo indisponível */ }

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`raças de suplemento : ${racas.length}`);
console.log(`classes de suplemento: ${classes.length} (${classes.map((c) => c.nome).join(", ")})`);
console.log(`origens de suplemento: ${origens.length}`);
console.log(`deuses menores       : ${deusesMenores.length}`);

if (APLICAR) {
  const grava = (p, d) => fs.writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
  grava(path.join(CORE, "racas-suplementos.json"), racas);
  grava(path.join(CORE, "classes-suplementos.json"), classes);
  grava(path.join(CORE, "origens-suplementos.json"), origens);
  grava(path.join(RAW, "deuses-menores.json"), deusesMenores);
  console.log("\nEscrito. Confira o diff antes de commitar.");
} else {
  console.log("\nNada foi escrito. Rode com --write para gerar os arquivos.");
}
