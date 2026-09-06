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
