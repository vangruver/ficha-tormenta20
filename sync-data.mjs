// Baixa o compendium não-oficial de Tormenta 20 para Foundry VTT (Kull4ck/tormenta20-compendium)
// e normaliza os arquivos NeDB (.db, um JSON por linha) em JSON limpo dentro de data/raw/.
//
// Roda localmente (`node sync-data.mjs`) e todo dia via .github/workflows/sync-data.yml.
//
// Fontes:
//  - packs "base" (poderes, magias, equipamentos, panteão, ameaças): tag 0.7.8, a última versão
//    do módulo que ainda continha esse conteúdo (o repositório depois virou só "conteúdo extra").
//  - packs "extra" (poderes-extra, equipamentos-extra, ameaças extras): branch master atual.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_RAW = "https://raw.githubusercontent.com/Kull4ck/tormenta20-compendium/0.7.8/packs";
const EXTRA_RAW = "https://raw.githubusercontent.com/Kull4ck/tormenta20-compendium/master/packs";
const OUT_DIR = new URL("./data/raw/", import.meta.url).pathname;

const BASE_PACKS = ["poderes", "magias", "equipamentos", "panteao", "ameacas"];
const EXTRA_PACKS = [
  { file: "poderes-extra", tipo: "poder" },
  { file: "equipamentos-extra", tipo: "item" },
  { file: "guia-de-npcs", tipo: "ameaca" },
  { file: "jornada-heroica", tipo: "ameaca" },
  { file: "dragao-brasil", tipo: "misto" },
];

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

// Arquivos .db do Foundry/NeDB: um objeto JSON por linha.
function parseNeDB(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // linha corrompida/truncada — ignora
    }
  }
  return out;
}

// A descrição vem como string simples nos packs antigos (NeDB) e como
// { value, chat, unidentified } (HTML) nos packs mais novos.
function textoDescricao(d) {
  return textoLivre(d?.description);
}

// Vários campos de texto mudam de formato entre versões do módulo:
// string simples, ou { value, chat, unidentified } com HTML.
function textoLivre(valor) {
  if (typeof valor === "string") return valor.trim();
  if (valor && typeof valor === "object") return limparHtml(valor.value ?? "");
  return "";
}

function limparHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&atilde;/g, "ã")
    .replace(/&otilde;/g, "õ").replace(/&ccedil;/g, "ç").replace(/&ecirc;/g, "ê")
    .replace(/&acirc;/g, "â").replace(/&ocirc;/g, "ô").replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

const CATEGORIAS_VALIDAS = new Set(["classe", "racial", "origem", "geral", "concedido"]);

function normalizarPoder(raw, fonte) {
  const d = raw.data ?? {};
  const tipoRaw = (typeof d.tipo === "string" ? d.tipo : "").trim();
  let categoria = "outro";
  let subtipo = tipoRaw;
  if (/^Classe -/.test(tipoRaw)) { categoria = "classe"; subtipo = tipoRaw.replace(/^Classe -\s*/, "").trim(); }
  else if (/^Racial -/.test(tipoRaw)) { categoria = "racial"; subtipo = tipoRaw.replace(/^Racial -\s*/, "").trim(); }
  else if (/^Origem -/.test(tipoRaw)) { categoria = "origem"; subtipo = tipoRaw.replace(/^Origem -\s*/, "").trim(); }
  else if (/^P\.?\s*Geral -/.test(tipoRaw)) { categoria = "geral"; subtipo = tipoRaw.replace(/^P\.?\s*Geral -\s*/, "").trim(); }
  else if (/^P\.?\s*Concedido/.test(tipoRaw)) { categoria = "concedido"; subtipo = "Concedido"; }
  // Packs mais novos (Foundry 0.8+) usam tipo/subtipo já separados em minúsculo.
  else if (CATEGORIAS_VALIDAS.has(tipoRaw.toLowerCase())) {
    categoria = tipoRaw.toLowerCase();
    subtipo = (typeof d.subtipo === "string" ? d.subtipo : "").trim() || tipoRaw;
  }
  return {
    id: raw._id,
    nome: (raw.name ?? "").trim(),
    categoria,
    subtipo,
    tipoOriginal: tipoRaw,
    custo: d.custo ?? null,
    requisito: d.requisito ?? d.preRequisito ?? "",
    descricao: textoDescricao(d),
    fonte,
  };
}

function normalizarMagia(raw, fonte) {
  const d = raw.data ?? {};
  return {
    id: raw._id,
    nome: (raw.name ?? "").trim(),
    tipo: d.tipo ?? "",
    circulo: d.circulo ?? "",
    escola: d.escola ?? "",
    execucao: d.execucao ?? "",
    alcance: d.alcance ?? "",
    duracao: d.duracao ?? "",
    resistencia: d.resistencia ?? "",
    alvo: d.alvo ?? "",
    area: d.area ?? "",
    efeito: d.efeito ?? "",
    custo: d.custo ?? null,
    descricao: textoDescricao(d),
    fonte,
  };
}

// Packs mais novos movem o dado de dano para dentro de data.rolls[] (ex.: {type:"dano", parts:[["1d6",""],["@for",""]]})
// em vez do antigo campo plano data.dano.
function danoDosRolls(rolls) {
  if (!Array.isArray(rolls)) return "";
  const roll = rolls.find((r) => r.type === "dano");
  if (!roll?.parts?.length) return "";
  return roll.parts.map((p) => p[0]).filter(Boolean).join(" + ");
}

