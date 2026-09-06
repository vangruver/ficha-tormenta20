// Teste rápido da camada de dados: gera data/raw/*.json (se preciso) e confere valores conhecidos.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

function assert(cond, msg) {
  if (!cond) throw new Error("FALHOU: " + msg);
  console.log("OK:", msg);
}

async function lerJSON(caminho) {
  return JSON.parse(await readFile(new URL(`../${caminho}`, import.meta.url), "utf-8"));
}

async function main() {
  if (!existsSync(new URL("../data/raw/poderes.json", import.meta.url))) {
    console.log("data/raw ainda não existe — rode `node sync-data.mjs` primeiro.");
    process.exit(1);
  }

  const poderes = await lerJSON("data/raw/poderes.json");
  const magias = await lerJSON("data/raw/magias.json");
  const equipamentos = await lerJSON("data/raw/equipamentos.json");
  const ameacas = await lerJSON("data/raw/ameacas.json");
  const panteao = await lerJSON("data/raw/panteao.json");
  const classes = await lerJSON("data/core/classes.json");
  const racas = await lerJSON("data/core/racas.json");
  const pericias = await lerJSON("data/core/pericias.json");

  assert(poderes.length > 500, `poderes.json tem registros suficientes (${poderes.length})`);
  assert(magias.length > 100, `magias.json tem registros suficientes (${magias.length})`);
  assert(equipamentos.length > 50, `equipamentos.json tem registros suficientes (${equipamentos.length})`);
  assert(ameacas.length > 50, `ameacas.json tem registros suficientes (${ameacas.length})`);
  assert(panteao.length > 5, `panteao.json tem registros suficientes (${panteao.length})`);

  assert(classes.length === 14, `classes.json tem as 14 classes (${classes.length})`);
  assert(racas.length >= 14, `racas.json tem pelo menos 14 raças (${racas.length})`);
  assert(pericias.length === 29, `pericias.json tem as 29 perícias/resistências (${pericias.length})`);

  const guerreiro = classes.find((c) => c.id === "guerreiro");
  assert(guerreiro && guerreiro.pvInicial === 20, "Guerreiro tem 20 PV inicial (antes de Constituição)");

  // ---- automação: dados que o painel da aba Construção consome ----
  const idsPericias = new Set(pericias.map((p) => p.id));
  for (const c of classes) {
    assert(Array.isArray(c.periciasFixas), `${c.nome} declara periciasFixas`);
    assert(Array.isArray(c.periciasFixasEscolha), `${c.nome} declara periciasFixasEscolha`);
    const usadas = [...c.periciasFixas, ...c.periciasFixasEscolha.flat()];
    assert(usadas.every((id) => idsPericias.has(id)), `${c.nome}: perícias fixas existem em pericias.json`);
    assert(usadas.every((id) => c.periciasDeClasse.includes(id)), `${c.nome}: perícias fixas estão na lista de classe`);
    assert(c.pmInicial === c.pmPorNivel, `${c.nome}: PM do 1º nível é igual ao PM por nível (regra de T20)`);
    assert(c.pmAtributo === undefined, `${c.nome}: PM não depende de atributo em T20`);
  }
  assert(classes.find((c) => c.id === "ladino").treinosIniciais === 8, "Ladino escolhe 8 perícias além das fixas");
  assert(classes.find((c) => c.id === "cacador").pmPorNivel === 4, "Caçador tem 4 PM por nível");

  for (const r of racas) {
    assert(r.auto && typeof r.auto === "object", `${r.nome} tem bloco de automação`);
    const bonus = { ...(r.auto.bonusPericias || {}), ...Object.assign({}, ...(r.auto.legados || []).map((l) => l.bonusPericias || {})) };
    assert(Object.keys(bonus).every((id) => idsPericias.has(id)), `${r.nome}: bônus raciais apontam para perícias existentes`);
  }
  const humano = racas.find((r) => r.id === "humano");
  assert(humano.auto.atributosEscolha?.quantidade === 3, "Humano escolhe 3 atributos");
  assert(humano.auto.treinosEscolha === 2, "Humano treina 2 perícias à escolha");

  // ---- fórmulas ----
  const regras = await import("../src/rules.js");
  assert(regras.mod(2) === 2, "em T20 o valor do atributo já é o modificador");
  assert(regras.bonusPericia({ nivel: 1, treinado: true, modAtributo: 2 }) === 4, "perícia treinada no 1º nível: 0 + 2 + 2");
  assert(regras.bonusPericia({ nivel: 6, treinado: true, modAtributo: 0 }) === 5, "6º nível ainda usa treino +2 (3 + 2)");
  assert(regras.bonusPericia({ nivel: 7, treinado: true, modAtributo: 0 }) === 7, "treino vira +4 no 7º nível (3 + 4)");
  assert(regras.bonusPericia({ nivel: 15, treinado: true, modAtributo: 0 }) === 13, "treino vira +6 no 15º nível (7 + 6)");
  assert(regras.bonusPericia({ nivel: 10, treinado: false, modAtributo: 1 }) === 6, "perícia não treinada soma metade do nível (5 + 1)");
  assert(regras.pmMaximo({ classe: guerreiro, nivel: 5 }) === 15, "PM do guerreiro no 5º nível é 3 por nível, sem atributo");
  assert(regras.poderesDeClassePorNivel(1) === 0 && regras.poderesDeClassePorNivel(7) === 6,
    "poderes de classe: nenhum no 1º nível, um no 2º e um a cada nível seguinte");

  const cota = regras.escolhasDePericiaDaClasse({ classe: guerreiro, modInt: 2 });
  assert(cota === 4, "perícias à escolha = número da classe + modificador de Inteligência");

  const malha = equipamentos.find((e) => e.nome === "Cota de malha");
  const lida = regras.lerArmadura(malha);
  assert(lida && lida.defesa === 6 && lida.penalidade === 2, "cota de malha lida do compêndio: +6 Defesa, −2 de penalidade");
  assert(regras.lerArmadura({ nome: "Escudo pesado", descricao: "" }).defesa === 2, "escudo pesado dá +2 de Defesa");
  assert(regras.lerArmadura({ nome: "Espada longa", descricao: "Arma Marcial" }) === null, "arma comum não é armadura");

  // ---- origens ----
  const origens = await lerJSON("data/core/origens.json");
  const poderesDeOrigem = new Set(poderes.filter((p) => p.categoria === "origem").map((p) => p.subtipo));
  const semPoder = origens.filter((o) => o.periciasSugeridas?.length && !poderesDeOrigem.has(o.id));
  assert(semPoder.length <= 1, `quase toda origem tem poder correspondente no compêndio (sem: ${semPoder.map((o) => o.id).join(", ") || "nenhuma"})`);

  const poderClasseLadino = poderes.filter((p) => p.categoria === "classe" && p.subtipo === "Ladino");
  assert(poderClasseLadino.length > 10, `Ladino tem poderes de classe suficientes (${poderClasseLadino.length})`);

  const magiaCirculo1 = magias.filter((m) => String(m.circulo) === "1");
  assert(magiaCirculo1.length > 5, `existem magias de 1º círculo (${magiaCirculo1.length})`);

  console.log("\nTudo certo!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
