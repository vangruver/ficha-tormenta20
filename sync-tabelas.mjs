// ============================================================
// Gera as tabelas de progressão por nível: quantas magias cada classe
// conjuradora conhece e quais habilidades ela ganha em cada nível.
//
// POR QUE ISTO É UMA TABELA E NÃO UMA CÓPIA DE CÓDIGO
// ---------------------------------------------------
// No Fichas de Nimb essas duas coisas não estão em tabela: estão em funções
// (`qtySpellsLearnAtLevel(nivel)`, `spellCircleAvailableAtLevel(nivel)`), e
// algumas classes só montam o caminho de magia dentro de um `setup()`.
//
// Reimplementar essas funções aqui seria copiar o código dele. O que este
// script faz é diferente: ele **chama** cada função para os níveis 1 a 20 e
// anota o resultado. São funções puras do nível, então o que sai é a tabela
// de progressão do livro — "no 5º nível o conjurador alcança o 2º círculo" —
// que é fato de regra da Jambô, não invenção de nenhum dos dois projetos.
// A lógica não vem junto; vem só o número que ela produz.
//
// As habilidades de classe entram só como NOME e NÍVEL. O texto de cada uma
// é a prosa do livro e fica de fora, como no resto de data/core.
//
// COMO RODAR
//   git clone --depth 1 https://github.com/YuriAlessandro/gerador-ficha-tormenta20 /tmp/nimb
//   npm i esbuild lodash uuid
//   node sync-tabelas.mjs /tmp/nimb --write
// ============================================================
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ_NIMB = process.argv[2] || process.env.NIMB_PATH || "/tmp/nimb";
const APLICAR = process.argv.includes("--write");
const CORE = path.join(import.meta.dirname, "data/core");
const NIVEIS = Array.from({ length: 20 }, (_, i) => i + 1);

if (!fs.existsSync(path.join(RAIZ_NIMB, "src/data/systems/tormenta20"))) {
  console.error(`Checkout do Fichas de Nimb não encontrado em ${RAIZ_NIMB}. Veja o cabeçalho deste arquivo.`);
  process.exit(1);
}

const esbuild = require("esbuild");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t20-tab-"));

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

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ATRIBUTOS = { forca: "for", destreza: "des", constituicao: "con", inteligencia: "int", sabedoria: "sab", carisma: "car" };
const idDe = (n) => semAcento(n).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Tabela de um caminho de magia: para cada nível, quantas magias novas e até
// que círculo. `conhecidasAcumuladas` é a soma corrida — é o número que a
// ficha realmente precisa mostrar ("você conhece N magias no nível X").
function tabelaDeMagias(caminho) {
  let acumulado = Number(caminho.initialSpells) || 0;
  const linhas = [];
  for (const nivel of NIVEIS) {
    // No 1º nível valem as magias iniciais; dos outros, o que a função der.
    const novas = nivel === 1 ? 0 : (Number(caminho.qtySpellsLearnAtLevel?.(nivel)) || 0);
    acumulado += novas;
    linhas.push({
      nivel,
      novas: nivel === 1 ? caminho.initialSpells : novas,
      conhecidas: acumulado,
      circuloMaximo: Number(caminho.spellCircleAvailableAtLevel?.(nivel)) || 1,
    });
  }
  return {
    magiasIniciais: caminho.initialSpells ?? 0,
    tipo: caminho.spellType === "Divine" ? "divina" : "arcana",
    atributoChave: ATRIBUTOS[semAcento(caminho.keyAttribute)] ?? null,
    progressao: linhas,
  };
}

// ---------- execução ----------
const classesMod = await carregar("core/classes/index");
const arcanistaMod = await carregar("classes/arcanista");
const listaClasses = classesMod.default || [];

const conjuracao = [];
const habilidades = [];

for (const classe of listaClasses) {
  const id = idDe(classe.name);

  // Habilidades de classe: nome e nível, nada de texto.
  const porNivel = (classe.abilities || [])
    .filter((a) => a?.name)
    .map((a) => ({ nivel: Number(a.nivel) || 1, nome: a.name }))
    .sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, "pt-BR"));
  if (porNivel.length) habilidades.push({ classe: id, nome: classe.nome ?? classe.name, habilidades: porNivel });

  // Caminho de magia: algumas classes só o montam dentro de setup().
  let comCaminho = classe;
  if (!classe.spellPath && typeof classe.setup === "function") {
    try { comCaminho = classe.setup(classe) ?? classe; } catch { /* setup depende da ficha */ }
  }
  if (comCaminho?.spellPath) {
    conjuracao.push({ classe: id, nome: classe.name, ...tabelaDeMagias(comCaminho.spellPath) });
  }
}

// O Arcanista tem um caminho por Caminho (Bruxo, Feiticeiro, Mago), e é o
// caminho escolhido que decide quantas magias ele aprende.
const caminhosArcanista = arcanistaMod.arcanistaSpellPaths || {};
for (const [subtipo, caminho] of Object.entries(caminhosArcanista)) {
  conjuracao.push({ classe: "arcanista", nome: `Arcanista (${subtipo})`, subtipo, ...tabelaDeMagias(caminho) });
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`classes com tabela de magias: ${conjuracao.length}`);
for (const c of conjuracao) {
  const n5 = c.progressao.find((l) => l.nivel === 5), n20 = c.progressao.at(-1);
  console.log(`  ${c.nome.padEnd(24)} ${String(c.magiasIniciais).padStart(2)} iniciais · nv5: ${n5.conhecidas} magias, ${n5.circuloMaximo}º círc · nv20: ${n20.conhecidas} magias, ${n20.circuloMaximo}º círc`);
}
console.log(`\nclasses com habilidades tabeladas: ${habilidades.length} (${habilidades.reduce((n, h) => n + h.habilidades.length, 0)} habilidades)`);

if (APLICAR) {
  const grava = (n, d) => fs.writeFileSync(path.join(CORE, n), `${JSON.stringify(d, null, 2)}\n`);
  grava("conjuracao.json", conjuracao);
  grava("habilidades-classe.json", habilidades);
  console.log("\nEscrito em data/core/. Confira o diff antes de commitar.");
} else {
  console.log("\nNada foi escrito. Rode com --write para gerar os arquivos.");
}
