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
