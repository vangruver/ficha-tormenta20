// ============================================================
// Idioma da INTERFACE — menus, abas e rótulos fixos da casca do app
// (cabeçalho, navegação, dashboard). NÃO traduz o conteúdo do compêndio
// (poderes, magias, ameaças, raças, classes...) — só a moldura visível o
// tempo todo. pt (padrão), en, es — outro idioma entra depois só
// adicionando outra chave em DICT.
// ============================================================
import { getSavedLang, saveLang, LANGS } from "./storage.js";

const DICT = {
  pt: {
    "app.title": "Ficha de Tormenta 20",
    "menu.character": "Personagem",
    "menu.charactersBtn": "🗂️ Meus Personagens",
    "menu.newCharacter": "➕ Novo",
    "menu.templatesBtn": "📐 Modelos",
    "menu.randomCharacter": "🎲 Personagem aleatório",
    "menu.randomCharacter.title": "Sorteia raça, classe, origem, divindade e atributos — pronto pra jogar",
    "menu.file": "Arquivo",
    "menu.exportJson": "📤 Exportar JSON",
    "menu.importJson": "📥 Importar JSON",
    "menu.shareLink": "🔗 Link somente-leitura",
    "menu.shareLink.title": "Gera um link somente-leitura com o personagem inteiro codificado nele — sem servidor, sem conta. Quem abrir vê a ficha (sem poder editar); as notas de sessão não entram no link.",
    "menu.printCharacter": "🖨️ Imprimir ficha",
    "menu.tools": "Ferramentas",
    "menu.discordSettings": "🔗 Discord",
    "menu.discordSettings.title": "Enviar as rolagens de dado pro Discord",
    "menu.roomSettings": "💬 Sala de rolagens",
    "menu.roomSettings.title": "Configurar a sala de rolagens compartilhada em tempo real com o grupo",
    "menu.mestreMode": "🐉 Ambiente do Mestre",
    "menu.mestreMode.title": "Ambiente do mestre: listas de ameaças por mesa/campanha, bestiário oficial completo e criação de ameaças — independe do personagem aberto",
    "menu.refreshData": "🔄 Atualizar banco de dados",
    "menu.prefs": "Ajustes",
    "prefs.skin": "Tema",
    "prefs.skin.title": "Visual da ficha na tela — a ficha em PDF sai sempre no papel oficial",
    "prefs.skin.pergaminho": "Pergaminho (padrão)",
    "prefs.skin.noite": "Noite (escuro)",
    "prefs.skin.papel": "Papel Branco (claro)",
    "prefs.lang": "Idioma",
    "menu.updates": "📰 Novidades",
    "menu.updates.title": "O que mudou recentemente na ficha",
    "menu.reportBug": "🐛 Relatar bug",
    "menu.reportBug.title": "Achou um bug ou tem uma sugestão? Manda pra mim",
    "menu.help": "❓ Ajuda",
    "menu.help.title": "Guia detalhado de tudo que a ficha faz",
    "previewPdf": "🖨️ PDF",
    "tab.build": "Construção",
    "tab.sheet": "Ficha",
    "tab.pericias": "Perícias",
    "tab.poderes": "Poderes",
    "tab.magias": "Magias",
    "tab.combate": "Combate",
    "tab.equipamentos": "Equipamentos",
    "tab.compendio": "Compêndio",
    "tab.notas": "Notas",
    "dashboard.collapse": "Recolher",
    "dashboard.expand": "Expandir",
    "footer.disclaimerLink": "Aviso legal completo",
    "footer.disclaimerLink.title": "Ler o aviso legal completo",
  },
  en: {
    "app.title": "Tormenta 20 Character Sheet",
    "menu.character": "Character",
    "menu.charactersBtn": "🗂️ My Characters",
    "menu.newCharacter": "➕ New",
    "menu.templatesBtn": "📐 Templates",
    "menu.randomCharacter": "🎲 Random character",
    "menu.randomCharacter.title": "Rolls race, class, origin, deity and ability scores — ready to play",
    "menu.file": "File",
    "menu.exportJson": "📤 Export JSON",
    "menu.importJson": "📥 Import JSON",
    "menu.shareLink": "🔗 Read-only link",
    "menu.shareLink.title": "Generates a read-only link with the whole character encoded in it — no server, no account. Whoever opens it sees the sheet (without editing it); session notes are left out of the link.",
    "menu.printCharacter": "🖨️ Print sheet",
    "menu.tools": "Tools",
    "menu.discordSettings": "🔗 Discord",
    "menu.discordSettings.title": "Send dice rolls to Discord",
    "menu.roomSettings": "💬 Roll room",
    "menu.roomSettings.title": "Configure the real-time roll room shared with your group",
    "menu.mestreMode": "🐉 GM Environment",
    "menu.mestreMode.title": "GM kit: creature lists per table/campaign, the full official bestiary and creature creation — independent from the open character",
    "menu.refreshData": "🔄 Refresh database",
    "menu.prefs": "Settings",
    "prefs.skin": "Theme",
    "prefs.skin.title": "Sheet visual on screen — the printed PDF always uses the official paper look",
    "prefs.skin.pergaminho": "Parchment (default)",
    "prefs.skin.noite": "Night (dark)",
    "prefs.skin.papel": "White Paper (light)",
    "prefs.lang": "Language",
    "menu.updates": "📰 What's new",
    "menu.updates.title": "What recently changed in the sheet",
    "menu.reportBug": "🐛 Report bug",
    "menu.reportBug.title": "Found a bug or have a suggestion? Send it my way",
    "menu.help": "❓ Help",
    "menu.help.title": "Detailed guide to everything the sheet does",
    "previewPdf": "🖨️ PDF",
    "tab.build": "Build",
    "tab.sheet": "Sheet",
    "tab.pericias": "Skills",
    "tab.poderes": "Powers",
    "tab.magias": "Spells",
    "tab.combate": "Combat",
    "tab.equipamentos": "Equipment",
    "tab.compendio": "Compendium",
    "tab.notas": "Notes",
    "dashboard.collapse": "Collapse",
    "dashboard.expand": "Expand",
    "footer.disclaimerLink": "Full legal notice",
    "footer.disclaimerLink.title": "Read the full legal notice",
  },
  es: {
    "app.title": "Ficha de Tormenta 20",
    "menu.character": "Personaje",
    "menu.charactersBtn": "🗂️ Mis Personajes",
    "menu.newCharacter": "➕ Nuevo",
    "menu.templatesBtn": "📐 Plantillas",
    "menu.randomCharacter": "🎲 Personaje aleatorio",
    "menu.randomCharacter.title": "Sortea raza, clase, origen, divinidad y atributos — listo para jugar",
    "menu.file": "Archivo",
    "menu.exportJson": "📤 Exportar JSON",
    "menu.importJson": "📥 Importar JSON",
    "menu.shareLink": "🔗 Enlace de solo lectura",
    "menu.shareLink.title": "Genera un enlace de solo lectura con todo el personaje codificado — sin servidor, sin cuenta. Quien lo abra ve la ficha (sin poder editarla); las notas de sesión no entran en el enlace.",
    "menu.printCharacter": "🖨️ Imprimir ficha",
    "menu.tools": "Herramientas",
    "menu.discordSettings": "🔗 Discord",
    "menu.discordSettings.title": "Enviar las tiradas a Discord",
    "menu.roomSettings": "💬 Sala de tiradas",
    "menu.roomSettings.title": "Configurar la sala de tiradas compartida en tiempo real con el grupo",
    "menu.mestreMode": "🐉 Entorno del Narrador",
    "menu.mestreMode.title": "Kit del narrador: listas de amenazas por mesa/campaña, bestiario oficial completo y creación de amenazas — independiente del personaje abierto",
    "menu.refreshData": "🔄 Actualizar base de datos",
    "menu.prefs": "Ajustes",
    "prefs.skin": "Tema",
    "prefs.skin.title": "Visual de la ficha en pantalla — el PDF siempre usa el papel oficial",
    "prefs.skin.pergaminho": "Pergamino (predeterminado)",
    "prefs.skin.noite": "Noche (oscuro)",
    "prefs.skin.papel": "Papel Blanco (claro)",
    "prefs.lang": "Idioma",
    "menu.updates": "📰 Novedades",
    "menu.updates.title": "Qué cambió recientemente en la ficha",
    "menu.reportBug": "🐛 Reportar error",
    "menu.reportBug.title": "¿Encontraste un error o tienes una sugerencia? Avísame",
    "menu.help": "❓ Ayuda",
    "menu.help.title": "Guía detallada de todo lo que hace la ficha",
    "previewPdf": "🖨️ PDF",
    "tab.build": "Construcción",
    "tab.sheet": "Ficha",
    "tab.pericias": "Habilidades",
    "tab.poderes": "Poderes",
    "tab.magias": "Hechizos",
    "tab.combate": "Combate",
    "tab.equipamentos": "Equipo",
    "tab.compendio": "Compendio",
    "tab.notas": "Notas",
    "dashboard.collapse": "Colapsar",
    "dashboard.expand": "Expandir",
    "footer.disclaimerLink": "Aviso legal completo",
    "footer.disclaimerLink.title": "Leer el aviso legal completo",
  },
};

let currentLang = getSavedLang();

export function getLang() { return currentLang; }

export function t(key, vars) {
  let s = DICT[currentLang]?.[key] ?? DICT.pt[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

const HTML_LANG = { pt: "pt-BR", en: "en", es: "es" };
export function applyI18n() {
  document.documentElement.lang = HTML_LANG[currentLang] || "pt-BR";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.getAttribute("data-i18n-title")); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
}

export function setLang(lang) {
  currentLang = LANGS.includes(lang) ? lang : "pt";
  saveLang(currentLang);
  applyI18n();
}
