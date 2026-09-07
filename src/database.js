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
  const [atributos, pericias, classes, racas, origens, escolhasClasse, racasSup, classesSup, origensSup, deusesMenores, conjuracao, habilidadesClasse, poderes, magias, equipamentos, panteao, ameacas, ameacasExtra, golemChassis, golemPoderesFa, golemOrigensFa, origensRegionais, version] =
    await Promise.all([
      carregarJSON("data/core/atributos.json"),
      carregarJSON("data/core/pericias.json"),
      carregarJSON("data/core/classes.json"),
      carregarJSON("data/core/racas.json"),
      carregarJSON("data/core/origens.json"),
      // Escolhas que a classe OBRIGA a fazer num nível (Caminho do Arcanista,
      // Caminho do Cavaleiro). As opções não estão no arquivo: ele só aponta
      // pra família de poderes do compêndio, então continuam certas depois de
      // uma sincronização. Ver data/core/README-escolhas-classe.md.
      carregarJSON("data/core/escolhas-classe.json").catch(() => []),
      // Conteúdo dos suplementos (Heróis de Arton, Ameaças de Arton, Deuses de
      // Arton), gerado por sync-suplementos.mjs. Fica em arquivos separados dos
      // do livro básico e cada registro carrega `suplemento: true`, então dá
      // pra jogar só com o básico desligando o filtro na aba Construção.
      carregarJSON("data/core/racas-suplementos.json").catch(() => []),
      carregarJSON("data/core/classes-suplementos.json").catch(() => []),
      carregarJSON("data/core/origens-suplementos.json").catch(() => []),
      carregarJSON("data/raw/deuses-menores.json").catch(() => []),
      // Tabelas de progressão por nível (sync-tabelas.mjs): quantas magias
      // cada classe conhece e quais habilidades ela ganha em cada nível.
      carregarJSON("data/core/conjuracao.json").catch(() => []),
      carregarJSON("data/core/habilidades-classe.json").catch(() => []),
      carregarJSON("data/raw/poderes.json"),
      carregarJSON("data/raw/magias.json"),
      carregarJSON("data/raw/equipamentos.json"),
      carregarJSON("data/raw/panteao.json"),
      carregarJSON("data/raw/ameacas.json"),
      // Bestiário extra "Coleção Arton" (1850 ameaças de aventuras/suplementos
      // oficiais, curado à mão — não vem do sync-data.mjs, então sobrevive a
      // uma resincronização do compêndio).
      carregarJSON("data/raw/ameacas-extra.json").catch(() => []),
      // Conteúdo de FÃ (não-oficial) do "Manual do Golem T20 (BETA 6)": chassis,
      // poderes e origens extras para a raça golem. Fica em arquivos e chaves
      // separados dos dados oficiais — nunca é misturado a `poderes`/`origens`.
      carregarJSON("data/raw/golem-chassis.json").catch(() => []),
      carregarJSON("data/raw/golem-poderes-fa.json").catch(() => []),
      carregarJSON("data/raw/golem-origens-fa.json").catch(() => []),
      // Origens regionais do "Atlas de Arton" (66 origens ligadas a um reino ou
      // região específica de Arton) — curadas à mão a partir do livro. Ficam em
      // arquivo e chave separados de `origens` porque, ao contrário das origens
      // comuns, só fazem sentido para quem é nativo (ou cresceu em) daquele lugar.
      carregarJSON("data/raw/origens-regionais.json").catch(() => []),
      carregarJSON("data/version.json").catch(() => null),
    ]);
  cache = { atributos, pericias,
    // As listas já chegam unidas: quem quiser só o básico filtra por `suplemento`.
    classes: [...classes, ...classesSup],
    racas: [...racas, ...racasSup],
    origens: [...origens, ...origensSup],
    escolhasClasse, deusesMenores, conjuracao, habilidadesClasse, poderes, magias, equipamentos, panteao, ameacas: [...ameacas, ...ameacasExtra], golemChassis, golemPoderesFa, golemOrigensFa, origensRegionais, version };
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

// O compêndio traz o subtipo do poder de origem com o nome da origem, mas
// alguns vêm com espaço faltando ("Assistentede Laboratório") — por isso a
// comparação ignora espaços além de acentos e caixa.
function semEspacos(txt) { return normalizar(txt).replace(/\s+/g, ""); }

export function poderesDaOrigem(db, origemId) {
  const alvo = semEspacos(origemId);
  if (!alvo) return [];
  return db.poderes.filter((p) => p.categoria === "origem" && semEspacos(p.subtipo) === alvo);
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

// Opções de uma escolha obrigatória de classe: os poderes do compêndio cujo
// nome começa com "<familia>:" (ex.: "Caminho do Arcanista: Mago"). O
// compêndio tem nomes com espaços duplicados em alguns registros, então a
// comparação normaliza os espaços.
export function opcoesDaEscolhaDeClasse(db, familia) {
  const alvo = String(familia || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!alvo) return [];
  return db.poderes
    .filter((p) => {
      const nome = String(p.nome || "").replace(/\s+/g, " ");
      const i = nome.indexOf(":");
      return i > 0 && nome.slice(0, i).trim().toLowerCase() === alvo;
    })
    .map((p) => ({ ...p, rotulo: String(p.nome).replace(/\s+/g, " ").split(":").slice(1).join(":").trim() }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

// As escolhas de classe que já valem no nível atual do personagem.
export function escolhasDeClassePara(db, classeId, nivel) {
  return (db.escolhasClasse || []).filter((e) => e.classe === classeId && (Number(e.nivel) || 1) <= (Number(nivel) || 1));
}

// Tabela de conjuração da classe. O Arcanista tem uma por Caminho (Bruxo,
// Feiticeiro, Mago); sem Caminho escolhido cai na entrada genérica da classe.
export function conjuracaoDaClasse(db, classeId, subtipo) {
  const tabelas = (db.conjuracao || []).filter((c) => c.classe === classeId);
  if (!tabelas.length) return null;
  if (subtipo) {
    const exata = tabelas.find((c) => c.subtipo && c.subtipo.toLowerCase() === String(subtipo).toLowerCase());
    if (exata) return exata;
  }
  return tabelas.find((c) => !c.subtipo) ?? tabelas[0];
}

export function habilidadesDaClasse(db, classeId, nivel) {
  const reg = (db.habilidadesClasse || []).find((h) => h.classe === classeId);
  if (!reg) return [];
  return reg.habilidades.filter((a) => a.nivel <= (Number(nivel) || 1));
}
