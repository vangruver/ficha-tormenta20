// Personagens salvos no localStorage deste navegador — múltiplos slots + um "ativo".
const KEY_LISTA = "t20.personagens";
const KEY_ATIVO = "t20.personagemAtivo";
const KEY_VERSAO_VISTA = "t20.versaoDadosVista";

function lerLista() {
  try {
    const raw = localStorage.getItem(KEY_LISTA);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function salvarLista(lista) {
  localStorage.setItem(KEY_LISTA, JSON.stringify(lista));
}

export function novoPersonagem(nome = "Novo Herói") {
  return {
    id: crypto.randomUUID(),
    nome,
    jogador: "",
    raca: "", classe: "", origem: "", divindade: "",
    nivel: 1,
    atributos: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    atributosTemp: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
    pv: { atual: 0, maximo: null, temp: 0 },
    pm: { atual: 0, maximo: null, temp: 0 },
    defesaOutros: 0,
    deslocamentoExtra: "",
    periciasTreinadas: [],
    periciasOutros: {},
    poderes: [],
    magias: [],
    magiasPreparadas: [],
    equipamentos: [],
    dinheiro: { to: 0, tp: 0, tc: 0, tt: 0 },
    ataques: [],
    condicoes: [],
    modificadoresTemp: [],
    notas: [],
    biografia: "",
    aparencia: "",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
}

export function listarPersonagens() {
  const lista = lerLista();
  return Object.values(lista).sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
}

export function carregarPersonagem(id) {
  return lerLista()[id] ?? null;
}

export function salvarPersonagem(personagem) {
  const lista = lerLista();
  personagem.atualizadoEm = new Date().toISOString();
  lista[personagem.id] = personagem;
  salvarLista(lista);
}

export function apagarPersonagem(id) {
  const lista = lerLista();
  delete lista[id];
  salvarLista(lista);
  if (getPersonagemAtivoId() === id) setPersonagemAtivoId(null);
}

export function duplicarPersonagem(id) {
  const original = carregarPersonagem(id);
  if (!original) return null;
  const copia = { ...structuredClone(original), id: crypto.randomUUID(), nome: `${original.nome} (cópia)` };
  copia.criadoEm = copia.atualizadoEm = new Date().toISOString();
  salvarPersonagem(copia);
  return copia;
}

export function getPersonagemAtivoId() {
  return localStorage.getItem(KEY_ATIVO);
}

export function setPersonagemAtivoId(id) {
  if (id) localStorage.setItem(KEY_ATIVO, id);
  else localStorage.removeItem(KEY_ATIVO);
}

export function exportarJSON(personagem) {
  return JSON.stringify(personagem, null, 2);
}

export function importarJSON(texto) {
  const dados = JSON.parse(texto);
  if (!dados.id) dados.id = crypto.randomUUID();
  salvarPersonagem(dados);
  return dados;
}

export function getVersaoDadosVista() {
  return localStorage.getItem(KEY_VERSAO_VISTA);
}

export function setVersaoDadosVista(v) {
  localStorage.setItem(KEY_VERSAO_VISTA, v);
}
