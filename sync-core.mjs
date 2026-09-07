// ============================================================
// Enriquece data/core/*.json conferindo contra o Fichas de Nimb.
//
// POR QUE ISTO EXISTE
// -------------------
// Os arquivos de data/core (raças, classes, origens) foram digitados à mão a
// partir do livro básico de Tormenta 20, porque — ao contrário do 5etools pro
// D&D — não existe uma base aberta e "viva" do sistema. Digitação à mão erra,
// e várias colunas simplesmente faltavam: proficiências de armadura e arma por
// classe, prioridade de atributos, e a lista oficial de perícias e itens de
// cada origem (que aqui eram um "palpite temático" assumido no README).
//
// O Fichas de Nimb (https://github.com/YuriAlessandro/gerador-ficha-tormenta20,
// de Yuri Alessandro Martins, código sob licença MIT) é outro projeto de fã de
// T20 que mantém esses dados organizados. Este script lê o checkout dele e
// usa os NÚMEROS E LISTAS de regra — que são fatos do livro da Jambô, não
// criação de nenhum dos dois projetos — para:
//
//   1. conferir o que já temos e apontar divergência (o script NUNCA
//      sobrescreve um valor nosso em silêncio: ele reporta e você decide);
//   2. preencher os campos que faltavam, na NOSSA estrutura de dados.
//
// O que ele deliberadamente NÃO faz: copiar o texto descritivo das
// habilidades. As descrições que entram aqui são resumos mecânicos curtos
// escritos para esta ficha, no mesmo estilo do resto de data/core.
//
// COMO RODAR
// ----------
//   git clone --depth 1 https://github.com/YuriAlessandro/gerador-ficha-tormenta20 /tmp/nimb
//   npm i esbuild lodash uuid            # dependências só do script
//   node sync-core.mjs /tmp/nimb         # confere e reporta
//   node sync-core.mjs /tmp/nimb --write # aplica os campos que faltam
//
// Sem o checkout do Nimb o script apenas avisa e sai — a ficha não depende
// dele para rodar; data/core já vem pronto no repositório.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ_NIMB = process.argv[2] || process.env.NIMB_PATH || "/tmp/nimb";
const APLICAR = process.argv.includes("--write");
const CORE = path.join(import.meta.dirname, "data/core");

if (!fs.existsSync(path.join(RAIZ_NIMB, "src/data/systems/tormenta20"))) {
  console.error(`Checkout do Fichas de Nimb não encontrado em ${RAIZ_NIMB}.`);
  console.error("Veja o cabeçalho deste arquivo para as instruções.");
  process.exit(1);
}

// ---------- carregar os módulos de dados do Nimb ----------
// Eles são TypeScript e têm ciclos de import (o índice de suplementos monta um
// registro a partir de tudo). Transpilamos com esbuild e neutralizamos os
// acessos que rodam antes da inicialização terminar — só queremos ler dados.
const esbuild = require("esbuild");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t20-core-"));

async function carregar(modulo) {
  const saida = path.join(tmp, `${modulo.replace(/\W/g, "_")}.cjs`);
  await esbuild.build({
    entryPoints: [path.join(RAIZ_NIMB, "src/data/systems/tormenta20", `${modulo}.ts`)],
    bundle: true, format: "cjs", platform: "node", outfile: saida, logLevel: "error",
    alias: { "@": path.join(RAIZ_NIMB, "src") },
    // O checkout do Nimb não tem node_modules; as poucas dependências que os
    // arquivos de dados usam (uuid, lodash) são resolvidas nas nossas.
    nodePaths: [path.join(import.meta.dirname, "node_modules")],
    plugins: [{
      name: "stub-premium",
      setup(b) {
        // src/premium/ não é publicado no repositório aberto.
        b.onResolve({ filter: /premium\// }, (a) => ({ path: a.path, namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "module.exports = new Proxy({}, { get: () => () => undefined });", loader: "js",
        }));
      },
    }],
  });
  let src = fs.readFileSync(saida, "utf8")
    .replace(/Object\.values\((\w+_default)\)/g, "Object.values($1 || {})")
    .replace(/Object\.keys\((\w+_default)\)/g, "Object.keys($1 || {})");
  fs.writeFileSync(saida, src);
  return require(saida);
}

// ---------- utilidades ----------
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const lerJSON = (f) => JSON.parse(fs.readFileSync(path.join(CORE, f), "utf8"));
const gravarJSON = (f, d) => fs.writeFileSync(path.join(CORE, f), `${JSON.stringify(d, null, 2)}\n`);

