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

// Escolhas que a automação da ficha precisa guardar: tudo que o livro manda
// *escolher* (atributos raciais do humano, perícias da classe/origem, poder de
// origem...) e que, por isso, a ficha não consegue deduzir sozinha a partir de
// raça/classe/origem/nível.
export function escolhasVazias() {
  return {
    atributosRaciais: [],        // humano/lefou/osteon/sereia: 3 atributos +1
    legadoRacial: "",            // suraggel: "aggelus" | "sulfure"
    periciasClasseFixa: {},      // grupo "Luta ou Pontaria" → id escolhido
    periciasClasse: [],          // perícias escolhidas na lista da classe
    periciasOrigem: [],          // 2 perícias da lista da origem
    periciasRaciais: [],         // humano (2), kliren (1), osteon (1)
    bonusPericiasRaciais: [],    // lefou: 2 perícias com +2
    poderOrigem: "",             // poder concedido pela origem
  };
}

export function novoPersonagem(nome = "Novo Herói") {
  return {
    id: crypto.randomUUID(),
    nome,
    jogador: "",
    raca: "", classe: "", origem: "", divindade: "",
    nivel: 1,
    escolhas: escolhasVazias(),
    // Escala de T20: o valor do atributo já é o modificador e começa em 0.
    escalaAtributos: "t20",
    atributos: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
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
  return Object.values(lista).map(migrarPersonagem).sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
}

export function carregarPersonagem(id) {
  const p = lerLista()[id];
  return p ? migrarPersonagem(p) : null;
}

// Fichas salvas antes de um campo existir continuam abrindo: o migrador só
// preenche o que falta, nunca sobrescreve o que já está lá.
export function migrarPersonagem(p) {
  if (!p || typeof p !== "object") return p;
  const base = escolhasVazias();
  p.escolhas = { ...base, ...(p.escolhas || {}) };
  for (const k of Object.keys(base)) {
    if (Array.isArray(base[k]) && !Array.isArray(p.escolhas[k])) p.escolhas[k] = [];
    if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) && typeof p.escolhas[k] !== "object") p.escolhas[k] = {};
  }
  p.atributos = p.atributos || { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
  // Fichas criadas quando a ficha ainda usava a escala d20 (atributos 8–18 com
  // modificador (valor − 10) ÷ 2) são convertidas uma única vez para a escala
  // de T20, em que o valor já é o modificador.
  if (p.escalaAtributos !== "t20") {
    const precisaConverter = Object.values(p.atributos).some((v) => Number(v) >= 6);
    if (precisaConverter) {
      for (const k of Object.keys(p.atributos)) p.atributos[k] = Math.floor(((Number(p.atributos[k]) || 10) - 10) / 2);
    }
    p.escalaAtributos = "t20";
  }
  p.atributosTemp = p.atributosTemp || { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
  p.periciasOutros = p.periciasOutros || {};
  for (const k of ["periciasTreinadas", "poderes", "magias", "magiasPreparadas", "equipamentos", "ataques", "condicoes", "notas", "modificadoresTemp"]) {
    if (!Array.isArray(p[k])) p[k] = [];
  }
  for (const item of p.equipamentos) if (item && item.equipado === undefined) item.equipado = false;
  p.pv = p.pv || { atual: 0, maximo: null, temp: 0 };
  p.pm = p.pm || { atual: 0, maximo: null, temp: 0 };
  p.dinheiro = p.dinheiro || { to: 0, tp: 0, tc: 0, tt: 0 };
  return p;
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
  const dados = migrarPersonagem(JSON.parse(texto));
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

// Webhook do Discord pra onde as rolagens são enviadas — fica preso a este
// navegador (não ao personagem), já que cada jogador cola o link do próprio
// canal/servidor.
const DISCORD_WEBHOOK_KEY = "t20.discordWebhook";
export function getDiscordWebhook() { try { return localStorage.getItem(DISCORD_WEBHOOK_KEY) || ""; } catch { return ""; } }
export function saveDiscordWebhook(url) {
  try { url ? localStorage.setItem(DISCORD_WEBHOOK_KEY, url) : localStorage.removeItem(DISCORD_WEBHOOK_KEY); }
  catch { /* modo privado */ }
}

// Sala de rolagens — chat em tempo real compartilhado entre os jogadores da
// mesma mesa, ponto-a-ponto via WebRTC (PeerJS). Ver hostRoom()/joinRoom()/
// broadcastRoll() em app.js.
const ROOM_CODE_KEY = "t20.roomCode";
const ROOM_APPLIED_HEALS_KEY = "t20.roomAppliedHeals";
const ROOM_APPLIED_DAMAGES_KEY = "t20.roomAppliedDamages";

export function getRoomCode() { try { return localStorage.getItem(ROOM_CODE_KEY) || ""; } catch { return ""; } }
export function saveRoomCode(code) {
  try { code ? localStorage.setItem(ROOM_CODE_KEY, code) : localStorage.removeItem(ROOM_CODE_KEY); }
  catch { /* modo privado */ }
}
// IDs das rolagens de cura já aplicadas neste navegador — clicar de novo em
// "Aplicar cura" na mesma rolagem não cura duas vezes.
export function getAppliedHeals() {
  try { const v = localStorage.getItem(ROOM_APPLIED_HEALS_KEY); const arr = v ? JSON.parse(v) : []; return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}
export function markHealApplied(rollId) {
  const arr = getAppliedHeals();
  if (arr.includes(rollId)) return;
  try { localStorage.setItem(ROOM_APPLIED_HEALS_KEY, JSON.stringify([...arr, rollId].slice(-300))); } catch { /* modo privado */ }
}
// Mesma ideia, pro botão "Aplicar dano".
export function getAppliedDamages() {
  try { const v = localStorage.getItem(ROOM_APPLIED_DAMAGES_KEY); const arr = v ? JSON.parse(v) : []; return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}
export function markDamageApplied(rollId) {
  const arr = getAppliedDamages();
  if (arr.includes(rollId)) return;
  try { localStorage.setItem(ROOM_APPLIED_DAMAGES_KEY, JSON.stringify([...arr, rollId].slice(-300))); } catch { /* modo privado */ }
}

// Aviso "ficha gratuita / conteúdo de fã" no topo — cada navegador dispensa
// o próprio, não volta a aparecer depois de fechado uma vez ali.
const DISCLAIMER_DISMISSED_KEY = "t20.disclaimerDismissed";
export function isDisclaimerDismissed() { try { return localStorage.getItem(DISCLAIMER_DISMISSED_KEY) === "1"; } catch { return false; } }
export function dismissDisclaimer() { try { localStorage.setItem(DISCLAIMER_DISMISSED_KEY, "1"); } catch { /* modo privado */ } }

// Tema visual da ficha na tela: "pergaminho" (padrão) | "noite" | "papel".
const SKIN_KEY = "t20.skin";
export const SKINS = ["pergaminho", "noite", "papel"];
export function getSavedSkin() {
  try { const v = localStorage.getItem(SKIN_KEY); return SKINS.includes(v) ? v : "pergaminho"; } catch { return "pergaminho"; }
}
export function saveSkin(v) { try { localStorage.setItem(SKIN_KEY, SKINS.includes(v) ? v : "pergaminho"); } catch { /* modo privado */ } }

// Idioma da INTERFACE (menus, abas, rótulos fixos da própria ficha) — não
// traduz o conteúdo do compêndio (poderes, magias, ameaças...), só a casca
// do app. "pt" é o padrão e não depende de dicionário nenhum.
const LANG_KEY = "t20.lang";
export const LANGS = ["pt", "en", "es"];
export function getSavedLang() {
  try { const v = localStorage.getItem(LANG_KEY); return LANGS.includes(v) ? v : "pt"; } catch { return "pt"; }
}
export function saveLang(v) { try { localStorage.setItem(LANG_KEY, LANGS.includes(v) ? v : "pt"); } catch { /* modo privado */ } }

// Listas de ameaças do mestre — à parte de qualquer personagem salvo neste
// navegador. Várias listas nomeadas (ex.: "Mesa de sexta", "Encontros
// aleatórios"), cada uma com sua própria coleção de ameaças do bestiário
// oficial e/ou criadas na mão. Formato: [{ id, name, monsters: [...] }, ...]
const MONSTER_LISTS_KEY = "t20.monsterLists";
const MONSTER_ACTIVE_LIST_KEY = "t20.monsterActiveList";
function genMonsterListId() { return `mlist-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }

export function getMonsterLists() {
  try { const v = localStorage.getItem(MONSTER_LISTS_KEY); const arr = v ? JSON.parse(v) : []; return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}
export function saveMonsterLists(arr) { try { localStorage.setItem(MONSTER_LISTS_KEY, JSON.stringify(arr || [])); } catch { /* modo privado */ } }
export function newMonsterListId() { return genMonsterListId(); }
export function getActiveMonsterListId() { try { return localStorage.getItem(MONSTER_ACTIVE_LIST_KEY) || ""; } catch { return ""; } }
export function setActiveMonsterListId(id) { try { localStorage.setItem(MONSTER_ACTIVE_LIST_KEY, id || ""); } catch { /* modo privado */ } }

// Modelos de personagem salvos — construções (raça/classe/origem/divindade/
// atributos) reaproveitáveis, sem nome nem estado de jogo específico.
const TEMPLATES_KEY = "t20.templates";
export function getTemplates() { try { const v = localStorage.getItem(TEMPLATES_KEY); const arr = v ? JSON.parse(v) : []; return Array.isArray(arr) ? arr : []; } catch { return []; } }
export function saveTemplates(arr) { try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(arr || [])); } catch { /* modo privado */ } }

// Estado (aberto/recolhido) do dashboard fixo — preferência de navegador, não do personagem.
const DASHBOARD_COLLAPSED_KEY = "t20.dashboardCollapsed";
export function isDashboardCollapsed() { try { return localStorage.getItem(DASHBOARD_COLLAPSED_KEY) === "1"; } catch { return false; } }
export function setDashboardCollapsed(v) { try { localStorage.setItem(DASHBOARD_COLLAPSED_KEY, v ? "1" : "0"); } catch { /* modo privado */ } }
