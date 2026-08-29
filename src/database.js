// Carrega e consulta os dados da ficha: regras centrais (data/core) escritas à mão a partir do
// livro básico, e o compêndio de poderes/magias/equipamentos/ameaças/panteão gerado por
// sync-data.mjs a partir do Tormenta20 Compendium (Foundry VTT) em data/raw.

const BASE = new URL(".", document.baseURI).pathname.replace(/\/$/, "");

async function carregarJSON(caminho) {
  const res = await fetch(`${BASE}/${caminho}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Falha ao carregar ${caminho}: ${res.status}`);
  return res.json();
}

let cache = null;

export async function carregarBanco() {
  if (cache) return cache;
  const [atributos, pericias, classes, racas, origens, poderes, magias, equipamentos, panteao, ameacas, version] =
    await Promise.all([
      carregarJSON("data/core/atributos.json"),
      carregarJSON("data/core/pericias.json"),
      carregarJSON("data/core/classes.json"),
      carregarJSON("data/core/racas.json"),
      carregarJSON("data/core/origens.json"),
      carregarJSON("data/raw/poderes.json"),
      carregarJSON("data/raw/magias.json"),
      carregarJSON("data/raw/equipamentos.json"),
      carregarJSON("data/raw/panteao.json"),
      carregarJSON("data/raw/ameacas.json"),
      carregarJSON("data/version.json").catch(() => null),
    ]);
  cache = { atributos, pericias, classes, racas, origens, poderes, magias, equipamentos, panteao, ameacas, version };
  return cache;
}

export function porId(lista, id) {
  return lista.find((x) => x.id === id) ?? null;
}

function normalizar(txt) {
  return (txt ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function poderesDe(db, { categoria, subtipo, busca } = {}) {
  return db.poderes.filter((p) => {
    if (categoria && p.categoria !== categoria) return false;
    if (subtipo && normalizar(p.subtipo) !== normalizar(subtipo)) return false;
    if (busca && !normalizar(p.nome).includes(normalizar(busca)) && !normalizar(p.descricao).includes(normalizar(busca))) return false;
    return true;
  });
}

export function poderesDaClasse(db, classeId) {
  const classe = porId(db.classes, classeId);
  if (!classe) return [];
  return poderesDe(db, { categoria: "classe", subtipo: classe.nome });
}

export function poderesDaRaca(db, racaId) {
  const raca = porId(db.racas, racaId);
  if (!raca) return [];
  return poderesDe(db, { categoria: "racial", subtipo: raca.nome.split(" ")[0] });
}

export function poderesDaOrigem(db, origemId) {
  return poderesDe(db, { categoria: "origem", subtipo: origemId });
}

export function poderesGerais(db, subtipo) {
  return poderesDe(db, { categoria: "geral", subtipo });
}

export function magiasFiltradas(db, { tipo, circulo, escola, busca } = {}) {
  return db.magias.filter((m) => {
    if (tipo && m.tipo !== tipo) return false;
    if (circulo && String(m.circulo) !== String(circulo)) return false;
    if (escola && normalizar(m.escola) !== normalizar(escola)) return false;
    if (busca && !normalizar(m.nome).includes(normalizar(busca)) && !normalizar(m.descricao).includes(normalizar(busca))) return false;
    return true;
  });
}

export function equipamentosFiltrados(db, { tipoItem, busca } = {}) {
  return db.equipamentos.filter((e) => {
    if (tipoItem && e.tipoItem !== tipoItem) return false;
    if (busca && !normalizar(e.nome).includes(normalizar(busca)) && !normalizar(e.descricao).includes(normalizar(busca))) return false;
    return true;
  });
}

export function ameacasFiltradas(db, { busca, nd } = {}) {
  return db.ameacas.filter((a) => {
    if (nd && String(a.nd) !== String(nd)) return false;
    if (busca && !normalizar(a.nome).includes(normalizar(busca)) && !normalizar(a.tipo).includes(normalizar(busca))) return false;
    return true;
  });
}

export function panteaoFiltrado(db, { busca } = {}) {
  return db.panteao.filter((p) => {
    if (busca && !normalizar(p.nome).includes(normalizar(busca)) && !normalizar(p.descricao).includes(normalizar(busca))) return false;
    return true;
  });
}