const divergencias = [];
const preenchidos = [];
function conferir(onde, campo, nosso, deles) {
  if (deles === undefined || deles === null) return;
  const a = JSON.stringify(nosso), b = JSON.stringify(deles);
  if (nosso === undefined) preenchidos.push(`${onde}: ${campo} = ${b}`);
  else if (a !== b) divergencias.push(`${onde}: ${campo} — nosso ${a}, Nimb ${b}`);
}

// Nomes de perícia do Nimb ("Luta") para os ids desta ficha ("lut").
function mapaDePericias() {
  const pericias = lerJSON("pericias.json");
  const mapa = new Map();
  for (const p of pericias) mapa.set(semAcento(p.nome), p.id);
  // O Nimb desdobra Ofício em "Ofício (qualquer)" e variantes; todas caem no
  // nosso "ofi", que carrega a especialidade num campo à parte.
  return (nome) => {
    const k = semAcento(nome).replace(/\s*\(.*\)$/, "");
    return mapa.get(k) ?? null;
  };
}

// ---------- classes ----------
async function classes(paraId) {
  const deles = (await carregar("core/classes/index")).default;
  const nossas = lerJSON("classes.json");
  const porNome = new Map(nossas.map((c) => [semAcento(c.nome), c]));

  for (const c of deles) {
    const nossa = porNome.get(semAcento(c.name));
    if (!nossa) { divergencias.push(`classe ${c.name}: existe no Nimb e não aqui`); continue; }
    const onde = `classe ${c.nome ?? c.name}`;

    conferir(onde, "pvInicial", nossa.pvInicial, c.pv);
    conferir(onde, "pvPorNivel", nossa.pvPorNivel, c.addpv);
    conferir(onde, "pmInicial", nossa.pmInicial, c.pm);
    conferir(onde, "pmPorNivel", nossa.pmPorNivel, c.addpm);
    conferir(onde, "treinosIniciais", nossa.treinosIniciais, c.periciasrestantes?.qtd);

    // Campos que faltavam por aqui.
    const prof = (c.proficiencias || []).slice().sort();
    if (prof.length) {
      if (!nossa.proficiencias) preenchidos.push(`${onde}: proficiencias = ${prof.join(", ")}`);
      if (APLICAR) nossa.proficiencias = prof;
    }
    const prioridade = (c.attrPriority || []).map((a) => paraAtributo(a)).filter(Boolean);
    if (prioridade.length) {
      if (!nossa.atributosPrioritarios) preenchidos.push(`${onde}: atributosPrioritarios = ${prioridade.join(", ")}`);
      if (APLICAR) nossa.atributosPrioritarios = prioridade;
    }
    // Lista de perícias da classe. Os dois projetos guardam isso diferente: o
    // Nimb separa as fixas (`periciasbasicas`) das que ficam à escolha
    // (`periciasrestantes.list`), e aqui `periciasDeClasse` é o conjunto
    // inteiro. Então a comparação junta os dois lados antes de comparar.
    const fixasDeles = (c.periciasbasicas || []).flatMap((g) => (Array.isArray(g) ? g : g.list || []));
    const lista = [...new Set([...fixasDeles, ...(c.periciasrestantes?.list || [])].map(paraId).filter(Boolean))].sort();
    const nossaLista = [...new Set(nossa.periciasDeClasse || [])].sort();
    const faltam = lista.filter((x) => !nossaLista.includes(x));
    const sobram = nossaLista.filter((x) => !lista.includes(x));
    if (faltam.length) {
      divergencias.push(`${onde}: perícias de classe que faltam aqui — ${faltam.join(", ")}`);
      if (APLICAR) nossa.periciasDeClasse = [...new Set([...(nossa.periciasDeClasse || []), ...faltam])].sort();
    }
    if (sobram.length) divergencias.push(`${onde}: perícias que só nós listamos — ${sobram.join(", ")} (confira no livro)`);
  }
  if (APLICAR) gravarJSON("classes.json", nossas);
}

const ATRIBUTOS = { forca: "for", destreza: "des", constituicao: "con", inteligencia: "int", sabedoria: "sab", carisma: "car" };
const paraAtributo = (nome) => ATRIBUTOS[semAcento(nome)] ?? null;

