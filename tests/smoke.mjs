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

  // ---- geração de atributos ----
  assert(regras.ARRANJOS_PADRAO.every((a) => a.valores.length === 6),
    "todo arranjo padrão distribui os seis atributos");
  assert(regras.ARRANJOS_PADRAO.every((a) => regras.custoTotalAtributos(
    Object.fromEntries(a.valores.map((v, i) => [i, v])))  <= regras.PONTOS_ATRIBUTOS),
    "nenhum arranjo padrão estoura os 10 pontos de compra");
  const piscina = regras.rolarPiscinaDeAtributos();
  assert(piscina.length === 6, "a rolagem de atributos devolve seis valores");
  assert(piscina.every((r) => r.dados.length === 4 && r.usados.length === 3 && r.usados.reduce((a, b) => a + b, 0) === r.totalD20),
    "4d6 descartando o menor: quatro dados rolados, três somados");
  assert(piscina.every((r) => r.totalD20 >= 3 && r.totalD20 <= 18 && r.valorT20 === Math.floor((r.totalD20 - 10) / 2)),
    "o total do d20 vira modificador de T20 por (valor − 10) ÷ 2");
  assert(regras.custoDoAtributo(-1) === -1 && regras.custoDoAtributo(4) === 7,
    "tabela de compra: −1 devolve 1 ponto e +4 custa 7");

  // ---- escolhas sem alternativa ----
  // O painel de automação não deve pedir escolha quando a lista de opções
  // tem exatamente o tamanho da cota (ver normalizarEscolhas em src/app.js).
  const semEscolha = classes.filter((c) => {
    const fixas = new Set([...(c.periciasFixas || []), ...(c.periciasFixasEscolha || []).flat()]);
    const opcoes = (c.periciasDeClasse || []).filter((id) => !fixas.has(id));
    return opcoes.length <= regras.escolhasDePericiaDaClasse({ classe: c, modInt: 0 });
  });
  assert(Array.isArray(semEscolha), `classes cuja lista de perícias não deixa margem de escolha com Int +0: ${semEscolha.map((c) => c.id).join(", ") || "nenhuma"}`);
  const origensSemEscolha = origens.filter((o) => (o.periciasSugeridas || []).length && (o.periciasSugeridas || []).length <= 2);
  assert(origensSemEscolha.length > 0, `origens que treinam a lista inteira, sem escolha (${origensSemEscolha.length})`);

  // ---- magia: círculo por nível e custo em PM ----
  assert([1, 4].every((n) => regras.circuloMaximo(n) === 1) && regras.circuloMaximo(5) === 2
    && regras.circuloMaximo(9) === 3 && regras.circuloMaximo(13) === 4 && regras.circuloMaximo(17) === 5
    && regras.circuloMaximo(20) === 5,
    "círculo máximo: 1º no 1º nível e um novo a cada quatro (5º, 9º, 13º, 17º)");
  assert([1, 2, 3, 4, 5].every((c) => regras.nivelDoCirculo(c) === (c - 1) * 4 + 1),
    "nivelDoCirculo é o inverso de circuloMaximo");
  const semCusto = magias.filter((m) => !Number(m.custo));
  assert(semCusto.every((m) => regras.custoDaMagia(m) === regras.CUSTO_POR_CIRCULO[Number(m.circulo)]),
    `magia sem custo no compêndio cai no padrão do círculo (${semCusto.length} caso(s))`);
  assert(magias.filter((m) => Number(m.custo)).every((m) => regras.custoDaMagia(m) === Number(m.custo)),
    "quando o compêndio traz custo, é ele que vale");

  // ---- multiclasse ----
  const arc = classes.find((c) => c.id === "arcanista");
  const soArc = regras.pvMaximo({ classe: arc, nivel: 5, modCon: 1 });
  const mcIgual = regras.pvMaximoMulticlasse({ classes: [{ classe: arc, niveis: 5 }], nivel: 5, modCon: 1 });
  assert(soArc === mcIgual, "multiclasse de uma classe só dá o mesmo PV do cálculo simples");
  const mcMisto = regras.pvMaximoMulticlasse({ classes: [{ classe: arc, niveis: 3 }, { classe: guerreiro, niveis: 2 }], nivel: 5, modCon: 1 });
  const esperado = (arc.pvInicial + 1) + (arc.pvPorNivel + 1) * 2 + (guerreiro.pvPorNivel + 1) * 2;
  assert(mcMisto === esperado, `PV multiclasse soma o por-nível da classe de cada nível (${mcMisto})`);
  const dist = regras.niveisPorClasse([{ classe: arc, niveis: 1 }, { classe: guerreiro, niveis: 9 }], 5);
  assert(dist[0].niveis === 1 && dist.reduce((a, b) => a + b.niveis, 0) === 5,
    "classes extras nunca tomam o último nível da inicial nem estouram o total");

  // ---- escolhas obrigatórias de classe ----
  const escolhasClasse = await lerJSON("data/core/escolhas-classe.json");
  for (const regra of escolhasClasse) {
    assert(classes.some((c) => c.id === regra.classe), `escolha "${regra.id}" aponta para uma classe existente (${regra.classe})`);
    const opcoes = poderes.filter((x) => String(x.nome).replace(/\s+/g, " ").split(":")[0].trim().toLowerCase() === regra.familia.toLowerCase());
    assert(opcoes.length >= 2, `"${regra.nome}" tem opções no compêndio (${opcoes.length})`);
  }
  assert(classes.filter((c) => c.divindadeObrigatoria).length === 2, "Clérigo e Paladino exigem divindade");
  assert(classes.every((c) => Number(c.dinheiroInicial) > 0), "toda classe tem dinheiro inicial");

  // ---- tabelas de progressão ----
  const conj = await lerJSON("data/core/conjuracao.json");
  assert(conj.length >= 4, `existem tabelas de conjuração (${conj.length})`);
  for (const t of conj) {
    assert(t.progressao.length === 20, `${t.nome}: tabela cobre os 20 níveis`);
    assert(t.progressao.every((l, i) => i === 0 || l.conhecidas >= t.progressao[i - 1].conhecidas),
      `${t.nome}: magias conhecidas nunca diminuem ao subir de nível`);
    assert(t.progressao.every((l, i) => i === 0 || l.circuloMaximo >= t.progressao[i - 1].circuloMaximo),
      `${t.nome}: o círculo alcançado nunca regride`);
  }
  const bardo = conj.find((t) => t.classe === "bardo");
  const clerigo = conj.find((t) => t.classe === "clerigo");
  assert(bardo && bardo.progressao.at(-1).circuloMaximo === 4, "Bardo é meio-conjurador: para no 4º círculo");
  assert(clerigo && clerigo.progressao.at(-1).circuloMaximo === 5, "Clérigo é conjurador pleno: chega ao 5º círculo");
  assert(regras.circuloMaximoDaClasse(bardo, 20) === 4 && regras.circuloMaximoDaClasse(null, 20) === 5,
    "a tabela da classe manda; sem tabela vale a fórmula do conjurador pleno");
  assert(regras.magiasConhecidasNoNivel(clerigo, 1) === clerigo.magiasIniciais,
    "no 1º nível o conjurador conhece exatamente as magias iniciais");

  const habs = await lerJSON("data/core/habilidades-classe.json");
  assert(habs.length === classes.length, `todas as ${classes.length} classes do básico têm habilidades tabeladas`);
  assert(habs.every((h) => h.habilidades.every((a) => a.nivel >= 1 && a.nivel <= 20 && a.nome)),
    "toda habilidade tem nome e um nível entre 1 e 20");
  assert(habs.every((h) => h.habilidades.every((a) => !("texto" in a) && !("text" in a))),
    "as habilidades guardam só nome e nível — nenhum texto de livro");

  // ---- suplementos ----
  const racasSup = await lerJSON("data/core/racas-suplementos.json");
  const classesSup = await lerJSON("data/core/classes-suplementos.json");
  const nomesBase = new Set(racas.map((r) => r.nome.toLowerCase()));
  assert(racasSup.length > 20, `raças de suplemento carregadas (${racasSup.length})`);
  assert(racasSup.every((r) => r.suplemento && r.fonte), "toda raça de suplemento declara fonte e marcação");
  assert(!racasSup.some((r) => nomesBase.has(r.nome.toLowerCase())), "nenhuma raça de suplemento duplica uma do básico");
  assert(classesSup.every((c) => c.pvInicial > 0 && c.pmInicial >= 0), "classes de suplemento têm PV/PM");

  console.log("\nTudo certo!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