function normalizarItem(raw, fonte) {
  const d = raw.data ?? {};
  return {
    id: raw._id,
    nome: (raw.name ?? "").trim(),
    tipoItem: raw.type ?? "item",
    peso: d.peso ?? null,
    qtd: d.qtd ?? null,
    preco: d.preco ?? null,
    dano: (typeof d.dano === "string" && d.dano) || danoDosRolls(d.rolls) || "",
    criticoM: d.criticoM ?? null,
    criticoX: d.criticoX ?? null,
    danoTipo: typeof d.tipo === "string" ? d.tipo : "",
    alcance: d.alcance ?? "",
    municao: d.municao ?? null,
    descricao: textoDescricao(d),
    fonte,
  };
}

function normalizarPanteao(raw, fonte) {
  return {
    id: raw._id,
    nome: (raw.name ?? "").trim(),
    descricao: limparHtml(raw.content ?? ""),
    fonte,
  };
}

function normalizarAmeaca(raw, fonte) {
  const d = raw.data ?? {};
  const a = d.attributes ?? {};
  const atr = d.atributos ?? {};
  const atributos = {};
  for (const k of ["for", "des", "con", "int", "sab", "car"]) {
    atributos[k] = atr[k]?.value ?? null;
  }
  const pericias = {};
  for (const [k, v] of Object.entries(d.pericias ?? {})) {
    if (v?.value) pericias[k] = { label: v.label, valor: v.value };
  }
  return {
    id: raw._id,
    nome: (raw.name ?? "").trim(),
    nd: a.nd ?? "",
    tamanho: a.tamanho ?? "",
    tipo: a.raca ?? "",
    pv: a.pv?.value ?? null,
    defesa: d.defesa?.value ?? null,
    deslocamento: d.deslocamento ?? "",
    resistencias: d.resistencias ?? "",
    sentidos: d.sentidos ?? "",
    atributos,
    pericias,
    equipamento: textoLivre(d.equipament),
    descricao: textoLivre(a.info),
    fonte,
  };
}

async function baixarPack(baseUrl, nome) {
  const text = await fetchText(`${baseUrl}/${nome}.db`);
  return parseNeDB(text);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const poderes = [];
  const magias = [];
  const equipamentos = [];
  const panteao = [];
  const ameacas = [];

  console.log("Baixando packs base (v0.7.8)...");
  for (const nome of BASE_PACKS) {
    const registros = await baixarPack(BASE_RAW, nome);
    console.log(`  ${nome}.db: ${registros.length} registros`);
    const fonte = "Tormenta20 Compendium";
    for (const raw of registros) {
      if (nome === "poderes") poderes.push(normalizarPoder(raw, fonte));
      else if (nome === "magias") magias.push(normalizarMagia(raw, fonte));
      else if (nome === "equipamentos") equipamentos.push(normalizarItem(raw, fonte));
      else if (nome === "panteao") panteao.push(normalizarPanteao(raw, fonte));
      else if (nome === "ameacas") ameacas.push(normalizarAmeaca(raw, fonte));
    }
  }

  console.log("Baixando packs extra (master)...");
  for (const { file, tipo } of EXTRA_PACKS) {
    let registros;
    try {
      registros = await baixarPack(EXTRA_RAW, file);
    } catch (err) {
      console.warn(`  aviso: falhou ${file}.db (${err.message}) — pulando`);
      continue;
    }
    console.log(`  ${file}.db: ${registros.length} registros`);
    const fonte = `Compendium Extra T20 (${file})`;
    for (const raw of registros) {
      const t = raw.type ?? tipo;
      if (t === "poder") poderes.push(normalizarPoder(raw, fonte));
      else if (t === "magia") magias.push(normalizarMagia(raw, fonte));
      else if (t === "npc") ameacas.push(normalizarAmeaca(raw, fonte));
      else if (["arma", "tesouro", "consumivel", "item"].includes(t)) equipamentos.push(normalizarItem(raw, fonte));
    }
  }

  await writeFile(path.join(OUT_DIR, "poderes.json"), JSON.stringify(poderes, null, 1));
  await writeFile(path.join(OUT_DIR, "magias.json"), JSON.stringify(magias, null, 1));
  await writeFile(path.join(OUT_DIR, "equipamentos.json"), JSON.stringify(equipamentos, null, 1));
  await writeFile(path.join(OUT_DIR, "panteao.json"), JSON.stringify(panteao, null, 1));
  await writeFile(path.join(OUT_DIR, "ameacas.json"), JSON.stringify(ameacas, null, 1));

  const version = {
    syncedAt: new Date().toISOString(),
    counts: {
      poderes: poderes.length,
      magias: magias.length,
      equipamentos: equipamentos.length,
      panteao: panteao.length,
      ameacas: ameacas.length,
    },
    fontes: [
      "https://github.com/Kull4ck/tormenta20-compendium (tag 0.7.8 + master)",
    ],
  };
  await writeFile(new URL("./data/version.json", import.meta.url).pathname, JSON.stringify(version, null, 1));

  console.log("OK:", version.counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