// ---------- raças ----------
async function racas() {
  const deles = (await carregar("core/races/index")).default;
  const nossas = lerJSON("racas.json");
  const porNome = new Map(nossas.map((r) => [semAcento(r.nome), r]));
  // O Nimb separa Suraggel em Aggelus e Sulfure (nós tratamos como legados de
  // uma raça só) e nomeia algumas raças de outro jeito.
  const APELIDOS = { "suraggel (aggelus)": "suraggel", "suraggel (sulfure)": "suraggel", sereia: "sereia/tritao", hynne: "hynne (hobbit)" };

  for (const r of deles) {
    const chave = semAcento(r.name);
    const nossa = porNome.get(chave) ?? porNome.get(APELIDOS[chave] ?? "");
    if (!nossa) { divergencias.push(`raça ${r.name}: existe no Nimb e não aqui`); continue; }
    const onde = `raça ${nossa.nome}`;

    // Bônus de atributo: "any" é escolha livre, os demais são fixos.
    const fixos = {}; let escolhas = 0;
    for (const a of r.attributes?.attrs || []) {
      if (a.attr === "any") escolhas += 1;
      else { const id = paraAtributo(a.attr); if (id) fixos[id] = (fixos[id] || 0) + a.mod; }
    }
    // Só compara quando a nossa raça declara atributos fixos. Raça com legado
    // (Suraggel: Aggelus ou Sulfure) guarda um bloco por legado, enquanto o
    // Nimb trata cada legado como uma raça — aí a comparação direta não vale.
    const temLegado = !!nossa.auto?.legados?.length;
    if (nossa.atributos && !temLegado && !Object.keys(nossa.atributos).some((k) => k.startsWith("escolha"))) {
      const nossoFixo = Object.fromEntries(Object.entries(nossa.atributos).filter(([, v]) => v));
      conferir(onde, "atributos", nossoFixo, fixos);
    }
    if (escolhas && nossa.auto?.atributosEscolha) {
      conferir(onde, "atributos à escolha", nossa.auto.atributosEscolha.quantidade, escolhas);
    }

    let desloc = null;
    try { desloc = r.getDisplacement?.(r); } catch { /* depende de estado de ficha */ }
    if (typeof desloc === "number") conferir(onde, "deslocamento", nossa.deslocamento, `${desloc}m`);

    // Nomes dos traços — só os nomes, para conferir se falta algum na nossa
    // descrição. O texto de cada traço continua sendo o nosso resumo.
    const nomes = (r.abilities || []).map((a) => a.name).filter(Boolean);
    const faltando = nomes.filter((n) => !semAcento(nossa.traços ?? "").includes(semAcento(n)));
    if (faltando.length) divergencias.push(`${onde}: traços não citados no nosso texto — ${faltando.join(", ")}`);
  }
}

// ---------- origens ----------
async function origens(paraId) {
  const mod = await carregar("origins");
  const deles = mod.ORIGINS ?? mod.default;
  const nossas = lerJSON("origens.json");
  const porNome = new Map(nossas.map((o) => [semAcento(o.id), o]));

  for (const [nome, o] of Object.entries(deles)) {
    const nossa = porNome.get(semAcento(nome));
    if (!nossa) { divergencias.push(`origem ${nome}: existe no Nimb e não aqui`); continue; }
    const onde = `origem ${nome}`;

    const lista = (o.pericias || []).map(paraId).filter(Boolean).sort();
    const nossaLista = (nossa.periciasSugeridas || []).slice().sort();
    if (lista.length && JSON.stringify(lista) !== JSON.stringify(nossaLista)) {
      divergencias.push(`${onde}: perícias — nosso [${nossaLista}], Nimb [${lista}]`);
      if (APLICAR) nossa.periciasSugeridas = lista;
    }

    // Itens iniciais: o livro dá equipamento por origem, e a ficha não tinha
    // isso em lugar nenhum.
    let itens = [];
    try { itens = (o.getItems?.() || []).map((i) => i.equipment).filter((x) => typeof x === "string"); } catch { /* alguns dependem da ficha */ }
    if (itens.length && !nossa.itensIniciais) {
      preenchidos.push(`${onde}: itensIniciais = ${itens.length} item(ns)`);
      if (APLICAR) nossa.itensIniciais = itens;
    }
  }
  if (APLICAR) gravarJSON("origens.json", nossas);
}

// ---------- execução ----------
const paraId = mapaDePericias();
await classes(paraId);
await racas();
await origens(paraId);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n=== Campos preenchidos (${preenchidos.length}) ===`);
for (const p of preenchidos) console.log("  +", p);
console.log(`\n=== Divergências para conferir no livro (${divergencias.length}) ===`);
for (const d of divergencias) console.log("  !", d);
console.log(APLICAR
  ? "\nEscrito em data/core/. Confira o diff antes de commitar."
  : "\nNada foi escrito. Rode com --write para aplicar os campos preenchidos.");
