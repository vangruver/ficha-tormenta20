import { carregarBanco, porId, poderesDe, poderesDaClasse, poderesDaRaca, poderesDaOrigem, poderesGerais, magiasFiltradas, equipamentosFiltrados, ameacasFiltradas, panteaoFiltrado, opcoesDaEscolhaDeClasse, escolhasDeClassePara, conjuracaoDaClasse, habilidadesDaClasse } from "./database.js";
import * as regras from "./rules.js";
import * as storage from "./storage.js";
import { applyI18n, setLang, getLang, t } from "./i18n.js";

// As condições oficiais de T20. Além do texto, cada uma declara os efeitos
// NUMÉRICOS que a ficha sabe aplicar sozinha (`efeitos`) — antes a lista era
// só descritiva e aplicar "Abalado" não mexia em nada. Condição sem `efeitos`
// é comportamental (Apavorado, Confuso) ou depende do caso (Envenenado,
// Vulnerável), então continua valendo como lembrete escrito.
const CONDICOES = [
  { id: "abalado", nome: "Abalado", efeito: "-2 em testes de perícia, de resistência e de ataque.", efeitos: { pericias: -2, ataque: -2 } },
  { id: "acuado", nome: "Acuado", efeito: "Não pode atacar corpo a corpo, apenas se defender ou fugir." },
  { id: "alquebrado", nome: "Alquebrado", efeito: "-5 em testes de perícia, resistência e ataque; sofre o dobro de dano crítico.", efeitos: { pericias: -5, ataque: -5 } },
  { id: "apavorado", nome: "Apavorado", efeito: "Deve fugir da fonte do medo por 1d4 rodadas." },
  { id: "atordoado", nome: "Atordoado", efeito: "Perde a ação padrão e de movimento; -2 na Defesa.", efeitos: { defesa: -2 } },
  { id: "caido", nome: "Caído", efeito: "-2 de ataque corpo a corpo, +2 de ataque à distância contra o alvo caído.", efeitos: { ataqueCorpo: -2 } },
  { id: "cego", nome: "Cego", efeito: "-5 em testes de Luta/Pontaria e Percepção baseada em visão; 50% de falha em ataques.", efeitos: { periciasEspecificas: { lut: -5, pon: -5, per: -5 } } },
  { id: "confuso", nome: "Confuso", efeito: "Ação determinada aleatoriamente pelo mestre." },
  { id: "desprevenido", nome: "Desprevenido", efeito: "Sofre ataque furtivo e -2 na Defesa contra o atacante.", efeitos: { defesa: -2 } },
  { id: "enjoado", nome: "Enjoado", efeito: "Só pode realizar uma ação padrão ou de movimento por rodada." },
  { id: "envenenado", nome: "Envenenado", efeito: "Sofre os efeitos do veneno aplicado (dano ou penalidades)." },
  { id: "fatigado", nome: "Fatigado", efeito: "-2 em For e Des; não pode correr nem investir.", efeitos: { atributos: { for: -2, des: -2 } } },
  { id: "exausto", nome: "Exausto", efeito: "-6 em For e Des; desloca-se à metade.", efeitos: { atributos: { for: -6, des: -6 }, deslocamentoMetade: true } },
  { id: "imóvel", nome: "Imóvel", efeito: "Não pode se mover, mas pode agir normalmente." },
  { id: "indefeso", nome: "Indefeso", efeito: "Defesa 5; sofre ataque furtivo.", efeitos: { defesaFixa: 5 } },
  { id: "inconsciente", nome: "Inconsciente", efeito: "Indefeso e incapaz de agir.", efeitos: { defesaFixa: 5 } },
  { id: "ofuscado", nome: "Ofuscado", efeito: "-2 em testes de Luta/Pontaria e Percepção baseada em visão.", efeitos: { periciasEspecificas: { lut: -2, pon: -2, per: -2 } } },
  { id: "paralisado", nome: "Paralisado", efeito: "Não pode agir nem se mover; Destreza tratada como 0.", efeitos: { destrezaZero: true } },
  { id: "petrificado", nome: "Petrificado", efeito: "Transformado em pedra; indefeso e inconsciente dos sentidos.", efeitos: { defesaFixa: 5 } },
  { id: "sangrando", nome: "Sangrando", efeito: "Perde 5 PV no início de cada turno até ser curado ou estabilizado." },
  { id: "surdo", nome: "Surdo", efeito: "-4 em Percepção e testes de iniciativa baseados em audição.", efeitos: { periciasEspecificas: { per: -4, ini: -4 } } },
  { id: "surpreendido", nome: "Surpreendido", efeito: "Não age na primeira rodada de combate." },
  { id: "vulneravel", nome: "Vulnerável", efeito: "Sofre +50% de dano de um tipo específico." },
];

let db = null;
let personagem = null;

async function iniciar() {
  applySkin(storage.getSavedSkin());
  db = await carregarBanco();
  preencherDivindades();
  preencherSelectsEstáticos();

  const compartilhado = await decodeShareHash(location.hash);
  if (compartilhado) {
    personagem = compartilhado;
    personagem.notas = personagem.notas || []; // fora do link de propósito (privacidade) — ver shareSnapshot()
  } else {
    const ativoId = storage.getPersonagemAtivoId();
    personagem = (ativoId && storage.carregarPersonagem(ativoId)) || storage.listarPersonagens()[0] || storage.novoPersonagem();
    storage.setPersonagemAtivoId(personagem.id);
    storage.salvarPersonagem(personagem);
  }

  renderizarTudo();
  if (!compartilhado) verificarAtualizacaoDados();
  registrarEventos();
  registrarEventosAutomacao();
  registrarEventosSala();
  registrarEventosExtra();
  registrarServiceWorker();
  atualizarBannerDisclaimer();
  if (compartilhado) enterViewOnlyMode();
  applyI18n();
}

function atualizarBannerDisclaimer() {
  const banner = $("fan-disclaimer-banner");
  if (banner) banner.classList.toggle("hidden", storage.isDisclaimerDismissed());
}

function preencherDivindades() {
  const sel = document.getElementById("divindade");
  for (const d of db.panteao) {
    const opt = document.createElement("option");
    opt.value = d.nome;
    opt.textContent = d.nome;
    sel.appendChild(opt);
  }
}

function preencherSelectsEstáticos() {
  const raca = document.getElementById("raca");
  raca.innerHTML = '<option value="">— escolha —</option>' + db.racas.map((r) => `<option value="${r.id}">${r.nome}</option>`).join("");

  const classe = document.getElementById("classe");
  classe.innerHTML = '<option value="">— escolha —</option>' + db.classes.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");

  const origem = document.getElementById("origem");
  const regionais = db.origensRegionais || [];
  origem.innerHTML = '<option value="">— escolha —</option>'
    + `<optgroup label="Origens do livro básico">${db.origens.map((o) => `<option value="${esc(o.id)}">${esc(o.id)}</option>`).join("")}</optgroup>`
    + (regionais.length ? `<optgroup label="Origens regionais (Atlas de Arton)">${regionais.map((o) => `<option value="${esc(o.id)}">${esc(o.id)} — ${esc(o.regiao || "")}</option>`).join("")}</optgroup>` : "");

  const condSel = document.getElementById("condicao-select");
  condSel.innerHTML = CONDICOES.map((c) => `<option value="${c.id}">${c.nome}${c.efeitos ? "" : " (só lembrete)"}</option>`).join("");

  const modAlvo = document.getElementById("mod-alvo");
  if (modAlvo) modAlvo.innerHTML = ALVOS_MODIFICADOR.map((a) => `<option value="${a.id}">${esc(a.nome)}</option>`).join("");

  const circuloSel = document.getElementById("magias-filtro-circulo");
  for (const c of regras.CIRCULOS_MAGIA) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `${c}º círculo`;
    circuloSel.appendChild(opt);
  }
}

// ---------- Derivações ----------

function racaAtual() { return porId(db.racas, personagem.raca); }
function classeAtual() { return porId(db.classes, personagem.classe); }

// ==============================================================
// Multiclasse — a classe inicial (`personagem.classe`) mais as extras de
// `personagem.multiclasses`. A distribuição de níveis é sempre derivada do
// nível total: a inicial fica com o que sobra depois das extras, e nunca
// com menos de 1.
// ==============================================================
function classesDoPersonagem() {
  const inicial = classeAtual();
  if (!inicial) return [];
  const extras = (personagem.multiclasses || [])
    .map((m) => ({ classe: porId(db.classes, m.classeId), niveis: Math.max(1, Number(m.niveis) || 1) }))
    .filter((x) => x.classe && x.classe.id !== inicial.id);
  return regras.niveisPorClasse([{ classe: inicial, niveis: 1 }, ...extras], personagem.nivel || 1);
}
function temMulticlasse() { return classesDoPersonagem().length > 1; }
// Rótulo "Arcanista 3 / Guerreiro 2".
function rotuloDeClasses() {
  return classesDoPersonagem().map((x) => `${x.classe.nome} ${x.niveis}`).join(" / ");
}
// Perícias que a classe extra concede: o livro dá só as fixas da classe
// nova, não as escolhas livres do 1º nível.
function periciasDeMulticlasse() {
  const [, ...extras] = classesDoPersonagem();
  const out = new Map();
  for (const x of extras) for (const id of x.classe.periciasFixas || []) out.set(id, `Multiclasse (${x.classe.nome})`);
  return out;
}
function origemAtual() { return porId(db.origens, personagem.origem) || porId(db.origensRegionais, personagem.origem); }
// Bloco "auto" da raça: tudo que a ficha consegue aplicar sozinha (bônus de
// Defesa, PV/PM extras, perícias concedidas) ou precisa perguntar (atributos
// à escolha, legado do suraggel). Ver data/core/racas.json.
function racaAuto() { return racaAtual()?.auto || {}; }
function escolhas() { return (personagem.escolhas = personagem.escolhas || storage.escolhasVazias()); }
function legadoAtual() {
  const legados = racaAuto().legados;
  if (!legados?.length) return null;
  return legados.find((l) => l.id === escolhas().legadoRacial) || null;
}

function bonusRacial(atributoId) {
  const r = racaAtual();
  if (!r) return 0;
  let total = 0;
  // Raças com "+1 em três atributos à escolha" guardam escolha1/2/3 no lugar de
  // ids de atributo, e o suraggel guarda um objeto por legado — só somamos aqui
  // o que já vem como número pronto.
  const v = r.atributos?.[atributoId];
  if (typeof v === "number") total += v;
  const leg = legadoAtual();
  if (typeof leg?.atributos?.[atributoId] === "number") total += leg.atributos[atributoId];
  if (racaAuto().atributosEscolha) {
    total += (escolhas().atributosRaciais || []).filter((a) => a === atributoId).length;
  }
  // Herança com atributos livres (Moreau: +1 fixo e +1 em dois à escolha) e
  // variantes de distribuição (Kallyanach: +2 num atributo OU +1 em dois)
  // guardam as escolhas na mesma lista, com o valor que a opção declara.
  const variante = varianteAtributosAtual();
  if (leg?.atributosLivres || variante) {
    const valor = variante?.valor ?? 1;
    total += (escolhas().atributosRaciais || []).filter((a) => a === atributoId).length * valor;
  }
  return total;
}

// Variante de distribuição de atributos escolhida (só as raças que oferecem).
function varianteAtributosAtual() {
  const variantes = racaAuto().variantesAtributos;
  if (!variantes?.length) return null;
  return variantes.find((v) => v.id === escolhas().varianteAtributos) || null;
}
// Quantos atributos livres a raça deixa escolher, contando legado e variante.
function atributosLivresDaRaca() {
  const auto = racaAuto();
  if (auto.atributosEscolha) return auto.atributosEscolha.quantidade;
  const variante = varianteAtributosAtual();
  if (variante) return variante.livres;
  const leg = legadoAtual();
  return leg?.atributosLivres || 0;
}

// ==============================================================
// Efeitos ativos — condições + modificadores temporários.
//
// `personagem.condicoes` guarda as condições aplicadas e
// `personagem.modificadoresTemp` os ajustes que o jogador cria à mão
// (um "+2 em tudo" de uma magia de bênção, um "−1 na Defesa" de um item).
// efeitosAtivos() soma os dois num único objeto que as contas da ficha
// consultam — perícias, ataque, Defesa, atributos e deslocamento.
//
// Um modificador temporário tem a forma
//   { nome, alvo, valor, pericia }
// com `alvo` em: "pericias" | "ataque" | "defesa" | "atributo" | "pericia".
// ==============================================================
const ALVOS_MODIFICADOR = [
  { id: "pericias", nome: "Todas as perícias (inclui resistências)" },
  { id: "pericia", nome: "Uma perícia específica" },
  { id: "ataque", nome: "Testes de ataque" },
  { id: "defesa", nome: "Defesa" },
  { id: "atributo", nome: "Um atributo" },
];

function condicoesAtivas() {
  return (personagem.condicoes || []).map((id) => CONDICOES.find((c) => c.id === id)).filter(Boolean);
}

function efeitosAtivos() {
  const out = {
    pericias: 0, ataque: 0, ataqueCorpo: 0, defesa: 0,
    periciasEspecificas: {}, atributos: {},
    defesaFixa: null, destrezaZero: false, deslocamentoMetade: false,
    fontes: [],
  };
  for (const c of condicoesAtivas()) {
    const e = c.efeitos;
    if (!e) continue;
    out.fontes.push(c.nome);
    out.pericias += e.pericias || 0;
    out.ataque += e.ataque || 0;
    out.ataqueCorpo += e.ataqueCorpo || 0;
    out.defesa += e.defesa || 0;
    for (const [k, v] of Object.entries(e.periciasEspecificas || {})) out.periciasEspecificas[k] = (out.periciasEspecificas[k] || 0) + v;
    for (const [k, v] of Object.entries(e.atributos || {})) out.atributos[k] = (out.atributos[k] || 0) + v;
    // A Defesa mais baixa vence: estar Indefeso e Atordoado ao mesmo tempo
    // não deixa a Defesa acima de 5.
    if (e.defesaFixa != null) out.defesaFixa = out.defesaFixa == null ? e.defesaFixa : Math.min(out.defesaFixa, e.defesaFixa);
    if (e.destrezaZero) out.destrezaZero = true;
    if (e.deslocamentoMetade) out.deslocamentoMetade = true;
  }
  for (const m of personagem.modificadoresTemp || []) {
    const v = Number(m.valor) || 0;
    if (!v) continue;
    out.fontes.push(m.nome || "modificador");
    if (m.alvo === "pericias") out.pericias += v;
    else if (m.alvo === "ataque") out.ataque += v;
    else if (m.alvo === "defesa") out.defesa += v;
    else if (m.alvo === "pericia" && m.pericia) out.periciasEspecificas[m.pericia] = (out.periciasEspecificas[m.pericia] || 0) + v;
    else if (m.alvo === "atributo" && m.atributo) out.atributos[m.atributo] = (out.atributos[m.atributo] || 0) + v;
  }
  return out;
}

function atributoFinal(id, efeitos = null) {
  const base = personagem.atributos[id] ?? 0;
  const temp = personagem.atributosTemp?.[id] ?? 0;
  const ef = efeitos || efeitosAtivos();
  // Paralisado trata a Destreza como 0 — não é uma penalidade que soma, é
  // uma substituição, então vem antes de qualquer outro ajuste.
  if (id === "des" && ef.destrezaZero) return 0;
  return base + bonusRacial(id) + temp + (ef.atributos[id] || 0);
}

function atributosFinais() {
  const ef = efeitosAtivos();
  const out = {};
  for (const a of db.atributos) out[a.id] = atributoFinal(a.id, ef);
  return out;
}

// ---------- Automação: perícias treinadas concedidas ----------

// Perícias que o personagem tem treinadas *por causa* de classe/origem/raça —
// a ficha marca sozinha e diz de onde veio. O jogador ainda pode marcar
// perícias extras à mão (personagem.periciasTreinadas).
// ==============================================================
// Escolhas sem alternativa real.
//
// Vários "escolha N" do livro chegam na ficha com exatamente N opções
// disponíveis — o Paladino, por exemplo, já vem treinado em Luta e Vontade
// e escolhe 2 perícias; se a lista de opções que sobra tiver 2 itens, não há
// nada a decidir. Pedir a escolha nesse caso só cria pendência falsa.
//
// normalizarEscolhas() detecta esses casos e aplica a única combinação
// possível, gravando na ficha. Os blocos de automação continuam mostrando o
// que foi concedido, mas como "aplicado automaticamente" em vez de pendência.
// A função é chamada antes de cada render e devolve `true` se mudou algo.
// ==============================================================

// Uma escolha é forçada quando o número de opções válidas é menor ou igual
// à cota — aí a resposta é "todas elas".
function escolhaForcada(opcoes, cota) { return cota > 0 && opcoes.length > 0 && opcoes.length <= cota; }

// Descreve cada grupo de escolha de perícia da ficha num formato único:
// { campo, opcoes, cota }. Serve tanto pra normalizar quanto pra renderizar.
function gruposDeEscolhaDePericia() {
  const grupos = [];
  const e = escolhas();
  const classe = classeAtual();
  const auto = racaAuto();

  if (classe) {
    const fixas = classe.periciasFixas || [];
    const escolhidasGrupo = (classe.periciasFixasEscolha || []).map((_, i) => e.periciasClasseFixa?.[i] || "");
    const jaFixas = new Set([...fixas, ...escolhidasGrupo.filter(Boolean)]);
    const opcoes = (classe.periciasDeClasse || []).filter((id) => !jaFixas.has(id));
    const cota = regras.escolhasDePericiaDaClasse({ classe, modInt: regras.mod(atributoFinal("int")) });
    grupos.push({ campo: "periciasClasse", opcoes, cota });
  }
  if (personagem.origem && !auto.semOrigem) {
    const lista = origemAtual()?.periciasSugeridas || [];
    grupos.push({ campo: "periciasOrigem", opcoes: lista, cota: Math.min(2, lista.length || 2) });
  }
  if (auto.treinosEscolha) {
    grupos.push({ campo: "periciasRaciais", opcoes: db.pericias.map((x) => x.id), cota: auto.treinosEscolha });
  }
  if (auto.bonusPericiasEscolha) {
    grupos.push({ campo: "bonusPericiasRaciais", opcoes: db.pericias.map((x) => x.id), cota: auto.bonusPericiasEscolha.quantidade });
  }
  const livresDaRaca = atributosLivresDaRaca();
  if (auto.atributosEscolha || livresDaRaca) {
    const { quantidade = livresDaRaca, excluir = [] } = auto.atributosEscolha || {};
    grupos.push({ campo: "atributosRaciais", opcoes: db.atributos.map((a) => a.id).filter((id) => !excluir.includes(id)), cota: quantidade });
  }
  return grupos;
}

function normalizarEscolhas() {
  if (!db) return false;
  const e = escolhas();
  const classe = classeAtual();
  const auto = racaAuto();
  let mudou = false;

  // "Luta ou Pontaria" com uma opção só (ou grupo de uma opção) não é escolha.
  (classe?.periciasFixasEscolha || []).forEach((grupo, i) => {
    if (grupo.length === 1 && e.periciasClasseFixa?.[i] !== grupo[0]) {
      e.periciasClasseFixa = { ...(e.periciasClasseFixa || {}), [i]: grupo[0] };
      mudou = true;
    }
  });

  // Legado único (nenhuma raça do básico tem, mas homebrew pode ter).
  if (auto.legados?.length === 1 && e.legadoRacial !== auto.legados[0].id) {
    e.legadoRacial = auto.legados[0].id;
    mudou = true;
  }

  // Escolha de classe com uma opção só na família não é escolha.
  for (const x of classesDoPersonagem()) {
    for (const regra of escolhasDeClassePara(db, x.classe.id, x.niveis)) {
      const opcoes = opcoesDaEscolhaDeClasse(db, regra.familia);
      const chave = `${regra.classe}.${regra.id}`;
      if (opcoes.length === 1 && e.escolhasClasse?.[chave] !== opcoes[0].id) {
        e.escolhasClasse = { ...(e.escolhasClasse || {}), [chave]: opcoes[0].id };
        mudou = true;
      }
    }
  }

  // Poder de origem: se a origem só tem um poder correspondente, ele já é o dela.
  if (personagem.origem && !auto.semOrigem && !e.poderOrigem) {
    const poderes = poderesDaOrigem(db, personagem.origem);
    if (poderes.length === 1) { e.poderOrigem = poderes[0].id; mudou = true; }
  }

  // Perícias/atributos: lista de opções menor ou igual à cota → aplica tudo.
  for (const { campo, opcoes, cota } of gruposDeEscolhaDePericia()) {
    if (!escolhaForcada(opcoes, cota)) continue;
    const atual = Array.isArray(e[campo]) ? e[campo] : [];
    const alvo = opcoes.slice(0, cota);
    if (atual.length !== alvo.length || alvo.some((id) => !atual.includes(id))) {
      e[campo] = alvo;
      mudou = true;
    }
  }

  if (mudou) storage.salvarPersonagem(personagem);
  return mudou;
}

function treinosAutomaticos() {
  const mapa = new Map();
  const add = (id, fonte) => {
    if (!id) return;
    const fontes = mapa.get(id) || [];
    if (!fontes.includes(fonte)) fontes.push(fonte);
    mapa.set(id, fontes);
  };
  const c = classeAtual();
  const e = escolhas();
  if (c) {
    const rotulo = `Classe (${c.nome})`;
    for (const id of c.periciasFixas || []) add(id, rotulo);
    (c.periciasFixasEscolha || []).forEach((_, i) => add(e.periciasClasseFixa?.[i], rotulo));
    for (const id of e.periciasClasse || []) if ((c.periciasDeClasse || []).includes(id)) add(id, rotulo);
  }
  for (const [id, fonte] of periciasDeMulticlasse()) add(id, fonte);
  if (personagem.origem) for (const id of e.periciasOrigem || []) add(id, `Origem (${personagem.origem})`);
  const r = racaAtual();
  if (r) for (const id of e.periciasRaciais || []) add(id, `Raça (${r.nome})`);
  return mapa;
}

// Bônus numéricos de perícia vindos da raça (+2 em Misticismo do elfo etc.).
function bonusRacialPericias() {
  const out = {};
  const somar = (obj) => { for (const [k, v] of Object.entries(obj || {})) out[k] = (out[k] || 0) + v; };
  somar(racaAuto().bonusPericias);
  somar(legadoAtual()?.bonusPericias);
  const esc = racaAuto().bonusPericiasEscolha;
  if (esc) for (const id of (escolhas().bonusPericiasRaciais || []).slice(0, esc.quantidade)) out[id] = (out[id] || 0) + esc.valor;
  return out;
}

// ---------- Automação: equipamento vestido ----------

function registroDoItem(item) { return db.equipamentos.find((e) => e.id === item.id) || item; }

// Defesa e penalidade de armadura da armadura/escudo efetivamente equipados.
// Só a melhor armadura e o melhor escudo contam (não empilham).
function defesaDoEquipamento() {
  let armadura = 0, escudo = 0, penalidade = 0;
  for (const item of personagem.equipamentos) {
    if (!item.equipado) continue;
    const info = regras.lerArmadura(registroDoItem(item));
    if (!info) continue;
    if (info.tipo === "escudo") escudo = Math.max(escudo, info.defesa);
    else if (info.defesa > armadura) { armadura = info.defesa; penalidade = info.penalidade; }
  }
  if (armadura > 0) penalidade += racaAuto().penalidadeArmaduraExtra || 0;
  return { armadura, escudo, penalidade };
}

function cargaAtual() {
  return personagem.equipamentos.reduce((soma, item) => soma + (Number(registroDoItem(item).peso) || 0) * (Number(item.qtd) || 1), 0);
}

function calcularDerivados() {
  const classe = classeAtual();
  const atrs = atributosFinais();
  const nivel = personagem.nivel || 1;
  const auto = racaAuto();
  const treinos = treinosAutomaticos();
  const bonusPericiasRacial = bonusRacialPericias();
  const equip = defesaDoEquipamento();
  const efeitos = efeitosAtivos();

  const classes = classesDoPersonagem();
  const pvMax = classe ? regras.pvMaximoMulticlasse({
    classes, nivel, modCon: regras.mod(atrs.con),
    extraNivel1: auto.pvNivel1 || 0, extraPorNivel: auto.pvPorNivel || 0,
  }) : null;
  const pmMax = classe ? regras.pmMaximoMulticlasse({ classes, nivel, extraPorNivel: auto.pmPorNivel || 0 }) : 0;
  const defesaCalculada = regras.defesaTotal({
    modDes: regras.mod(atrs.des), armadura: equip.armadura, escudo: equip.escudo,
    outros: (personagem.defesaOutros || 0) + (auto.defesa || 0) + efeitos.defesa,
  });
  // Indefeso/inconsciente/petrificado fixam a Defesa num valor, ignorando
  // armadura e Destreza.
  const defesa = efeitos.defesaFixa != null ? efeitos.defesaFixa : defesaCalculada;
  const cargaMax = regras.cargaMaxima(regras.mod(atrs.for));

  const d = { classe, classes, atrs, nivel, pvMax, pmMax, defesa, cargaMax, carga: cargaAtual(), treinos, bonusPericiasRacial, equip, penalidadeArmadura: equip.penalidade, efeitos };
  // Iniciativa é uma perícia em T20: entra metade do nível e o bônus de treino.
  d.iniciativa = bonusDePericia(porId(db.pericias, "ini"), d);
  return d;
}

function estaTreinado(id, d) {
  return (d?.treinos || treinosAutomaticos()).has(id) || personagem.periciasTreinadas.includes(id);
}

function bonusDePericia(p, d) {
  if (!p) return 0;
  const ef = d.efeitos || efeitosAtivos();
  const outros = (personagem.periciasOutros?.[p.id] ?? 0) + (d.bonusPericiasRacial[p.id] || 0)
    + ef.pericias + (ef.periciasEspecificas[p.id] || 0);
  return regras.bonusPericia({
    nivel: d.nivel,
    treinado: estaTreinado(p.id, d),
    modAtributo: regras.mod(d.atrs[p.atributo]),
    outros,
    penalidadeArmadura: p.penalidadeArmadura ? d.penalidadeArmadura : 0,
  });
}

// Quantos poderes o personagem pode ter neste nível, separados por origem.
function poderesEsperados() {
  const nivel = personagem.nivel || 1;
  const daClasse = classeAtual() ? regras.poderesDeClassePorNivel(nivel) : 0;
  const daOrigem = personagem.origem && !racaAuto().semOrigem ? 1 : 0;
  const geraisExtra = racaAuto().poderesGeraisExtra || 0;
  return { daClasse, daOrigem, geraisExtra, escolhiveis: daClasse + geraisExtra, total: daClasse + daOrigem + geraisExtra };
}

// ---------- Render geral ----------

function renderizarTudo() {
  normalizarEscolhas();
  renderIdentidade();
  renderConstrucao();
  renderAutomacao();
  renderAtributos();
  renderDashboard();
  renderPericias();
  renderPoderes();
  renderMagias();
  renderCombate();
  renderEquipamentos();
  renderNotas();
  renderCompendio();
  document.getElementById("rodape-versao").textContent = db.version
    ? `Compêndio sincronizado em ${new Date(db.version.syncedAt).toLocaleDateString("pt-BR")}`
    : "";
}

function renderIdentidade() {
  document.getElementById("nome").value = personagem.nome || "";
  document.getElementById("jogador").value = personagem.jogador || "";
  const campoXp = document.getElementById("xp");
  if (campoXp) campoXp.value = personagem.xp ?? 0;
  renderAvatar();
  document.getElementById("raca").value = personagem.raca || "";
  document.getElementById("classe").value = personagem.classe || "";
  document.getElementById("origem").value = personagem.origem || "";
  document.getElementById("divindade").value = personagem.divindade || "";
  document.getElementById("biografia").value = personagem.biografia || "";
  document.getElementById("aparencia").value = personagem.aparencia || "";
  document.getElementById("dinheiro-tt").value = personagem.dinheiro?.tt ?? 0;
  document.getElementById("dinheiro-to").value = personagem.dinheiro?.to ?? 0;
  document.getElementById("dinheiro-tp").value = personagem.dinheiro?.tp ?? 0;
  document.getElementById("dinheiro-tc").value = personagem.dinheiro?.tc ?? 0;

  const r = racaAtual();
  const racaInfo = document.getElementById("racaInfo");
  racaInfo.innerHTML = r
    ? `<summary>Traços de ${r.nome}</summary><p>${r.traços}</p><p><em>Deslocamento: ${r.deslocamento} · Tamanho: ${r.tamanho}</em></p>`
    : "";
  racaInfo.classList.toggle("hidden", !r);

  const c = classeAtual();
  const classeInfo = document.getElementById("classeInfo");
  classeInfo.innerHTML = c
    ? `<summary>Habilidades iniciais de ${c.nome}</summary><p>${c.iniciais}</p><p><em>Atributo-chave: ${c.atributoChave.toUpperCase()} · Conjuração: ${c.conjuracao ?? "nenhuma"}</em></p>`
    : "";
  classeInfo.classList.toggle("hidden", !c);
}

// ==============================================================
// Atributos — quatro métodos de geração (compra de pontos, arranjo pronto,
// rolagem 4d6 descartando o menor e valores livres).
//
// Nos métodos "arranjo" e "rolagem" existe uma *piscina* de valores fixos
// (personagem.atributosPool) que o jogador distribui pelos seis atributos:
// cada atributo vira um <select> com os valores ainda livres, e
// personagem.atributosSlots guarda qual índice da piscina foi pra onde.
// Nos métodos "compra" e "livre" cada atributo é um <input number> comum.
// ==============================================================
function atribModo() { return personagem.atributosModo || "compra"; }
function usaPiscina() { return atribModo() === "arranjo" || atribModo() === "rolagem"; }

// Piscina no formato { valor (escala T20), d20 (só na rolagem), dados }.
function piscinaAtual() { return Array.isArray(personagem.atributosPool) ? personagem.atributosPool : []; }

function definirPiscina(pool, { limpar = true } = {}) {
  personagem.atributosPool = pool;
  if (limpar) {
    personagem.atributosSlots = {};
    for (const a of db.atributos) personagem.atributos[a.id] = 0;
  }
  salvarERenderizar();
}

function atribuirSlot(atributoId, indice) {
  const slots = (personagem.atributosSlots = { ...(personagem.atributosSlots || {}) });
  // Um valor da piscina só pode estar num atributo: se já estava em outro,
  // os dois trocam de lugar em vez de o valor sumir.
  const anterior = Object.entries(slots).find(([, v]) => v === indice)?.[0];
  const meuAtual = slots[atributoId];
  if (indice === "" || indice === null) delete slots[atributoId];
  else {
    if (anterior && anterior !== atributoId) {
      if (meuAtual === undefined) delete slots[anterior];
      else slots[anterior] = meuAtual;
    }
    slots[atributoId] = indice;
  }
  const pool = piscinaAtual();
  for (const a of db.atributos) {
    const i = slots[a.id];
    personagem.atributos[a.id] = i === undefined ? 0 : Number(pool[i]?.valor ?? 0);
  }
  salvarERenderizar();
}

function setModoAtributos(modo) {
  if (!regras.MODOS_ATRIBUTO.includes(modo)) return;
  personagem.atributosModo = modo;
  if (modo === "arranjo") {
    const arranjo = regras.ARRANJOS_PADRAO.find((a) => a.id === personagem.atributosArranjo) || regras.ARRANJOS_PADRAO[0];
    personagem.atributosArranjo = arranjo.id;
    definirPiscina(arranjo.valores.map((v) => ({ valor: v })));
    return;
  }
  if (modo === "rolagem") {
    if (!piscinaAtual().length) { rolarAtributos(); return; }
  } else {
    personagem.atributosPool = [];
    personagem.atributosSlots = {};
  }
  salvarERenderizar();
}

function rolarAtributos() {
  const pool = regras.rolarPiscinaDeAtributos().map((r) => ({ valor: r.valorT20, d20: r.totalD20, dados: r.dados, descartado: r.descartado }));
  definirPiscina(pool);
  toast(`Rolagem: ${pool.map((p) => `${p.d20}(${formatarMod(p.valor)})`).join(" · ")}`);
}

function renderAtribModos() {
  document.querySelectorAll("#atrib-modos [data-atrib-modo]").forEach((b) => b.classList.toggle("active", b.dataset.atribModo === atribModo()));
  const extra = document.getElementById("atrib-modo-extra");
  const pool = document.getElementById("atrib-pool");
  if (!extra || !pool) return;
  const modo = atribModo();

  if (modo === "compra") {
    const gasto = regras.custoTotalAtributos(personagem.atributos);
    const sobra = regras.PONTOS_ATRIBUTOS - gasto;
    extra.innerHTML = `<span>Pontos restantes: <b class="atrib-pontos${sobra < 0 ? " estourado" : ""}">${sobra}</b> de ${regras.PONTOS_ATRIBUTOS}</span>
      <button type="button" id="atrib-zerar">Zerar</button>`;
    document.getElementById("atrib-zerar").addEventListener("click", () => {
      for (const a of db.atributos) personagem.atributos[a.id] = 0;
      salvarERenderizar();
    });
    pool.classList.add("hidden");
    pool.innerHTML = "";
    return;
  }

  if (modo === "livre") {
    extra.innerHTML = `<span>Sem orçamento — digite o que quiser em cada atributo.</span>`;
    pool.classList.add("hidden");
    pool.innerHTML = "";
    return;
  }

  if (modo === "arranjo") {
    extra.innerHTML = `<label class="filtro-check">Arranjo
      <select id="atrib-arranjo">${regras.ARRANJOS_PADRAO.map((a) => `<option value="${a.id}"${a.id === personagem.atributosArranjo ? " selected" : ""}>${esc(a.nome)} — ${a.valores.map(formatarMod).join(", ")}</option>`).join("")}</select>
    </label>`;
    document.getElementById("atrib-arranjo").addEventListener("change", (ev) => {
      const arranjo = regras.ARRANJOS_PADRAO.find((a) => a.id === ev.target.value) || regras.ARRANJOS_PADRAO[0];
      personagem.atributosArranjo = arranjo.id;
      definirPiscina(arranjo.valores.map((v) => ({ valor: v })));
    });
  } else {
    extra.innerHTML = `<button type="button" class="primary" id="atrib-rolar">🎲 Rolar 6× 4d6</button>
      <span>Descarta o menor dado de cada rolagem e converte o total pra escala de T20.</span>`;
    document.getElementById("atrib-rolar").addEventListener("click", () => {
      if (piscinaAtual().length && !confirm("Rolar de novo descarta os valores atuais. Continuar?")) return;
      rolarAtributos();
    });
  }

  const usados = new Set(Object.values(personagem.atributosSlots || {}));
  const lista = piscinaAtual();
  pool.classList.toggle("hidden", !lista.length);
  pool.innerHTML = lista.length
    ? `<span class="atrib-pool-legenda">Valores a distribuir:</span>${lista.map((v, i) => `
        <span class="atrib-pool-valor${usados.has(i) ? " usado" : ""}" title="${v.d20 ? esc(`4d6 = ${v.dados.join(", ")} (descartou o ${v.descartado}) → ${v.d20} na escala d20`) : "Valor do arranjo"}">${formatarMod(v.valor)}${v.d20 ? `<span class="atrib-pool-valor d20" style="border:0;padding:0 0 0 5px">d20 ${v.d20}</span>` : ""}</span>`).join("")}
      <span class="atrib-pool-legenda">${usados.size}/${lista.length} distribuídos</span>`
    : "";
}

// Retrato do personagem: guardado como data URL na própria ficha (assim
// viaja no export/import e no link somente-leitura), reduzido antes de
// salvar porque o localStorage é pequeno.
function renderAvatar() {
  const img = document.getElementById("avatar-img");
  const vazio = document.getElementById("avatar-vazio");
  const remover = document.getElementById("avatar-remover");
  if (!img || !vazio) return;
  const tem = !!personagem.avatar;
  img.classList.toggle("hidden", !tem);
  vazio.classList.toggle("hidden", tem);
  remover?.classList.toggle("hidden", !tem);
  if (tem) img.src = personagem.avatar;
  else img.removeAttribute("src");
}

// Reduz a imagem escolhida a no máximo 320px no maior lado antes de virar
// data URL — um retrato de câmera inteiro estouraria a cota do navegador.
function redimensionarAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Não consegui ler essa imagem."));
      img.onload = () => {
        const max = 320;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderAtributos() {
  renderAtribModos();
  const cont = document.getElementById("atributos");
  const modo = atribModo();
  const chave = classeAtual()?.atributoChave;
  const pool = piscinaAtual();
  const slots = personagem.atributosSlots || {};
  const usados = new Set(Object.values(slots));

  cont.innerHTML = db.atributos.map((a) => {
    const final = atributoFinal(a.id);
    const b = bonusRacial(a.id);
    const campo = usaPiscina()
      ? `<select class="atrib-slot" data-atributo-slot="${a.id}">
           <option value="">—</option>
           ${pool.map((v, i) => `<option value="${i}"${slots[a.id] === i ? " selected" : ""}${usados.has(i) && slots[a.id] !== i ? " disabled" : ""}>${formatarMod(v.valor)}${v.d20 ? ` (d20 ${v.d20})` : ""}</option>`).join("")}
         </select>`
      : `<input type="number" data-atributo="${a.id}" min="-5" max="8" step="1" value="${personagem.atributos[a.id] ?? 0}" />`;
    return `
      <div class="atributo-caixa${chave === a.id ? " chave" : ""}">
        <label title="${chave === a.id ? esc(`Atributo-chave de ${classeAtual().nome}`) : ""}">${a.nome}</label>
        ${campo}
        <div class="mod">${formatarMod(final)}</div>
        <div class="dica">base ${formatarMod(personagem.atributos[a.id] ?? 0)}${b ? ` ${formatarMod(b)} racial` : ""}${personagem.atributosTemp?.[a.id] ? ` ${formatarMod(personagem.atributosTemp[a.id])} temp` : ""}</div>
        <button type="button" class="secundario rolar-atributo" data-rolar-atributo="${a.id}" title="Rolar 1d20 + modificador de ${a.nome}">🎲 rolar</button>
      </div>`;
  }).join("");

  cont.querySelectorAll("[data-atributo-slot]").forEach((sel) => sel.addEventListener("change", () => {
    const v = sel.value === "" ? "" : Number(sel.value);
    atribuirSlot(sel.dataset.atributoSlot, v);
  }));

  const resumo = document.getElementById("resumo-atributos");
  if (!resumo) return;
  if (modo === "compra") {
    const gasto = regras.custoTotalAtributos(personagem.atributos);
    const sobra = regras.PONTOS_ATRIBUTOS - gasto;
    resumo.innerHTML = `
      <div class="resumo-treinos-linha">Compra de atributos: <b>${gasto}</b> de <b>${regras.PONTOS_ATRIBUTOS}</b> pontos usados${sobra > 0 ? ` — sobram <b>${sobra}</b>` : sobra < 0 ? ` — <b>${-sobra}</b> acima do orçamento inicial` : ""}.</div>
      <div class="resumo-treinos-conta">Custo por valor: ${[-1, 0, 1, 2, 3, 4].map((v) => `${formatarMod(v)} = ${regras.CUSTO_ATRIBUTO[v]}`).join(" · ")}. Baixar um atributo para −1 devolve 1 ponto.</div>
      <p class="dica">O orçamento vale só para a criação em 1º nível — a ficha nunca trava o valor, então itens, poderes e níveis podem passar dele.</p>`;
  } else if (usaPiscina()) {
    const faltam = pool.length - usados.size;
    resumo.innerHTML = faltam > 0
      ? `<div class="alerta-automacao">Faltam distribuir <b>${faltam}</b> valor(es) da ${modo === "rolagem" ? "rolagem" : "lista do arranjo"} pelos atributos.</div>`
      : `<div class="ok-automacao">✓ Todos os valores foram distribuídos.</div>`;
    if (modo === "rolagem") {
      resumo.innerHTML += `<p class="dica">Cada valor saiu de <b>4d6 descartando o menor dado</b> (3–18, escala do d20) e foi convertido pra escala de T20 pela regra <b>(valor − 10) ÷ 2</b>, arredondando para baixo. Passe o mouse num valor da lista pra ver os dados.</p>`;
    }
  } else {
    resumo.innerHTML = `<p class="dica">Modo livre: os atributos não seguem orçamento nenhum. Bom pra reproduzir uma ficha pronta ou um NPC.</p>`;
  }
}

function formatarMod(m) { return m >= 0 ? `+${m}` : `${m}`; }

function renderDashboard() {
  const d = calcularDerivados();
  document.getElementById("nivel").value = personagem.nivel || 1;
  document.getElementById("pv-atual").value = personagem.pv.atual ?? 0;
  document.getElementById("pv-max").textContent = d.pvMax ?? "-";
  document.getElementById("pv-temp").value = personagem.pv.temp || "";
  document.getElementById("pm-atual").value = personagem.pm.atual ?? 0;
  document.getElementById("pm-max").textContent = d.pmMax ?? "-";
  const dashDefesa = document.getElementById("dash-defesa");
  dashDefesa.textContent = d.defesa;
  const partesDefesa = ["10 base", `${formatarMod(regras.mod(d.atrs.des))} Des`];
  if (d.equip.armadura) partesDefesa.push(`+${d.equip.armadura} armadura`);
  if (d.equip.escudo) partesDefesa.push(`+${d.equip.escudo} escudo`);
  if (racaAuto().defesa) partesDefesa.push(`+${racaAuto().defesa} racial`);
  if (personagem.defesaOutros) partesDefesa.push(`${formatarMod(personagem.defesaOutros)} outros`);
  dashDefesa.title = partesDefesa.join(" · ");
  document.getElementById("dash-iniciativa").textContent = formatarMod(d.iniciativa);
  // Exausto anda pela metade — o deslocamento vem como texto ("9m"), então
  // o número é extraído, dividido e recomposto.
  const deslocBase = racaAtual()?.deslocamento || "9m";
  const desloc = d.efeitos.deslocamentoMetade
    ? deslocBase.replace(/(\d+([.,]\d+)?)/, (n) => String(Math.floor(Number(String(n).replace(",", ".")) / 2)))
    : deslocBase;
  const deslocEl = document.getElementById("dash-deslocamento");
  deslocEl.textContent = desloc + (personagem.deslocamentoExtra ? ` (${personagem.deslocamentoExtra})` : "");
  deslocEl.title = d.efeitos.deslocamentoMetade ? `Metade de ${deslocBase} por estar exausto` : "";
  const cargaEl = document.getElementById("carga-max");
  if (cargaEl) {
    cargaEl.textContent = `${(Math.round(d.carga * 10) / 10)} / ${d.cargaMax} kg`;
    cargaEl.classList.toggle("carga-excedida", d.carga > d.cargaMax);
  }
  const penEl = document.getElementById("dash-penalidade");
  if (penEl) {
    penEl.textContent = d.penalidadeArmadura ? `−${d.penalidadeArmadura}` : "0";
    penEl.title = d.penalidadeArmadura
      ? "Penalidade de armadura: desconta de Acrobacia, Furtividade e Ladinagem."
      : "Nenhuma armadura equipada com penalidade.";
  }

  const barra = document.getElementById("barra-pv");
  const faixa = regras.faixaPV(personagem.pv.atual ?? 0, d.pvMax || 1);
  const pct = d.pvMax ? Math.max(0, Math.min(100, ((personagem.pv.atual ?? 0) / d.pvMax) * 100)) : 0;
  barra.style.width = `${pct}%`;
  barra.className = `dash-barra-fill ${faixa}`;
}

// ---------- Perícias ----------

function renderPericias() {
  const d = calcularDerivados();
  const busca = (document.getElementById("pericias-busca")?.value || "").trim().toLowerCase();
  const soClasse = document.getElementById("pericias-so-classe")?.checked;
  const periciasDaClasse = new Set(d.classe?.periciasDeClasse || []);
  const tbody = document.getElementById("lista-pericias");

  const lista = db.pericias.filter((p) => {
    if (busca && !p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(busca.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return false;
    if (soClasse && !periciasDaClasse.has(p.id)) return false;
    return true;
  });

  tbody.innerHTML = lista.map((p) => {
    const fontes = d.treinos.get(p.id);
    const automatica = !!fontes;
    const treinado = automatica || personagem.periciasTreinadas.includes(p.id);
    const outros = personagem.periciasOutros?.[p.id] ?? 0;
    const racial = d.bonusPericiasRacial[p.id] || 0;
    const pen = p.penalidadeArmadura ? d.penalidadeArmadura : 0;
    const bonus = bonusDePericiaSeguro(p, d);
    const partes = [`${regras.metadeNivel(d.nivel)} ½ nível`, `${formatarMod(regras.mod(d.atrs[p.atributo]))} ${p.atributo.toUpperCase()}`];
    if (treinado) partes.push(`+${regras.bonusTreino(d.nivel, true)} treino`);
    if (racial) partes.push(`${formatarMod(racial)} racial`);
    if (outros) partes.push(`${formatarMod(outros)} outros`);
    if (pen) partes.push(`−${pen} armadura`);
    const bloqueada = p.somenteTreinado && !treinado;
    return `
      <tr class="${treinado ? "treinada" : ""}${bloqueada ? " bloqueada" : ""}">
        <td><input type="checkbox" data-pericia-treino="${p.id}" ${treinado ? "checked" : ""} ${automatica ? "disabled" : ""} title="${automatica ? esc(`Treinada automaticamente por: ${fontes.join(", ")}`) : "Marcar como treinada"}" /></td>
        <td><span class="pericia-nome">${esc(p.nome)}</span>
          ${PERICIAS_COM_ESPECIALIDADE.includes(p.id)
            ? `<input type="text" class="pericia-especialidade" data-pericia-especialidade="${p.id}" value="${esc(personagem.especializacoes?.[p.id] || "")}" placeholder="especialidade…" title="${esc(`${p.nome} pede uma especialidade escolhida na criação — ex.: Ofício (ferreiro)`)}" />`
            : ""}
          ${automatica ? `<span class="tag auto" title="${esc(fontes.join(" · "))}">auto</span>` : ""}
          ${periciasDaClasse.has(p.id) ? '<span class="tag classe">de classe</span>' : ""}
          ${p.somenteTreinado ? '<span class="tag">só treinado</span>' : ""}${p.salvamento ? '<span class="tag">resistência</span>' : ""}
          ${bloqueada ? '<small class="dica-inline">precisa ser treinada para usar</small>' : ""}
        </td>
        <td>${p.atributo.toUpperCase()}</td>
        <td><span class="pericia-bonus" title="${esc(partes.join(" · "))}">${formatarMod(bonus)}</span>
          <input type="number" class="mod-outros" data-pericia-outros="${p.id}" value="${outros}" title="Outros modificadores" />
        </td>
        <td><button class="secundario" data-rolar-pericia="${p.id}">🎲</button></td>
      </tr>`;
  }).join("") || '<tr><td colspan="5" class="dica">Nenhuma perícia com esse filtro.</td></tr>';

  renderResumoTreinos(d);
}

// Wrapper defensivo: uma perícia com atributo desconhecido não pode derrubar a aba.
function bonusDePericiaSeguro(p, d) {
  try { return bonusDePericia(p, d); } catch { return 0; }
}

// "Treinos usados X / Y" com a conta aberta: fixas da classe + escolhas da
// classe (número da classe + Inteligência) + as da origem + as raciais.
// ["Guerreiro", "origem", "raça"] → "Guerreiro, origem e raça"
function listaLegivel(itens) {
  if (itens.length <= 1) return itens[0] || "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function renderResumoTreinos(d) {
  const alvo = document.getElementById("resumo-treinos");
  if (!alvo) return;
  const c = d.classe;
  if (!c) { alvo.innerHTML = '<span class="dica">Escolha uma classe na aba <b>Construção</b> para a ficha calcular quantas perícias você treina.</span>'; return; }
  const modInt = regras.mod(d.atrs.int);
  const e = escolhas();
  const auto = racaAuto();

  const vagas = [
    { rotulo: "fixas da classe", total: (c.periciasFixas || []).length, usadas: (c.periciasFixas || []).length, automatica: true },
    { rotulo: `"uma ou outra" da classe`, total: (c.periciasFixasEscolha || []).length, usadas: (c.periciasFixasEscolha || []).filter((_, i) => e.periciasClasseFixa?.[i]).length },
    { rotulo: `à escolha da classe (${c.treinosIniciais} ${formatarMod(modInt)} Int)`, total: regras.escolhasDePericiaDaClasse({ classe: c, modInt }), usadas: (e.periciasClasse || []).filter((id) => (c.periciasDeClasse || []).includes(id)).length },
    { rotulo: "da origem", total: personagem.origem && !auto.semOrigem ? Math.min(2, (origemAtual()?.periciasSugeridas || []).length || 2) : 0, usadas: (e.periciasOrigem || []).length },
    { rotulo: "da raça", total: auto.treinosEscolha || 0, usadas: (e.periciasRaciais || []).length },
  ].filter((v) => v.total > 0);

  const total = vagas.reduce((n, v) => n + v.total, 0);
  const usadas = vagas.reduce((n, v) => n + Math.min(v.usadas, v.total), 0);
  const extras = personagem.periciasTreinadas.filter((id) => !d.treinos.has(id)).length;
  const pendentes = vagas.filter((v) => v.usadas < v.total);

  alvo.innerHTML = `
    <div class="resumo-treinos-linha">
      <b>${usadas}</b> de <b>${total}</b> perícias concedidas por ${listaLegivel([esc(c.nome), personagem.origem && !auto.semOrigem ? "origem" : "", auto.treinosEscolha ? "raça" : ""].filter(Boolean))} já foram escolhidas —
      resultando em <b>${d.treinos.size}</b> perícia(s) treinada(s) na ficha.
      ${extras ? `<span class="tag">+${extras} marcada(s) à mão</span>` : ""}
    </div>
    <div class="resumo-treinos-conta">${vagas.map((v) => `${v.usadas}/${v.total} ${v.rotulo}`).join(" · ")}</div>
    ${pendentes.length
      ? `<div class="alerta-automacao">Faltam escolher: ${pendentes.map((v) => `${v.total - v.usadas} ${v.rotulo}`).join(", ")}. <button type="button" class="link-btn" data-ir-automacao="1">Abrir automação →</button></div>`
      : '<div class="ok-automacao">✓ Todas as perícias concedidas já foram escolhidas.</div>'}
    ${usadas > d.treinos.size ? '<div class="alerta-automacao">Duas fontes concederam a mesma perícia — o livro manda trocar por outra. As repetidas aparecem marcadas no painel de automação.</div>' : ""}
    <p class="dica">O bônus segue a regra do livro: <b>metade do nível + atributo + treino (+2, +4 no 7º, +6 no 15º)</b>. Perícias marcadas <b>auto</b> vêm de classe/origem/raça e não dá pra desmarcar — mude a escolha no painel de automação.</p>`;
}

// ---------- Poderes ----------

function poolPoderesDisponiveis() {
  const c = classeAtual();
  const pool = [
    ...(c ? poderesDaClasse(db, c.id) : []),
    ...(personagem.raca ? poderesDaRaca(db, personagem.raca) : []),
    ...(personagem.origem ? poderesDaOrigem(db, personagem.origem) : []),
    ...poderesGerais(db),
    ...poderesDe(db, { categoria: "concedido" }),
  ];
  const vistos = new Set();
  return pool.filter((p) => (vistos.has(p.id) ? false : (vistos.add(p.id), true)));
}

// As habilidades que a classe concede sozinha ao subir de nível (Fúria no 1º,
// Evasão no 2º...). Não ocupam vaga de poder — a ficha só mostra o que já
// está liberado e o que vem a seguir, para não parecer que sumiu algo.
function renderHabilidadesDeClasse(d) {
  const box = document.getElementById("habilidades-classe");
  if (!box) return;
  const todas = d.classes.flatMap((x) => {
    const reg = (db.habilidadesClasse || []).find((h) => h.classe === x.classe.id);
    return (reg?.habilidades || []).map((a) => ({ ...a, classe: x.classe.nome, niveisNaClasse: x.niveis }));
  });
  if (!todas.length) {
    box.innerHTML = '<p class="dica">Escolha uma classe na aba <b>Construção</b> — ou esta classe não tem habilidades tabeladas.</p>';
    return;
  }
  const liberadas = todas.filter((a) => a.nivel <= a.niveisNaClasse).sort((a, b) => a.nivel - b.nivel);
  const futuras = todas.filter((a) => a.nivel > a.niveisNaClasse).sort((a, b) => a.nivel - b.nivel);
  const linha = (a, ativa) => `<span class="chip ${ativa ? "ativo" : "limpar"}" title="${esc(`${a.classe} · ${a.nivel}º nível`)}">${esc(a.nome)}<small>${a.nivel}º</small></span>`;
  box.innerHTML = `
    <div class="resumo-treinos-linha">Já liberadas: <b>${liberadas.length}</b>${futuras.length ? ` · ainda por vir: <b>${futuras.length}</b>` : ""}.</div>
    <div class="chip-lista">${liberadas.map((a) => linha(a, true)).join("") || '<span class="dica">Nenhuma ainda.</span>'}</div>
    ${futuras.length ? `<p class="dica" style="margin-top:10px">Próximos níveis:</p><div class="chip-lista">${futuras.slice(0, 12).map((a) => linha(a, false)).join("")}</div>` : ""}
    <p class="dica" style="margin-top:10px">O texto de cada habilidade está no livro — a ficha guarda o nome e o nível para você saber o que já tem.</p>`;
}

function renderPoderes() {
  const d = calcularDerivados();
  renderHabilidadesDeClasse(d);
  const esperados = poderesEsperados();
  const e = escolhas();
  const poderOrigem = e.poderOrigem ? db.poderes.find((x) => x.id === e.poderOrigem) : null;

  const listaEsc = document.getElementById("lista-poderes-personagem");
  // 174 dos 709 poderes do compêndio custam PM (Fúria 2 PM, Aparar 1 PM...).
  // Esses ganham botão de usar, que desconta a mana igual ao "Conjurar" das
  // magias — antes o custo era só um rótulo e a conta ficava com o jogador.
  const botaoUsar = (poder) => {
    const custo = Number(poder.custo) || 0;
    if (!custo) return "";
    const temPM = (personagem.pm.atual ?? 0) >= custo;
    return `<button class="${temPM ? "primary" : "secundario"}" data-usar-poder="${poder.id}" ${temPM ? "" : "disabled"} title="${temPM ? `Gasta ${custo} PM` : "PM insuficiente"}">⚡ Usar</button>`;
  };
  const linhaOrigem = poderOrigem
    ? `<li class="poder-auto"><span data-abrir-poder="${poderOrigem.id}">${esc(poderOrigem.nome)} <span class="tag">${esc(poderOrigem.subtipo)}</span>${poderOrigem.custo ? ` <span class="tag magia">${poderOrigem.custo} PM</span>` : ""} <span class="tag auto">da origem</span></span><span class="col-rolagens">${botaoUsar(poderOrigem)}<span class="dica-inline">escolhido na automação</span></span></li>`
    : "";
  listaEsc.innerHTML = linhaOrigem + (personagem.poderes.map((id) => {
    const poder = db.poderes.find((x) => x.id === id);
    if (!poder) return "";
    const requisitoOk = requisitoAtendido(poder, d);
    return `<li>
      <span data-abrir-poder="${poder.id}">${esc(poder.nome)} <span class="tag">${esc(poder.subtipo)}</span>${poder.custo ? ` <span class="tag magia">${poder.custo} PM</span>` : ""}${requisitoOk === false ? ' <span class="tag alerta" title="Requisito do poder não parece atendido">requisito?</span>' : ""}</span>
      <span class="col-rolagens">${botaoUsar(poder)}<button class="perigo" data-remover-poder="${poder.id}">✕</button></span></li>`;
  }).join("") || (linhaOrigem ? "" : "<li>Nenhum poder escolhido ainda.</li>"));

  const escolhidos = personagem.poderes.length;
  document.getElementById("poderes-escolhidos-n").textContent = escolhidos;
  document.getElementById("poderes-esperados").textContent = esperados.escolhiveis;

  const resumo = document.getElementById("resumo-poderes");
  if (resumo) {
    const faltam = esperados.escolhiveis - escolhidos;
    const partes = [];
    if (d.classe) partes.push(`<b>${esperados.daClasse}</b> poder(es) de ${esc(d.classe.nome)} (um no 2º nível e um a cada nível seguinte)`);
    if (esperados.daOrigem) partes.push(`<b>1</b> poder de origem${poderOrigem ? ` — ${esc(poderOrigem.nome)} ✓` : " — <b>ainda não escolhido</b>"}`);
    if (esperados.geraisExtra) partes.push(`<b>${esperados.geraisExtra}</b> poder geral extra (traço racial)`);
    resumo.innerHTML = `
      <div class="resumo-treinos-linha">Neste nível (${d.nivel}) você tem direito a <b>${esperados.total}</b> poder(es) no total.</div>
      <div class="resumo-treinos-conta">${partes.join(" · ") || "Escolha uma classe para a ficha calcular seus poderes."}</div>
      ${faltam > 0
        ? `<div class="alerta-automacao">Você ainda pode escolher <b>${faltam}</b> poder(es) na lista abaixo.</div>`
        : faltam < 0
          ? `<div class="alerta-automacao">Você escolheu <b>${-faltam}</b> poder(es) a mais do que o nível ${d.nivel} concede.</div>`
          : '<div class="ok-automacao">✓ Todos os poderes deste nível já foram escolhidos.</div>'}`;
  }

  renderCatalogoPoderes();
}

// O compêndio guarda o requisito como texto livre ("Força 1", "treinado em
// Luta", "4º nível"...). Só checamos o que dá pra ler com segurança —
// requisito de nível e de atributo — e devolvemos null quando não sabemos.
function requisitoAtendido(poder, d) {
  const txt = String(poder?.requisito || "").trim();
  if (!txt) return null;
  const nivel = txt.match(/(\d+)\s*º?\s*n[ií]vel/i);
  if (nivel && d.nivel < Number(nivel[1])) return false;
  const ATRS = { for: "for", des: "des", con: "con", int: "int", sab: "sab", car: "car" };
  const NOMES = { "força": "for", "destreza": "des", "constituição": "con", "inteligência": "int", "sabedoria": "sab", "carisma": "car" };
  const atr = txt.match(/(For[çc]a|Destreza|Constitui[çc][ãa]o|Intelig[êe]ncia|Sabedoria|Carisma)\s+(\d+)/i);
  if (atr) {
    const chave = NOMES[atr[1].toLowerCase().normalize("NFC")] || ATRS[atr[1].slice(0, 3).toLowerCase()];
    if (chave && regras.mod(d.atrs[chave]) < Number(atr[2])) return false;
  }
  // "Conta como" outra raça para pré-requisito: um Meio-Orc atende requisito
  // de Orc, um Soterrado atende o de Osteon.
  const raca = racaAtual();
  if (raca) {
    const nomes = [raca.nome, ...(raca.contaComo || [])].map((n) => n.toLowerCase());
    const pedeRaca = db.racas.find((x) => new RegExp(`\\b${x.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(txt));
    if (pedeRaca && !nomes.includes(pedeRaca.nome.toLowerCase())) return false;
  }
  const treino = txt.match(/treinad[oa]\s+em\s+([A-Za-zÀ-ÿ]+)/i);
  if (treino) {
    const pericia = db.pericias.find((x) => x.nome.toLowerCase().startsWith(treino[1].toLowerCase().slice(0, 4)));
    if (pericia && !estaTreinado(pericia.id, d)) return false;
  }
  return true;
}

function renderCatalogoPoderes() {
  const d = calcularDerivados();
  const categoria = document.getElementById("poderes-filtro-categoria").value;
  const busca = document.getElementById("poderes-busca").value;
  const soDisponiveis = document.getElementById("poderes-so-disponiveis")?.checked;
  let lista = categoria || busca ? poderesDe(db, { categoria: categoria || undefined, busca: busca || undefined }) : poolPoderesDisponiveis();
  if (soDisponiveis) lista = lista.filter((poder) => requisitoAtendido(poder, d) !== false);
  lista = lista.slice(0, 200);
  const catalogo = document.getElementById("lista-poderes-catalogo");
  catalogo.innerHTML = lista.map((poder) => {
    const ok = requisitoAtendido(poder, d);
    return `
    <li data-abrir-poder="${poder.id}"${ok === false ? ' class="requisito-nao-atendido"' : ""}>
      <span>${esc(poder.nome)} <span class="tag">${esc(poder.subtipo)}</span>${poder.custo ? ` <span class="tag">${poder.custo} PM</span>` : ""}${ok === false ? ` <span class="tag alerta" title="${esc(poder.requisito)}">requisito</span>` : ""}</span>
      <button data-add-poder="${poder.id}">${personagem.poderes.includes(poder.id) ? "✓" : "➕"}</button>
    </li>`;
  }).join("") || '<li class="dica">Nenhum poder com esse filtro.</li>';
}

// ---------- Magias ----------

// ==============================================================
// Gasto de PM — o recurso central de Tormenta 20.
//
// Em T20 não existe "espaço de magia": toda magia e boa parte dos poderes
// (Fúria 2 PM, Inspiração 2 PM, Aparar 1 PM...) são pagos em Pontos de
// Mana, e o custo já vem no compêndio. Antes a ficha só *mostrava* esse
// número — quem jogava tinha que abrir a caixa de PM e digitar o novo
// total a cada uso. gastarPM() centraliza isso: desconta, recusa quando
// não há mana suficiente, registra no histórico de rolagens e avisa a sala.
// ==============================================================
function gastarPM(custo, rotulo) {
  const n = Math.max(0, Math.round(Number(custo) || 0));
  if (!n) { toast(`${rotulo} não custa PM.`); return true; }
  const atual = personagem.pm.atual ?? 0;
  if (atual < n) {
    toast(`PM insuficiente: ${rotulo} custa ${n} PM e você tem ${atual}.`);
    return false;
  }
  personagem.pm.atual = atual - n;
  salvarERenderizar();
  const detalhe = `${n} PM · restam ${personagem.pm.atual}`;
  registrarNoHistorico(rotulo, detalhe, personagem.pm.atual);
  broadcastRoll(`${personagem.nome || "Personagem"} usou ${rotulo}`, detalhe, personagem.pm.atual, { type: "outro" });
  toast(`${rotulo}: −${n} PM (restam ${personagem.pm.atual}).`);
  return true;
}

// Recupera PM (item, poder, descanso parcial), sem passar do máximo.
function recuperarPM(quanto) {
  const d = calcularDerivados();
  personagem.pm.atual = Math.min(d.pmMax ?? Infinity, (personagem.pm.atual ?? 0) + Math.max(0, Number(quanto) || 0));
  salvarERenderizar();
}

// ---------- Magias ----------

// Um conjurador só alcança um círculo novo a cada quatro níveis. Magias
// acima disso continuam podendo ficar guardadas na ficha (o jogador pode
// estar planejando a subida de nível), mas aparecem marcadas e o botão de
// conjurar fica travado.
// A tabela da classe (data/core/conjuracao.json) é quem decide: Bardo e
// Druida são meio-conjuradores e param no 4º círculo, enquanto Arcanista e
// Clérigo chegam ao 5º. Sem tabela (classe de suplemento), vale a fórmula
// genérica do conjurador pleno.
function tabelaDeConjuracao() {
  const classe = classeAtual();
  if (!classe) return null;
  // O Caminho do Arcanista muda quantas magias ele aprende.
  const escolhaCaminho = escolhas().escolhasClasse?.[`${classe.id}.caminho`];
  const poder = escolhaCaminho ? db.poderes.find((p) => p.id === escolhaCaminho) : null;
  const subtipo = poder ? String(poder.nome).split(":").slice(1).join(":").trim() : null;
  return conjuracaoDaClasse(db, classe.id, subtipo);
}
function magiaLiberada(m, nivel) {
  return Number(m?.circulo || 1) <= regras.circuloMaximoDaClasse(tabelaDeConjuracao(), nivel);
}

function renderMagias() {
  const c = classeAtual();
  const semConjuracao = !c || !c.conjuracao;
  document.getElementById("magias-sem-conjuracao").hidden = !semConjuracao;
  document.getElementById("magias-conteudo").style.display = semConjuracao ? "none" : "";
  if (semConjuracao) return;

  const d = calcularDerivados();
  const tabela = tabelaDeConjuracao();
  const maxCirculo = regras.circuloMaximoDaClasse(tabela, d.nivel);
  const cota = regras.magiasConhecidasNoNivel(tabela, d.nivel);
  const conhecidas = personagem.magias.map((id) => db.magias.find((x) => x.id === id)).filter(Boolean);

  const resumo = document.getElementById("resumo-magias");
  if (resumo) {
    const porCirculo = [1, 2, 3, 4, 5].map((n) => ({ n, qtd: conhecidas.filter((m) => Number(m.circulo) === n).length }));
    const acima = conhecidas.filter((m) => !magiaLiberada(m, d.nivel));
    resumo.innerHTML = `
      <div class="resumo-treinos-linha">Conjuração <b>${esc(tabela?.tipo || c.conjuracao)}</b>${tabela?.nome && tabela.subtipo ? ` (${esc(tabela.subtipo)})` : ""} · no nível <b>${d.nivel}</b> você alcança até o <b>${maxCirculo}º círculo</b>${maxCirculo < 5 ? ` (o ${maxCirculo + 1}º chega no ${regras.nivelDoCirculoDaClasse(tabela, maxCirculo + 1)}º nível)` : " (máximo)"}.</div>
      <div class="resumo-treinos-conta">Magias conhecidas: ${porCirculo.map((x) => `<b>${x.qtd}</b> de ${x.n}º`).join(" · ")} · total <b>${conhecidas.length}</b>${cota != null ? ` de <b>${cota}</b> que o nível concede` : ""} · PM disponível <b>${personagem.pm.atual ?? 0}</b>/${d.pmMax ?? 0}.</div>
      ${cota != null && conhecidas.length !== cota
        ? `<div class="alerta-automacao">${conhecidas.length < cota
            ? `Faltam <b>${cota - conhecidas.length}</b> magia(s) para o total do nível ${d.nivel}.`
            : `Você tem <b>${conhecidas.length - cota}</b> magia(s) a mais do que o nível ${d.nivel} concede.`}</div>`
        : cota != null ? '<div class="ok-automacao">✓ Você conhece exatamente as magias do seu nível.</div>' : ""}
      ${acima.length
        ? `<div class="alerta-automacao">${acima.length} magia(s) acima do seu círculo máximo (${acima.map((m) => esc(m.nome)).join(", ")}) — ficam guardadas, mas não dá pra conjurar ainda.</div>`
        : ""}
      <p class="dica">Em T20 magia não tem "espaço": você paga o custo em PM (${Object.entries(regras.CUSTO_POR_CIRCULO).map(([k, v]) => `${k}º = ${v} PM`).join(", ")}). O botão <b>Conjurar</b> desconta sozinho e avisa quando falta mana.</p>`;
  }

  const listaConh = document.getElementById("lista-magias-personagem");
  listaConh.innerHTML = conhecidas.map((m) => {
    const custo = regras.custoDaMagia(m);
    const liberada = magiaLiberada(m, d.nivel);
    const temPM = (personagem.pm.atual ?? 0) >= custo;
    const favorita = personagem.magiasPreparadas.includes(m.id);
    return `<li class="${liberada ? "" : "requisito-nao-atendido"}">
      <span data-abrir-magia="${m.id}">${esc(m.nome)} <span class="tag">${m.circulo}º círc.</span> <span class="tag magia">${custo} PM</span>${liberada ? "" : ` <span class="tag alerta" title="Você alcança o ${m.circulo}º círculo no ${regras.nivelDoCirculoDaClasse(tabela, m.circulo)}º nível">${regras.nivelDoCirculoDaClasse(tabela, m.circulo)}º nível</span>`}</span>
      <span class="col-rolagens">
        <button class="${liberada && temPM ? "primary" : "secundario"}" data-conjurar-magia="${m.id}" ${liberada && temPM ? "" : "disabled"} title="${liberada ? (temPM ? `Gasta ${custo} PM` : "PM insuficiente") : "Círculo acima do seu nível"}">✨ Conjurar</button>
        <button data-preparar-magia="${m.id}" title="Marca como favorita para achar rápido no combate">${favorita ? "★" : "☆"}</button>
        <button class="perigo" data-remover-magia="${m.id}">✕</button>
      </span></li>`;
  }).join("") || "<li>Nenhuma magia conhecida ainda.</li>";

  renderCatalogoMagias(c);
}

function renderCatalogoMagias(classe) {
  const circulo = document.getElementById("magias-filtro-circulo").value;
  const busca = document.getElementById("magias-busca").value;
  const lista = magiasFiltradas(db, {
    tipo: !busca && !circulo ? classe.conjuracao[0].toUpperCase() + classe.conjuracao.slice(1) : undefined,
    circulo: circulo || undefined,
    busca: busca || undefined,
  }).slice(0, 200);
  const catalogo = document.getElementById("lista-magias-catalogo");
  const nivel = personagem.nivel || 1;
  const tabela = tabelaDeConjuracao();
  catalogo.innerHTML = lista.map((m) => {
    const liberada = magiaLiberada(m, nivel);
    return `
    <li data-abrir-magia="${m.id}" class="${liberada ? "" : "requisito-nao-atendido"}">
      <span>${esc(m.nome)} <span class="tag">${esc(m.tipo)}</span> <span class="tag">${m.circulo}º círc.</span> <span class="tag magia">${regras.custoDaMagia(m)} PM</span>${liberada ? "" : ` <span class="tag alerta">${regras.nivelDoCirculoDaClasse(tabela, m.circulo)}º nível</span>`}</span>
      <button data-add-magia="${m.id}">${personagem.magias.includes(m.id) ? "✓" : "➕"}</button>
    </li>`;
  }).join("") || '<li class="dica">Nenhuma magia com esse filtro.</li>';
}

// ---------- Combate ----------

function renderCombate() {
  renderCombateArmas();
  const d = calcularDerivados();
  const resist = document.getElementById("lista-resistencias");
  resist.innerHTML = db.pericias.filter((p) => p.salvamento).map((p) => {
    const bonus = bonusDePericiaSeguro(p, d);
    return `<div class="resistencia-caixa">
      <label>${esc(p.nome)}</label>
      <div class="valor">${formatarMod(bonus)}</div>
      <small>${p.atributo.toUpperCase()}${estaTreinado(p.id, d) ? " · treinada" : ""}</small>
      <button type="button" class="secundario" data-rolar-resistencia="${p.id}">🎲 Rolar</button>
    </div>`;
  }).join("");

  const tbody = document.getElementById("lista-ataques");
  tbody.innerHTML = personagem.ataques.map((at, i) => {
    const bonus = bonusDeAtaque(at, d);
    const crit = parseCritico(at.critico);
    return `<tr>
      <td><input data-ataque-campo="nome" data-ataque-idx="${i}" value="${esc(at.nome || "")}" placeholder="Arma" /></td>
      <td><select data-ataque-campo="pericia" data-ataque-idx="${i}">
        <option value="lut" ${at.pericia === "lut" ? "selected" : ""}>Luta</option>
        <option value="pon" ${at.pericia === "pon" ? "selected" : ""}>Pontaria</option>
      </select></td>
      <td><input data-ataque-campo="dano" data-ataque-idx="${i}" value="${esc(at.dano || "")}" placeholder="1d8+for" title="Aceita os apelidos for/des/con/int/sab/car — a ficha troca pelo modificador na hora de rolar." /></td>
      <td><input data-ataque-campo="critico" data-ataque-idx="${i}" value="${esc(at.critico || "20/x2")}" title="margem/multiplicador — ex.: 19/x3" /></td>
      <td class="col-rolagens">
        <button data-rolar-ataque="${i}" title="Rolar ataque (crítico a partir de ${crit.margem})">🎲 ${formatarMod(bonus)}</button>
        <button class="secundario" data-rolar-dano="${i}" title="Rolar dano">🩸 dano</button>
      </td>
      <td><button class="perigo" data-remover-ataque="${i}">✕</button></td>
    </tr>`;
  }).join("") || '<tr><td colspan="6" class="dica">Nenhum ataque ainda. Equipe uma arma na aba <b>Equipamentos</b> para a ficha montar o ataque sozinha.</td></tr>';

  const listaCond = document.getElementById("lista-condicoes");
  listaCond.innerHTML = personagem.condicoes.map((cid, i) => {
    const c = CONDICOES.find((x) => x.id === cid);
    if (!c) return "";
    return `<li><span><strong>${esc(c.nome)}</strong> ${c.efeitos ? '<span class="tag auto">aplicada</span>' : '<span class="tag" title="Efeito comportamental ou variável — a ficha mantém como lembrete, mas não mexe nos números">só lembrete</span>'}<br><small class="dica">${esc(c.efeito)}</small></span>
      <button class="perigo" data-remover-condicao="${i}">✕</button></li>`;
  }).join("") || '<li class="dica">Nenhuma condição ativa.</li>';

  renderModificadores(d);
  renderParceiros();
}

// ==============================================================
// Parceiros — aliados e montarias.
//
// Em T20 os poderes "Aliado: X" e "Montaria: X" dão um parceiro que luta
// junto e tem PV próprios. A ficha não recalcula o bloco de regras dele (o
// texto está no compêndio); ela acompanha o que muda em jogo: PV atual,
// tipo e anotações. Os poderes dessas famílias que o personagem já tem
// viram atalhos de "adicionar parceiro".
// ==============================================================
const FAMILIAS_DE_PARCEIRO = ["Aliado", "Montaria"];

function poderesDeParceiroEscolhidos() {
  return personagem.poderes
    .map((id) => db.poderes.find((x) => x.id === id))
    .filter((p) => p && FAMILIAS_DE_PARCEIRO.includes(String(p.nome).split(":")[0].trim()))
    .map((p) => ({
      id: p.id,
      familia: String(p.nome).split(":")[0].trim(),
      tipo: String(p.nome).split(":").slice(1).join(":").trim(),
    }));
}

function renderParceiros() {
  const sug = document.getElementById("parceiros-sugestoes");
  const lista = document.getElementById("lista-parceiros");
  if (!lista) return;

  const doPoder = poderesDeParceiroEscolhidos();
  if (sug) {
    const jaTem = new Set((personagem.parceiros || []).map((x) => x.poderId).filter(Boolean));
    sug.innerHTML = doPoder.length
      ? doPoder.map((p) => `<button type="button" class="chip${jaTem.has(p.id) ? " travado" : " acao"}" ${jaTem.has(p.id) ? "disabled" : `data-add-parceiro-poder="${esc(p.id)}"`}>${esc(p.familia)}: ${esc(p.tipo)}<small>${jaTem.has(p.id) ? "já na lista" : "adicionar"}</small></button>`).join("")
      : '<span class="dica">Nenhum poder de Aliado ou Montaria escolhido ainda — dá pra adicionar um parceiro à mão abaixo.</span>';
  }

  lista.innerHTML = (personagem.parceiros || []).map((p, i) => `
    <div class="parceiro-card">
      <div class="parceiro-topo">
        <input type="text" data-parceiro-campo="nome" data-parceiro-idx="${i}" value="${esc(p.nome || "")}" placeholder="Nome" />
        <input type="text" data-parceiro-campo="tipo" data-parceiro-idx="${i}" value="${esc(p.tipo || "")}" placeholder="Tipo" />
        <button class="perigo" data-remover-parceiro="${i}">✕</button>
      </div>
      <div class="parceiro-pv">
        <label>PV <input type="number" data-parceiro-campo="pvAtual" data-parceiro-idx="${i}" value="${Number(p.pvAtual) || 0}" /></label>
        <span>/</span>
        <label>máx <input type="number" data-parceiro-campo="pvMax" data-parceiro-idx="${i}" value="${Number(p.pvMax) || 0}" /></label>
        <div class="dash-barra"><div class="dash-barra-fill ${regras.faixaPV(Number(p.pvAtual) || 0, Number(p.pvMax) || 1)}" style="width:${p.pvMax ? Math.max(0, Math.min(100, ((Number(p.pvAtual) || 0) / Number(p.pvMax)) * 100)) : 0}%"></div></div>
      </div>
      <textarea data-parceiro-campo="notas" data-parceiro-idx="${i}" rows="2" placeholder="Ataques, habilidades, anotações…">${esc(p.notas || "")}</textarea>
    </div>`).join("") || '<p class="dica">Nenhum parceiro.</p>';

  sug?.querySelectorAll("[data-add-parceiro-poder]").forEach((b) => b.addEventListener("click", () => {
    const p = doPoder.find((x) => x.id === b.dataset.addParceiroPoder);
    if (!p) return;
    personagem.parceiros = [...(personagem.parceiros || []), { nome: p.tipo, tipo: p.familia, poderId: p.id, pvAtual: 0, pvMax: 0, notas: "" }];
    salvarERenderizar();
  }));
}

// ==============================================================
// Modificadores temporários — o "+2 em tudo" da bênção, o "−1 na Defesa"
// do item amaldiçoado. O campo já existia salvo na ficha
// (personagem.modificadoresTemp) mas nada lia ele; agora ele é editável e
// entra nas mesmas contas das condições.
// ==============================================================
function renderModificadores(d) {
  const box = document.getElementById("lista-modificadores");
  if (!box) return;
  const lista = personagem.modificadoresTemp || [];
  box.innerHTML = lista.map((m, i) => {
    const alvo = ALVOS_MODIFICADOR.find((a) => a.id === m.alvo);
    const detalhe = m.alvo === "pericia" ? nomePericia(m.pericia)
      : m.alvo === "atributo" ? (db.atributos.find((a) => a.id === m.atributo)?.nome || m.atributo)
      : alvo?.nome || m.alvo;
    return `<li><span><strong>${esc(m.nome || "Modificador")}</strong> <span class="tag ${Number(m.valor) >= 0 ? "auto" : "alerta"}">${formatarMod(Number(m.valor) || 0)}</span> <small class="dica">${esc(detalhe)}</small></span>
      <button class="perigo" data-remover-modificador="${i}">✕</button></li>`;
  }).join("") || '<li class="dica">Nenhum modificador temporário.</li>';

  const ef = d.efeitos;
  const resumo = document.getElementById("resumo-efeitos");
  if (resumo) {
    const partes = [];
    if (ef.pericias) partes.push(`${formatarMod(ef.pericias)} em todas as perícias`);
    if (ef.ataque) partes.push(`${formatarMod(ef.ataque)} nos ataques`);
    if (ef.ataqueCorpo) partes.push(`${formatarMod(ef.ataqueCorpo)} em ataques corpo a corpo`);
    if (ef.defesa) partes.push(`${formatarMod(ef.defesa)} na Defesa`);
    for (const [k, v] of Object.entries(ef.periciasEspecificas)) partes.push(`${formatarMod(v)} em ${nomePericia(k)}`);
    for (const [k, v] of Object.entries(ef.atributos)) partes.push(`${formatarMod(v)} em ${db.atributos.find((a) => a.id === k)?.nome || k}`);
    if (ef.destrezaZero) partes.push("Destreza tratada como 0");
    if (ef.defesaFixa != null) partes.push(`Defesa fixada em ${ef.defesaFixa}`);
    if (ef.deslocamentoMetade) partes.push("deslocamento pela metade");
    resumo.innerHTML = partes.length
      ? `<div class="alerta-automacao">Em efeito agora: ${partes.join(" · ")}. <small>(de ${listaLegivel([...new Set(ef.fontes)])})</small></div>`
      : '<div class="ok-automacao">✓ Nenhum efeito ativo mexendo nos números.</div>';
  }
}

function bonusDeAtaque(at, d) {
  const pericia = db.pericias.find((p) => p.id === at.pericia);
  if (!pericia) return 0;
  const ef = d.efeitos || efeitosAtivos();
  // O penalidade geral de perícia já entrou em bonusDePericia; aqui somam só
  // os que valem exclusivamente para ataque (e o de corpo a corpo, que não
  // atinge Pontaria).
  const extraAtaque = ef.ataque + (at.pericia === "lut" ? ef.ataqueCorpo : 0);
  return bonusDePericiaSeguro(pericia, d) + (Number(at.bonusExtra) || 0) + extraAtaque;
}

// "19/x3" → { margem: 19, multiplicador: 3 }. Um campo vazio ou estranho cai
// no crítico padrão de T20 (20/x2).
function parseCritico(texto) {
  const t = String(texto || "").trim();
  const margem = t.match(/(\d{1,2})/);
  const mult = t.match(/x\s*(\d)/i);
  return {
    margem: margem ? Math.min(20, Math.max(2, Number(margem[1]))) : 20,
    multiplicador: mult ? Math.max(2, Number(mult[1])) : 2,
  };
}

// Nas expressões de dano os apelidos for/des/con/int/sab/car viram o
// modificador do atributo — "1d8+for" numa personagem com Força 3 rola 1d8+3.
function expandirAtributosNoDano(expr, d) {
  return String(expr || "").replace(/\b(for|des|con|int|sab|car)\b/gi, (m) => {
    const v = regras.mod(d.atrs[m.toLowerCase()]);
    return v >= 0 ? `+${v}` : `${v}`;
  }).replace(/\+\s*\+/g, "+").replace(/\+\s*-/g, "-");
}

function rolarDanoDoAtaque(i, critico = false) {
  const d = calcularDerivados();
  const at = personagem.ataques[i];
  if (!at) return;
  const expr = expandirAtributosNoDano(at.dano, d);
  const parsed = regras.parseDiceExpr(expr);
  if (!parsed) { toast("Preencha o dano da arma (ex.: 1d8+for) para rolar."); return; }
  const { multiplicador } = parseCritico(at.critico);
  const vezes = critico ? multiplicador : 1;
  const { rolls, total } = regras.rollDice(parsed.n * vezes, parsed.faces);
  const totalFinal = total + parsed.bonus * vezes;
  const rotulo = `Dano: ${at.nome || "ataque"}${critico ? ` (crítico ×${multiplicador})` : ""}`;
  const detalhe = `${parsed.n * vezes}d${parsed.faces} [${rolls.join(", ")}] ${formatarMod(parsed.bonus * vezes)}`;
  toast(`${rotulo}: ${detalhe} = ${totalFinal}`);
  registrarNoHistorico(rotulo, detalhe, totalFinal);
  broadcastRoll(rotulo, detalhe, totalFinal, { type: "dano", amount: totalFinal });
  return totalFinal;
}

// ---------- Equipamentos ----------

function ehArma(rec) { return rec?.tipoItem === "arma" || !!rec?.dano; }
// Luta ou Pontaria? O compêndio diz isso na primeira linha da descrição
// ("Arma Marcial - Ataque à Distância" / "Arma Simples - Corpo a Corpo").
// O campo `alcance` NÃO serve pra isso: adaga e lança são corpo a corpo e
// ainda assim trazem alcance "Curto" (a distância de arremesso delas) — ler
// só o alcance jogava metade das armas brancas pra Pontaria.
function armaEhDistancia(rec) {
  const txt = String(rec?.descricao || "");
  // A categoria vive na PRIMEIRA linha ("Arma Simples - Ataque à Distância").
  // Só ela decide: o corpo do texto costuma citar as duas coisas — a azagaia
  // é arma de arremesso e o texto dela ainda explica como usá-la "como arma
  // corpo a corpo", com penalidade.
  const cabecalho = txt.split("\n")[0] || "";
  if (/ataque\s+[àa]\s+dist[âa]ncia/i.test(cabecalho)) return true;
  if (/corpo\s*a\s*corpo/i.test(cabecalho)) return false;
  // Armas sem cabeçalho de categoria (itens de origem, itens de aventura):
  // arma de fogo é à distância, o resto é improviso corpo a corpo.
  if (/arma\s+de\s+fogo|disparo|proj[ée]til/i.test(txt)) return true;
  return false;
}

// Monta a linha de ataque a partir do item do compêndio: perícia (Luta para
// corpo a corpo, Pontaria para armas de ataque à distância), dano com o
// modificador de atributo certo, margem e multiplicador de crítico.
function ataqueDaArma(rec) {
  const distancia = armaEhDistancia(rec);
  const dano = rec.dano ? `${rec.dano}${distancia ? "" : "+for"}` : "";
  return {
    nome: rec.nome,
    pericia: distancia ? "pon" : "lut",
    dano,
    critico: `${rec.criticoM || 20}/x${rec.criticoX || 2}`,
    itemId: rec.id,
  };
}

// ==============================================================
// Armadura, escudo e armas — atalhos que faltavam.
//
// Até aqui a única forma de vestir uma armadura era caçar o item no
// catálogo geral (misturado com tesouros e consumíveis), adicionar ao
// inventário e só então equipar. Estas funções dão um seletor direto por
// função — armadura, escudo, arma corpo a corpo, arma à distância — que
// adiciona ao inventário, equipa e, no caso das armas, já cria a linha de
// ataque na aba Combate.
// ==============================================================

// O compêndio não marca armadura/escudo como tipo próprio: armaduras vêm
// como "tesouro" com "Armadura Leve/Pesada" na descrição e escudos vêm
// como "arma". regras.lerArmadura() é quem sabe ler isso.
function classificarEquipamento(rec) {
  const info = regras.lerArmadura(rec);
  if (info?.tipo === "escudo") return "escudo";
  if (info) return "armadura";
  // Só o que o compêndio marca como `tipoItem: "arma"` entra nos seletores
  // de arma — poções e itens de origem também têm dano ("Elixir da vida",
  // 4d6) e não são coisas que se empunha.
  if (rec?.tipoItem === "arma") return armaEhDistancia(rec) ? "arma-distancia" : "arma-corpo";
  return rec?.tipoItem || "tesouro";
}
function catalogoPorFuncao(funcao) {
  // O compêndio traz algumas entradas repetidas (duas "Alabarda", por
  // exemplo) — no seletor por função elas viram uma linha só.
  const vistos = new Set();
  return db.equipamentos
    .filter((e) => classificarEquipamento(e) === funcao)
    .filter((e) => { const k = e.nome.trim().toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
// Item do inventário atualmente equipado numa "vaga" (armadura ou escudo).
function equipadoNaVaga(vaga) {
  return personagem.equipamentos.find((item) => {
    if (!item.equipado) return false;
    const info = regras.lerArmadura(registroDoItem(item));
    return info && (vaga === "escudo" ? info.tipo === "escudo" : info.tipo !== "escudo");
  }) || null;
}
function garantirNoInventario(rec) {
  let item = personagem.equipamentos.find((x) => x.id === rec.id);
  if (!item) {
    item = { id: rec.id, nome: rec.nome, peso: rec.peso, qtd: 1, equipado: false };
    personagem.equipamentos.push(item);
  }
  return item;
}
// Equipa uma armadura/escudo, tirando o que estava na mesma vaga.
function equiparNaVaga(rec, vaga) {
  const atual = equipadoNaVaga(vaga);
  if (atual && atual.id === rec.id) { atual.equipado = false; salvarERenderizar(); return; }
  if (atual) atual.equipado = false;
  garantirNoInventario(rec).equipado = true;
  salvarERenderizar();
  toast(`${rec.nome} equipado.`);
}
// Empunhar uma arma = colocar no inventário e criar a linha de ataque.
function empunharArma(rec) {
  garantirNoInventario(rec);
  if (personagem.ataques.some((a) => a.itemId === rec.id)) {
    personagem.ataques = personagem.ataques.filter((a) => a.itemId !== rec.id);
    salvarERenderizar();
    toast(`${rec.nome} saiu da lista de ataques.`);
    return;
  }
  personagem.ataques.push(ataqueDaArma(rec));
  salvarERenderizar();
  toast(`Ataque de ${rec.nome} criado.`);
}

function slotHtml({ vaga, rotulo, rec, detalhe }) {
  return `<div class="equip-slot ${rec ? "preenchido" : "vazio"}">
    <div class="equip-slot-info"><span>${esc(rotulo)}</span><b>${rec ? esc(rec.nome) : "nada equipado"}</b><small>${detalhe}</small></div>
    ${rec ? `<button type="button" class="perigo" data-equip-tirar="${vaga}">Tirar</button>` : ""}
  </div>`;
}

function opcoesHtml(lista, selecionadosIds, attr) {
  return `<div class="equip-opcoes">${lista.map((rec) => {
    const info = regras.lerArmadura(rec);
    const detalhe = info
      ? `+${info.defesa} Defesa${info.penalidade ? ` · −${info.penalidade} penalidade` : ""}${rec.peso ? ` · ${rec.peso}kg` : ""}`
      : `${rec.dano || "—"} · ${rec.criticoM || 20}/x${rec.criticoX || 2}${rec.peso ? ` · ${rec.peso}kg` : ""}`;
    return `<button type="button" class="equip-opcao${selecionadosIds.includes(rec.id) ? " selected" : ""}" ${attr}="${esc(rec.id)}">
      <b>${esc(rec.nome)}</b><small>${esc(detalhe)}</small></button>`;
  }).join("") || '<p class="dica">Nenhum item.</p>'}</div>`;
}

// Painel "Armadura, escudo e armas" da aba Equipamentos (e do passo
// "Equipamento" do assistente guiado).
function renderEquipSlots(alvoId = "equip-slots") {
  const box = document.getElementById(alvoId);
  if (!box) return;
  const d = calcularDerivados();
  const armadura = equipadoNaVaga("armadura");
  const escudo = equipadoNaVaga("escudo");
  const recArmadura = armadura ? registroDoItem(armadura) : null;
  const recEscudo = escudo ? registroDoItem(escudo) : null;
  const armasNaLista = personagem.ataques.map((a) => a.itemId).filter(Boolean);

  box.innerHTML = `
    <div class="equip-quick-col">
      <h3>Armadura</h3>
      ${slotHtml({ vaga: "armadura", rotulo: "Vestindo", rec: recArmadura, detalhe: d.equip.armadura ? `+${d.equip.armadura} de Defesa${d.equip.penalidade ? ` · −${d.equip.penalidade} de penalidade` : ""}` : "Defesa sem armadura" })}
      ${opcoesHtml(catalogoPorFuncao("armadura"), recArmadura ? [recArmadura.id] : [], "data-equip-armadura")}
    </div>
    <div class="equip-quick-col">
      <h3>Escudo</h3>
      ${slotHtml({ vaga: "escudo", rotulo: "Empunhando", rec: recEscudo, detalhe: d.equip.escudo ? `+${d.equip.escudo} de Defesa` : "Nenhum bônus de escudo" })}
      ${opcoesHtml(catalogoPorFuncao("escudo"), recEscudo ? [recEscudo.id] : [], "data-equip-escudo")}
    </div>
    <div class="equip-quick-col">
      <h3>Armas corpo a corpo <span class="tag">Luta</span></h3>
      ${opcoesHtml(catalogoPorFuncao("arma-corpo"), armasNaLista, "data-equip-arma")}
    </div>
    <div class="equip-quick-col">
      <h3>Armas à distância <span class="tag">Pontaria</span></h3>
      ${opcoesHtml(catalogoPorFuncao("arma-distancia"), armasNaLista, "data-equip-arma")}
    </div>
    <p class="dica coluna-cheia">Defesa atual: <b>${d.defesa}</b> (10 base ${formatarMod(regras.mod(d.atrs.des))} Des${d.equip.armadura ? ` +${d.equip.armadura} armadura` : ""}${d.equip.escudo ? ` +${d.equip.escudo} escudo` : ""}). Carga: <b>${Math.round(d.carga * 10) / 10}</b>/${d.cargaMax}.</p>`;

  box.querySelectorAll("[data-equip-armadura]").forEach((b) => b.addEventListener("click", () => equiparNaVaga(db.equipamentos.find((x) => x.id === b.dataset.equipArmadura), "armadura")));
  box.querySelectorAll("[data-equip-escudo]").forEach((b) => b.addEventListener("click", () => equiparNaVaga(db.equipamentos.find((x) => x.id === b.dataset.equipEscudo), "escudo")));
  box.querySelectorAll("[data-equip-arma]").forEach((b) => b.addEventListener("click", () => empunharArma(db.equipamentos.find((x) => x.id === b.dataset.equipArma))));
  box.querySelectorAll("[data-equip-tirar]").forEach((b) => b.addEventListener("click", () => {
    const item = equipadoNaVaga(b.dataset.equipTirar);
    if (item) { item.equipado = false; salvarERenderizar(); }
  }));
}

// Versão enxuta do painel para a aba Combate: só as armas.
function renderCombateArmas() {
  const box = document.getElementById("combate-armas");
  if (!box) return;
  const armasNaLista = personagem.ataques.map((a) => a.itemId).filter(Boolean);
  box.innerHTML = `
    <div class="equip-quick-col"><h3>Corpo a corpo <span class="tag">Luta</span></h3>${opcoesHtml(catalogoPorFuncao("arma-corpo"), armasNaLista, "data-equip-arma")}</div>
    <div class="equip-quick-col"><h3>À distância <span class="tag">Pontaria</span></h3>${opcoesHtml(catalogoPorFuncao("arma-distancia"), armasNaLista, "data-equip-arma")}</div>`;
  box.querySelectorAll("[data-equip-arma]").forEach((b) => b.addEventListener("click", () => empunharArma(db.equipamentos.find((x) => x.id === b.dataset.equipArma))));
}

function renderEquipamentos() {
  const d = calcularDerivados();
  const tbody = document.getElementById("lista-inventario");
  tbody.innerHTML = personagem.equipamentos.map((item, i) => {
    const rec = registroDoItem(item);
    const armadura = regras.lerArmadura(rec);
    const arma = ehArma(rec);
    const vestivel = !!armadura;
    const jaTemAtaque = personagem.ataques.some((a) => a.itemId === rec.id);
    const marcadores = [];
    if (armadura) marcadores.push(`<span class="tag">${esc(armadura.tipo)} +${armadura.defesa} Defesa${armadura.penalidade ? ` / −${armadura.penalidade} penalidade` : ""}</span>`);
    if (arma) marcadores.push(`<span class="tag">${esc(rec.dano || "")} ${rec.criticoM || 20}/x${rec.criticoX || 2}</span>`);
    return `
    <tr class="${item.equipado ? "equipado" : ""}">
      <td>${esc(item.nome)} ${marcadores.join(" ")}</td>
      <td><input type="number" min="1" data-inv-qtd="${i}" value="${item.qtd || 1}" style="width:4em" /></td>
      <td>${rec.peso ?? "-"}</td>
      <td class="col-rolagens">
        ${vestivel ? `<button data-equipar-item="${i}" class="${item.equipado ? "" : "secundario"}" title="${item.equipado ? "Tirar" : "Vestir/empunhar — entra na Defesa e na penalidade de armadura"}">${item.equipado ? "✓ equipado" : "Equipar"}</button>` : ""}
        ${arma ? `<button class="secundario" data-criar-ataque="${i}" title="Cria a linha de ataque desta arma na aba Combate">${jaTemAtaque ? "⚔️ já na lista" : "⚔️ virar ataque"}</button>` : ""}
        <button class="perigo" data-remover-item="${i}">✕</button>
      </td>
    </tr>`;
  }).join("") || '<tr><td colspan="4" class="dica">Inventário vazio — adicione itens no catálogo abaixo.</td></tr>';

  const resumo = document.getElementById("resumo-carga");
  if (resumo) {
    const excedeu = d.carga > d.cargaMax;
    resumo.innerHTML = `
      <div class="resumo-treinos-linha">Carga: <b class="${excedeu ? "carga-excedida" : ""}">${Math.round(d.carga * 10) / 10}</b> de <b>${d.cargaMax}</b> (Força ${formatarMod(regras.mod(d.atrs.for))}).</div>
      <div class="resumo-treinos-conta">Defesa vinda do equipamento: ${d.equip.armadura ? `+${d.equip.armadura} de armadura` : "nenhuma armadura equipada"}${d.equip.escudo ? ` · +${d.equip.escudo} de escudo` : ""}${d.equip.penalidade ? ` · penalidade de armadura −${d.equip.penalidade} em Acrobacia, Furtividade e Ladinagem` : ""}.</div>
      ${excedeu ? '<div class="alerta-automacao">Você está carregando mais que a carga máxima — combine a penalidade com o mestre.</div>' : ""}`;
  }

  renderEquipSlots();

  const tipo = document.getElementById("equip-filtro-tipo").value;
  const busca = document.getElementById("equip-busca").value;
  const catalogo = document.getElementById("lista-equip-catalogo");
  // "armadura" e "escudo" não existem como tipoItem no compêndio — são lidos
  // da descrição por classificarEquipamento(), então filtram aqui.
  const porFuncao = tipo === "armadura" || tipo === "escudo";
  const lista = equipamentosFiltrados(db, { tipoItem: porFuncao ? undefined : (tipo || undefined), busca: busca || undefined })
    .filter((e) => !porFuncao || classificarEquipamento(e) === tipo)
    .slice(0, 200);
  catalogo.innerHTML = lista.map((e) => {
    const armadura = regras.lerArmadura(e);
    return `
    <li data-abrir-equip="${e.id}">
      <span>${esc(e.nome)} ${e.dano ? `<span class="tag">${esc(e.dano)}</span>` : ""} ${armadura ? `<span class="tag">+${armadura.defesa} Defesa</span>` : ""} ${e.peso ? `<span class="tag">${e.peso}kg</span>` : ""}</span>
      <button data-add-item="${e.id}">➕</button>
    </li>`;
  }).join("") || '<li class="dica">Nenhum item com esse filtro.</li>';
}

// ---------- Notas ----------

function renderNotas() {
  const lista = document.getElementById("lista-notas");
  lista.innerHTML = personagem.notas.slice().reverse().map((n, i) => {
    const idx = personagem.notas.length - 1 - i;
    return `<li><small>${new Date(n.data).toLocaleString("pt-BR")}</small><p>${n.texto}</p><button class="perigo" data-remover-nota="${idx}">apagar</button></li>`;
  }).join("") || "<li>Nenhuma nota ainda.</li>";
}

// ---------- Compêndio ----------

function renderCompendio() {
  const tipo = document.getElementById("compendio-tipo").value;
  const busca = document.getElementById("compendio-busca").value;
  const cont = document.getElementById("compendio-resultado");
  let itens = [];
  if (tipo === "poderes") itens = poderesDe(db, { busca: busca || undefined }).slice(0, 150).map((p) => ({ titulo: p.nome, sub: `${p.subtipo} · ${p.categoria}`, abrir: () => abrirDetalhePoder(p) }));
  else if (tipo === "magias") itens = magiasFiltradas(db, { busca: busca || undefined }).slice(0, 150).map((m) => ({ titulo: m.nome, sub: `${m.tipo} · ${m.circulo}º círculo`, abrir: () => abrirDetalheMagia(m) }));
  else if (tipo === "equipamentos") itens = equipamentosFiltrados(db, { busca: busca || undefined }).slice(0, 150).map((e) => ({ titulo: e.nome, sub: e.tipoItem, abrir: () => abrirDetalheItem(e) }));
  else if (tipo === "ameacas") itens = ameacasFiltradas(db, { busca: busca || undefined }).slice(0, 150).map((a) => ({ titulo: a.nome, sub: `ND ${a.nd} · ${a.tipo} · PV ${a.pv ?? "?"} · Defesa ${a.defesa ?? "?"}`, abrir: () => abrirDetalheAmeaca(a) }));
  else if (tipo === "panteao") itens = panteaoFiltrado(db, { busca: busca || undefined }).map((p) => ({ titulo: p.nome, sub: "Divindade", abrir: () => abrirDetalheTexto(p.nome, p.descricao) }));

  cont.innerHTML = itens.map((it, i) => `<div class="item" data-compendio-idx="${i}"><span>${it.titulo}</span><span class="tag">${it.sub}</span></div>`).join("");
  cont.querySelectorAll("[data-compendio-idx]").forEach((el, i) => el.addEventListener("click", () => itens[i].abrir()));
}

// ---------- Modais de detalhe ----------

function abrirModal(id) { document.getElementById(id).hidden = false; }
function fecharModal(id) { document.getElementById(id).hidden = true; }

function abrirDetalheTexto(titulo, corpo) {
  document.getElementById("modal-detalhe-corpo").innerHTML = `<h2>${titulo}</h2><p>${corpo}</p>`;
  abrirModal("modal-detalhe");
}
function abrirDetalhePoder(p) {
  abrirDetalheTexto(p.nome, `<em>${p.tipoOriginal}${p.custo ? ` · ${p.custo} PM` : ""}</em><br><br>${p.descricao}${p.requisito ? `<br><br><strong>Requisito:</strong> ${p.requisito}` : ""}`);
}
function abrirDetalheMagia(m) {
  abrirDetalheTexto(m.nome, `<em>${m.tipo} · ${m.circulo}º círculo · ${m.escola}</em><br>
    Execução: ${m.execucao} · Alcance: ${m.alcance} · Duração: ${m.duracao}<br>
    Resistência: ${m.resistencia || "-"} · Alvo/Área: ${m.alvo || m.area || "-"} · Custo: ${m.custo ?? "-"} PM<br><br>${m.descricao}`);
}
function abrirDetalheItem(e) {
  abrirDetalheTexto(e.nome, `<em>${e.tipoItem}${e.dano ? ` · dano ${e.dano}` : ""}${e.peso ? ` · ${e.peso}kg` : ""}</em><br><br>${e.descricao}`);
}
function abrirDetalheAmeaca(a) {
  // As ameaças do compêndio vieram com atributos na escala d20 (3–20). Como a
  // ficha usa a escala de T20 (o valor já é o modificador), mostramos os dois.
  const atrs = Object.entries(a.atributos).map(([k, v]) => {
    if (typeof v !== "number") return `${k.toUpperCase()} -`;
    return v >= 6 ? `${k.toUpperCase()} ${v} (${formatarMod(regras.modDeEscalaD20(v))})` : `${k.toUpperCase()} ${formatarMod(v)}`;
  }).join(" · ");
  const poderes = (a.poderes || []).length
    ? `<br><strong>Poderes e habilidades</strong><ul>${a.poderes.map((p) => `<li><strong>${p.nome}</strong>${p.descricao ? ` — ${p.descricao}` : ""}</li>`).join("")}</ul>`
    : "";
  const magias = (a.magias || []).length
    ? `<br><strong>Magias</strong><ul>${a.magias.map((m) => `<li><strong>${m.nome}</strong>${m.circulo ? ` (${m.circulo}º círc.)` : ""}${m.descricao ? ` — ${m.descricao}` : ""}</li>`).join("")}</ul>`
    : "";
  abrirDetalheTexto(a.nome, `<em>ND ${a.nd} · ${a.tamanho} · ${a.tipo}</em>${a.fonte ? `<br><small>${a.fonte}</small>` : ""}<br>
    PV ${a.pv ?? "?"}${a.pm ? ` · PM ${a.pm}` : ""} · Defesa ${a.defesa ?? "?"} · Deslocamento ${a.deslocamento || "-"}<br>
    ${atrs}<br>${a.resistencias ? `<br>Resistências: ${a.resistencias}` : ""}${a.sentidos ? `<br>Sentidos: ${a.sentidos}` : ""}${a.equipamento ? `<br>Equipamento: ${a.equipamento}` : ""}<br><br>${a.descricao || ""}${poderes}${magias}`);
}

// ---------- Meus personagens ----------

function renderPersonagensSalvos() {
  const lista = document.getElementById("lista-personagens-salvos");
  lista.innerHTML = storage.listarPersonagens().map((p) => `
    <li>
      <span>${p.nome || "(sem nome)"} — ${porId(db.classes, p.classe)?.nome ?? "?"} nível ${p.nivel}</span>
      <span>
        <button data-abrir-personagem="${p.id}">Abrir</button>
        <button class="secundario" data-duplicar-personagem="${p.id}">Duplicar</button>
        <button class="perigo" data-apagar-personagem="${p.id}">Apagar</button>
      </span>
    </li>`).join("") || "<li>Nenhum personagem salvo.</li>";
}

// ---------- Persistência de dados / atualização ----------

async function verificarAtualizacaoDados() {
  if (!db.version) return;
  const vista = storage.getVersaoDadosVista();
  if (vista === db.version.syncedAt) return;
  const aviso = document.getElementById("aviso-dados");
  aviso.hidden = false;
  aviso.innerHTML = `📦 O banco de dados do compêndio foi atualizado em ${new Date(db.version.syncedAt).toLocaleDateString("pt-BR")}. <button id="btn-ok-aviso">Ok, entendi</button>`;
  document.getElementById("btn-ok-aviso").addEventListener("click", () => {
    storage.setVersaoDadosVista(db.version.syncedAt);
    aviso.hidden = true;
  });
}

function registrarServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

// Trocar de raça/classe/origem invalida as escolhas que dependiam da opção
// antiga (um humano que vira anão não fica com "+1 em três atributos").
function limparEscolhasInvalidas(oQueMudou) {
  const e = escolhas();
  if (oQueMudou === "raca") {
    e.atributosRaciais = [];
    e.legadoRacial = "";
    e.periciasRaciais = [];
    e.bonusPericiasRaciais = [];
  }
  if (oQueMudou === "classe") {
    e.periciasClasseFixa = {};
    e.periciasClasse = [];
  }
  if (oQueMudou === "origem") {
    e.periciasOrigem = [];
    e.poderOrigem = "";
  }
}

function salvar() { storage.salvarPersonagem(personagem); }
function salvarERenderizar() { salvar(); renderizarTudo(); }

// ---------- Eventos ----------

function registrarEventos() {
  document.querySelectorAll(".aba-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".aba-btn").forEach((b) => b.classList.remove("ativo"));
    document.querySelectorAll(".aba").forEach((a) => a.classList.remove("ativo"));
    btn.classList.add("ativo");
    document.getElementById(`aba-${btn.dataset.aba}`).classList.add("ativo");
  }));

  document.querySelectorAll(".modal-fechar").forEach((btn) => btn.addEventListener("click", () => fecharModal(btn.dataset.fechar)));
  document.querySelectorAll(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) fecharModal(m.id); }));

  // Identidade
  document.getElementById("nome").addEventListener("input", (e) => { personagem.nome = e.target.value; salvar(); });
  document.getElementById("jogador").addEventListener("input", (e) => { personagem.jogador = e.target.value; salvar(); });
  document.getElementById("raca").addEventListener("change", (e) => {
    personagem.raca = e.target.value;
    limparEscolhasInvalidas("raca");
    salvarERenderizar();
  });
  document.getElementById("classe").addEventListener("change", (e) => {
    personagem.classe = e.target.value;
    limparEscolhasInvalidas("classe");
    salvarERenderizar();
  });
  document.getElementById("origem").addEventListener("change", (e) => {
    personagem.origem = e.target.value;
    limparEscolhasInvalidas("origem");
    salvarERenderizar();
  });
  document.getElementById("divindade").addEventListener("change", (e) => { personagem.divindade = e.target.value; salvar(); });
  document.getElementById("biografia").addEventListener("input", (e) => { personagem.biografia = e.target.value; salvar(); });
  document.getElementById("aparencia").addEventListener("input", (e) => { personagem.aparencia = e.target.value; salvar(); });
  document.getElementById("nivel").addEventListener("input", (e) => { personagem.nivel = Math.max(1, Math.min(20, Number(e.target.value) || 1)); salvarERenderizar(); });
  document.getElementById("xp")?.addEventListener("input", (e) => { personagem.xp = Math.max(0, Number(e.target.value) || 0); salvar(); });

  // Retrato
  const avatarInput = document.getElementById("avatar-input");
  document.getElementById("avatar-bloco")?.addEventListener("click", (e) => {
    if (e.target.id === "avatar-remover") { personagem.avatar = null; salvarERenderizar(); return; }
    avatarInput?.click();
  });
  avatarInput?.addEventListener("change", async () => {
    const file = avatarInput.files?.[0];
    avatarInput.value = "";
    if (!file) return;
    try {
      personagem.avatar = await redimensionarAvatar(file);
      salvarERenderizar();
    } catch (err) {
      toast(err.message || "Não consegui usar essa imagem.");
    }
  });

  for (const id of ["tt", "to", "tp", "tc"]) {
    document.getElementById(`dinheiro-${id}`).addEventListener("input", (e) => {
      personagem.dinheiro[id] = Number(e.target.value) || 0; salvar();
    });
  }

  // Atributos — barra de modos (compra / arranjo / rolagem / livre)
  document.getElementById("atrib-modos")?.addEventListener("click", (e) => {
    const modo = e.target.closest("[data-atrib-modo]")?.dataset.atribModo;
    if (modo) setModoAtributos(modo);
  });
  document.getElementById("atributos").addEventListener("input", (e) => {
    const id = e.target.dataset.atributo;
    if (!id) return;
    personagem.atributos[id] = Number(e.target.value) || 0;
    salvarERenderizar();
  });
  document.getElementById("atributos").addEventListener("click", (e) => {
    const id = e.target.dataset.rolarAtributo;
    if (!id) return;
    const atributo = db.atributos.find((a) => a.id === id);
    rolarDado(20, regras.mod(atributoFinal(id)), `Teste de ${atributo?.nome || id.toUpperCase()}`);
  });

  // Dashboard PV/PM
  document.getElementById("pv-atual").addEventListener("input", (e) => { personagem.pv.atual = Number(e.target.value) || 0; salvarERenderizar(); });
  document.getElementById("pv-temp").addEventListener("input", (e) => { personagem.pv.temp = Number(e.target.value) || 0; salvar(); });
  document.getElementById("pm-atual").addEventListener("input", (e) => { personagem.pm.atual = Number(e.target.value) || 0; salvarERenderizar(); });
  document.querySelectorAll("[data-dano]").forEach((b) => b.addEventListener("click", () => {
    personagem.pv.atual = (personagem.pv.atual ?? 0) - Number(b.dataset.dano); salvarERenderizar();
  }));
  document.querySelectorAll("[data-cura]").forEach((b) => b.addEventListener("click", () => {
    const d = calcularDerivados();
    personagem.pv.atual = Math.min(d.pvMax ?? Infinity, (personagem.pv.atual ?? 0) + Number(b.dataset.cura)); salvarERenderizar();
  }));
  document.querySelectorAll("[data-pm]").forEach((b) => b.addEventListener("click", () => {
    const d = calcularDerivados();
    personagem.pm.atual = Math.max(0, Math.min(d.pmMax ?? Infinity, (personagem.pm.atual ?? 0) + Number(b.dataset.pm))); salvarERenderizar();
  }));
  document.getElementById("btn-descanso").addEventListener("click", () => {
    const d = calcularDerivados();
    personagem.pv.atual = d.pvMax ?? personagem.pv.atual;
    personagem.pm.atual = d.pmMax ?? personagem.pm.atual;
    personagem.pv.temp = 0;
    salvarERenderizar();
  });

  // Perícias
  // A especialidade é texto livre: grava enquanto digita, sem redesenhar a
  // tabela (o campo perderia o foco a cada tecla).
  document.getElementById("lista-pericias").addEventListener("input", (e) => {
    const espec = e.target.dataset.periciaEspecialidade;
    if (!espec) return;
    personagem.especializacoes = { ...(personagem.especializacoes || {}), [espec]: e.target.value };
    salvar();
    renderAutomacao();
  });
  document.getElementById("lista-pericias").addEventListener("change", (e) => {
    const treino = e.target.dataset.periciaTreino;
    if (treino) {
      if (e.target.checked) personagem.periciasTreinadas.push(treino);
      else personagem.periciasTreinadas = personagem.periciasTreinadas.filter((x) => x !== treino);
      salvarERenderizar();
    }
    const outros = e.target.dataset.periciaOutros;
    if (outros) {
      personagem.periciasOutros[outros] = Number(e.target.value) || 0;
      salvarERenderizar();
    }
  });
  document.getElementById("lista-pericias").addEventListener("click", (e) => {
    const id = e.target.dataset.rolarPericia;
    if (!id) return;
    const d = calcularDerivados();
    const p = db.pericias.find((x) => x.id === id);
    if (p.somenteTreinado && !estaTreinado(p.id, d)) {
      toast(`${p.nome} só pode ser usada por quem é treinado nela.`);
      return;
    }
    rolarDado(20, bonusDePericiaSeguro(p, d), `${p.nome}`, { type: "outro" });
  });
  document.getElementById("pericias-busca")?.addEventListener("input", renderPericias);
  document.getElementById("pericias-so-classe")?.addEventListener("change", renderPericias);
  document.getElementById("resumo-treinos")?.addEventListener("click", (e) => {
    if (e.target.dataset.irAutomacao) irParaAba("construcao");
  });

  // Poderes
  document.getElementById("poderes-filtro-categoria").addEventListener("change", renderCatalogoPoderes);
  document.getElementById("poderes-busca").addEventListener("input", renderCatalogoPoderes);
  document.getElementById("poderes-so-disponiveis")?.addEventListener("change", renderCatalogoPoderes);
  document.getElementById("lista-poderes-catalogo").addEventListener("click", (e) => {
    const add = e.target.dataset.addPoder;
    if (add) { if (!personagem.poderes.includes(add)) personagem.poderes.push(add); salvarERenderizar(); return; }
    const abrir = e.target.closest("[data-abrir-poder]")?.dataset.abrirPoder;
    if (abrir) abrirDetalhePoder(db.poderes.find((p) => p.id === abrir));
  });
  document.getElementById("lista-poderes-personagem").addEventListener("click", (e) => {
    const usar = e.target.dataset.usarPoder;
    if (usar) {
      const poder = db.poderes.find((x) => x.id === usar);
      if (poder) gastarPM(poder.custo, poder.nome);
      return;
    }
    const rem = e.target.dataset.removerPoder;
    if (rem) { personagem.poderes = personagem.poderes.filter((x) => x !== rem); salvarERenderizar(); return; }
    const abrir = e.target.closest("[data-abrir-poder]")?.dataset.abrirPoder;
    if (abrir) abrirDetalhePoder(db.poderes.find((p) => p.id === abrir));
  });

  // Magias
  document.getElementById("magias-filtro-circulo").addEventListener("change", renderMagias);
  document.getElementById("magias-busca").addEventListener("input", renderMagias);
  document.getElementById("lista-magias-catalogo").addEventListener("click", (e) => {
    const add = e.target.dataset.addMagia;
    if (add) { if (!personagem.magias.includes(add)) personagem.magias.push(add); salvarERenderizar(); return; }
    const abrir = e.target.closest("[data-abrir-magia]")?.dataset.abrirMagia;
    if (abrir) abrirDetalheMagia(db.magias.find((m) => m.id === abrir));
  });
  document.getElementById("lista-magias-personagem").addEventListener("click", (e) => {
    const conjurar = e.target.dataset.conjurarMagia;
    if (conjurar) {
      const m = db.magias.find((x) => x.id === conjurar);
      if (m) gastarPM(regras.custoDaMagia(m), `Magia: ${m.nome}`);
      return;
    }
    const rem = e.target.dataset.removerMagia;
    if (rem) { personagem.magias = personagem.magias.filter((x) => x !== rem); personagem.magiasPreparadas = personagem.magiasPreparadas.filter((x) => x !== rem); salvarERenderizar(); return; }
    const prep = e.target.dataset.prepararMagia;
    if (prep) {
      if (personagem.magiasPreparadas.includes(prep)) personagem.magiasPreparadas = personagem.magiasPreparadas.filter((x) => x !== prep);
      else personagem.magiasPreparadas.push(prep);
      salvarERenderizar(); return;
    }
    const abrir = e.target.closest("[data-abrir-magia]")?.dataset.abrirMagia;
    if (abrir) abrirDetalheMagia(db.magias.find((m) => m.id === abrir));
  });

  // Combate
  document.getElementById("btn-add-ataque").addEventListener("click", () => {
    personagem.ataques.push({ nome: "", pericia: "lut", dano: "", critico: "20/x2" });
    salvarERenderizar();
  });
  document.getElementById("lista-ataques").addEventListener("input", (e) => {
    const campo = e.target.dataset.ataqueCampo, idx = e.target.dataset.ataqueIdx;
    if (campo === undefined || idx === undefined) return;
    personagem.ataques[idx][campo] = e.target.value;
    salvar();
  });
  document.getElementById("lista-ataques").addEventListener("change", (e) => {
    const campo = e.target.dataset.ataqueCampo, idx = e.target.dataset.ataqueIdx;
    if (campo === "pericia") { personagem.ataques[idx].pericia = e.target.value; salvarERenderizar(); }
  });
  document.getElementById("lista-ataques").addEventListener("click", (e) => {
    const rem = e.target.dataset.removerAtaque;
    if (rem !== undefined) { personagem.ataques.splice(Number(rem), 1); salvarERenderizar(); return; }
    const dano = e.target.dataset.rolarDano;
    if (dano !== undefined) { rolarDanoDoAtaque(Number(dano)); return; }
    const rolar = e.target.dataset.rolarAtaque;
    if (rolar !== undefined) {
      const d = calcularDerivados();
      const at = personagem.ataques[rolar];
      const p = db.pericias.find((x) => x.id === at.pericia);
      const { margem } = parseCritico(at.critico);
      const bruto = regras.rollDie(20);
      const total = bruto + bonusDeAtaque(at, d);
      const critico = bruto >= margem;
      const rotulo = `Ataque: ${at.nome || p?.nome || "arma"}`;
      toast(`${rotulo}: d20 (${bruto}) ${formatarMod(bonusDeAtaque(at, d))} = ${total}${critico ? " 🎉 AMEAÇA DE CRÍTICO!" : bruto === 1 ? " 💥 falha crítica" : ""}`);
      broadcastRoll(rotulo, `d20 (${bruto}) ${formatarMod(bonusDeAtaque(at, d))}${critico ? " 🎉 crítico" : ""}`, total, { type: "ataque" });
      if (critico) rolarDanoDoAtaque(Number(rolar), true);
    }
  });

  document.getElementById("lista-resistencias").addEventListener("click", (e) => {
    const id = e.target.dataset.rolarResistencia;
    if (!id) return;
    const d = calcularDerivados();
    const p = db.pericias.find((x) => x.id === id);
    rolarDado(20, bonusDePericiaSeguro(p, d), `Resistência: ${p.nome}`, { type: "outro" });
  });

  document.getElementById("btn-add-condicao").addEventListener("click", () => {
    personagem.condicoes.push(document.getElementById("condicao-select").value);
    salvarERenderizar();
  });
  document.getElementById("lista-condicoes").addEventListener("click", (e) => {
    const rem = e.target.dataset.removerCondicao;
    if (rem !== undefined) { personagem.condicoes.splice(Number(rem), 1); salvarERenderizar(); }
  });

  // Parceiros
  document.getElementById("btn-add-parceiro")?.addEventListener("click", () => {
    const nome = document.getElementById("parceiro-nome").value.trim();
    const tipo = document.getElementById("parceiro-tipo").value.trim();
    if (!nome && !tipo) { toast("Dê um nome ou um tipo ao parceiro."); return; }
    personagem.parceiros = [...(personagem.parceiros || []), { nome, tipo, pvAtual: 0, pvMax: 0, notas: "" }];
    document.getElementById("parceiro-nome").value = "";
    document.getElementById("parceiro-tipo").value = "";
    salvarERenderizar();
  });
  document.getElementById("lista-parceiros")?.addEventListener("input", (e) => {
    const campo = e.target.dataset.parceiroCampo, idx = e.target.dataset.parceiroIdx;
    if (!campo || idx === undefined) return;
    const valor = e.target.type === "number" ? Number(e.target.value) || 0 : e.target.value;
    personagem.parceiros[Number(idx)][campo] = valor;
    salvar();
  });
  document.getElementById("lista-parceiros")?.addEventListener("click", (e) => {
    const rem = e.target.dataset.removerParceiro;
    if (rem !== undefined) { personagem.parceiros.splice(Number(rem), 1); salvarERenderizar(); }
  });

  // Modificadores temporários: o segundo <select> só aparece quando o alvo
  // precisa de detalhe (qual perícia, qual atributo).
  const modAlvoSel = document.getElementById("mod-alvo");
  const modDetalhe = document.getElementById("mod-detalhe");
  const atualizarDetalhe = () => {
    const alvo = modAlvoSel.value;
    const precisa = alvo === "pericia" || alvo === "atributo";
    modDetalhe.classList.toggle("hidden", !precisa);
    if (!precisa) { modDetalhe.innerHTML = ""; return; }
    modDetalhe.innerHTML = alvo === "pericia"
      ? db.pericias.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join("")
      : db.atributos.map((a) => `<option value="${a.id}">${esc(a.nome)}</option>`).join("");
  };
  modAlvoSel?.addEventListener("change", atualizarDetalhe);
  atualizarDetalhe();
  document.getElementById("btn-add-modificador")?.addEventListener("click", () => {
    const alvo = modAlvoSel.value;
    const valor = Number(document.getElementById("mod-valor").value) || 0;
    if (!valor) { toast("Dê um valor diferente de zero ao modificador."); return; }
    const mod = { nome: document.getElementById("mod-nome").value.trim() || "Modificador", alvo, valor };
    if (alvo === "pericia") mod.pericia = modDetalhe.value;
    if (alvo === "atributo") mod.atributo = modDetalhe.value;
    personagem.modificadoresTemp = [...(personagem.modificadoresTemp || []), mod];
    document.getElementById("mod-nome").value = "";
    salvarERenderizar();
  });
  document.getElementById("lista-modificadores")?.addEventListener("click", (e) => {
    const rem = e.target.dataset.removerModificador;
    if (rem !== undefined) { personagem.modificadoresTemp.splice(Number(rem), 1); salvarERenderizar(); }
  });

  // Equipamentos
  document.getElementById("equip-filtro-tipo").addEventListener("change", renderEquipamentos);
  document.getElementById("equip-busca").addEventListener("input", renderEquipamentos);
  document.getElementById("lista-equip-catalogo").addEventListener("click", (e) => {
    const add = e.target.dataset.addItem;
    if (add) {
      const item = db.equipamentos.find((x) => x.id === add);
      const existente = personagem.equipamentos.find((x) => x.id === add);
      if (existente) existente.qtd = (existente.qtd || 1) + 1;
      else personagem.equipamentos.push({ id: item.id, nome: item.nome, peso: item.peso, qtd: 1, equipado: false });
      salvarERenderizar(); return;
    }
    const abrir = e.target.closest("[data-abrir-equip]")?.dataset.abrirEquip;
    if (abrir) abrirDetalheItem(db.equipamentos.find((x) => x.id === abrir));
  });
  document.getElementById("lista-inventario").addEventListener("input", (e) => {
    const idx = e.target.dataset.invQtd;
    if (idx === undefined) return;
    personagem.equipamentos[idx].qtd = Number(e.target.value) || 1;
    salvar();
  });
  document.getElementById("lista-inventario").addEventListener("click", (e) => {
    const rem = e.target.dataset.removerItem;
    if (rem !== undefined) { personagem.equipamentos.splice(Number(rem), 1); salvarERenderizar(); return; }

    const equipar = e.target.dataset.equiparItem;
    if (equipar !== undefined) {
      const item = personagem.equipamentos[Number(equipar)];
      const info = regras.lerArmadura(registroDoItem(item));
      // Só uma armadura e um escudo por vez — equipar outro tira o anterior.
      if (!item.equipado && info) {
        for (const outro of personagem.equipamentos) {
          if (outro === item || !outro.equipado) continue;
          const infoOutro = regras.lerArmadura(registroDoItem(outro));
          if (infoOutro && (infoOutro.tipo === "escudo") === (info.tipo === "escudo")) outro.equipado = false;
        }
      }
      item.equipado = !item.equipado;
      salvarERenderizar();
      return;
    }

    const criar = e.target.dataset.criarAtaque;
    if (criar !== undefined) {
      const rec = registroDoItem(personagem.equipamentos[Number(criar)]);
      if (personagem.ataques.some((a) => a.itemId === rec.id)) { toast(`${rec.nome} já está na lista de ataques.`); return; }
      personagem.ataques.push(ataqueDaArma(rec));
      salvarERenderizar();
      toast(`Ataque de ${rec.nome} criado na aba Combate.`);
    }
  });

  // Compêndio
  document.getElementById("compendio-tipo").addEventListener("change", renderCompendio);
  document.getElementById("compendio-busca").addEventListener("input", renderCompendio);

  // Notas
  document.getElementById("btn-add-nota").addEventListener("click", () => {
    const txt = document.getElementById("nova-nota");
    if (!txt.value.trim()) return;
    personagem.notas.push({ data: new Date().toISOString(), texto: txt.value.trim() });
    txt.value = "";
    salvarERenderizar();
  });
  document.getElementById("lista-notas").addEventListener("click", (e) => {
    const rem = e.target.dataset.removerNota;
    if (rem !== undefined) { personagem.notas.splice(Number(rem), 1); salvarERenderizar(); }
  });

  // Topo: personagens, import/export, pdf, dados
  document.getElementById("btn-personagens").addEventListener("click", () => { renderPersonagensSalvos(); abrirModal("modal-personagens"); });
  document.getElementById("lista-personagens-salvos").addEventListener("click", (e) => {
    const abrir = e.target.dataset.abrirPersonagem;
    if (abrir) { personagem = storage.carregarPersonagem(abrir); storage.setPersonagemAtivoId(abrir); renderizarTudo(); fecharModal("modal-personagens"); return; }
    const dup = e.target.dataset.duplicarPersonagem;
    if (dup) { storage.duplicarPersonagem(dup); renderPersonagensSalvos(); return; }
    const apagar = e.target.dataset.apagarPersonagem;
    if (apagar) {
      if (confirm("Apagar este personagem? Essa ação não pode ser desfeita.")) {
        storage.apagarPersonagem(apagar);
        if (personagem.id === apagar) {
          personagem = storage.listarPersonagens()[0] || storage.novoPersonagem();
          storage.setPersonagemAtivoId(personagem.id);
          storage.salvarPersonagem(personagem);
          renderizarTudo();
        }
        renderPersonagensSalvos();
      }
    }
  });

  document.getElementById("btn-novo").addEventListener("click", () => {
    if (!confirm("Criar um novo personagem em branco?")) return;
    personagem = storage.novoPersonagem();
    storage.setPersonagemAtivoId(personagem.id);
    storage.salvarPersonagem(personagem);
    renderizarTudo();
  });

  document.getElementById("btn-exportar").addEventListener("click", () => {
    const blob = new Blob([storage.exportarJSON(personagem)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(personagem.nome || "personagem").replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById("btn-importar").addEventListener("click", () => document.getElementById("input-importar").click());
  document.getElementById("input-importar").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const texto = await file.text();
    try {
      personagem = storage.importarJSON(texto);
      storage.setPersonagemAtivoId(personagem.id);
      renderizarTudo();
    } catch (err) {
      alert("Não foi possível importar este arquivo: " + err.message);
    }
    e.target.value = "";
  });

  document.getElementById("btn-pdf").addEventListener("click", imprimirFicha);

  document.getElementById("btn-atualizar-dados").addEventListener("click", async () => {
    location.reload();
  });
}

// ==============================================================
// Helpers genéricos (equivalentes aos usados nas seções abaixo)
// ==============================================================
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
let toastTimer = null;
function toast(t) {
  const e = $("toast");
  if (!e) return;
  e.textContent = t;
  e.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove("show"), 2400);
}
function abrirModalGenerico(html) {
  $("modal-content").innerHTML = html;
  $("modal").classList.remove("hidden");
}

// ==============================================================
// Integração com Discord — cada rolagem vira uma mensagem no canal
// configurado. Fica salvo neste navegador, não no personagem.
// ==============================================================
function discordMessage(label, detail, total) {
  const nome = (personagem?.nome || "").trim() || "Personagem sem nome";
  return `🎲 **${nome}** rolou **${label}**: ${detail} = **${total}**`;
}
function discordTurnMessage(nome, round) {
  return `⚔️ Rodada **${round}** — é a vez de **${nome}**!`;
}
async function sendToDiscord(text) {
  const url = storage.getDiscordWebhook();
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.slice(0, 1900) }),
    });
    if (!res.ok) toast(`Discord recusou a rolagem (HTTP ${res.status}).`);
  } catch {
    toast("Não deu pra enviar a rolagem pro Discord — confira o link do webhook.");
  }
}
function renderDiscordSettings() {
  const url = storage.getDiscordWebhook();
  abrirModalGenerico(`<div class="modal-title"><div><span class="eyebrow">INTEGRAÇÃO</span><h2>Discord</h2><p class="muted">Cada rolagem (perícia, ataque, rolador genérico) vira uma mensagem no canal do Discord que você configurar abaixo. Isso fica salvo neste navegador, não no personagem.</p></div></div>
    <div class="modal-body">
      <h3>Como criar o link do webhook</h3>
      <ol>
        <li>Abra o Discord e entre no <strong>servidor</strong> onde as rolagens devem aparecer.</li>
        <li>Ao lado do <strong>canal</strong> desejado, clique em "Editar Canal" → <strong>Integrações</strong> → <strong>Webhooks</strong> → <strong>Novo Webhook</strong>.</li>
        <li>Clique em <strong>Copiar link do Webhook</strong> e cole no campo abaixo.</li>
      </ol>
      <p class="muted">⚠️ Esse link funciona como uma senha — não compartilhe publicamente.</p>
      <label>Link do webhook<br><input id="discord-webhook-input" placeholder="https://discord.com/api/webhooks/..." value="${esc(url)}" style="width:100%"></label>
      <div class="linha-botoes-modal">
        <button type="button" class="add-btn" id="discord-webhook-save">Salvar</button>
        <button type="button" id="discord-webhook-test">Enviar teste</button>
        ${url ? `<button type="button" id="discord-webhook-remove">Remover</button>` : ""}
      </div>
    </div>`);
  $("discord-webhook-save")?.addEventListener("click", () => {
    storage.saveDiscordWebhook($("discord-webhook-input").value.trim());
    toast("Webhook do Discord salvo.");
    renderDiscordSettings();
  });
  $("discord-webhook-test")?.addEventListener("click", async () => {
    const pending = $("discord-webhook-input").value.trim();
    if (pending) storage.saveDiscordWebhook(pending);
    await sendToDiscord(discordMessage("um teste", "🎉", "funcionou!"));
    toast("Mensagem de teste enviada.");
  });
  $("discord-webhook-remove")?.addEventListener("click", () => {
    storage.saveDiscordWebhook("");
    toast("Webhook removido.");
    renderDiscordSettings();
  });
}

// ==============================================================
// Sala de rolagens — chat de rolagem em tempo real compartilhado entre
// os jogadores da mesma mesa, ponto-a-ponto via WebRTC (PeerJS). Nenhum
// serviço de terceiro guarda ou lê as rolagens — elas trafegam direto de
// navegador pra navegador. Um jogador (normalmente o mestre) cria a sala
// e vira o "anfitrião"; os outros entram com o mesmo código. Rolagens de
// Cura/Dano ganham um botão que ajusta o PV direto no personagem de quem
// clicar.
// ==============================================================
let roomPeer = null;
let roomRole = null;              // "anfitriao" | "jogador" | null
let roomHostConns = new Map();
let roomClientConn = null;
let roomRolls = [];
let myPeerId = null;
// Iniciativa compartilhada da sala — o anfitrião (mestre) é a fonte da
// verdade: um jogador nunca aplica a própria ação, só envia e espera o
// estado recalculado voltar.
let roomCombat = { round: 1, currentId: null, list: [] };
// Música da sala (YouTube ou SoundCloud) — mesma autoridade da iniciativa.
let roomMusic = { source: null, videoId: null, playlistId: null, playlistIndex: 0, scUrl: null, scIndex: 0, playing: false, seekTime: 0, updatedAt: 0 };
let ytPlayer = null;
let ytLoadedVideoId = null;
let ytLoadedPlaylistId = null;
let ytApiPromise = null;
let scWidget = null;
let scLoadedUrl = null;
let scApiPromise = null;
let scPlaylistCache = [];
let scCurrentIndex = 0;
let scMuted = false;
let scLastVolume = 100;

function sanitizeRoomCode(code) {
  return "t20ficha-" + String(code || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 50);
}
function roomStatusText() {
  if (!roomRole) return "⚪ Sala não configurada — clique na engrenagem.";
  if (roomRole === "anfitriao") return `🟢 Anfitrião da sala — ${roomHostConns.size} jogador(es) conectado(s).`;
  return roomClientConn?.open ? "🟢 Conectado à sala." : "🟡 Conectando à sala…";
}
function leaveRoom() {
  try { roomPeer?.destroy(); } catch { /* ignore */ }
  roomPeer = null; roomRole = null; roomHostConns = new Map(); roomClientConn = null; myPeerId = null;
  roomCombat = { round: 1, currentId: null, list: [] };
  roomMusic = { source: null, videoId: null, playlistId: null, playlistIndex: 0, scUrl: null, scIndex: 0, playing: false, seekTime: 0, updatedAt: 0 };
  try { ytPlayer?.destroy?.(); } catch { /* ignore */ }
  ytPlayer = null; ytLoadedVideoId = null; ytLoadedPlaylistId = null;
  try { $("room-music-player-sc") && ($("room-music-player-sc").innerHTML = ""); } catch { /* ignore */ }
  scWidget = null; scLoadedUrl = null; scPlaylistCache = []; scCurrentIndex = 0;
  renderRoomChat();
}
function hostRoom(code) {
  if (typeof Peer === "undefined") { toast("Biblioteca da sala não carregou — confira sua conexão e recarregue a página."); return; }
  leaveRoom();
  roomRole = "anfitriao";
  roomPeer = new Peer(sanitizeRoomCode(code));
  roomPeer.on("open", (id) => { myPeerId = id; renderRoomChat(); });
  roomPeer.on("connection", (conn) => {
    roomHostConns.set(conn.peer, conn);
    const joinerName = (conn.metadata?.name || "").trim() || "Um jogador";
    conn.on("data", (msg) => {
      if (msg?.kind === "combat-action") { applyCombatAction(msg.action, msg.payload); return; }
      if (msg?.kind === "music-action") { applyMusicAction(msg.action, msg.payload); return; }
      onRoomMessage(msg); relayToOthers(msg, conn.peer);
    });
    conn.on("close", () => {
      roomHostConns.delete(conn.peer);
      applyCombatAction("remove", { id: conn.peer });
      pushRoomSystemMessage(`${joinerName} saiu da sala.`);
    });
    conn.on("open", () => {
      conn.send({ kind: "combat-state", combat: publicCombatState() });
      conn.send({ kind: "music-state", music: roomMusic });
      pushRoomSystemMessage(`${joinerName} entrou na sala.`);
    });
  });
  roomPeer.on("error", (err) => {
    console.warn("Sala (anfitrião):", err);
    toast(err?.type === "unavailable-id" ? "Já existe uma sala aberta com esse código — escolha outro ou entre nela em vez de criar." : "A sala teve um problema de conexão — confira sua internet.");
    renderRoomChat();
  });
}
function joinRoom(code) {
  if (typeof Peer === "undefined") { toast("Biblioteca da sala não carregou — confira sua conexão e recarregue a página."); return; }
  leaveRoom();
  roomRole = "jogador";
  roomPeer = new Peer();
  roomPeer.on("open", () => {
    myPeerId = roomPeer.id;
    const myName = (personagem?.nome || "").trim() || "Um jogador";
    roomClientConn = roomPeer.connect(sanitizeRoomCode(code), { reliable: true, metadata: { name: myName } });
    roomClientConn.on("data", (msg) => onRoomMessage(msg));
    roomClientConn.on("open", () => { toast(`Você entrou na sala como ${myName}.`); renderRoomChat(); });
    roomClientConn.on("close", () => { toast("Desconectado da sala — o anfitrião pode ter fechado a aba."); renderRoomChat(); });
  });
  roomPeer.on("error", (err) => {
    console.warn("Sala (jogador):", err);
    toast(err?.type === "peer-unavailable" ? "Não achei uma sala aberta com esse código — confira com quem criou." : "A sala teve um problema de conexão — confira sua internet.");
    renderRoomChat();
  });
}
function relayToOthers(msg, exceptPeerId) {
  roomHostConns.forEach((conn, peerId) => { if (peerId !== exceptPeerId && conn.open) conn.send(msg); });
}
function onRoomMessage(msg) {
  if (msg?.kind === "combat-state") { roomCombat = msg.combat || roomCombat; renderCombatTracker(); return; }
  if (msg?.kind === "music-state") { roomMusic = msg.music || roomMusic; renderMusicPanel(); syncMusicPlayer(); return; }
  if (!msg?.id || roomRolls.some((r) => r.id === msg.id)) return;
  roomRolls.push(msg);
  roomRolls = roomRolls.slice(-50);
  renderRoomChat();
}
function pushRoomSystemMessage(text) {
  const msg = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, type: "system", text, ts: Date.now() };
  onRoomMessage(msg);
  relayToOthers(msg, null);
}
// Redimensiona uma foto pro chat da sala (lado maior até 480px, JPEG). GIF
// passa direto (canvas mataria a animação), com teto de tamanho.
function resizeChatImage(file) {
  return new Promise((resolve, reject) => {
    if (file.type === "image/gif") {
      if (file.size > 700 * 1024) { reject(new Error("GIF grande demais pra enviar como arquivo (máx. 700KB) — cole o link dele na mensagem em vez disso.")); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Não deu pra ler essa imagem."));
      img.onload = () => {
        const maxSide = 480;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
const CHAT_IMAGE_URL_RE = /^https?:\/\/\S+\.(?:gif|png|jpe?g|webp)(?:\?\S*)?$/i;
function linkifyEscaped(text) {
  return text.replace(/((?:https?:\/\/)[^\s<]+)/gi, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}
function pushRoomMessage(text, image) {
  if (!roomRole) { toast("Entre numa sala primeiro (⚙️)."); return; }
  const msg = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: (personagem?.nome || "").trim() || "Personagem sem nome",
    type: "chat", text: String(text || "").slice(0, 500), image: image || null, ts: Date.now(),
  };
  onRoomMessage(msg);
  if (roomRole === "anfitriao") relayToOthers(msg, null);
  else if (roomClientConn?.open) roomClientConn.send(msg);
}
async function sendRoomChatImage(file) {
  if (!file) return;
  if (!roomRole) { toast("Entre numa sala primeiro (⚙️)."); return; }
  try {
    const dataUrl = await resizeChatImage(file);
    pushRoomMessage("", dataUrl);
  } catch (err) {
    toast(err?.message || "Não deu pra enviar essa imagem.");
  }
}
function sendRoomChatText() {
  const input = $("room-chat-text-input");
  const text = input?.value.trim();
  if (!text) return;
  pushRoomMessage(text, null);
  input.value = "";
}
function pushRoomRoll(entry) {
  if (!roomRole) return;
  const msg = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: entry.name || (personagem?.nome || "").trim() || "Personagem sem nome",
    label: entry.label, detail: entry.detail, total: String(entry.total ?? ""),
    type: entry.type || "outro", amount: entry.amount ?? null, ts: Date.now(),
  };
  onRoomMessage(msg);
  if (roomRole === "anfitriao") relayToOthers(msg, null);
  else if (roomClientConn?.open) roomClientConn.send(msg);
}
// Manda pro Discord (se configurado) E pra sala (se conectado), sem
// duplicar a lógica de formatação em cada ponto de rolagem.
function broadcastRoll(label, detail, total, opts = {}) {
  const note = opts.note || "";
  sendToDiscord(discordMessage(label, detail, total) + note);
  pushRoomRoll({ label, detail: detail + note, total, type: opts.type, amount: opts.amount ?? null });
}

function renderRoomChat() {
  const modalStatus = $("room-modal-status");
  if (modalStatus) modalStatus.textContent = roomStatusText();
  const box = $("room-chat-list");
  if (!box) return;
  const status = $("room-chat-status");
  if (status) status.textContent = roomStatusText();
  renderCombatTracker();
  if (!roomRolls.length) { box.innerHTML = `<div class="empty">Nenhuma mensagem na sala ainda.</div>`; return; }
  const applied = storage.getAppliedHeals();
  const appliedDmg = storage.getAppliedDamages();
  box.innerHTML = roomRolls.slice().reverse().map((r) => {
    const time = r.ts ? new Date(r.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    if (r.type === "system") {
      return `<div class="room-chat-row room-chat-system"><span>${esc(r.text || "")}</span><small>${time}</small></div>`;
    }
    if (r.type === "chat") {
      const trimmed = (r.text || "").trim();
      const autoImg = !r.image && CHAT_IMAGE_URL_RE.test(trimmed) ? trimmed : null;
      const bits = [];
      if (r.image) bits.push(`<img class="room-chat-image" src="${esc(r.image)}" alt="Imagem enviada na sala" loading="lazy">`);
      if (autoImg) bits.push(`<img class="room-chat-image" src="${esc(autoImg)}" alt="Imagem/GIF do link" loading="lazy">`);
      else if (r.text) bits.push(`<span class="room-chat-text">${linkifyEscaped(esc(r.text))}</span>`);
      return `<div class="room-chat-row room-chat-message">
        <div class="room-chat-meta"><b>${esc(r.name || "?")}</b><small>${time}</small></div>
        <div class="room-chat-body room-chat-body-msg">${bits.join("")}</div>
      </div>`;
    }
    const canHeal = r.type === "cura" && r.amount != null;
    const done = canHeal && applied.includes(r.id);
    const canDamage = r.type === "dano" && r.amount != null;
    const doneDmg = canDamage && appliedDmg.includes(r.id);
    return `<div class="room-chat-row${canHeal ? " room-chat-heal" : ""}${canDamage ? " room-chat-damage" : ""}">
      <div class="room-chat-meta"><b>${esc(r.name || "?")}</b><span>${esc(r.label || "")}</span><small>${time}</small></div>
      <div class="room-chat-body"><span class="room-chat-detail">${esc(r.detail || "")}</span><b class="room-chat-total">${esc(String(r.total ?? ""))}</b></div>
      ${canHeal ? `<button type="button" class="room-chat-heal-btn" data-heal-roll="${esc(r.id)}" ${done ? "disabled" : ""}>${done ? "✓ Cura aplicada" : `+ Aplicar cura (${esc(String(r.amount))} PV)`}</button>` : ""}
      ${canDamage ? `<button type="button" class="room-chat-damage-btn" data-damage-roll="${esc(r.id)}" ${doneDmg ? "disabled" : ""}>${doneDmg ? "✓ Dano aplicado" : `− Aplicar dano (${esc(String(r.amount))} PV)`}</button>` : ""}
    </div>`;
  }).join("");
  box.querySelectorAll("[data-heal-roll]").forEach((b) => b.addEventListener("click", () => applyHealFromRoom(b.dataset.healRoll)));
  box.querySelectorAll("[data-damage-roll]").forEach((b) => b.addEventListener("click", () => applyDamageFromRoom(b.dataset.damageRoll)));
}
function applyHealFromRoom(rollId) {
  const roll = roomRolls.find((r) => r.id === rollId);
  if (!roll || roll.amount == null || storage.getAppliedHeals().includes(rollId)) return;
  if (!personagem) { toast("Abra um personagem primeiro."); return; }
  const maxPv = calcularDerivados().pvMax ?? Infinity;
  const before = personagem.pv.atual ?? 0;
  const amount = Number(roll.amount) || 0;
  personagem.pv.atual = Math.min(maxPv, before + amount);
  storage.markHealApplied(rollId);
  salvarERenderizar();
  renderRoomChat();
  toast(`+${amount} PV de "${roll.label}" (${roll.name}) aplicado em ${personagem.nome || "seu personagem"}.`);
}
// Espelha applyHealFromRoom: o PV temporário absorve o dano primeiro, só o
// excedente desconta do PV atual — nunca passa de 0.
function applyDamageFromRoom(rollId) {
  const roll = roomRolls.find((r) => r.id === rollId);
  if (!roll || roll.amount == null || storage.getAppliedDamages().includes(rollId)) return;
  if (!personagem) { toast("Abra um personagem primeiro."); return; }
  const beforeHp = personagem.pv.atual ?? 0;
  const beforeTemp = Number(personagem.pv.temp) || 0;
  let amount = Number(roll.amount) || 0;
  const tempAbsorbed = Math.min(beforeTemp, amount);
  amount -= tempAbsorbed;
  personagem.pv.temp = beforeTemp - tempAbsorbed;
  personagem.pv.atual = Math.max(0, beforeHp - amount);
  storage.markDamageApplied(rollId);
  salvarERenderizar();
  renderRoomChat();
  toast(`−${roll.amount} PV de "${roll.label}" (${roll.name}) aplicado em ${personagem.nome || "seu personagem"}.`);
}
function toggleRoomChat(force) {
  const panel = $("room-chat-panel");
  if (!panel) return;
  const show = force != null ? force : panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !show);
  document.body.classList.toggle("room-chat-docked", show);
  if (show) { renderRoomChat(); renderDiceHistory(); }
}

// ==============================================================
// Rastreador de iniciativa da sala — mesma sala WebRTC do chat. O
// anfitrião é sempre a autoridade: um jogador nunca aplica a própria
// ação, só a envia e espera o estado recalculado voltar.
// ==============================================================
function sortedCombatants() {
  return roomCombat.list.slice().sort((a, b) => (Number(b.init) || 0) - (Number(a.init) || 0) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}
function announceRoomTurn() {
  const c = sortedCombatants().find((x) => x.id === roomCombat.currentId);
  if (c) sendToDiscord(discordTurnMessage(c.hidden ? mysteryCreatureLabel(c.id) : c.name, roomCombat.round));
}
// Nomes de efeito pra criatura "misteriosa" (nome/vida escondidos do resto
// da mesa) — escolha estável por id, pra não trocar a cada re-render.
const MYSTERY_CREATURE_LABELS = [
  "Algo se aproxima nas sombras…",
  "Uma presença ainda não identificada",
  "Um vulto oculto pela penumbra",
  "Uma silhueta que ninguém reconhece",
  "Algo observa, escondido",
  "Uma ameaça sem nome — por enquanto",
];
function mysteryCreatureLabel(id) {
  let h = 0;
  for (const ch of String(id || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MYSTERY_CREATURE_LABELS[h % MYSTERY_CREATURE_LABELS.length];
}
// Versão do estado de combate que vai pros jogadores: combatentes marcados
// como "hidden" trocam nome e PV por um enigma.
function publicCombatState() {
  return {
    round: roomCombat.round,
    currentId: roomCombat.currentId,
    list: roomCombat.list.map((c) => c.hidden
      ? { id: c.id, name: mysteryCreatureLabel(c.id), init: c.init, ac: c.ac, hpMax: null, hpCur: null, hpTemp: 0, hidden: true }
      : c),
  };
}
function broadcastCombatState() {
  const msg = { kind: "combat-state", combat: publicCombatState() };
  roomHostConns.forEach((conn) => { if (conn.open) conn.send(msg); });
  renderCombatTracker();
}
function applyCombatAction(action, payload = {}) {
  if (roomRole !== "anfitriao") return;
  const list = roomCombat.list;
  if (action === "join" || action === "update") {
    if (!payload.id) return;
    const entry = {
      id: payload.id,
      name: String(payload.name || "").trim() || "Sem nome",
      init: Number(payload.init) || 0,
      ac: Number(payload.ac) || 0,
      hpMax: Math.max(0, Number(payload.hpMax) || 0),
      hpCur: Number.isFinite(Number(payload.hpCur)) ? Number(payload.hpCur) : (Number(payload.hpMax) || 0),
      hpTemp: Math.max(0, Number(payload.hpTemp) || 0),
    };
    const idx = list.findIndex((c) => c.id === payload.id);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
  } else if (action === "addManual") {
    list.push({
      id: `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      name: String(payload.name || "").trim() || "Monstro",
      init: Number(payload.init) || 0, ac: Number(payload.ac) || 0,
      hpMax: Math.max(0, Number(payload.hpMax) || 0), hpCur: Math.max(0, Number(payload.hpMax) || 0), hpTemp: 0,
      hidden: !!payload.hidden,
    });
  } else if (action === "toggleHidden") {
    const c = list.find((x) => x.id === payload.id);
    if (c) c.hidden = !c.hidden; else return;
  } else if (action === "remove") {
    const i = list.findIndex((c) => c.id === payload.id);
    if (i >= 0) list.splice(i, 1);
    if (roomCombat.currentId === payload.id) roomCombat.currentId = null;
  } else if (action === "start") {
    roomCombat.round = 1;
    roomCombat.currentId = sortedCombatants()[0]?.id ?? null;
    announceRoomTurn();
  } else if (action === "next") {
    const sorted = sortedCombatants();
    if (sorted.length) {
      const idx = sorted.findIndex((c) => c.id === roomCombat.currentId);
      const nextIdx = idx < 0 ? 0 : (idx + 1) % sorted.length;
      if (idx >= 0 && nextIdx === 0) roomCombat.round += 1;
      roomCombat.currentId = sorted[nextIdx].id;
      announceRoomTurn();
    }
  } else if (action === "prev") {
    const sorted = sortedCombatants();
    if (sorted.length) {
      const idx = sorted.findIndex((c) => c.id === roomCombat.currentId);
      const prevIdx = idx <= 0 ? sorted.length - 1 : idx - 1;
      if (idx === 0 && roomCombat.round > 1) roomCombat.round -= 1;
      roomCombat.currentId = sorted[prevIdx].id;
    }
  } else if (action === "clear") {
    roomCombat = { round: 1, currentId: null, list: [] };
  } else { return; }
  broadcastCombatState();
}
function sendCombatAction(action, payload) {
  if (!roomRole) { toast("Entre numa sala primeiro (⚙️)."); return; }
  if (roomRole === "anfitriao") applyCombatAction(action, payload);
  else if (roomClientConn?.open) roomClientConn.send({ kind: "combat-action", action, payload });
  else toast("Ainda conectando à sala…");
}
function hpBarClass(cur, max) {
  const faixa = regras.faixaPV(cur, max || 1);
  return faixa === "morto" ? "morto" : faixa === "critico" ? "critico" : faixa === "ferido" ? "ferido" : "ok";
}
function renderCombatTracker() {
  const controls = $("room-combat-controls"), list = $("room-combat-list");
  if (!controls || !list) return;
  if (!roomRole) {
    controls.innerHTML = `<p class="dica">Entre numa sala (⚙️) pra usar o rastreador de iniciativa com o grupo.</p>`;
    list.innerHTML = "";
    return;
  }
  const isHost = roomRole === "anfitriao";
  const mine = roomCombat.list.find((c) => c.id === myPeerId);
  const d = personagem ? calcularDerivados() : null;
  controls.innerHTML = `
    <div class="room-combat-self">
      <input id="combat-self-name" placeholder="Nome" value="${esc(mine?.name ?? (personagem?.nome || ""))}">
      <div class="room-combat-self-row">
        <label>Inic.<input id="combat-self-init" type="number" value="${mine?.init ?? ""}"></label>
        <button type="button" id="combat-self-roll-init" title="Rolar iniciativa (d20 + Destreza)">🎲</button>
        <label>Defesa<input id="combat-self-ac" type="number" value="${mine?.ac ?? (d ? d.defesa : "")}"></label>
      </div>
      <div class="room-combat-self-row">
        <label>PV atual<input id="combat-self-hpcur" type="number" value="${mine?.hpCur ?? (personagem ? (personagem.pv.atual ?? 0) : "")}"></label>
        <label>PV máx<input id="combat-self-hpmax" type="number" value="${mine?.hpMax ?? (d ? d.pvMax : "")}"></label>
      </div>
      <div class="room-combat-self-row">
        <button type="button" class="add-btn" id="combat-self-join">${mine ? "Atualizar" : "Entrar na iniciativa"}</button>
        ${mine ? `<button type="button" id="combat-self-leave">Sair</button>` : ""}
      </div>
    </div>
    ${isHost ? `
    <div class="room-combat-add">
      <input id="combat-add-name" placeholder="Nome (ex.: Kliger 1)">
      <input id="combat-add-init" type="number" placeholder="Inic.">
      <input id="combat-add-ac" type="number" placeholder="Defesa">
      <input id="combat-add-hp" type="number" placeholder="PV máx">
      <label class="room-combat-hidden-check" title="Os jogadores veem a criatura entrar na iniciativa, mas nome e PV ficam ocultos até você revelar.">
        <input type="checkbox" id="combat-add-hidden"> 🎭 Misteriosa (esconder nome e PV dos jogadores)
      </label>
      <button type="button" class="add-btn" id="combat-add-btn">+ Adicionar</button>
    </div>
    <div class="room-combat-master">
      <button type="button" id="combat-start-btn">▶ Iniciar</button>
      <button type="button" id="combat-prev-btn">⏮</button>
      <button type="button" id="combat-next-btn">⏭ Próximo</button>
      <button type="button" id="combat-clear-btn">🗑 Encerrar</button>
      <b>Rodada ${roomCombat.round}</b>
    </div>` : `<p class="room-combat-round dica">Rodada ${roomCombat.round}</p>`}
  `;
  const sorted = sortedCombatants();
  list.innerHTML = sorted.length ? sorted.map((c) => {
    const mysterious = c.hidden && !isHost;
    const pct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCur / c.hpMax) * 100)) : 0;
    const isTurn = c.id === roomCombat.currentId;
    const canRemove = isHost || c.id === myPeerId;
    const hostBadge = isHost && c.hidden ? `<span class="room-combat-hidden-badge" title="Jogadores veem só o enigma — nome e PV reais ficam só com você.">🎭 oculta p/ jogadores</span>` : "";
    const hideToggle = isHost ? `<button type="button" class="room-combat-hide-toggle" data-combat-toggle-hidden="${esc(c.id)}" title="${c.hidden ? "Revelar nome e PV pros jogadores" : "Esconder nome e PV dos jogadores (misteriosa)"}">${c.hidden ? "👁" : "🎭"}</button>` : "";
    const hpBlock = mysterious
      ? `<div class="dash-hp-bar mystery-hp-bar" title="O mestre ainda não revelou os detalhes dessa criatura"><div class="dash-hp-label">??? / ???</div></div>`
      : `<div class="dash-hp-bar"><div class="dash-hp-fill ${hpBarClass(c.hpCur, c.hpMax)}" style="width:${pct}%"></div><div class="dash-hp-label">${c.hpCur} / ${c.hpMax}${c.hpTemp ? ` (+${c.hpTemp})` : ""}</div></div>`;
    return `<div class="room-combat-row${isTurn ? " room-combat-turn" : ""}${mysterious ? " room-combat-mystery" : ""}">
      <div class="room-combat-row-top"><b>${esc(c.name)}</b>${hostBadge}<span class="room-combat-init" title="Iniciativa">${c.init}</span>${hideToggle}${canRemove ? `<button type="button" class="remove-btn" data-combat-remove="${esc(c.id)}" title="Remover">×</button>` : ""}</div>
      <div class="room-combat-row-bottom">
        <span>Defesa ${c.ac}</span>
        ${hpBlock}
      </div>
    </div>`;
  }).join("") : `<div class="empty">Ninguém na iniciativa ainda.</div>`;

  $("combat-self-roll-init")?.addEventListener("click", () => {
    const des = personagem ? regras.mod(calcularDerivados().atrs.des) : 0;
    $("combat-self-init").value = regras.rollDie(20) + des;
  });
  $("combat-self-join")?.addEventListener("click", () => {
    sendCombatAction(mine ? "update" : "join", {
      id: myPeerId,
      name: $("combat-self-name").value,
      init: $("combat-self-init").value,
      ac: $("combat-self-ac").value,
      hpCur: $("combat-self-hpcur").value,
      hpMax: $("combat-self-hpmax").value,
      hpTemp: mine?.hpTemp || 0,
    });
  });
  $("combat-self-leave")?.addEventListener("click", () => sendCombatAction("remove", { id: myPeerId }));
  $("combat-add-btn")?.addEventListener("click", () => {
    const name = $("combat-add-name").value.trim();
    if (!name) { toast("Digite um nome primeiro."); return; }
    sendCombatAction("addManual", { name, init: $("combat-add-init").value, ac: $("combat-add-ac").value, hpMax: $("combat-add-hp").value, hidden: $("combat-add-hidden")?.checked });
    $("combat-add-name").value = ""; $("combat-add-init").value = ""; $("combat-add-ac").value = ""; $("combat-add-hp").value = ""; if ($("combat-add-hidden")) $("combat-add-hidden").checked = false;
  });
  list.querySelectorAll("[data-combat-toggle-hidden]").forEach((b) => b.addEventListener("click", () => sendCombatAction("toggleHidden", { id: b.dataset.combatToggleHidden })));
  $("combat-start-btn")?.addEventListener("click", () => sendCombatAction("start", {}));
  $("combat-prev-btn")?.addEventListener("click", () => sendCombatAction("prev", {}));
  $("combat-next-btn")?.addEventListener("click", () => sendCombatAction("next", {}));
  $("combat-clear-btn")?.addEventListener("click", () => { if (confirm("Encerrar o combate e limpar a lista de iniciativa?")) sendCombatAction("clear", {}); });
  list.querySelectorAll("[data-combat-remove]").forEach((b) => b.addEventListener("click", () => sendCombatAction("remove", { id: b.dataset.combatRemove })));
}
function renderRoomSettings() {
  const code = storage.getRoomCode();
  abrirModalGenerico(`<div class="modal-title"><div><span class="eyebrow">INTEGRAÇÃO</span><h2>Sala de rolagens</h2><p class="muted">Conecta os navegadores da mesa direto um no outro por WebRTC — sem conta, sem servidor guardando as rolagens. Um jogador (normalmente o mestre) <b>cria</b> a sala com um código; os outros <b>entram</b> com o mesmo código. Rolagens de <b>Cura</b> e <b>Dano</b> ganham um botão pra ajustar o PV direto no personagem de quem clicar.</p></div></div>
    <div class="modal-body">
      <p class="muted">Combine um código com o grupo (ex.: o nome da campanha). <strong>Só uma pessoa cria a sala</strong> — as outras entram com o mesmo código, no próprio navegador.</p>
      <label>Código da sala<br><input id="room-code-input" placeholder="ex.: mesa-de-sexta" value="${esc(code)}" style="width:100%"></label>
      <div class="linha-botoes-modal">
        <button type="button" class="add-btn" id="room-host-btn">Criar sala (virar anfitrião)</button>
        <button type="button" id="room-join-btn">Entrar na sala</button>
        ${roomRole ? `<button type="button" id="room-leave-btn">Sair da sala</button>` : ""}
      </div>
      <p class="muted" style="margin-top:10px">⚠️ Quem tiver o código consegue entrar na sala. O anfitrião precisa manter a aba da ficha aberta durante a sessão; se fechar ou recarregar, a sala cai.</p>
      <p class="muted" id="room-modal-status" style="margin-top:6px">${esc(roomStatusText())}</p>
    </div>`);
  $("room-host-btn")?.addEventListener("click", () => {
    const v = $("room-code-input").value.trim();
    if (!v) { toast("Digite um código de sala primeiro."); return; }
    storage.saveRoomCode(v);
    hostRoom(v);
    toast("Criando sala…");
    renderRoomSettings();
    toggleRoomChat(true);
  });
  $("room-join-btn")?.addEventListener("click", () => {
    const v = $("room-code-input").value.trim();
    if (!v) { toast("Digite um código de sala primeiro."); return; }
    storage.saveRoomCode(v);
    joinRoom(v);
    toast("Entrando na sala…");
    renderRoomSettings();
    toggleRoomChat(true);
  });
  $("room-leave-btn")?.addEventListener("click", () => {
    leaveRoom();
    toast("Saiu da sala.");
    renderRoomSettings();
  });
}

// ==============================================================
// Música da sala — YouTube ou SoundCloud embutido, sincronizado pro
// grupo. Só o anfitrião carrega/controla; a API só é carregada quando
// alguém abre a aba "Música".
// ==============================================================
function parseYouTubeUrl(url) {
  const s = String(url || "").trim();
  const listMatch = s.match(/[?&]list=([\w-]+)/);
  const vidMatch = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  const videoId = vidMatch ? vidMatch[1] : (/^[\w-]{11}$/.test(s) ? s : null);
  return { videoId, listId: listMatch ? listMatch[1] : null };
}
function parseMusicUrl(url) {
  let s = String(url || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  if (/^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\//i.test(s)) return { source: "soundcloud", scUrl: s };
  const { videoId, listId } = parseYouTubeUrl(url);
  if (videoId || listId) return { source: "youtube", videoId, listId };
  return null;
}
function ensureYouTubeApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(); return; }
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytApiPromise;
}
function ensureSoundCloudApi() {
  if (scApiPromise) return scApiPromise;
  scApiPromise = new Promise((resolve) => {
    if (window.SC && window.SC.Widget) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://w.soundcloud.com/player/api.js";
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return scApiPromise;
}
function sendMusicAction(action, payload) {
  if (!roomRole) { toast("Entre numa sala primeiro (⚙️)."); return; }
  if (roomRole === "anfitriao") applyMusicAction(action, payload);
  else if (roomClientConn?.open) roomClientConn.send({ kind: "music-action", action, payload });
  else toast("Ainda conectando à sala…");
}
function applyMusicAction(action, payload = {}) {
  if (roomRole !== "anfitriao") return;
  const updatedAt = Date.now();
  if (action === "load") {
    if (payload.source === "soundcloud") {
      roomMusic = { source: "soundcloud", scUrl: payload.scUrl, scIndex: 0, videoId: null, playlistId: null, playlistIndex: 0, playing: true, seekTime: 0, updatedAt };
    } else {
      roomMusic = payload.listId
        ? { source: "youtube", videoId: null, playlistId: payload.listId, playlistIndex: 0, scUrl: null, scIndex: 0, playing: true, seekTime: 0, updatedAt }
        : { source: "youtube", videoId: payload.videoId, playlistId: null, playlistIndex: 0, scUrl: null, scIndex: 0, playing: true, seekTime: 0, updatedAt };
    }
  }
  else if (action === "play") roomMusic = { ...roomMusic, playing: true, seekTime: Number(payload.seekTime) || 0, updatedAt };
  else if (action === "pause") roomMusic = { ...roomMusic, playing: false, seekTime: Number(payload.seekTime) || 0, updatedAt };
  else if (action === "stop") roomMusic = { source: null, videoId: null, playlistId: null, playlistIndex: 0, scUrl: null, scIndex: 0, playing: false, seekTime: 0, updatedAt };
  else if (action === "select") {
    roomMusic = roomMusic.source === "soundcloud"
      ? { ...roomMusic, scIndex: Number(payload.index) || 0, playing: true, seekTime: 0, updatedAt }
      : { ...roomMusic, playlistIndex: Number(payload.index) || 0, videoId: null, playing: true, seekTime: 0, updatedAt };
  }
  else return;
  broadcastMusicState();
}
function hostSyncPlaylistIndex(index, videoId) {
  if (roomRole !== "anfitriao" || roomMusic.source !== "youtube" || !roomMusic.playlistId) return;
  if (roomMusic.playlistIndex === index && roomMusic.videoId === videoId) return;
  roomMusic = { ...roomMusic, playlistIndex: index, videoId: videoId || roomMusic.videoId, seekTime: 0, updatedAt: Date.now() };
  broadcastMusicState();
}
function hostSyncScIndex(index) {
  if (roomRole !== "anfitriao" || roomMusic.source !== "soundcloud") return;
  if (roomMusic.scIndex === index) return;
  roomMusic = { ...roomMusic, scIndex: index, seekTime: 0, updatedAt: Date.now() };
  broadcastMusicState();
}
function broadcastMusicState() {
  const msg = { kind: "music-state", music: roomMusic };
  roomHostConns.forEach((conn) => { if (conn.open) conn.send(msg); });
  renderMusicPanel();
  syncMusicPlayer();
}
function liveMusicSeek(music) {
  const base = Number(music.seekTime) || 0;
  if (!music.playing || !music.updatedAt) return base;
  return base + Math.max(0, (Date.now() - music.updatedAt) / 1000);
}
function getMusicPositionSeconds(cb) {
  if (roomMusic.source === "soundcloud" && scWidget) { scWidget.getPosition((ms) => cb((Number(ms) || 0) / 1000)); return; }
  cb(ytPlayer?.getCurrentTime?.() ?? roomMusic.seekTime);
}
function updateMusicMuteBtn() {
  const btn = $("room-music-mute-btn");
  if (!btn) return;
  const muted = roomMusic.source === "soundcloud" ? scMuted : !!ytPlayer?.isMuted?.();
  btn.textContent = muted ? "🔇 Sem som" : "🔊 Com som";
}
function musicVolumeControlsHtml() {
  return `<div class="room-music-volume-row">
    <button type="button" id="room-music-mute-btn">🔊 Com som</button>
    <input type="range" id="room-music-volume" min="0" max="100" value="100" title="Volume (só neste navegador)">
  </div>`;
}
function wireMusicVolumeControls() {
  $("room-music-mute-btn")?.addEventListener("click", () => {
    if (roomMusic.source === "soundcloud") {
      scMuted = !scMuted;
      try { scWidget?.setVolume(scMuted ? 0 : (scLastVolume || 100)); } catch { /* ignore */ }
    } else {
      try { ytPlayer?.isMuted?.() ? ytPlayer.unMute() : ytPlayer?.mute(); } catch { /* ignore */ }
    }
    updateMusicMuteBtn();
  });
  $("room-music-volume")?.addEventListener("input", (e) => {
    const v = Number(e.target.value);
    if (roomMusic.source === "soundcloud") {
      scLastVolume = v; scMuted = v === 0;
      try { scWidget?.setVolume?.(v); } catch { /* ignore */ }
    } else {
      try { ytPlayer?.setVolume?.(v); if (v > 0) ytPlayer?.unMute?.(); } catch { /* ignore */ }
    }
    updateMusicMuteBtn();
  });
  updateMusicMuteBtn();
}
function renderMusicPlaylist() {
  const wrap = $("room-music-playlist");
  if (!wrap) return;
  let items = [], curIndex = 0;
  if (roomMusic.source === "youtube" && roomMusic.playlistId) {
    items = (ytPlayer?.getPlaylist?.() || []).map((id) => ({ img: `https://i.ytimg.com/vi/${id}/default.jpg`, label: null }));
    curIndex = ytPlayer?.getPlaylistIndex?.() ?? roomMusic.playlistIndex;
  } else if (roomMusic.source === "soundcloud" && scPlaylistCache.length > 1) {
    items = scPlaylistCache.map((snd) => ({ img: snd?.artwork_url || "", label: snd?.title || "" }));
    curIndex = scCurrentIndex ?? roomMusic.scIndex ?? 0;
  }
  if (!items.length) { wrap.innerHTML = ""; wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  const canPick = roomRole === "anfitriao";
  wrap.innerHTML = items.map((it, i) => `
    <button type="button" class="room-music-track${i === curIndex ? " active" : ""}" data-track-index="${i}" ${canPick ? "" : "disabled"} title="${esc(it.label || `Faixa ${i + 1}`)}">
      ${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : ""}
      <span>${it.label ? esc(it.label.length > 16 ? `${it.label.slice(0, 15)}…` : it.label) : i + 1}</span>
    </button>`).join("");
  if (canPick) wrap.querySelectorAll("[data-track-index]").forEach((b) => b.addEventListener("click", () => sendMusicAction("select", { index: Number(b.dataset.trackIndex) })));
}
function renderMusicPanel() {
  const box = $("room-music-controls");
  if (!box) return;
  const hasMedia = roomMusic.source === "soundcloud" ? !!roomMusic.scUrl : !!(roomMusic.videoId || roomMusic.playlistId);
  const status = $("room-music-status");
  if (status) {
    status.textContent = !roomRole ? "Sala não configurada — clique na engrenagem."
      : !hasMedia ? (roomRole === "anfitriao" ? "Cole um link do YouTube ou SoundCloud abaixo pra tocar pra sala." : "Aguardando o mestre tocar alguma coisa…")
      : roomMusic.playing ? "▶️ Tocando na sala." : "⏸ Pausado.";
  }
  if (roomRole !== "anfitriao") {
    box.innerHTML = hasMedia ? `${musicVolumeControlsHtml()}<div id="room-music-playlist" class="room-music-playlist hidden"></div>` : "";
    if (hasMedia) { wireMusicVolumeControls(); renderMusicPlaylist(); }
    return;
  }
  box.innerHTML = `
    <div class="room-music-load"><input type="text" id="room-music-url" placeholder="Link do YouTube ou SoundCloud (faixa ou playlist)"><button type="button" class="add-btn" id="room-music-load-btn">Carregar</button></div>
    <div class="room-music-buttons">
      <button type="button" id="room-music-play-btn" ${hasMedia ? "" : "disabled"}>${roomMusic.playing ? "⏸ Pausar" : "▶️ Tocar"}</button>
      <button type="button" id="room-music-resync-btn" ${hasMedia ? "" : "disabled"}>🔄 Ressincronizar</button>
      <button type="button" id="room-music-stop-btn" ${hasMedia ? "" : "disabled"}>⏹ Parar</button>
    </div>
    ${hasMedia ? musicVolumeControlsHtml() : ""}
    <div id="room-music-playlist" class="room-music-playlist hidden"></div>`;
  if (hasMedia) wireMusicVolumeControls();
  $("room-music-load-btn").addEventListener("click", () => {
    const parsed = parseMusicUrl($("room-music-url").value);
    if (!parsed) { toast("Cole um link válido do YouTube ou SoundCloud."); return; }
    sendMusicAction("load", parsed);
  });
  $("room-music-play-btn").addEventListener("click", () => {
    getMusicPositionSeconds((seekTime) => sendMusicAction(roomMusic.playing ? "pause" : "play", { seekTime }));
  });
  $("room-music-resync-btn").addEventListener("click", () => {
    getMusicPositionSeconds((seekTime) => sendMusicAction(roomMusic.playing ? "play" : "pause", { seekTime }));
  });
  $("room-music-stop-btn").addEventListener("click", () => sendMusicAction("stop", {}));
  renderMusicPlaylist();
}
function onYtPlayerStateChange(e) {
  if (roomMusic.source !== "youtube") return;
  if (roomMusic.playlistId) renderMusicPlaylist();
  if (roomRole === "anfitriao" && roomMusic.playlistId && e.data === YT.PlayerState.PLAYING) {
    const idx = ytPlayer.getPlaylistIndex?.();
    const vid = ytPlayer.getVideoData?.()?.video_id;
    if (idx != null && idx >= 0) hostSyncPlaylistIndex(idx, vid);
  }
}
function onScPlay() {
  if (roomMusic.source !== "soundcloud" || !scWidget) return;
  scWidget.getCurrentSoundIndex((idx) => {
    scCurrentIndex = Number(idx) || 0;
    renderMusicPlaylist();
    if (roomRole === "anfitriao") hostSyncScIndex(scCurrentIndex);
  });
}
function refreshScPlaylistCache() {
  if (!scWidget) return;
  scWidget.getSounds((sounds) => { scPlaylistCache = sounds || []; renderMusicPlaylist(); });
}
async function syncYtPlayer() {
  if (roomMusic.source !== "youtube" || !$("room-music-player")) {
    if (roomMusic.source !== "youtube") { try { ytPlayer?.stopVideo(); } catch { /* ignore */ } ytLoadedVideoId = null; ytLoadedPlaylistId = null; }
    return;
  }
  if (!roomMusic.videoId && !roomMusic.playlistId) {
    try { ytPlayer?.stopVideo(); } catch { /* ignore */ }
    ytLoadedVideoId = null; ytLoadedPlaylistId = null;
    return;
  }
  await ensureYouTubeApi();
  if (roomMusic.source !== "youtube" || !$("room-music-player")) return;
  if (!ytPlayer) {
    await new Promise((resolve) => {
      ytPlayer = new YT.Player("room-music-player", {
        width: "100%", height: "100%",
        videoId: roomMusic.playlistId ? undefined : roomMusic.videoId,
        playerVars: roomMusic.playlistId
          ? { autoplay: 1, playsinline: 1, listType: "playlist", list: roomMusic.playlistId, index: roomMusic.playlistIndex || 0 }
          : { autoplay: 1, playsinline: 1 },
        events: { onReady: () => resolve(), onStateChange: onYtPlayerStateChange },
      });
    });
    ytLoadedVideoId = roomMusic.playlistId ? null : roomMusic.videoId;
    ytLoadedPlaylistId = roomMusic.playlistId || null;
    if (roomRole !== "anfitriao") { try { ytPlayer.mute(); } catch { /* autoplay sem som — o jogador ativa depois */ } }
    const seek = liveMusicSeek(roomMusic);
    if (seek) ytPlayer.seekTo(seek, true);
    if (!roomMusic.playing) ytPlayer.pauseVideo();
    updateMusicMuteBtn();
    return;
  }
  if (roomMusic.playlistId && ytLoadedPlaylistId !== roomMusic.playlistId) {
    ytLoadedPlaylistId = roomMusic.playlistId; ytLoadedVideoId = null;
    ytPlayer.loadPlaylist({ list: roomMusic.playlistId, index: roomMusic.playlistIndex || 0 });
    if (!roomMusic.playing) setTimeout(() => { try { ytPlayer.pauseVideo(); } catch { /* ignore */ } }, 300);
    return;
  }
  if (!roomMusic.playlistId && ytLoadedVideoId !== roomMusic.videoId) {
    ytLoadedPlaylistId = null; ytLoadedVideoId = roomMusic.videoId;
    ytPlayer.loadVideoById(roomMusic.videoId, liveMusicSeek(roomMusic));
    if (!roomMusic.playing) setTimeout(() => { try { ytPlayer.pauseVideo(); } catch { /* ignore */ } }, 300);
    return;
  }
  if (roomMusic.playlistId && ytPlayer.getPlaylistIndex && ytPlayer.getPlaylistIndex() !== roomMusic.playlistIndex) {
    ytPlayer.playVideoAt(roomMusic.playlistIndex || 0);
    if (!roomMusic.playing) setTimeout(() => { try { ytPlayer.pauseVideo(); } catch { /* ignore */ } }, 300);
    return;
  }
  const cur = ytPlayer.getCurrentTime?.() || 0;
  const target = liveMusicSeek(roomMusic);
  if (Math.abs(cur - target) > 2.5) ytPlayer.seekTo(target, true);
  try { roomMusic.playing ? ytPlayer.playVideo() : ytPlayer.pauseVideo(); } catch { /* ignore */ }
}
async function syncScWidget() {
  if (roomMusic.source !== "soundcloud" || !$("room-music-player-sc")) {
    if (roomMusic.source !== "soundcloud") { try { scWidget?.pause(); } catch { /* ignore */ } scLoadedUrl = null; }
    return;
  }
  if (!roomMusic.scUrl) {
    try { scWidget?.pause(); } catch { /* ignore */ }
    scLoadedUrl = null;
    return;
  }
  await ensureSoundCloudApi();
  const wrap = $("room-music-player-sc");
  if (roomMusic.source !== "soundcloud" || !wrap) return;
  if (!scWidget) {
    await new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.width = "100%"; iframe.height = "100%"; iframe.style.border = "0"; iframe.allow = "autoplay";
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(roomMusic.scUrl)}&auto_play=true&show_artwork=true&visual=false`;
      wrap.innerHTML = ""; wrap.appendChild(iframe);
      scWidget = SC.Widget(iframe);
      scWidget.bind(SC.Widget.Events.READY, () => {
        scWidget.bind(SC.Widget.Events.PLAY, onScPlay);
        refreshScPlaylistCache();
        resolve();
      });
    });
    scLoadedUrl = roomMusic.scUrl;
    if (roomRole !== "anfitriao") { scMuted = true; try { scWidget.setVolume(0); } catch { /* autoplay sem som — o jogador ativa depois */ } }
    const seek = liveMusicSeek(roomMusic) * 1000;
    if (seek) scWidget.seekTo(seek);
    if (!roomMusic.playing) scWidget.pause();
    updateMusicMuteBtn();
    return;
  }
  if (scLoadedUrl !== roomMusic.scUrl) {
    scLoadedUrl = roomMusic.scUrl;
    scWidget.load(roomMusic.scUrl, {
      auto_play: roomMusic.playing, show_artwork: true,
      callback: () => { refreshScPlaylistCache(); if (roomMusic.scIndex) scWidget.skip(roomMusic.scIndex); },
    });
    return;
  }
  scWidget.getCurrentSoundIndex((idx) => {
    if ((Number(idx) || 0) !== (roomMusic.scIndex || 0)) scWidget.skip(roomMusic.scIndex || 0);
  });
  scWidget.getPosition((posMs) => {
    const target = liveMusicSeek(roomMusic) * 1000;
    if (Math.abs((Number(posMs) || 0) - target) > 2500) scWidget.seekTo(target);
  });
  try { roomMusic.playing ? scWidget.play() : scWidget.pause(); } catch { /* ignore */ }
}
function syncMusicPlayer() {
  const ytWrap = $("room-music-player"), scWrap = $("room-music-player-sc");
  if (ytWrap) ytWrap.classList.toggle("hidden", roomMusic.source !== "youtube");
  if (scWrap) scWrap.classList.toggle("hidden", roomMusic.source !== "soundcloud");
  syncYtPlayer();
  syncScWidget();
}

// ==============================================================
// Rolador de dados genérico — expressão tipo "2d6+3" sempre à mão,
// embutido no chat da sala. Histórico é só da sessão atual.
// ==============================================================
let diceHistory = [];

// Todo lugar da ficha que rola dado passa por aqui, então o histórico do
// rolador mostra tanto "2d6+3" digitado à mão quanto perícias, ataques,
// resistências e dano.
function registrarNoHistorico(rotulo, detalhe, resultado) {
  diceHistory.unshift({ rotulo, detalhe, resultado, ts: Date.now() });
  diceHistory = diceHistory.slice(0, 20);
  renderDiceHistory();
}

function rollExpression(expr, type) {
  const parsed = regras.parseDiceExpr(expr);
  if (!parsed || !parsed.faces) { toast("Expressão inválida. Use algo como 2d6+3, 1d20 ou d8."); return null; }
  const { n, faces, bonus } = parsed;
  const { rolls, total } = regras.rollDice(n, faces);
  const result = total + bonus;
  const rotulo = `${n}d${faces}${bonus ? regras.fmt(bonus) : ""}`;
  registrarNoHistorico(rotulo, `[${rolls.join(", ")}]${bonus ? ` ${regras.fmt(bonus)}` : ""}`, result);
  const t = type || $("dice-roll-type")?.value || "outro";
  broadcastRoll(rotulo, `[${rolls.join(", ")}]${bonus ? ` ${regras.fmt(bonus)}` : ""}`, result, { type: t, amount: (t === "cura" || t === "dano") ? result : null });
  toast(`${rotulo}: [${rolls.join(", ")}]${bonus ? ` ${regras.fmt(bonus)}` : ""} = ${result}`);
  return result;
}

function renderDiceHistory() {
  const html = diceHistory.length
    ? diceHistory.map((h) => `<div class="dice-history-row"><span class="dice-history-expr">${esc(h.rotulo)}</span><span class="dice-history-rolls">${esc(h.detalhe)}</span><b class="dice-history-total">${esc(h.resultado)}</b></div>`).join("")
    : `<div class="empty">Nenhuma rolagem ainda.</div>`;
  for (const id of ["dice-history", "dice-history-modal"]) {
    const box = $(id);
    if (box) box.innerHTML = html;
  }
}

// ==============================================================
// Rolador de dados avulso — o mesmo rolador do chat da sala, disponível pelo
// menu Ferramentas mesmo sem sala configurada, com os testes da ficha
// (atributos, perícias e resistências) a um clique.
// ==============================================================
const DADOS_RAPIDOS = [4, 6, 8, 10, 12, 20, 100];

function renderDiceRollerModal() {
  const d = calcularDerivados();
  const resistencias = db.pericias.filter((p) => p.salvamento);
  abrirModalGenerico(`
    <div class="modal-title"><div><span class="eyebrow">FERRAMENTAS</span><h2>🎲 Rolador de dados</h2>
      <p class="muted">Rola qualquer expressão e também os testes da ficha aberta. Se você estiver numa sala de rolagens ou com o Discord configurado, a rolagem vai junto.</p></div></div>
    <div class="modal-body">
      <div class="dice-quick-row">${DADOS_RAPIDOS.map((f) => `<button type="button" data-dado-modal="${f}">d${f}</button>`).join("")}</div>
      <div class="dice-expr-row">
        <input id="dice-expr-modal" placeholder="2d6+3" autocomplete="off">
        <button type="button" id="dice-roll-modal">Rolar</button>
      </div>
      <h3>Atributos</h3>
      <div class="chip-lista">${db.atributos.map((a) => `<button type="button" class="chip" data-dado-atributo="${a.id}">${esc(a.nome)}<small>${formatarMod(regras.mod(d.atrs[a.id]))}</small></button>`).join("")}</div>
      <h3>Resistências</h3>
      <div class="chip-lista">${resistencias.map((p) => `<button type="button" class="chip" data-dado-resistencia="${p.id}">${esc(p.nome)}<small>${formatarMod(bonusDePericiaSeguro(p, d))}</small></button>`).join("")}</div>
      <h3>Perícias treinadas</h3>
      <div class="chip-lista">${db.pericias.filter((p) => estaTreinado(p.id, d) && !p.salvamento).map((p) => `<button type="button" class="chip" data-dado-pericia="${p.id}">${esc(p.nome)}<small>${formatarMod(bonusDePericiaSeguro(p, d))}</small></button>`).join("") || '<span class="dica">Nenhuma perícia treinada ainda.</span>'}</div>
      <h3>Histórico da sessão</h3>
      <div id="dice-history-modal" class="dice-history"></div>
    </div>`);

  renderDiceHistory();
  const rolarExpressao = () => rollExpression($("dice-expr-modal").value, "outro");
  $("dice-roll-modal")?.addEventListener("click", rolarExpressao);
  $("dice-expr-modal")?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") rolarExpressao(); });
  $("modal-content").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    const atual = calcularDerivados();
    if (b.dataset.dadoModal) return void rollExpression(`1d${b.dataset.dadoModal}`, "outro");
    if (b.dataset.dadoAtributo) {
      const a = db.atributos.find((x) => x.id === b.dataset.dadoAtributo);
      return void rolarDado(20, regras.mod(atual.atrs[a.id]), `Teste de ${a.nome}`);
    }
    if (b.dataset.dadoResistencia || b.dataset.dadoPericia) {
      const id = b.dataset.dadoResistencia || b.dataset.dadoPericia;
      const p = db.pericias.find((x) => x.id === id);
      return void rolarDado(20, bonusDePericiaSeguro(p, atual), `${b.dataset.dadoResistencia ? "Resistência: " : ""}${p.nome}`);
    }
  });
}

// ==============================================================
// Apoio ao projeto — totalmente opcional, nenhum recurso da ficha fica
// trancado atrás de doação.
// ==============================================================
const SUPPORT_PIX = { key: "", name: "", city: "" };
const SUPPORT_INTL = { label: "Ko-fi", url: "" };
function pixCrc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function buildPixPayload({ key, name, city }) {
  const tlv = (id, value) => `${id}${String(value.length).padStart(2, "0")}${value}`;
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  let payload = tlv("00", "01") + tlv("26", merchantAccount) + tlv("52", "0000") + tlv("53", "986")
    + tlv("58", "BR") + tlv("59", name.toUpperCase().slice(0, 25)) + tlv("60", city.toUpperCase().slice(0, 15))
    + tlv("62", tlv("05", "***"));
  payload += "6304";
  return payload + pixCrc16(payload);
}
function renderSupportModal() {
  const pixReady = !!(SUPPORT_PIX.key && SUPPORT_PIX.name && SUPPORT_PIX.city);
  const intlReady = !!SUPPORT_INTL.url;
  const pixCode = pixReady ? buildPixPayload(SUPPORT_PIX) : "";
  abrirModalGenerico(`<div class="modal-title"><div><span class="eyebrow">APOIO</span><h2>Apoiar o projeto</h2><p class="muted">Totalmente opcional — a ficha é gratuita e continua assim pra sempre. Nenhuma função fica trancada atrás de doação.</p></div></div>
    <div class="modal-body">
      <h3>🇧🇷 Pix</h3>
      ${pixReady ? `
        <p class="muted">Chave no nome de <strong>${esc(SUPPORT_PIX.name)}</strong>.</p>
        <label>Código Pix Copia e Cola<br><input id="support-pix-code" readonly value="${esc(pixCode)}" style="width:100%"></label>
        <button type="button" class="add-btn" id="support-pix-copy" style="margin-top:8px">📋 Copiar código Pix</button>
      ` : `<p class="muted">Chave Pix ainda não configurada.</p>`}
      <h3 style="margin-top:16px">🌍 Fora do Brasil</h3>
      ${intlReady
        ? `<p><a href="${esc(SUPPORT_INTL.url)}" target="_blank" rel="noopener noreferrer" class="add-btn" style="display:inline-block;text-decoration:none">${esc(SUPPORT_INTL.label || "Apoiar")}</a></p>`
        : `<p class="muted">Link internacional (Ko-fi, PayPal, Buy Me a Coffee…) ainda não configurado.</p>`}
    </div>`);
  $("support-pix-copy")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(pixCode); toast("Código Pix copiado — cole no \"Pix Copia e Cola\" do seu banco."); }
    catch { $("support-pix-code")?.select(); toast("Não deu pra copiar sozinho — selecione o código e copie manualmente."); }
  });
}

// ==============================================================
// Guia de ajuda
// ==============================================================
function renderHelpModal() {
  abrirModalGenerico(`<div class="modal-title"><div><span class="eyebrow">GUIA</span><h2>Como a ficha funciona</h2><p class="muted">Um resumo de cada aba e botão. Tudo fica salvo neste navegador (sem conta nem servidor) — veja "🗂️ Personagens" pra alternar entre fichas salvas, e "📤 Exportar"/"📥 Importar" pra levar uma ficha pra outro navegador.</p></div></div>
    <div class="modal-body">
      <h3>Como a automação funciona</h3>
      <p>A aba <strong>Construção</strong> tem o painel <strong>Automação da ficha</strong>: cada benefício que raça, classe, origem e nível concedem vira um bloco. O que é fixo já vem aplicado (marcado como <em>aplicado</em>); o que o livro manda escolher fica <em>falta escolher</em> até você decidir — atributos do humano, legado do suraggel, "Luta ou Pontaria" do guerreiro, perícias da classe e da origem, poder de origem. O contador do topo diz quantas pendências sobraram.</p>
      <ul>
        <li><strong>Perícias treinadas</strong> — as fixas da classe entram sozinhas; as à escolha são <em>número da classe + modificador de Inteligência</em>; a origem treina 2; algumas raças treinam mais. Perícias que vieram da automação aparecem marcadas <strong>auto</strong> e só mudam pelo painel.</li>
        <li><strong>Poderes</strong> — um poder de classe no 2º nível e um a cada nível seguinte, mais o poder da origem. A aba Poderes mostra quantos faltam e pode filtrar só os que você tem requisito pra pegar.</li>
        <li><strong>Atributos</strong> — em T20 o valor <em>é</em> o modificador (Força 2 soma +2). A ficha mostra quantos dos 10 pontos de compra você usou.</li>
        <li><strong>Equipamento</strong> — equipar armadura ou escudo entra sozinho na Defesa e na penalidade de armadura; equipar uma arma cria a linha de ataque com dano e crítico prontos.</li>
        <li><strong>⬆️ Subir de nível</strong> — aplica o nível e lista o que mudou (PV, PM, poder novo, metade do nível, bônus de treino).</li>
      </ul>
      <h3>Abas</h3>
      <ul>
        <li><strong>Construção</strong> — raça, classe, origem e divindade (modo livre ou assistente guiado) + o painel de automação.</li>
        <li><strong>Ficha</strong> — identidade, atributos, carga, dinheiro e biografia.</li>
        <li><strong>Perícias</strong> — todas as perícias com o bônus calculado (metade do nível + atributo + treino + outros − penalidade de armadura), com busca, filtro por perícias de classe e botão de rolagem (🎲) em cada uma.</li>
        <li><strong>Poderes</strong> — poderes escolhidos, quantos o nível concede e catálogo filtrável por categoria (classe/racial/origem/geral/concedido).</li>
        <li><strong>Magias</strong> — só aparece pra classes conjuradoras; grimório/lista de magias conhecidas e catálogo por círculo.</li>
        <li><strong>Combate</strong> — testes de resistência (com rolagem), tabela de ataques com rolagem de ataque e de dano, e condições ativas.</li>
        <li><strong>Equipamentos</strong> — inventário com equipar/desequipar e peso carregado, e catálogo de itens do compêndio.</li>
        <li><strong>Compêndio</strong> — busca em poderes, magias, equipamentos, ameaças (bestiário) e panteão.</li>
        <li><strong>Notas</strong> — anotações de sessão.</li>
      </ul>
      <h3>Dashboard fixo</h3>
      <p>PV/PM com botões rápidos de dano/cura, Defesa, Iniciativa, Deslocamento e Nível — sempre visível no topo, útil durante a sessão.</p>
      <h3>🔗 Discord</h3>
      <p>Cadastra um link de webhook e cada rolagem (perícia, ataque, rolador genérico) vira uma mensagem automática no canal configurado. Fica salvo neste navegador, cada jogador configura o próprio.</p>
      <h3>💬 Sala de rolagens (WebRTC, sem servidor)</h3>
      <p>Conecta os navegadores da mesa direto um no outro — sem conta, sem serviço de terceiro guardando as rolagens. Configura pelo botão ⚙️ da bolha de chat (canto da tela) ou pelo botão "💬 Sala" no topo.</p>
      <ul>
        <li><strong>Criar sala (virar anfitrião)</strong> — normalmente o mestre; o anfitrião precisa manter a aba aberta durante a sessão.</li>
        <li><strong>Entrar na sala</strong> — os outros jogadores digitam o mesmo código, cada um no próprio navegador.</li>
        <li><strong>Aba Chat</strong> — toda rolagem (perícia, ataque, rolador genérico) aparece pra todo mundo, além de mensagens de texto e imagens/GIFs. Rolagens marcadas como <strong>Cura</strong> ou <strong>Dano</strong> ganham um botão pra ajustar o PV direto no personagem de quem clicar.</li>
        <li><strong>Aba Iniciativa</strong> — rastreador de combate compartilhado; o anfitrião é sempre a autoridade. Criaturas podem ser marcadas como "🎭 misteriosas" (nome/PV ocultos dos jogadores até o mestre revelar).</li>
        <li><strong>Aba Música</strong> — cole um link do YouTube ou SoundCloud; só o anfitrião controla, os jogadores recebem a mesma faixa sincronizada.</li>
      </ul>
      <h3>🎲 Rolador de dados</h3>
      <p>Fica em <strong>Ferramentas → 🎲 Rolador de dados</strong> e também dentro do chat da sala. Digite uma expressão como "2d6+3", ou clique num atributo, resistência ou perícia treinada pra rolar o teste já com o bônus da ficha. O histórico junta tudo que a ficha rolou na sessão. Marcar o tipo como <strong>Cura</strong> ou <strong>Dano</strong> antes de rolar habilita o botão de ajustar PV no chat da sala.</p>
      <h3>💛 Sobre ser gratuito</h3>
      <p>A ficha é 100% gratuita — conteúdo de fã, feito por fãs de Tormenta 20. Quem quiser apoiar pode clicar em "💛 Apoiar o projeto" no aviso do topo — isso é opcional e nunca destrava nada.</p>
    </div>`);
}

// ==============================================================
// Novidades — resumo das atualizações da ficha, mais recente primeiro.
// ==============================================================
const CHANGELOG = [
  { date: "2026-09-13", items: [
    "<b>Auditoria das raças</b>: as 52 raças que existem no compêndio comunitário estão todas na ficha, e tamanho e deslocamento batem uma a uma. Nada faltando.",
    "<b>Moreau ganhou as 12 heranças</b> (Coruja, Hiena, Raposa, Serpente, Búfalo, Coelho, Crocodilo, Leão, Gato, Lobo, Urso, Morcego) — cada uma com bônus de atributo e de perícia próprios, no mesmo esquema dos legados do Suraggel.",
    "<b>Kallyanach escolhe como distribuir o bônus</b>: +2 num atributo ou +1 em dois.",
    "Raça que <b>conta como outra</b> para pré-requisito (Meio-Orc como Orc, Soterrado como Osteon, Moreau como Humano, Meio-Elfo como Elfo, Trog Anão como Trog) agora atende os requisitos de poder.",
    "Raça marcada como obsoleta no compêndio sai do seletor, mas continua valendo em quem já a usava.",
  ] },
  { date: "2026-09-12", items: [
    "<b>Bardo e Druida são meio-conjuradores</b> — a ficha tratava todo mundo como conjurador pleno. Eles só alcançam o 2º círculo no 9º nível e param no 4º; Arcanista e Clérigo continuam chegando ao 5º.",
    "<b>Magias conhecidas por nível</b>: a aba Magias agora mostra quantas magias o seu nível concede e avisa se faltam ou sobram. O Arcanista tem uma tabela por Caminho — Mago, Bruxo e Feiticeiro aprendem quantidades diferentes.",
    "<b>Habilidades de classe por nível</b> na aba Poderes: o que a classe dá sozinho ao subir (Fúria no 1º, Evasão no 2º…), separado dos poderes que você escolhe, com o que ainda está por vir.",
    "O gerador de personagem passa a escolher exatamente o número de magias do nível.",
  ] },
  { date: "2026-09-11", items: [
    "<b>Conteúdo dos suplementos</b>: 34 raças novas (Centauro, Ogro, Orc, Tengu, Harpia, Duende, Galokk…), 2 classes (Treinador e Frade), 30 origens e 63 deuses menores, de <b>Heróis de Arton</b>, <b>Ameaças de Arton</b> e <b>Deuses de Arton</b>.",
    "Cada opção mostra de qual livro veio, e o filtro <b>\"Incluir suplementos\"</b> na aba Construção deixa jogar só com o Jogo Básico — o que o personagem já escolheu nunca some da ficha.",
    "As divindades agora incluem os deuses menores, separados dos maiores no seletor.",
  ] },
  { date: "2026-09-10", items: [
    "<b>Dados de raça, classe e origem conferidos</b> contra o <a href=\"https://github.com/YuriAlessandro/gerador-ficha-tormenta20\" target=\"_blank\" rel=\"noopener\">Fichas de Nimb</a>, outro projeto de fã de T20. PV, PM e número de perícias das 14 classes batem integralmente entre os dois.",
    "<b>As perícias de origem deixaram de ser palpite</b>: as 35 origens batem uma a uma com a lista do Nimb — o aviso de \"palpite temático\" saiu do README.",
    "<b>Equipamento inicial de origem</b>: cada origem agora traz o que ela concede na criação, com um botão pra jogar tudo no inventário.",
    "<b>Proficiências por classe</b>: o gerador parou de vestir armadura pesada em Arcanista — cada classe só usa o que é proficiente, e escudo só pra quem tem.",
    "Quatro classes ganharam perícias de classe que faltavam (Bucaneiro, Caçador, Cavaleiro e Clérigo), e a distribuição de atributos do gerador segue a prioridade declarada pela classe.",
  ] },
  { date: "2026-09-09", items: [
    "<b>PM gasto de verdade</b>: botão <b>Conjurar</b> em cada magia e <b>Usar</b> nos 174 poderes com custo (Fúria, Aparar, Inspiração…). Desconta a mana, recusa quando falta e registra no histórico. Antes o custo era só um rótulo.",
    "<b>Círculo máximo por nível</b>: 1º círculo no 1º nível e um novo a cada quatro. Magia acima disso fica marcada com o nível em que libera e não dá pra conjurar.",
    "<b>Condições mexem nos números</b>: Abalado tira −2 de perícias e ataques, Exausto tira −6 de For/Des e corta o deslocamento, Indefeso fixa a Defesa em 5, Paralisado zera a Destreza. As condições sem efeito numérico continuam como lembrete, agora marcadas como tal.",
    "<b>Modificadores temporários</b>: crie o \"+2 em tudo\" de uma bênção ou o \"−1 na Defesa\" de um item e ele entra nas mesmas contas das condições.",
    "<b>Multiclasse</b>: reparta o nível entre classes — PV e PM contam a repartição e as perícias fixas das classes novas entram sozinhas.",
    "<b>Escolhas obrigatórias de classe</b>: Caminho do Arcanista e Caminho do Cavaleiro viram pendência no painel de automação, com as opções vindas do próprio compêndio. Clérigo e Paladino passam a exigir divindade.",
    "<b>Ficha em PDF de duas páginas</b>, num layout A4 de papel — não é mais a página do app impressa. Tem pré-visualização em tela no menu Arquivo.",
    "<b>Retrato do personagem, XP e parceiros</b> (aliados e montarias com PV e anotações), além de especialidade em Ofício e Conhecimento.",
    "O <b>gerador</b> agora também escolhe magias pra conjuradores, dinheiro inicial e a especialidade das perícias.",
  ] },
  { date: "2026-09-08", items: [
    "<b>Visual novo</b>: a ficha inteira foi repaginada — superfícies escuras empilhadas, tipografia condensada nos rótulos e acento escarlate de Arton, na mesma linguagem visual da ficha de D&D 5e. Agora são quatro temas: Noite (padrão), Mesa (escuro e compacto pra jogar), Papel Branco e Pergaminho.",
    "<b>Perícias treinadas legíveis em qualquer tema</b>: a linha destacada usava um creme fixo que, no tema escuro, deixava texto claro sobre fundo claro — impossível de ler. Agora o realce sai da cor de acento do tema, com uma faixa vermelha na margem e o bônus em pílula.",
    "<b>Assistente guiado com 10 passos</b> (era 4): raça, classe, origem, divindade, nível, atributos, perícias e traços, poderes, equipamento e revisão final — com cartões pesquisáveis, resumo do que cada opção concede e ✓ no que já está resolvido.",
    "<b>Quatro jeitos de gerar atributos</b>: compra de pontos (os 10 do livro), arranjo padrão, rolagem 4d6 descartando o menor (convertida pra escala de T20) e valores livres. Nos dois do meio os valores viram uma piscina que você distribui pelos atributos.",
    "<b>Escolha sem alternativa não é mais pendência</b>: quando a lista de opções tem exatamente o tamanho da cota (a origem que sugere 2 perícias e treina 2, o grupo \"uma ou outra\" com uma opção só), a ficha aplica sozinha e marca como <em>aplicado</em> em vez de pedir uma decisão que não existe.",
    "<b>Seletor de armadura, escudo e armas</b> na aba Equipamentos e na aba Combate: cada função tem sua lista, com Defesa, penalidade e peso à mostra. Equipar entra na Defesa na hora; escolher uma arma cria a linha de ataque.",
    "<b>Luta ou Pontaria pela categoria certa</b>: a ficha decidia pelo campo de alcance, o que jogava adaga, lança e azagaia pro lado errado. Agora lê a categoria do compêndio (\"Arma Simples - Corpo a Corpo\" / \"Ataque à Distância\").",
    "<b>Gerador de personagem</b> (menu Personagem): trava o que você já decidiu e sorteia o resto — distribui atributos favorecendo o atributo-chave da classe, resolve todas as escolhas da automação, veste equipamento e enche PV/PM.",
  ] },
  { date: "2026-09-07", items: [
    "<b>Atributos na escala de Tormenta 20</b>: o valor do atributo agora <em>é</em> o modificador (Força 2 = +2), como manda o livro — a ficha vinha usando a escala do d20 (base 10). Fichas antigas são convertidas sozinhas ao abrir.",
    "<b>Bônus de perícia correto</b>: metade do nível em toda perícia + treino de +2 (+4 no 7º nível, +6 no 15º). Antes o treino escalava errado e as perícias não-treinadas não somavam metade do nível.",
    "<b>Painel de automação de verdade</b> na aba Construção: mostra tudo que raça/classe/origem/nível concedem e pede as escolhas que faltam (atributos do humano, legado do suraggel, perícias da classe e da origem, poder de origem), marcando as pendências.",
    "<b>Contagem de poderes por nível</b>: um poder de classe no 2º nível e a cada nível seguinte, mais o poder de origem e os poderes gerais extras de traço racial.",
    "<b>Perícias treinadas automáticas</b>: as fixas da classe entram sozinhas, as escolhas ganham contador (número da classe + Inteligência), e perícias concedidas duas vezes por fontes diferentes ficam marcadas.",
    "<b>Rolador de dados no menu Ferramentas</b>, fora da sala: expressões livres, atributos, resistências e perícias treinadas a um clique, com histórico de tudo que a ficha rolou.",
    "<b>Equipar armadura e escudo</b>: entram sozinhos na Defesa e na penalidade de armadura (que desconta de Acrobacia, Furtividade e Ladinagem); armas viram linha de ataque pronta com dano, margem e multiplicador de crítico.",
    "<b>Rolagem de dano</b> nos ataques, com crítico aplicando o multiplicador da arma, e rolagem de atributos e de testes de resistência.",
    "<b>Assistente de subida de nível</b> mostrando o que mudou (PV, PM, poderes, metade do nível, bônus de treino).",
    "PM não soma mais atributo (regra de T20) e o Caçador voltou a ter 4 PM por nível; perícias iniciais de todas as 14 classes conferidas com o livro.",
    "As 66 origens regionais do Atlas de Arton passaram a aparecer no seletor de origem.",
  ] },
  { date: "2026-09-06", items: [
    "Sala de rolagens compartilhada em tempo real (WebRTC, sem servidor): chat com texto/imagem/GIF, rolagens com botão de aplicar cura/dano direto no PV.",
    "Rastreador de iniciativa da sala, com criaturas \"misteriosas\" (nome/PV ocultos dos jogadores até o mestre revelar).",
    "Música da sala sincronizada pra todo mundo — YouTube e SoundCloud, com playlists navegáveis.",
    "Integração com Discord — rolagens (perícia, ataque, rolador genérico) viram mensagens automáticas num canal configurável.",
    "Rolador de dados genérico (expressão tipo 2d6+3) com histórico.",
    "Novo guia de ajuda (❓), aviso de conteúdo de fã e modal de apoio ao projeto.",
  ] },
];
function renderUpdatesModal() {
  const body = CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="changelog-date">${new Date(entry.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
      <ul>${entry.items.map((i) => `<li>${i}</li>`).join("")}</ul>
    </div>`).join("");
  abrirModalGenerico(`<div class="modal-title"><div><span class="eyebrow">NOVIDADES</span><h2>O que mudou na ficha</h2><p class="muted">Resumo das atualizações mais recentes — o histórico completo de código fica no repositório do GitHub.</p></div></div>
    <div class="modal-body">${body}</div>`);
}

// ==============================================================
// Aviso legal / disclaimer — projeto de fã, não-oficial, sem fins
// lucrativos; o conteúdo de regras pertence à Jambô Editora/Editora Games
// Magazine (ou aos autores de homebrew citados nas fontes do compêndio).
// ==============================================================
function renderDisclaimerModal() {
  abrirModalGenerico(`<div class="modal-title"><div><span class="eyebrow">AVISO LEGAL</span><h2>Aviso legal / Disclaimer</h2></div></div>
    <div class="modal-body">
      <p><strong>Este é um projeto de fã, não-oficial e sem fins lucrativos.</strong> Não há anúncios, cobrança, assinatura ou qualquer forma de monetização — o código é aberto e a ficha roda de graça direto do navegador.</p>
      <p><strong>Tormenta 20</strong> (Tormenta RPG), seus logos, nomes de raças, classes, poderes, magias, ameaças, divindades e demais elementos de regra e ambientação de Arton são marcas e propriedade dos respectivos detentores de direitos autorais do sistema. Este site, seu autor e seus colaboradores <strong>não são afiliados, endossados, patrocinados ou aprovados</strong> pelos editores/detentores de direitos de Tormenta 20.</p>
      <p>Os dados de regra que a ficha usa vêm de duas fontes comunitárias, ambas projetos de fã de código aberto, e ficam versionados no repositório em formato de tabela (números e listas), não como reprodução dos livros: o compêndio <a href="https://github.com/Kull4ck/tormenta20-compendium" target="_blank" rel="noopener">tormenta20-compendium</a> (Kull4ck), de onde saem poderes, magias, equipamentos, ameaças e panteão; e o <a href="https://github.com/YuriAlessandro/gerador-ficha-tormenta20" target="_blank" rel="noopener">Fichas de Nimb</a> (Yuri Alessandro Martins), usado para conferir e completar raças, classes e origens. <strong>Nenhum texto dos livros é reproduzido aqui</strong>: as descrições são resumos mecânicos curtos escritos para esta ficha, e o que se guarda são as estatísticas do sistema — que são fatos de regra, não a prosa dos livros.</p>
      <p>Se você quer as regras completas, com o texto, as ilustrações e a ambientação, <strong>compre os livros</strong>: eles são o produto da Jambô, e esta ficha não substitui nenhum deles — ela só organiza a ficha de quem já joga.</p>
      <p>Esta ficha existe pra uso pessoal em mesas de RPG. Se você é detentor de direitos sobre algum conteúdo aqui e quer que algo seja removido, abra uma Issue no repositório do GitHub (veja o botão "🐛 Relatar bug") explicando o pedido.</p>
      <p>A ficha é fornecida "como está", sem garantias de qualquer tipo. Os personagens que você cria ficam salvos só no seu próprio navegador (ou no arquivo que você exportar) — ninguém além de você tem acesso a eles.</p>
    </div>`);
}

// ==============================================================
// Construção do personagem (aba "Construção") — cartões de escolha pra
// raça/classe/origem/divindade (em vez de <select> nu), com um modo
// "guiado" (passo a passo) além do modo livre (os 4 cartões de uma vez).
// Os <select> originais (#raca/#classe/#origem/#divindade, agora ocultos
// na aba Ficha) continuam sendo a fonte da verdade — os cartões só leem o
// valor deles e, ao escolher algo no seletor, mudam o <select> e disparam
// "change" nele, reaproveitando os listeners já registrados em
// registrarEventos().
// ==============================================================
const CHOICE_KINDS = ["raca", "classe", "origem", "divindade"];
let creationMode = "livre"; // "livre" | "guiado"

function nomePericia(id) { return db.pericias.find((p) => p.id === id)?.nome || id; }

// Perícias que o livro manda especializar na criação: você não é treinado em
// "Ofício", e sim em "Ofício (ferreiro)". A ficha guarda o texto em
// personagem.especializacoes e mostra junto do nome da perícia.
const PERICIAS_COM_ESPECIALIDADE = ["ofi", "con"];
function nomePericiaCompleto(id) {
  const base = nomePericia(id);
  const espec = (personagem.especializacoes?.[id] || "").trim();
  return espec ? `${base} (${espec})` : base;
}

// Mostrar ou não o conteúdo dos suplementos (Heróis de Arton, Ameaças de
// Arton, Deuses de Arton). Fica no navegador, como o tema.
const CHAVE_SUPLEMENTOS = "t20.suplementos";
function usaSuplementos() {
  try { return localStorage.getItem(CHAVE_SUPLEMENTOS) !== "0"; } catch { return true; }
}
function setUsaSuplementos(v) {
  try { localStorage.setItem(CHAVE_SUPLEMENTOS, v ? "1" : "0"); } catch { /* modo privado */ }
  renderizarTudo();
}
// Nada some da ficha por desligar o filtro: o que o personagem já escolheu
// continua aparecendo, senão a ficha se contradiria ao reabrir.
function filtrarPorSuplemento(lista, idAtual) {
  const emUso = (x) => x.id === idAtual || x.nome === idAtual;
  // Raça que o Fichas de Nimb marca como obsoleta (substituída por errata)
  // não aparece no seletor, mas continua válida em quem já a usa.
  const semObsoletas = lista.filter((x) => !x.obsoleta || emUso(x));
  if (usaSuplementos()) return semObsoletas;
  return semObsoletas.filter((x) => !x.suplemento || emUso(x));
}

function pickerOptionsFor(kind) {
  if (kind === "raca") return filtrarPorSuplemento(db.racas, personagem.raca).map((r) => ({ id: r.id, nome: r.nome, meta: `${r.tamanho} · desloc. ${r.deslocamento}${r.suplemento ? ` · ${r.fonte}` : ""}`, desc: r.traços, suplemento: r.suplemento }));
  if (kind === "classe") return filtrarPorSuplemento(db.classes, personagem.classe).map((c) => ({ id: c.id, nome: c.nome, meta: `Atributo-chave ${c.atributoChave.toUpperCase()}${c.conjuracao ? ` · conjuração ${c.conjuracao}` : ""}${c.suplemento ? ` · ${c.fonte}` : ""}`, desc: c.iniciais, suplemento: c.suplemento }));
  if (kind === "origem") return [
    ...filtrarPorSuplemento(db.origens, personagem.origem).map((o) => ({ id: o.id, nome: o.id, meta: o.suplemento ? `Origem · ${o.fonte}` : "Origem do livro básico", desc: `Perícias: ${(o.periciasSugeridas || []).map(nomePericia).join(", ") || "—"}${o.itensIniciais ? ` · Itens: ${o.itensIniciais.join(", ")}` : ""}${o.nota ? ` · ${o.nota}` : ""}`, suplemento: o.suplemento })),
    ...(db.origensRegionais || []).map((o) => ({ id: o.id, nome: o.id, meta: `Atlas de Arton · ${o.regiao || ""}`, desc: `Perícias: ${(o.periciasSugeridas || []).map(nomePericia).join(", ") || "—"}${o.beneficio ? ` · ${o.beneficio}` : ""}` })),
  ];
  if (kind === "divindade") return [
    ...db.panteao.map((d) => ({ id: d.nome, nome: d.nome, meta: "Divindade maior", desc: (d.descricao || "").replace(/<[^>]+>/g, "").slice(0, 220) })),
    ...(db.deusesMenores || []).map((d) => ({ id: d.nome, nome: d.nome, meta: `Deus menor · ${d.fonte}`, desc: "", suplemento: true })),
  ];
  return [];
}
function valorAtualDoCampo(kind) { return document.getElementById(kind).value; }
function definirCampo(kind, id) {
  const sel = document.getElementById(kind);
  sel.value = id;
  sel.dispatchEvent(new Event("change"));
}
function labelDoCampo(kind, id) {
  if (!id) return null;
  return pickerOptionsFor(kind).find((o) => o.id === id) || null;
}

const CHOICE_DESC_VAZIO = {
  raca: "Escolha uma raça para começar.",
  classe: "Escolha uma classe para começar.",
  origem: "Escolha uma origem.",
  divindade: "Escolha uma divindade do panteão (opcional).",
};
function renderConstrucao() {
  for (const kind of CHOICE_KINDS) {
    const valor = valorAtualDoCampo(kind);
    const opt = labelDoCampo(kind, valor);
    const card = $(`choice-${kind}`);
    if (!card) continue;
    card.classList.toggle("selected", !!opt);
    $(`choice-${kind}-value`).textContent = opt ? opt.nome : (kind === "divindade" ? "Nenhuma" : "Escolher…");
    $(`choice-${kind}-meta`).textContent = opt ? opt.meta : (kind === "divindade" ? "Opcional" : "Nenhuma opção selecionada");
    $(`choice-${kind}-desc`).textContent = opt ? (opt.desc || "").replace(/<[^>]+>/g, "").slice(0, 240) : CHOICE_DESC_VAZIO[kind];
  }
  renderMulticlasse();
  const feitas = ["raca", "classe"].filter((k) => valorAtualDoCampo(k)).length;
  $("auto-status").textContent = feitas === 2 ? "Construção completa" : `${feitas}/2 escolhas principais feitas`;
  $("auto-empty")?.classList.toggle("hidden", feitas > 0);
}

// ==============================================================
// Painel de multiclasse — vive na aba Construção (modo livre) e é
// emprestado pelo passo "Classe" do assistente, como os demais painéis.
// ==============================================================
function renderMulticlasse(alvoId = "multiclasse-secao") {
  const box = document.getElementById(alvoId);
  if (!box) return;
  const inicial = classeAtual();
  if (!inicial) { box.innerHTML = ""; return; }
  const nivelTotal = personagem.nivel || 1;
  const dist = classesDoPersonagem();
  const extras = personagem.multiclasses || [];
  const usadosExtras = dist.slice(1).reduce((a, b) => a + b.niveis, 0);

  box.innerHTML = `
    <div class="multiclasse-head">
      <div><span>Multiclasse</span><small>Reparta o nível <b>${nivelTotal}</b> entre classes. A inicial fica com o que sobra e nunca com menos de 1.</small></div>
      <button type="button" class="add-btn" id="btn-add-multiclasse" ${nivelTotal < 2 ? "disabled title='Precisa de nível 2 ou mais'" : ""}>+ Adicionar classe</button>
    </div>
    <div class="multiclasse-dist">${dist.map((x, i) => `<span class="chip ${i === 0 ? "ativo" : ""}">${esc(x.classe.nome)}<small>nível ${x.niveis}</small></span>`).join("")}</div>
    <div class="multiclasse-lista">${extras.map((m, i) => `
      <div class="multiclasse-linha">
        <select data-mc-classe="${i}">
          <option value="">— escolher classe —</option>
          ${db.classes.filter((c) => c.id !== inicial.id).map((c) => `<option value="${c.id}"${c.id === m.classeId ? " selected" : ""}>${esc(c.nome)}</option>`).join("")}
        </select>
        <input type="number" min="1" max="${Math.max(1, nivelTotal - 1)}" value="${m.niveis || 1}" data-mc-niveis="${i}" title="Níveis nesta classe" />
        <button type="button" class="perigo" data-mc-remover="${i}">✕</button>
      </div>`).join("")}</div>
    ${usadosExtras >= nivelTotal
      ? '<div class="alerta-automacao">As classes extras pediram mais níveis do que o personagem tem — a ficha cortou no que cabia. Suba o nível ou reduza os números.</div>'
      : ""}
    ${dist.length > 1
      ? `<p class="dica">PV e PM já contam a repartição: o pacote inicial vem de <b>${esc(inicial.nome)}</b> e cada nível seguinte usa o valor por nível da classe em que foi ganho. As perícias <b>fixas</b> das classes novas entram sozinhas (o livro não repete as escolhas livres do 1º nível).</p>`
      : '<p class="dica">Sem classes extras — o personagem é de classe única.</p>'}`;

  document.getElementById("btn-add-multiclasse")?.addEventListener("click", () => {
    if ((personagem.nivel || 1) < 2) { toast("Multiclasse só a partir do 2º nível."); return; }
    personagem.multiclasses = [...extras, { classeId: "", niveis: 1 }];
    salvarERenderizar();
  });
  box.querySelectorAll("[data-mc-classe]").forEach((sel) => sel.addEventListener("change", () => {
    personagem.multiclasses[Number(sel.dataset.mcClasse)].classeId = sel.value;
    salvarERenderizar();
  }));
  box.querySelectorAll("[data-mc-niveis]").forEach((inp) => inp.addEventListener("change", () => {
    personagem.multiclasses[Number(inp.dataset.mcNiveis)].niveis = Math.max(1, Number(inp.value) || 1);
    salvarERenderizar();
  }));
  box.querySelectorAll("[data-mc-remover]").forEach((b) => b.addEventListener("click", () => {
    personagem.multiclasses.splice(Number(b.dataset.mcRemover), 1);
    salvarERenderizar();
  }));
}

function openPickerModal(kind) {
  const titulos = { raca: "Escolher raça", classe: "Escolher classe", origem: "Escolher origem", divindade: "Escolher divindade" };
  const opts = pickerOptionsFor(kind);
  const atual = valorAtualDoCampo(kind);
  $("modal-content").innerHTML = `<div class="modal-title"><div><span class="eyebrow">CONSTRUÇÃO</span><h2>${esc(titulos[kind])}</h2></div></div>
    <div class="modal-body">
      ${kind === "divindade" ? `<button type="button" class="change-choice" data-pick-opt="" style="margin-bottom:8px">— Nenhuma —</button>` : ""}
      <div class="pick-list">${opts.map((o) => `
        <button type="button" class="pick-card${o.id === atual ? " selected" : ""}" data-pick-opt="${esc(o.id)}">
          <b>${esc(o.nome)}</b><small>${esc(o.meta)}</small>
        </button>`).join("")}</div>
    </div>`;
  $("modal").classList.remove("hidden");
  $("modal-content").querySelectorAll("[data-pick-opt]").forEach((b) => b.addEventListener("click", () => {
    definirCampo(kind, b.dataset.pickOpt);
    $("modal").classList.add("hidden");
    if (creationMode === "guiado") avancarWizardSeSelecionado();
  }));
}

// ==============================================================
// Assistente guiado — passo a passo completo de criação.
//
// Antes eram só quatro passos (raça/classe/origem/divindade); tudo o que
// realmente monta o personagem — atributos, perícias, poderes, equipamento —
// ficava fora dele. Agora são dez, na ordem em que o livro monta a ficha.
//
// Os passos de atributos, perícias/automação e equipamento não duplicam
// nenhuma lógica: eles *movem* pra dentro do corpo do assistente os mesmos
// elementos que vivem nas abas Ficha/Construção/Equipamentos, e devolvem pro
// lugar de origem ao sair do passo. Assim só existe uma implementação de cada
// painel — se ela melhora numa aba, melhora no assistente também.
// ==============================================================
const PASSOS_WIZARD = [
  { key: "raca", tipo: "raca", titulo: "Raça", dica: "A raça define tamanho, deslocamento, bônus de atributo e traços — em T20 ela pesa bastante no herói que você vai jogar." },
  { key: "classe", tipo: "classe", titulo: "Classe", dica: "A classe define PV e PM por nível, o atributo-chave, as perícias treinadas iniciais, os poderes que você pode pegar e se o personagem conjura magias." },
  { key: "origem", tipo: "origem", titulo: "Origem", dica: "A origem é a vida antes da aventura: treina 2 perícias da lista dela e concede um poder de origem.", opcional: true },
  { key: "divindade", tipo: "divindade", titulo: "Divindade", dica: "Opcional para a maioria, obrigatória pra Clérigos e Paladinos. Define os poderes concedidos e obrigações do devoto.", opcional: true },
  { key: "nivel", titulo: "Nível", dica: "O nível determina PV, PM, quantos poderes você escolheu até aqui, metade do nível somada em toda perícia e o bônus de treino (+2, +4 no 7º, +6 no 15º)." },
  { key: "atributos", titulo: "Atributos", dica: "Distribua os atributos por compra de pontos, por um arranjo pronto, rolando 4d6 e descartando o menor, ou digitando livremente. Os bônus raciais entram sozinhos por cima." },
  { key: "pericias", titulo: "Perícias e traços", dica: "Aqui ficam todas as escolhas que raça, classe e origem mandam fazer. O que não tem alternativa real já vem aplicado — só sobra o que de fato é decisão sua." },
  { key: "poderes", titulo: "Poderes", dica: "Escolha os poderes que o nível concede: um poder de classe no 2º nível e um a cada nível seguinte, mais o poder de origem.", opcional: true },
  { key: "equipamento", titulo: "Equipamento", dica: "Vista uma armadura, empunhe um escudo e escolha suas armas — a Defesa, a penalidade de armadura e as linhas de ataque saem daqui.", opcional: true },
  { key: "revisao", titulo: "Revisão", dica: "Confira o herói montado. Depois de concluir dá pra mexer em tudo, a qualquer momento, no modo livre e nas abas da ficha." },
];

let wizardStepIndex = 0;
// Onde cada painel emprestado mora quando o assistente não está usando ele.
const ancorasDePainel = new Map();

function guardarAncora(id) {
  const el = document.getElementById(id);
  if (!el || ancorasDePainel.has(id)) return;
  ancorasDePainel.set(id, { pai: el.parentNode, proximo: el.nextSibling });
}
function devolverPaineis() {
  for (const [id, { pai, proximo }] of ancorasDePainel) {
    const el = document.getElementById(id);
    if (el && el.parentNode !== pai) pai.insertBefore(el, proximo);
  }
}
function emprestarPainel(id, destino) {
  guardarAncora(id);
  const el = document.getElementById(id);
  if (el && destino) destino.appendChild(el);
}

function wizardStepBodyHtml(kind) {
  const opts = pickerOptionsFor(kind);
  const atual = valorAtualDoCampo(kind);
  const selecionado = atual ? opts.find((o) => o.id === atual) : null;
  return `<div class="wizard-current${selecionado ? " picked" : ""}">${selecionado
      ? `Selecionado: <strong>${esc(selecionado.nome)}</strong> — ${esc(selecionado.meta)}`
      : "Nada selecionado ainda."}</div>
    <div class="picker-controls"><input type="search" id="wizard-busca" placeholder="Pesquisar…" autocomplete="off"></div>
    ${kind === "divindade" ? `<button type="button" class="change-choice" data-wiz-opt="" style="margin-bottom:10px">— Nenhuma —</button>` : ""}
    <div class="pick-list" id="wizard-pick-list">${pickCardsHtml(opts, atual)}</div>`;
}
function pickCardsHtml(opts, atual) {
  return opts.map((o) => `
    <button type="button" class="pick-card${o.id === atual ? " selected" : ""}" data-wiz-opt="${esc(o.id)}">
      <b>${esc(o.nome)}</b><small>${esc(o.meta)}</small>
      <span class="pick-desc">${esc((o.desc || "").replace(/<[^>]+>/g, "").slice(0, 150))}</span>
    </button>`).join("") || '<p class="dica">Nenhum resultado.</p>';
}

function renderWizardPassoEscolha(passo, body) {
  const kind = passo.tipo;
  body.innerHTML = wizardStepBodyHtml(kind);
  const opts = pickerOptionsFor(kind);
  const lista = document.getElementById("wizard-pick-list");
  const busca = document.getElementById("wizard-busca");
  const ligar = () => lista.querySelectorAll("[data-wiz-opt]").forEach((b) => b.addEventListener("click", () => {
    definirCampo(kind, b.dataset.wizOpt);
    renderWizard();
  }));
  busca?.addEventListener("input", () => {
    const q = normalizar(busca.value);
    lista.innerHTML = pickCardsHtml(opts.filter((o) => normalizar(`${o.nome} ${o.meta}`).includes(q)), valorAtualDoCampo(kind));
    ligar();
  });
  body.querySelectorAll('[data-wiz-opt=""]').forEach((b) => b.addEventListener("click", () => { definirCampo(kind, ""); renderWizard(); }));
  ligar();
}

function renderWizardPassoNivel(body) {
  const d = calcularDerivados();
  const classe = classeAtual();
  const esperados = poderesEsperados();
  body.innerHTML = `<div class="wizard-nivel-box">
      <input id="wizard-nivel-input" type="number" min="1" max="20" value="${d.nivel}">
      <div class="wizard-nivel-resumo">
        <div>Pontos de vida: <b>${d.pvMax ?? "—"}</b>${classe ? ` (${classe.pvInicial}${formatarMod(regras.mod(d.atrs.con))} no 1º nível, ${classe.pvPorNivel}${formatarMod(regras.mod(d.atrs.con))} por nível)` : ""}</div>
        <div>Pontos de mana: <b>${d.pmMax ?? "—"}</b>${classe ? ` (${classe.pmPorNivel} por nível — PM não soma atributo em T20)` : ""}</div>
        <div>Metade do nível em toda perícia: <b>${formatarMod(regras.metadeNivel(d.nivel))}</b> · bônus de treino: <b>${formatarMod(regras.bonusTreino(d.nivel, true))}</b></div>
        <div>Poderes que este nível concede: <b>${esperados.total}</b> (${esperados.daClasse} de classe${esperados.daOrigem ? " + 1 de origem" : ""}${esperados.geraisExtra ? ` + ${esperados.geraisExtra} geral` : ""})</div>
      </div>
    </div>
    <p class="dica" style="margin-top:10px">Personagens de Tormenta 20 começam no 1º nível; níveis acima disso já contam todos os poderes e o bônus de treino maior.</p>`;
  document.getElementById("wizard-nivel-input").addEventListener("input", (ev) => {
    personagem.nivel = Math.max(1, Math.min(20, Number(ev.target.value) || 1));
    salvar();
    renderizarTudo();
    renderWizard();
  });
}

function renderWizardPassoPoderes(body) {
  const d = calcularDerivados();
  const esperados = poderesEsperados();
  const pool = poolPoderesDisponiveis();
  const escolhidos = personagem.poderes.slice();
  const faltam = esperados.escolhiveis - escolhidos.length;
  body.innerHTML = `
    <div class="wizard-current${faltam === 0 ? " picked" : ""}">
      ${classeAtual()
        ? `Escolhidos <strong>${escolhidos.length}</strong> de <strong>${esperados.escolhiveis}</strong> poder(es) do nível ${d.nivel}.${faltam > 0 ? ` Faltam ${faltam}.` : faltam < 0 ? ` ${-faltam} a mais do que o nível concede.` : " Tudo certo."}`
        : "Escolha uma classe nos passos anteriores para a ficha calcular seus poderes."}
    </div>
    <div class="picker-controls"><input type="search" id="wizard-poder-busca" placeholder="Pesquisar poder…" autocomplete="off"></div>
    <div class="pick-list" id="wizard-poder-list"></div>`;

  const cards = (q) => {
    const filtro = normalizar(q || "");
    const lista = pool.filter((x) => !filtro || normalizar(`${x.nome} ${x.subtipo || ""}`).includes(filtro)).slice(0, 150);
    return lista.map((poder) => {
      const ok = requisitoAtendido(poder, d);
      return `<button type="button" class="pick-card${escolhidos.includes(poder.id) ? " selected" : ""}" data-wiz-poder="${esc(poder.id)}">
        <b>${esc(poder.nome)}</b><small>${esc(poder.subtipo || poder.categoria || "")}${poder.custo ? ` · ${poder.custo} PM` : ""}${ok === false ? " · requisito não atendido" : ""}</small>
        <span class="pick-desc">${esc((poder.descricao || "").replace(/<[^>]+>/g, "").slice(0, 140))}</span></button>`;
    }).join("") || '<p class="dica">Nenhum poder disponível — escolha uma classe primeiro.</p>';
  };
  const listaEl = document.getElementById("wizard-poder-list");
  const ligar = () => listaEl.querySelectorAll("[data-wiz-poder]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.wizPoder;
    personagem.poderes = personagem.poderes.includes(id) ? personagem.poderes.filter((x) => x !== id) : [...personagem.poderes, id];
    salvar();
    renderizarTudo();
    renderWizard();
  }));
  listaEl.innerHTML = cards("");
  ligar();
  document.getElementById("wizard-poder-busca").addEventListener("input", (ev) => { listaEl.innerHTML = cards(ev.target.value); ligar(); });
}

function renderWizardPassoRevisao(body) {
  const d = calcularDerivados();
  const linhas = [
    ["Raça", racaAtual()?.nome],
    ["Classe", temMulticlasse() ? rotuloDeClasses() : classeAtual()?.nome],
    ["Origem", personagem.origem],
    ["Divindade", personagem.divindade],
    ["Nível", String(d.nivel)],
    ["Atributos", db.atributos.map((a) => `${a.nome.slice(0, 3).toUpperCase()} ${formatarMod(atributoFinal(a.id))}`).join(" · ")],
    ["Perícias treinadas", `${d.treinos.size} (${[...d.treinos.keys()].map(nomePericia).sort((x, y) => x.localeCompare(y, "pt-BR")).join(", ") || "nenhuma"})`],
    ["Poderes", personagem.poderes.map((id) => db.poderes.find((x) => x.id === id)?.nome).filter(Boolean).join(", ") || "nenhum"],
    ["Equipado", [equipadoNaVaga("armadura"), equipadoNaVaga("escudo")].filter(Boolean).map((i) => i.nome).join(" · ") || "nada"],
    ["Ataques", personagem.ataques.map((a) => a.nome).join(", ") || "nenhum"],
  ];
  const pendencias = blocosDeAutomacao().filter((b) => b.includes('class="auto-bloco pendente"')).length;
  body.innerHTML = `
    <div class="wizard-review-grid">${linhas.map(([r, v]) => `<div class="identity-row"><span>${esc(r)}</span><strong>${esc(v || "—")}</strong></div>`).join("")}</div>
    <div class="two-input">
      <label>Nome do personagem<input id="wizard-nome" value="${esc(personagem.nome || "")}" placeholder="Nome do personagem"></label>
      <label>Jogador<input id="wizard-jogador" value="${esc(personagem.jogador || "")}" placeholder="Seu nome"></label>
    </div>
    <div class="resumo-grande">
      <div><span>PV</span><b>${d.pvMax ?? "—"}</b></div>
      <div><span>PM</span><b>${d.pmMax ?? "—"}</b></div>
      <div><span>Defesa</span><b>${d.defesa}</b></div>
      <div><span>Iniciativa</span><b>${formatarMod(d.iniciativa)}</b></div>
      <div><span>Deslocamento</span><b>${esc(racaAtual()?.deslocamento || "9m")}</b></div>
    </div>
    ${pendencias
      ? `<div class="alerta-automacao">Ainda restam <b>${pendencias}</b> escolha(s) pendente(s) no passo "Perícias e traços". Dá pra concluir assim mesmo e resolver depois.</div>`
      : '<div class="ok-automacao">✓ Nenhuma pendência de construção.</div>'}`;
  document.getElementById("wizard-nome").addEventListener("input", (ev) => {
    personagem.nome = ev.target.value;
    document.getElementById("nome").value = personagem.nome;
    salvar();
  });
  document.getElementById("wizard-jogador").addEventListener("input", (ev) => {
    personagem.jogador = ev.target.value;
    document.getElementById("jogador").value = personagem.jogador;
    salvar();
  });
}

function renderWizard() {
  const passo = PASSOS_WIZARD[wizardStepIndex];
  const feito = (p) => {
    if (p.tipo) return !!valorAtualDoCampo(p.tipo);
    if (p.key === "nivel") return true;
    if (p.key === "atributos") return db.atributos.some((a) => (personagem.atributos[a.id] || 0) !== 0);
    if (p.key === "pericias") return !blocosDeAutomacao().some((b) => b.includes('class="auto-bloco pendente"'));
    if (p.key === "poderes") return personagem.poderes.length >= poderesEsperados().escolhiveis;
    if (p.key === "equipamento") return !!equipadoNaVaga("armadura") || personagem.ataques.length > 0;
    return false;
  };

  document.getElementById("wizard-steps").innerHTML = PASSOS_WIZARD.map((p, i) => {
    const ok = feito(p);
    return `<button type="button" class="wizard-step-chip${i === wizardStepIndex ? " active" : ""}${ok ? " done" : ""}" data-wiz-passo="${i}">${i + 1}. ${esc(p.titulo)}${ok ? " ✓" : ""}</button>`;
  }).join("");
  document.getElementById("wizard-steps").querySelectorAll("[data-wiz-passo]").forEach((b) => b.addEventListener("click", () => {
    wizardStepIndex = Number(b.dataset.wizPasso);
    renderWizard();
  }));

  const body = document.getElementById("wizard-body");
  // Todo painel emprestado volta pro lugar antes de montar o passo novo.
  devolverPaineis();
  body.innerHTML = `<p class="wizard-hint">${esc(passo.dica)}</p><div id="wizard-passo-corpo"></div>`;
  const corpo = document.getElementById("wizard-passo-corpo");

  if (passo.tipo) {
    renderWizardPassoEscolha(passo, corpo);
    // O passo da classe também é onde se decide multiclasse — empresta o
    // mesmo painel do modo livre em vez de duplicá-lo.
    if (passo.tipo === "classe" && classeAtual()) {
      corpo.insertAdjacentHTML("beforeend", '<div class="multiclasse-secao" id="wizard-multiclasse"></div>');
      renderMulticlasse("wizard-multiclasse");
    }
  }
  else if (passo.key === "nivel") renderWizardPassoNivel(corpo);
  else if (passo.key === "atributos") emprestarPainel("cartao-atributos", corpo);
  else if (passo.key === "pericias") emprestarPainel("auto-panel", corpo);
  else if (passo.key === "poderes") renderWizardPassoPoderes(corpo);
  else if (passo.key === "equipamento") {
    corpo.innerHTML = '<div id="wizard-equip" class="equip-quick"></div>';
    renderEquipSlots("wizard-equip");
  } else if (passo.key === "revisao") renderWizardPassoRevisao(corpo);

  document.getElementById("wizard-progress").textContent = `Passo ${wizardStepIndex + 1} de ${PASSOS_WIZARD.length} · ${passo.titulo}`;
  document.getElementById("wizard-back").disabled = wizardStepIndex === 0;
  const ultimo = wizardStepIndex === PASSOS_WIZARD.length - 1;
  const pulavel = passo.opcional && !feito(passo);
  document.getElementById("wizard-next").textContent = ultimo ? "Concluir ✓" : pulavel ? "Pular →" : "Próximo →";
}

function avancarWizardSeSelecionado() {
  if (wizardStepIndex < PASSOS_WIZARD.length - 1) { wizardStepIndex++; renderWizard(); }
}

function wizardProximo() {
  const passo = PASSOS_WIZARD[wizardStepIndex];
  if (passo.tipo === "raca" && !personagem.raca) { toast("Escolha uma raça antes de continuar."); return; }
  if (passo.tipo === "classe" && !personagem.classe) { toast("Escolha uma classe antes de continuar."); return; }
  if (wizardStepIndex < PASSOS_WIZARD.length - 1) { wizardStepIndex++; renderWizard(); return; }
  concluirWizard();
}
function wizardVoltar() { if (wizardStepIndex > 0) { wizardStepIndex--; renderWizard(); } }

function concluirWizard() {
  setCreationMode("livre");
  // PV e PM cheios: quem acabou de criar o herói quer ele pronto pra jogar.
  const d = calcularDerivados();
  if (d.pvMax) personagem.pv.atual = d.pvMax;
  if (d.pmMax) personagem.pm.atual = d.pmMax;
  salvarERenderizar();
  toast("Personagem pronto! Ajuste o que quiser nas abas da ficha.");
  irParaAba("ficha");
}

function setCreationMode(mode) {
  creationMode = mode;
  document.querySelectorAll("#creation-mode-toggle [data-modo]").forEach((b) => b.classList.toggle("active", b.dataset.modo === mode));
  $("wizard").classList.toggle("hidden", mode !== "guiado");
  $("modo-livre-conteudo").classList.toggle("hidden", mode === "guiado");
  if (mode === "guiado") renderWizard();
  else devolverPaineis();
}

// Busca sem acento/caixa, usada pelos filtros do assistente.
function normalizar(txt) {
  return String(txt || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

const CHOICE_INFO = {
  raca: "A raça define atributos, tamanho, deslocamento e traços iniciais do personagem.",
  classe: "A classe define PV/PM iniciais, perícias de classe, atributo-chave e se o personagem conjura magias.",
  origem: "A origem representa a vida do personagem antes da aventura — sugere perícias treinadas e concede um poder de origem.",
  divindade: "Divindade opcional — relevante sobretudo pra Clérigos e Paladinos, e pra perícia de Religião.",
};

// ==============================================================
// Subir de nível — em vez de digitar o número novo e adivinhar o que mudou,
// a ficha aplica o nível e lista o que veio junto (PV, PM, poder, bônus de
// treino) e o que ainda falta escolher.
// ==============================================================
function resumoDeNivel(nivel) {
  const guardado = personagem.nivel;
  personagem.nivel = nivel;
  const d = calcularDerivados();
  personagem.nivel = guardado;
  return {
    pv: d.pvMax, pm: d.pmMax,
    metadeNivel: regras.metadeNivel(nivel),
    treino: regras.bonusTreino(nivel, true),
    poderes: regras.poderesDeClassePorNivel(nivel),
  };
}

function subirDeNivel() {
  const de = personagem.nivel || 1;
  if (de >= 20) { toast("O personagem já está no 20º nível."); return; }
  if (!classeAtual()) { toast("Escolha uma classe antes de subir de nível."); return; }
  const para = de + 1;
  const antes = resumoDeNivel(de);
  const depois = resumoDeNivel(para);

  personagem.nivel = para;
  // PV e PM ganhos no nível já entram no valor atual, senão a ficha sobe o
  // máximo e deixa o personagem "ferido" de graça.
  personagem.pv.atual = Math.max(0, (personagem.pv.atual ?? 0) + (depois.pv - antes.pv));
  personagem.pm.atual = Math.max(0, (personagem.pm.atual ?? 0) + (depois.pm - antes.pm));
  salvarERenderizar();

  const ganhos = [
    `PV máximo <b>${antes.pv} → ${depois.pv}</b> (e o PV atual subiu junto)`,
    `PM máximo <b>${antes.pm} → ${depois.pm}</b>`,
    `Poderes de classe a que você tem direito: <b>${antes.poderes} → ${depois.poderes}</b>`,
  ];
  if (depois.metadeNivel !== antes.metadeNivel) ganhos.push(`Metade do nível em todas as perícias: <b>${formatarMod(antes.metadeNivel)} → ${formatarMod(depois.metadeNivel)}</b>`);
  if (depois.treino !== antes.treino) ganhos.push(`Bônus de treino: <b>${formatarMod(antes.treino)} → ${formatarMod(depois.treino)}</b>`);

  const pendentes = blocosDeAutomacao().filter((b) => b.includes('class="auto-bloco pendente"')).length;
  abrirModalGenerico(`
    <div class="modal-title"><div><span class="eyebrow">PROGRESSÃO</span><h2>Nível ${de} → ${para}</h2></div></div>
    <div class="modal-body">
      <ul class="lista-ganhos">${ganhos.map((g) => `<li>${g}</li>`).join("")}</ul>
      ${pendentes
        ? `<div class="alerta-automacao">Você tem <b>${pendentes}</b> escolha(s) pendente(s) no painel de automação — inclusive o poder novo deste nível.</div>`
        : '<div class="ok-automacao">✓ Nada pendente no painel de automação.</div>'}
      <div class="linha-botoes-modal">
        <button type="button" class="add-btn" id="nivel-ir-poderes">Escolher poderes →</button>
        <button type="button" id="nivel-ir-automacao">Abrir automação</button>
      </div>
    </div>`);
  $("nivel-ir-poderes")?.addEventListener("click", () => { $("modal").classList.add("hidden"); irParaAba("poderes"); });
  $("nivel-ir-automacao")?.addEventListener("click", () => { $("modal").classList.add("hidden"); irParaAba("construcao"); });
}

// ==============================================================
// AUTOMAÇÃO DA FICHA — o painel da aba "Construção" que mostra, um por um,
// todos os benefícios que raça/classe/origem/nível concedem e pede as
// escolhas que o livro manda fazer (atributos do humano, perícias da classe,
// poder da origem...). O que é fixo já vem aplicado; o que é escolha fica
// marcado como pendência até o jogador decidir.
// ==============================================================

// `jaTreinadas` é o mapa de perícias que outras fontes já concederam: em T20,
// se você ganharia de novo uma perícia que já tem, o livro manda escolher
// outra — então elas aparecem marcadas para não desperdiçar a escolha.
function chipsDePericia(pericias, selecionadas, attr, jaTreinadas = new Map(), { travado = false } = {}) {
  return `<div class="chip-lista">${pericias.map((id) => {
    const p = db.pericias.find((x) => x.id === id);
    if (!p) return "";
    const ativo = selecionadas.includes(id);
    const repetida = !ativo && jaTreinadas.has(id);
    // Escolha sem alternativa: o chip vira leitura (não é botão clicável),
    // porque clicar nele só poderia desfazer algo que o livro já decidiu.
    if (travado) return `<span class="chip travado" title="Concedida automaticamente — não há outra opção para escolher.">${esc(p.nome)}<small>${p.atributo.toUpperCase()}</small></span>`;
    return `<button type="button" class="chip${ativo ? " ativo" : ""}${repetida ? " repetida" : ""}" ${attr}="${esc(id)}"${repetida ? ` title="${esc(`Você já é treinado em ${p.nome} por: ${jaTreinadas.get(id).join(", ")}. Escolha outra para não desperdiçar.`)}"` : ""}>${esc(p.nome)}<small>${repetida ? "já treinada" : p.atributo.toUpperCase()}</small></button>`;
  }).join("")}</div>`;
}

// Frase padrão dos blocos cuja "escolha" não tem alternativa nenhuma.
const SEM_ESCOLHA = (n, oQue) => `A lista tem exatamente <b>${n}</b> ${oQue} para <b>${n}</b> vaga(s) — não há o que escolher, então a ficha já aplicou.`;

// Perícias já concedidas por outras fontes que não a que está sendo escolhida
// agora — usado para marcar as repetidas nos chips.
function treinosDeOutrasFontes(exceto) {
  const mapa = new Map();
  for (const [id, fontes] of treinosAutomaticos()) {
    const restantes = fontes.filter((f) => !f.startsWith(exceto));
    if (restantes.length) mapa.set(id, restantes);
  }
  return mapa;
}

function blocoHtml({ id, titulo, fonte, estado, texto, corpo = "" }) {
  const rotulos = { ok: "✓ pronto", pendente: "• falta escolher", info: "aplicado" };
  return `<article class="auto-bloco ${estado}" data-bloco="${id}">
    <header><b>${esc(titulo)}</b><span class="auto-chip ${estado}">${rotulos[estado]}</span></header>
    <small class="auto-fonte">${esc(fonte)}</small>
    <p>${texto}</p>${corpo}</article>`;
}

function blocosDeAutomacao() {
  const d = calcularDerivados();
  const e = escolhas();
  const raca = racaAtual();
  const classe = classeAtual();
  const auto = racaAuto();
  const blocos = [];

  if (!raca && !classe) return blocos;

  // --- Raça: atributos à escolha ---
  const livresDaRaca = atributosLivresDaRaca();
  if (auto.atributosEscolha || livresDaRaca) {
    const { quantidade = livresDaRaca, excluir = [] } = auto.atributosEscolha || {};
    const escolhidos = (e.atributosRaciais || []).slice(0, quantidade);
    const disponiveis = db.atributos.filter((a) => !excluir.includes(a.id));
    const forcada = escolhaForcada(disponiveis.map((a) => a.id), quantidade);
    blocos.push(blocoHtml({
      id: "atributos-raciais",
      titulo: `Atributos de ${raca.nome}`,
      fonte: forcada ? "Raça · automático" : "Raça",
      estado: forcada ? "info" : escolhidos.length === quantidade ? "ok" : "pendente",
      texto: forcada
        ? `+1 em ${listaLegivel(disponiveis.map((a) => a.nome))}. ${SEM_ESCOLHA(quantidade, "atributos possíveis")}`
        : `+1 em <b>${quantidade}</b> atributos diferentes${excluir.length ? ` (não pode ser ${excluir.map((x) => x.toUpperCase()).join("/")})` : ""}. Escolhidos: <b>${escolhidos.length}/${quantidade}</b>.`,
      corpo: forcada ? "" : `<div class="chip-lista">${disponiveis.map((a) => `
        <button type="button" class="chip${escolhidos.includes(a.id) ? " ativo" : ""}" data-auto-atributo="${a.id}">${esc(a.nome)}<small>${escolhidos.includes(a.id) ? "+1" : ""}</small></button>`).join("")}</div>`,
    }));
  }

  // --- Raça: variante de distribuição de atributos (kallyanach) ---
  if (auto.variantesAtributos?.length) {
    const atual = varianteAtributosAtual();
    blocos.push(blocoHtml({
      id: "variante-atributos",
      titulo: `Bônus de atributo de ${raca.nome}`,
      fonte: "Raça",
      estado: atual ? "ok" : "pendente",
      texto: atual
        ? `Escolhido: <b>${esc(atual.nome)}</b>. Marque abaixo em qu${atual.livres > 1 ? "ais atributos" : "al atributo"} aplicar.`
        : "Esta raça deixa você escolher como distribuir o bônus racial.",
      corpo: `<div class="chip-lista">${auto.variantesAtributos.map((v) => `
        <button type="button" class="chip${v.id === atual?.id ? " ativo" : ""}" data-auto-variante="${esc(v.id)}">${esc(v.nome)}</button>`).join("")}</div>`,
    }));
  }

  // --- Raça: legado (suraggel) ---
  if (auto.legados?.length) {
    const atual = legadoAtual();
    const legadoUnico = auto.legados.length === 1;
    blocos.push(blocoHtml({
      id: "legado",
      titulo: `Legado de ${raca.nome}`,
      fonte: legadoUnico ? "Raça · automático" : "Raça",
      estado: legadoUnico ? "info" : atual ? "ok" : "pendente",
      texto: atual
        ? `Legado <b>${esc(atual.nome)}</b>: ${Object.entries(atual.atributos).map(([k, v]) => `${formatarMod(v)} ${k.toUpperCase()}`).join(", ")}${atual.bonusPericias ? `; ${Object.entries(atual.bonusPericias).map(([k, v]) => `${formatarMod(v)} em ${nomePericia(k)}`).join(", ")}` : ""}.`
        : "Escolha um legado — ele define os bônus de atributo e de perícia da raça.",
      corpo: `<div class="chip-lista">${auto.legados.map((l) => `
        <button type="button" class="chip${l.id === e.legadoRacial ? " ativo" : ""}" data-auto-legado="${esc(l.id)}">${esc(l.nome)}<small>${Object.entries(l.atributos).map(([k, v]) => `${formatarMod(v)} ${k.toUpperCase()}`).join(" ")}</small></button>`).join("")}</div>`,
    }));
  }

  // --- Raça: bônus fixos já aplicados ---
  const bonusFixos = { ...(auto.bonusPericias || {}) };
  const infoRacial = [];
  if (Object.keys(bonusFixos).length) infoRacial.push(Object.entries(bonusFixos).map(([k, v]) => `${formatarMod(v)} em ${nomePericia(k)}`).join(", "));
  if (auto.defesa) infoRacial.push(`${formatarMod(auto.defesa)} na Defesa`);
  if (auto.pvNivel1 || auto.pvPorNivel) infoRacial.push(`${formatarMod(auto.pvNivel1 || 0)} PV no 1º nível e ${formatarMod(auto.pvPorNivel || 0)} PV por nível`);
  if (auto.pmPorNivel) infoRacial.push(`${formatarMod(auto.pmPorNivel)} PM por nível`);
  if (auto.penalidadeArmaduraExtra) infoRacial.push(`−${auto.penalidadeArmaduraExtra} extra de penalidade de armadura`);
  if (raca && infoRacial.length) {
    blocos.push(blocoHtml({
      id: "racial-fixo",
      titulo: `Traços de ${raca.nome} já aplicados`,
      fonte: "Raça · automático",
      estado: "info",
      texto: `${infoRacial.join(" · ")}.${auto.nota ? ` <em>${esc(auto.nota)}</em>` : ""}`,
    }));
  } else if (raca && auto.nota) {
    blocos.push(blocoHtml({ id: "racial-nota", titulo: `Traços de ${raca.nome}`, fonte: "Raça", estado: "info", texto: esc(auto.nota) }));
  }

  // --- Raça: bônus de perícia à escolha (lefou) ---
  if (auto.bonusPericiasEscolha) {
    const { quantidade, valor } = auto.bonusPericiasEscolha;
    const escolhidas = (e.bonusPericiasRaciais || []).slice(0, quantidade);
    const forcada = escolhaForcada(db.pericias.map((x) => x.id), quantidade);
    blocos.push(blocoHtml({
      id: "bonus-racial",
      titulo: `Bônus de perícia de ${raca.nome}`,
      fonte: forcada ? "Raça · automático" : "Raça",
      estado: forcada ? "info" : escolhidas.length === quantidade ? "ok" : "pendente",
      texto: `${formatarMod(valor)} em <b>${quantidade}</b> perícias à escolha. Escolhidas: <b>${escolhidas.length}/${quantidade}</b>.`,
      corpo: chipsDePericia(db.pericias.map((x) => x.id), escolhidas, "data-auto-bonus-racial", new Map(), { travado: forcada }),
    }));
  }

  // --- Raça: perícias treinadas à escolha (humano, kliren, osteon) ---
  if (auto.treinosEscolha) {
    const escolhidas = (e.periciasRaciais || []).slice(0, auto.treinosEscolha);
    const opcional = !!auto.treinosEscolhaOpcional;
    const forcada = escolhaForcada(db.pericias.map((x) => x.id), auto.treinosEscolha);
    blocos.push(blocoHtml({
      id: "pericias-raciais",
      titulo: `Perícias de ${raca.nome}`,
      fonte: forcada ? "Raça · automático" : "Raça",
      estado: forcada ? "info" : escolhidas.length === auto.treinosEscolha ? "ok" : opcional ? "info" : "pendente",
      texto: forcada
        ? SEM_ESCOLHA(auto.treinosEscolha, "perícias possíveis")
        : `Treinado em <b>${auto.treinosEscolha}</b> perícia(s) à escolha${opcional ? " (ou troque por um poder geral)" : ""}. Escolhidas: <b>${escolhidas.length}/${auto.treinosEscolha}</b>.`,
      corpo: chipsDePericia(db.pericias.map((x) => x.id), escolhidas, "data-auto-pericia-racial", treinosDeOutrasFontes("Raça"), { travado: forcada }),
    }));
  }

  // --- Classe: perícias fixas ---
  if (classe) {
    const fixas = classe.periciasFixas || [];
    const grupos = classe.periciasFixasEscolha || [];
    const escolhidasGrupo = grupos.map((_, i) => e.periciasClasseFixa?.[i] || "");
    if (fixas.length || grupos.length) {
      // Grupo com uma opção só já foi aplicado por normalizarEscolhas().
      const gruposReais = grupos.filter((g) => g.length > 1);
      const pendente = grupos.some((g, i) => g.length > 1 && !escolhidasGrupo[i]);
      blocos.push(blocoHtml({
        id: "pericias-classe-fixas",
        titulo: `Perícias garantidas de ${classe.nome}`,
        fonte: "Classe · automático",
        estado: pendente ? "pendente" : gruposReais.length ? "ok" : "info",
        texto: `${fixas.length ? `Já treinado em <b>${fixas.map(nomePericia).join(", ")}</b>.` : ""}${gruposReais.length ? ` Escolha ${gruposReais.length === 1 ? "uma" : gruposReais.length}: ` : grupos.length ? " O grupo de escolha tinha uma opção só, já aplicada." : ""}`,
        corpo: grupos.map((grupo, i) => grupo.length <= 1 ? "" : `<div class="chip-lista">${grupo.map((id) => `
          <button type="button" class="chip${escolhidasGrupo[i] === id ? " ativo" : ""}" data-auto-classe-fixa="${i}" data-valor="${esc(id)}">${esc(nomePericia(id))}</button>`).join("")}</div>`).join(""),
      }));
    }

    // --- Classe: perícias à escolha ---
    const modInt = regras.mod(d.atrs.int);
    const cotaClasse = regras.escolhasDePericiaDaClasse({ classe, modInt });
    const jaFixas = new Set([...fixas, ...escolhidasGrupo.filter(Boolean)]);
    const opcoes = (classe.periciasDeClasse || []).filter((id) => !jaFixas.has(id));
    const escolhidasClasse = (e.periciasClasse || []).filter((id) => opcoes.includes(id));
    const forcadaClasse = escolhaForcada(opcoes, cotaClasse);
    const conta = `<b>${classe.treinosIniciais}</b> da classe ${formatarMod(modInt)} de Inteligência = <b>${cotaClasse}</b> perícia(s) na lista de ${esc(classe.nome)}`;
    blocos.push(blocoHtml({
      id: "pericias-classe",
      titulo: forcadaClasse ? `Perícias de ${classe.nome}` : `Perícias à escolha de ${classe.nome}`,
      fonte: forcadaClasse ? "Classe · automático" : "Classe",
      estado: forcadaClasse ? "info" : escolhidasClasse.length >= cotaClasse ? "ok" : "pendente",
      texto: forcadaClasse
        ? `${conta}. ${SEM_ESCOLHA(opcoes.length, "perícias disponíveis")}`
        : `${conta}. Escolhidas: <b>${escolhidasClasse.length}/${cotaClasse}</b>.`,
      corpo: chipsDePericia(opcoes, escolhidasClasse, "data-auto-pericia-classe", treinosDeOutrasFontes("Classe"), { travado: forcadaClasse }),
    }));
  }

  // --- Origem ---
  if (auto.semOrigem) {
    blocos.push(blocoHtml({
      id: "sem-origem", titulo: "Sem origem", fonte: "Raça", estado: "info",
      texto: `${esc(raca.nome)} não tem origem: em vez das perícias e do poder de origem, ganha <b>${auto.poderesGeraisExtra || 1}</b> poder(es) geral(is) à escolha, na aba <b>Poderes</b>.`,
    }));
  } else if (personagem.origem) {
    const origem = origemAtual();
    const listaOrigem = origem?.periciasSugeridas || [];
    const cotaOrigem = Math.min(2, listaOrigem.length || 2);
    const escolhidasOrigem = (e.periciasOrigem || []).slice(0, cotaOrigem);
    const forcadaOrigem = escolhaForcada(listaOrigem, cotaOrigem);
    blocos.push(blocoHtml({
      id: "pericias-origem",
      titulo: `Perícias de ${personagem.origem}`,
      fonte: forcadaOrigem ? "Origem · automático" : "Origem",
      estado: forcadaOrigem ? "info" : escolhidasOrigem.length >= cotaOrigem ? "ok" : "pendente",
      texto: !listaOrigem.length
        ? "Esta origem não tem lista fixa de perícias — combine com o mestre e marque à mão na aba Perícias."
        : forcadaOrigem
          ? `A origem treina <b>${cotaOrigem}</b> perícia(s). ${SEM_ESCOLHA(listaOrigem.length, "perícias na lista dela")}`
          : `A origem treina <b>${cotaOrigem}</b> perícia(s) da lista dela. Escolhidas: <b>${escolhidasOrigem.length}/${cotaOrigem}</b>.`,
      corpo: listaOrigem.length ? chipsDePericia(listaOrigem, escolhidasOrigem, "data-auto-pericia-origem", treinosDeOutrasFontes("Origem"), { travado: forcadaOrigem }) : "",
    }));

    const poderesOrigem = poderesDaOrigem(db, personagem.origem);
    const beneficio = origem?.beneficio;
    if (poderesOrigem.length || beneficio) {
      const atual = e.poderOrigem ? db.poderes.find((x) => x.id === e.poderOrigem) : null;
      const poderUnico = poderesOrigem.length === 1;
      blocos.push(blocoHtml({
        id: "poder-origem",
        titulo: `Poder de ${personagem.origem}`,
        fonte: poderUnico ? "Origem · automático" : "Origem",
        estado: poderUnico ? "info" : atual ? "ok" : poderesOrigem.length ? "pendente" : "info",
        texto: beneficio
          ? `<em>${esc(beneficio)}</em>`
          : atual ? `Poder escolhido: <b>${esc(atual.nome)}</b>.` : "A origem concede um poder — escolha abaixo.",
        corpo: poderesOrigem.length ? `<div class="chip-lista">${poderesOrigem.map((poder) => `
          <button type="button" class="chip${poder.id === e.poderOrigem ? " ativo" : ""}" data-auto-poder-origem="${esc(poder.id)}" title="${esc((poder.descricao || "").slice(0, 200))}">${esc(poder.nome)}</button>`).join("")}
          ${e.poderOrigem ? '<button type="button" class="chip limpar" data-auto-poder-origem="">✕ limpar</button>' : ""}</div>` : "",
      }));
    }
  } else {
    blocos.push(blocoHtml({
      id: "origem-vazia", titulo: "Origem", fonte: "Origem", estado: "pendente",
      texto: "Escolha uma origem acima: ela treina 2 perícias e concede um poder.",
    }));
  }

  // --- Origem: equipamento inicial ---
  // A origem concede itens na criação. Eles são texto do livro ("Símbolo
  // sagrado", "Cão de guarda, cavalo, pônei ou trobo (escolha um)"), então a
  // ficha oferece o botão de jogar tudo no inventário como itens avulsos, em
  // vez de tentar casar cada frase com uma linha do catálogo.
  const itensDaOrigem = origemAtual()?.itensIniciais || [];
  if (itensDaOrigem.length && !auto.semOrigem) {
    const jaTem = itensDaOrigem.every((nome) => personagem.equipamentos.some((i) => i.nome === nome));
    blocos.push(blocoHtml({
      id: "itens-origem",
      titulo: `Equipamento de ${personagem.origem}`,
      fonte: "Origem",
      estado: jaTem ? "ok" : "info",
      texto: `A origem começa com: ${itensDaOrigem.map((x) => `<b>${esc(x)}</b>`).join(" · ")}.`,
      corpo: jaTem
        ? '<div class="chip-lista"><span class="chip travado">já no inventário<small>✓</small></span></div>'
        : '<div class="chip-lista"><button type="button" class="chip acao" data-add-itens-origem="1">+ Adicionar ao inventário</button></div>',
    }));
  }

  // --- Classe: escolhas obrigatórias de nível (Caminho do Arcanista etc.) ---
  // A ficha não guarda a lista de opções: ela pergunta ao compêndio quais
  // poderes pertencem à família declarada em data/core/escolhas-classe.json.
  if (classe) {
    // `regra` e não `esc`: `esc` é a função global de escapar HTML, e uma
    // variável de laço com esse nome a apagaria dentro do bloco.
    // Numa multiclasse cada classe traz as escolhas dela, contadas pelos
    // níveis gastos naquela classe (não pelo nível total do personagem).
    const regrasDeEscolha = d.classes.flatMap((x) => escolhasDeClassePara(db, x.classe.id, x.niveis));
    for (const regra of regrasDeEscolha) {
      const opcoes = opcoesDaEscolhaDeClasse(db, regra.familia);
      if (!opcoes.length) continue;
      const chave = `${regra.classe}.${regra.id}`;
      const escolhidoId = e.escolhasClasse?.[chave] || "";
      const escolhido = opcoes.find((o) => o.id === escolhidoId);
      const forcada = opcoes.length === 1;
      blocos.push(blocoHtml({
        id: `escolha-classe-${chave}`,
        titulo: d.classes.length > 1 ? `${regra.nome} (${porId(db.classes, regra.classe)?.nome || regra.classe})` : regra.nome,
        fonte: forcada ? "Classe · automático" : `Classe · ${regra.nivel}º nível`,
        estado: forcada ? "info" : escolhido ? "ok" : regra.obrigatorio ? "pendente" : "info",
        texto: escolhido
          ? `Escolhido: <b>${esc(escolhido.rotulo)}</b>. <em>${esc((escolhido.descricao || "").replace(/<[^>]+>/g, "").slice(0, 220))}</em>`
          : `${esc(regra.descricao || "")} <b>${opcoes.length}</b> opções.`,
        corpo: `<div class="chip-lista">${opcoes.map((o) => `
          <button type="button" class="chip${o.id === escolhidoId ? " ativo" : ""}" data-auto-escolha-classe="${esc(chave)}" data-valor="${esc(o.id)}" title="${esc((o.descricao || "").replace(/<[^>]+>/g, "").slice(0, 240))}">${esc(o.rotulo)}</button>`).join("")}
          ${escolhidoId ? `<button type="button" class="chip limpar" data-auto-escolha-classe="${esc(chave)}" data-valor="">✕ limpar</button>` : ""}</div>`,
      }));
    }

    // Clérigo e Paladino são devotos: sem divindade a ficha fica incompleta.
    if (classe.divindadeObrigatoria) {
      blocos.push(blocoHtml({
        id: "divindade-obrigatoria",
        titulo: `Divindade de ${classe.nome}`,
        fonte: "Classe",
        estado: personagem.divindade ? "ok" : "pendente",
        texto: personagem.divindade
          ? `Devoto de <b>${esc(personagem.divindade)}</b>.`
          : `${esc(classe.nome)} é uma classe devota — escolher uma divindade não é opcional. Ela define os poderes concedidos e as obrigações do código.`,
        corpo: personagem.divindade ? "" : '<div class="chip-lista"><button type="button" class="chip acao" data-abrir-picker="divindade">Escolher divindade →</button></div>',
      }));
    }
  }

  // --- Perícias que pedem especialidade (Ofício, Conhecimento...) ---
  const comEspecialidade = PERICIAS_COM_ESPECIALIDADE.filter((id) => d.treinos.has(id) || personagem.periciasTreinadas.includes(id));
  if (comEspecialidade.length) {
    const faltando = comEspecialidade.filter((id) => !(personagem.especializacoes?.[id] || "").trim());
    blocos.push(blocoHtml({
      id: "especializacoes",
      titulo: "Especialidade das perícias",
      fonte: "Perícias",
      estado: faltando.length ? "pendente" : "ok",
      texto: `${listaLegivel(comEspecialidade.map(nomePericia))} ${comEspecialidade.length > 1 ? "pedem" : "pede"} uma especialidade escolhida na criação (o Ofício de ferreiro, o Conhecimento arcano). Anote na aba <b>Perícias</b>.`,
      corpo: `<div class="chip-lista">${comEspecialidade.map((id) => {
        const v = (personagem.especializacoes?.[id] || "").trim();
        return `<span class="chip ${v ? "ativo" : "limpar"}">${esc(nomePericia(id))}<small>${v ? esc(v) : "sem especialidade"}</small></span>`;
      }).join("")}<button type="button" class="chip acao" data-ir-aba="pericias">Abrir aba Perícias →</button></div>`,
    }));
  }

  // --- Poderes por nível ---
  const esperados = poderesEsperados();
  const escolhidosPoderes = personagem.poderes.length;
  blocos.push(blocoHtml({
    id: "poderes-nivel",
    titulo: "Poderes por nível",
    fonte: "Classe · nível",
    estado: escolhidosPoderes >= esperados.escolhiveis ? "ok" : "pendente",
    texto: classe
      ? `No nível <b>${d.nivel}</b> você escolhe <b>${esperados.daClasse}</b> poder(es) de ${esc(classe.nome)} — um no 2º nível e um a cada nível seguinte${esperados.geraisExtra ? `, mais ${esperados.geraisExtra} poder geral do traço racial` : ""}. Escolhidos: <b>${escolhidosPoderes}/${esperados.escolhiveis}</b>.`
      : "Escolha uma classe para a ficha calcular quantos poderes você pode pegar.",
    corpo: '<div class="chip-lista"><button type="button" class="chip acao" data-ir-aba="poderes">Abrir aba Poderes →</button></div>',
  }));

  // --- Progressão do nível ---
  if (classe) {
    const modCon = formatarMod(regras.mod(d.atrs.con));
    const [inicialDist, ...extrasDist] = d.classes;
    const contaPV = extrasDist.length
      ? `${classe.pvInicial}${modCon} no 1º nível de ${esc(classe.nome)}, ${classe.pvPorNivel}${modCon} nos outros ${Math.max(0, inicialDist.niveis - 1)}, ${extrasDist.map((x) => `${x.classe.pvPorNivel}${modCon} × ${x.niveis} de ${esc(x.classe.nome)}`).join(", ")}`
      : `${classe.pvInicial}${modCon} no 1º nível, ${classe.pvPorNivel}${modCon} por nível`;
    const contaPM = extrasDist.length
      ? `${classe.pmInicial} inicial de ${esc(classe.nome)}, ${classe.pmPorNivel} × ${Math.max(0, inicialDist.niveis - 1)}, ${extrasDist.map((x) => `${x.classe.pmPorNivel} × ${x.niveis} de ${esc(x.classe.nome)}`).join(", ")}`
      : `${classe.pmPorNivel} por nível`;
    blocos.push(blocoHtml({
      id: "progressao",
      titulo: `Progressão até o nível ${d.nivel}${extrasDist.length ? ` — ${esc(rotuloDeClasses())}` : ""}`,
      fonte: "Nível · automático",
      estado: "info",
      texto: `PV <b>${d.pvMax}</b> (${contaPV}${auto.pvNivel1 || auto.pvPorNivel ? " + traço racial" : ""}) ·
        PM <b>${d.pmMax}</b> (${contaPM}${auto.pmPorNivel ? " + traço racial" : ""}) ·
        bônus de treino atual <b>${formatarMod(regras.bonusTreino(d.nivel, true))}</b>${d.nivel < 7 ? " (vira +4 no 7º nível)" : d.nivel < 15 ? " (vira +6 no 15º nível)" : " (máximo)"} ·
        metade do nível <b>${formatarMod(regras.metadeNivel(d.nivel))}</b> em toda perícia.`,
    }));
  }

  return blocos;
}

function renderAutomacao() {
  const box = $("auto-blocos");
  if (!box) return;
  const blocos = blocosDeAutomacao();
  box.innerHTML = blocos.join("");
  const pendentes = (box.querySelectorAll(".auto-bloco.pendente") || []).length;
  const status = $("auto-status");
  if (status) {
    const temEscolhas = !!(personagem.raca || personagem.classe);
    status.textContent = !temEscolhas ? "Aguardando seleção" : pendentes ? `${pendentes} pendência(s)` : "Automação completa";
    status.classList.toggle("pendente", pendentes > 0);
  }
  $("auto-empty")?.classList.toggle("hidden", blocos.length > 0);
}

// Marca/desmarca um item numa lista de escolhas respeitando o limite: quando
// a lista já está cheia, a escolha mais antiga sai para a nova entrar.
function alternarEscolha(campo, valor, limite) {
  const e = escolhas();
  const lista = Array.isArray(e[campo]) ? e[campo].slice() : [];
  const i = lista.indexOf(valor);
  if (i >= 0) lista.splice(i, 1);
  else {
    lista.push(valor);
    while (lista.length > limite) lista.shift();
  }
  e[campo] = lista;
  salvarERenderizar();
}

function registrarEventosAutomacao() {
  $("auto-blocos")?.addEventListener("click", (ev) => {
    const alvo = ev.target.closest("button");
    if (!alvo) return;
    const e = escolhas();
    const auto = racaAuto();
    const dataset = alvo.dataset;

    if (dataset.autoAtributo) return alternarEscolha("atributosRaciais", dataset.autoAtributo, atributosLivresDaRaca() || 3);
    if (dataset.autoBonusRacial) return alternarEscolha("bonusPericiasRaciais", dataset.autoBonusRacial, auto.bonusPericiasEscolha?.quantidade || 2);
    if (dataset.autoPericiaRacial) return alternarEscolha("periciasRaciais", dataset.autoPericiaRacial, auto.treinosEscolha || 1);
    if (dataset.autoPericiaOrigem) {
      const origem = origemAtual();
      return alternarEscolha("periciasOrigem", dataset.autoPericiaOrigem, Math.min(2, (origem?.periciasSugeridas || []).length || 2));
    }
    if (dataset.autoPericiaClasse) {
      const classe = classeAtual();
      const cota = regras.escolhasDePericiaDaClasse({ classe, modInt: regras.mod(atributoFinal("int")) });
      return alternarEscolha("periciasClasse", dataset.autoPericiaClasse, Math.max(1, cota));
    }
    if (dataset.autoClasseFixa !== undefined) {
      e.periciasClasseFixa = { ...(e.periciasClasseFixa || {}), [dataset.autoClasseFixa]: dataset.valor };
      return salvarERenderizar();
    }
    if (dataset.autoEscolhaClasse !== undefined) {
      e.escolhasClasse = { ...(e.escolhasClasse || {}) };
      if (dataset.valor) e.escolhasClasse[dataset.autoEscolhaClasse] = dataset.valor;
      else delete e.escolhasClasse[dataset.autoEscolhaClasse];
      return salvarERenderizar();
    }
    if (dataset.addItensOrigem) {
      for (const nome of origemAtual()?.itensIniciais || []) {
        if (!personagem.equipamentos.some((i) => i.nome === nome)) {
          personagem.equipamentos.push({ id: `origem-${nome}`, nome, peso: 0, qtd: 1, equipado: false });
        }
      }
      toast("Equipamento da origem adicionado ao inventário.");
      return salvarERenderizar();
    }
    if (dataset.abrirPicker) return openPickerModal(dataset.abrirPicker);
    if (dataset.autoVariante) {
      e.varianteAtributos = e.varianteAtributos === dataset.autoVariante ? "" : dataset.autoVariante;
      e.atributosRaciais = []; // trocar de variante zera a distribuição
      return salvarERenderizar();
    }
    if (dataset.autoLegado) {
      e.legadoRacial = dataset.autoLegado;
      e.atributosRaciais = []; // herança nova, distribuição nova
      return salvarERenderizar();
    }
    if (dataset.autoPoderOrigem !== undefined) {
      e.poderOrigem = e.poderOrigem === dataset.autoPoderOrigem ? "" : dataset.autoPoderOrigem;
      return salvarERenderizar();
    }
    if (dataset.irAba) return irParaAba(dataset.irAba);
  });
}

function irParaAba(aba) {
  const btn = document.querySelector(`.aba-btn[data-aba="${aba}"]`);
  if (!btn) return;
  btn.click();
  document.querySelector(`#aba-${aba}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ==============================================================
// Modelos de personagem — construções (raça/classe/origem/divindade/
// nível/atributos) salvas pra reaproveitar em personagens novos.
// ==============================================================
function templateSnapshot() {
  return {
    raca: personagem.raca, classe: personagem.classe, origem: personagem.origem, divindade: personagem.divindade,
    nivel: personagem.nivel, atributos: { ...personagem.atributos },
  };
}
function templateSummary(t) {
  return `${porId(db.racas, t.raca)?.nome ?? "—"} · ${porId(db.classes, t.classe)?.nome ?? "—"} · nível ${t.nivel || 1}`;
}
function openTemplatesModal() {
  const list = storage.getTemplates();
  $("modal-content").innerHTML = `<div class="modal-title"><div><span class="eyebrow">MODELOS</span><h2>Meus Modelos</h2><p class="muted">Salve a construção atual (raça, classe, origem, divindade, nível e atributos) como modelo reaproveitável — não inclui nome, PV atual nem inventário.</p></div></div>
    <div class="modal-body">
      <div class="template-grid" id="template-grid">${list.length ? list.map((tp) => `<div class="template-card" data-template-id="${esc(tp.id)}"><b>${esc(tp.name)}</b><p>${esc(templateSummary(tp))}</p><div class="template-card-actions"><button type="button" class="primary" data-use-template="${esc(tp.id)}">Usar</button><button type="button" class="perigo" data-delete-template="${esc(tp.id)}">Apagar</button></div></div>`).join("") : `<div class="template-empty">Nenhum modelo salvo ainda.</div>`}</div>
      <div class="template-save-row"><input id="template-name" placeholder="Nome do novo modelo (ex.: Guerreiro Básico)"><button type="button" class="primary" id="template-save">💾 Salvar como modelo</button></div>
    </div>`;
  $("modal").classList.remove("hidden");
  $("template-save").addEventListener("click", () => {
    const name = $("template-name").value.trim();
    if (!name) { toast("Dê um nome ao modelo."); return; }
    const arr = storage.getTemplates();
    arr.push({ id: `tpl-${Date.now()}`, name, ...templateSnapshot() });
    storage.saveTemplates(arr);
    toast(`Modelo "${name}" salvo.`);
    openTemplatesModal();
  });
  $("modal-content").querySelectorAll("[data-use-template]").forEach((b) => b.addEventListener("click", () => {
    const tp = storage.getTemplates().find((x) => x.id === b.dataset.useTemplate);
    if (!tp) return;
    personagem.raca = tp.raca; personagem.classe = tp.classe; personagem.origem = tp.origem; personagem.divindade = tp.divindade;
    personagem.nivel = tp.nivel || 1; personagem.atributos = { ...personagem.atributos, ...(tp.atributos || {}) };
    salvarERenderizar();
    $("modal").classList.add("hidden");
    toast(`Modelo "${tp.name}" aplicado.`);
  }));
  $("modal-content").querySelectorAll("[data-delete-template]").forEach((b) => b.addEventListener("click", () => {
    if (!confirm("Apagar este modelo?")) return;
    storage.saveTemplates(storage.getTemplates().filter((x) => x.id !== b.dataset.deleteTemplate));
    openTemplatesModal();
  }));
}

// ==============================================================
// Gerador de personagem — monta uma ficha jogável de ponta a ponta.
//
// Não é só sortear raça e classe: ele distribui atributos favorecendo o
// atributo-chave da classe, resolve TODAS as escolhas do painel de automação
// (perícias de classe/origem/raça, legado, poder de origem, poderes por
// nível), veste a melhor armadura que o personagem aguenta, empunha uma arma
// coerente com a classe, cria a linha de ataque e enche PV/PM. O resultado é
// uma ficha sem pendências, pronta pra jogar.
//
// gerarPersonagem(opcoes) aceita escolhas parciais — o modal "Gerador de
// personagem" deixa travar raça/classe/nível e sortear o resto.
// ==============================================================
const NOMES_ALEATORIOS = [
  "Aldrin", "Bran", "Cassia", "Doriel", "Elenwe", "Fenris", "Galadur", "Helvi", "Ithir", "Jarik",
  "Kaelen", "Liora", "Morwen", "Nerion", "Orwin", "Perah", "Quenna", "Rhandir", "Selune", "Torvald",
];

const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Especialidades temáticas para o gerador preencher Ofício/Conhecimento —
// são sugestões de sabor, não uma lista fechada do livro.
const ESPECIALIDADES_SUGERIDAS = {
  ofi: ["ferreiro", "alfaiate", "cozinheiro", "carpinteiro", "joalheiro", "curtidor", "escriba", "alquimista"],
  con: ["arcano", "história", "natureza", "religião", "engenharia", "geografia"],
};
function sorteiaVarios(lista, n) {
  const copia = lista.slice();
  const out = [];
  while (out.length < n && copia.length) out.push(...copia.splice(Math.floor(Math.random() * copia.length), 1));
  return out;
}

// Distribui um arranjo priorizando o atributo-chave da classe e, depois,
// Constituição e Destreza (que todo mundo usa: PV, Defesa e iniciativa).
function distribuirArranjo(valores, classe) {
  const ordem = valores.slice().sort((a, b) => b - a);
  // A classe declara a ordem de atributos que interessa a ela; o
  // atributo-chave abre a fila, e Constituição/Destreza fecham o resto
  // (todo mundo usa PV, Defesa e iniciativa).
  const chave = classe?.atributoChave;
  const daClasse = classe?.atributosPrioritarios || [];
  const prioridade = [...new Set([chave, ...daClasse, "con", "des", "sab", "int", "car", "for"].filter(Boolean))];
  const restantes = db.atributos.map((a) => a.id).filter((id) => !prioridade.includes(id));
  const alvo = [...new Set([...prioridade, ...restantes])].slice(0, valores.length);
  const out = {};
  alvo.forEach((id, i) => { out[id] = ordem[i] ?? 0; });
  for (const a of db.atributos) if (out[a.id] === undefined) out[a.id] = 0;
  return out;
}

// Preenche as escolhas de automação com opções válidas — o "Personagem
// aleatório" precisa entregar ficha jogável, não uma pilha de pendências.
function aplicarAutomacaoAleatoria(raca, classe, origem) {
  const e = (personagem.escolhas = storage.escolhasVazias());
  const auto = raca?.auto || {};
  if (auto.legados?.length) e.legadoRacial = sorteia(auto.legados).id;
  if (auto.variantesAtributos?.length) e.varianteAtributos = sorteia(auto.variantesAtributos).id;
  // Quantos atributos ficam livres depende do legado e da variante sorteados
  // acima, então esta leitura vem depois deles.
  const livresDaRaca = atributosLivresDaRaca();
  if (livresDaRaca) {
    const excluir = auto.atributosEscolha?.excluir || [];
    e.atributosRaciais = sorteiaVarios(db.atributos.map((a) => a.id).filter((id) => !excluir.includes(id)), livresDaRaca);
  }
  if (auto.bonusPericiasEscolha) e.bonusPericiasRaciais = sorteiaVarios(db.pericias.map((p) => p.id), auto.bonusPericiasEscolha.quantidade);
  if (auto.treinosEscolha) e.periciasRaciais = sorteiaVarios(db.pericias.map((p) => p.id), auto.treinosEscolha);
  if (classe) {
    (classe.periciasFixasEscolha || []).forEach((grupo, i) => { e.periciasClasseFixa[i] = sorteia(grupo); });
    const jaFixas = new Set([...(classe.periciasFixas || []), ...Object.values(e.periciasClasseFixa)]);
    const cota = regras.escolhasDePericiaDaClasse({ classe, modInt: regras.mod(atributoFinal("int")) });
    e.periciasClasse = sorteiaVarios((classe.periciasDeClasse || []).filter((id) => !jaFixas.has(id)), cota);
  }
  if (origem && !auto.semOrigem) {
    e.periciasOrigem = sorteiaVarios(origem.periciasSugeridas || [], Math.min(2, (origem.periciasSugeridas || []).length));
    e.poderOrigem = poderesDaOrigem(db, origem.id)[0]?.id || "";
  }
  // Escolhas obrigatórias da classe (Caminho do Arcanista, do Cavaleiro...).
  if (classe) {
    e.escolhasClasse = {};
    for (const regra of escolhasDeClassePara(db, classe.id, personagem.nivel || 1)) {
      const opcoes = opcoesDaEscolhaDeClasse(db, regra.familia);
      if (opcoes.length) e.escolhasClasse[`${regra.classe}.${regra.id}`] = sorteia(opcoes).id;
    }
  }
  // Ofício e Conhecimento pedem especialidade — o gerador escolhe uma temática.
  personagem.especializacoes = {};
  const treinadas = treinosAutomaticos();
  for (const [id, lista] of Object.entries(ESPECIALIDADES_SUGERIDAS)) {
    if (treinadas.has(id)) personagem.especializacoes[id] = sorteia(lista);
  }
  const disponiveis = poolPoderesDisponiveis();
  const d = calcularDerivados();
  // Prefere poderes cujo requisito a ficha consegue conferir e aprovar.
  const validos = disponiveis.filter((p) => requisitoAtendido(p, d) !== false);
  personagem.poderes = sorteiaVarios((validos.length ? validos : disponiveis).map((x) => x.id), poderesEsperados().escolhiveis);
}

// Veste a melhor armadura cuja penalidade o personagem aguenta, um escudo, e
// empunha uma arma coerente com a classe (Pontaria → arma de ataque à
// distância; senão, corpo a corpo), criando a linha de ataque.
function equiparInicialAleatorio(classe) {
  personagem.equipamentos = [];
  personagem.ataques = [];

  // A classe agora declara em que armaduras é proficiente — um Arcanista, que
  // só tem "Armaduras Leves", não pode sair de armadura completa.
  const prof = (classe?.proficiencias || []).map((x) => x.toLowerCase());
  const podePesada = prof.some((x) => x.includes("pesada"));
  const podeLeve = prof.some((x) => x.includes("leve")) || podePesada;
  const armaduras = catalogoPorFuncao("armadura")
    .map((rec) => ({ rec, info: regras.lerArmadura(rec) }))
    .filter((x) => x.info)
    .filter((x) => (x.info.tipo === "armadura pesada" ? podePesada : podeLeve))
    .sort((a, b) => b.info.defesa - a.info.defesa);
  // Classe sem treino em armadura pesada é castigada pela penalidade; como a
  // ficha não modela proficiências, o limite usado é a penalidade máxima que
  // não zera as perícias de Destreza do personagem.
  const limitePenalidade = Math.max(1, 2 + regras.mod(atributoFinal("des")));
  // ...e que ele consiga carregar: armadura pesada com Força baixa deixa o
  // personagem sobrecarregado antes mesmo de pegar o resto do equipamento.
  const cargaMax = regras.cargaMaxima(regras.mod(atributoFinal("for")));
  const cabe = (x) => (Number(x.rec.peso) || 0) <= cargaMax * 0.6;
  const escolhida = armaduras.find((x) => x.info.penalidade <= limitePenalidade && cabe(x))
    || armaduras.filter(cabe).pop()
    || armaduras[armaduras.length - 1];
  if (escolhida) equiparNaVaga(escolhida.rec, "armadura");

  const usaDistancia = (classe?.periciasDeClasse || []).includes("pon") && !(classe?.periciasFixas || []).includes("lut");
  const armas = catalogoPorFuncao(usaDistancia ? "arma-distancia" : "arma-corpo");
  const arma = armas.length ? sorteia(armas) : null;
  if (arma) {
    garantirNoInventario(arma);
    personagem.ataques.push(ataqueDaArma(arma));
  }
  // Escudo só pra quem luta corpo a corpo e não usa arma de duas mãos óbvia.
  if (!usaDistancia && prof.some((x) => x.includes("escudo"))) {
    const escudo = catalogoPorFuncao("escudo").find((x) => /leve/i.test(x.nome));
    if (escudo) equiparNaVaga(escudo, "escudo");
  }
}

// opcoes: { raca, classe, origem, nivel, divindade, modoAtributos, equipar }
// Qualquer campo vazio é sorteado.
function gerarPersonagem(opcoes = {}) {
  const raca = porId(db.racas, opcoes.raca) || sorteia(filtrarPorSuplemento(db.racas, ""));
  const classe = porId(db.classes, opcoes.classe) || sorteia(filtrarPorSuplemento(db.classes, ""));
  const origem = raca.auto?.semOrigem ? null : (porId(db.origens, opcoes.origem) || sorteia(filtrarPorSuplemento(db.origens, "")));
  // Clérigo e Paladino são devotos: divindade não é sorteio de moeda.
  const precisaDivindade = !!classe.divindadeObrigatoria;
  const divindade = opcoes.divindade !== undefined
    ? opcoes.divindade
    : (precisaDivindade || Math.random() < 0.5 ? sorteia(db.panteao).nome : "");

  personagem.nome = opcoes.nome || `${sorteia(NOMES_ALEATORIOS)} de ${raca.nome}`;
  personagem.raca = raca.id;
  personagem.classe = classe.id;
  personagem.origem = origem ? origem.id : "";
  personagem.divindade = divindade;
  personagem.nivel = Math.max(1, Math.min(20, Number(opcoes.nivel) || 1));
  personagem.escalaAtributos = "t20";
  personagem.periciasTreinadas = [];

  // Atributos: rolagem 4d6 (convertida pra escala T20) ou um arranjo pronto.
  const modo = opcoes.modoAtributos || "arranjo";
  if (modo === "rolagem") {
    const pool = regras.rolarPiscinaDeAtributos().map((r) => ({ valor: r.valorT20, d20: r.totalD20, dados: r.dados, descartado: r.descartado }));
    personagem.atributosModo = "rolagem";
    personagem.atributosPool = pool;
    const distribuido = distribuirArranjo(pool.map((x) => x.valor), classe);
    personagem.atributos = distribuido;
    // Liga cada atributo ao índice da piscina de onde veio o valor.
    const usados = new Set();
    personagem.atributosSlots = {};
    for (const [id, valor] of Object.entries(distribuido)) {
      const i = pool.findIndex((x, k) => x.valor === valor && !usados.has(k));
      if (i >= 0) { usados.add(i); personagem.atributosSlots[id] = i; }
    }
  } else {
    const arranjo = regras.ARRANJOS_PADRAO[Math.floor(Math.random() * regras.ARRANJOS_PADRAO.length)];
    personagem.atributosModo = "arranjo";
    personagem.atributosArranjo = arranjo.id;
    personagem.atributosPool = arranjo.valores.map((v) => ({ valor: v }));
    personagem.atributos = distribuirArranjo(arranjo.valores, classe);
    const usados = new Set();
    personagem.atributosSlots = {};
    for (const [id, valor] of Object.entries(personagem.atributos)) {
      const i = arranjo.valores.findIndex((v, k) => v === valor && !usados.has(k));
      if (i >= 0) { usados.add(i); personagem.atributosSlots[id] = i; }
    }
  }

  aplicarAutomacaoAleatoria(raca, classe, origem);
  if (opcoes.equipar !== false) equiparInicialAleatorio(classe);

  // Equipamento que a origem concede, junto do que o gerador equipou.
  for (const nome of (origem?.itensIniciais) || []) {
    if (!personagem.equipamentos.some((i) => i.nome === nome)) {
      personagem.equipamentos.push({ id: `origem-${nome}`, nome, peso: 0, qtd: 1, equipado: false });
    }
  }

  // Dinheiro inicial da criação (o que sobra depois do equipamento fica no
  // bolso — a ficha não cobra o preço dos itens, então é um valor de partida).
  personagem.dinheiro = { tt: Number(classe.dinheiroInicial) || 0, to: 0, tp: 0, tc: 0 };

  // Conjurador começa com magias: as do tipo da classe, dentro do círculo que
  // o nível alcança. Sem isso um Arcanista saía do gerador sem uma magia.
  personagem.magias = [];
  personagem.magiasPreparadas = [];
  if (classe.conjuracao) {
    // A cota agora vem da tabela de conjuração da classe (e do Caminho, no
    // caso do Arcanista) em vez de um chute.
    const tabela = tabelaDeConjuracao();
    const tipo = classe.conjuracao[0].toUpperCase() + classe.conjuracao.slice(1);
    const max = regras.circuloMaximoDaClasse(tabela, personagem.nivel);
    const disponiveis = db.magias.filter((m) => (m.tipo === tipo || m.tipo === "Universal") && Number(m.circulo) <= max);
    const cota = regras.magiasConhecidasNoNivel(tabela, personagem.nivel) ?? (2 + (max - 1));
    personagem.magias = sorteiaVarios(disponiveis, Math.min(disponiveis.length, cota)).map((m) => m.id);
  }

  normalizarEscolhas();
  const d = calcularDerivados();
  personagem.pv = { atual: d.pvMax ?? 0, maximo: null, temp: 0 };
  personagem.pm = { atual: d.pmMax ?? 0, maximo: null, temp: 0 };
  salvarERenderizar();
  return { raca, classe, origem };
}

function gerarPersonagemAleatorio() {
  const { raca, classe } = gerarPersonagem();
  toast(`Gerado: ${personagem.nome} — ${raca.nome} ${classe.nome} nível ${personagem.nivel}.`);
}

// Modal "Gerador de personagem": trava o que você já decidiu e sorteia o resto.
function abrirGeradorModal() {
  const opcoesSelect = (lista, rotulo) => `<option value="">— sortear ${rotulo} —</option>${lista.map((x) => `<option value="${esc(x.id)}">${esc(x.nome || x.id)}</option>`).join("")}`;
  abrirModalGenerico(`<div class="modal-title"><div><span class="eyebrow">GERADOR</span><h2>Gerador de personagem</h2><p class="muted">Deixe em "sortear" o que você não decidiu. A ficha resolve todas as escolhas da automação, veste equipamento e enche PV/PM.</p></div></div>
    <div class="modal-body">
      <div class="two-input">
        <label>Raça<select id="gen-raca">${opcoesSelect(db.racas, "raça")}</select></label>
        <label>Classe<select id="gen-classe">${opcoesSelect(db.classes, "classe")}</select></label>
      </div>
      <div class="two-input">
        <label>Origem<select id="gen-origem">${opcoesSelect(db.origens, "origem")}</select></label>
        <label>Nível<input id="gen-nivel" type="number" min="1" max="20" value="${personagem.nivel || 1}"></label>
      </div>
      <div class="two-input">
        <label>Atributos<select id="gen-atributos">
          <option value="arranjo">Arranjo pronto (dentro dos 10 pontos)</option>
          <option value="rolagem">Rolagem 4d6, descarta o menor</option>
        </select></label>
        <label>Nome<input id="gen-nome" placeholder="deixe vazio pra sortear"></label>
      </div>
      <label class="filtro-check" style="margin-top:10px"><input type="checkbox" id="gen-equipar" checked> Vestir armadura, escudo e arma automaticamente</label>
      <div class="linha-botoes-modal">
        <button type="button" class="primary" id="gen-gerar">🎲 Gerar personagem</button>
        <button type="button" id="gen-cancelar">Cancelar</button>
      </div>
      <p class="dica">Isto substitui as escolhas do personagem que está aberto. Pra manter o atual, crie um novo antes (Personagem → Novo).</p>
    </div>`);
  $("gen-cancelar").addEventListener("click", () => $("modal").classList.add("hidden"));
  $("gen-gerar").addEventListener("click", () => {
    const { raca, classe } = gerarPersonagem({
      raca: $("gen-raca").value,
      classe: $("gen-classe").value,
      origem: $("gen-origem").value,
      nivel: Number($("gen-nivel").value) || 1,
      nome: $("gen-nome").value.trim(),
      modoAtributos: $("gen-atributos").value,
      equipar: $("gen-equipar").checked,
    });
    $("modal").classList.add("hidden");
    toast(`Gerado: ${personagem.nome} — ${raca.nome} ${classe.nome} nível ${personagem.nivel}.`);
    irParaAba("ficha");
  });
}

// ==============================================================
// Ficha impressa (A4) — duas páginas montadas na hora de imprimir.
//
// Antes o botão de PDF mandava o navegador imprimir a própria página do
// app, com abas, painéis de automação e catálogos escondidos por CSS: dava
// uma folha que ninguém levaria pra mesa. Aqui a ficha é remontada num
// layout de papel — bloco de identidade, atributos, Defesa/PV/PM, as 29
// perícias em duas colunas, ataques, equipamento e, na segunda página,
// poderes, magias e anotações.
//
// O HTML só existe enquanto a impressão acontece; em tela ele fica com
// display:none (a não ser na pré-visualização).
// ==============================================================
function campoImpresso(rotulo, valor) {
  return `<div class="fi-campo"><b>${valor === "" || valor == null ? "&nbsp;" : valor}</b><span>${esc(rotulo)}</span></div>`;
}
function caixaImpressa(titulo, corpo, classe = "") {
  return `<section class="fi-caixa ${classe}"><h3>${esc(titulo)}</h3><div class="fi-caixa-corpo">${corpo}</div></section>`;
}

function montarFichaImpressa() {
  const d = calcularDerivados();
  const raca = racaAtual();
  const classeTexto = d.classes.length > 1 ? rotuloDeClasses() : (classeAtual()?.nome || "—");

  // --- Atributos ---
  const atributos = db.atributos.map((a) => `
    <div class="fi-atributo"><span>${esc(a.nome)}</span><b>${formatarMod(atributoFinal(a.id))}</b></div>`).join("");

  // --- Perícias: as 29, em duas colunas, marcando as treinadas ---
  const pericias = db.pericias.map((p) => {
    const treinado = estaTreinado(p.id, d);
    return `<div class="fi-pericia${treinado ? " treinada" : ""}">
      <i>${treinado ? "●" : "○"}</i>
      <span>${esc(nomePericiaCompleto(p.id))}</span>
      <em>${esc(p.atributo.toUpperCase())}</em>
      <b>${formatarMod(bonusDePericiaSeguro(p, d))}</b></div>`;
  }).join("");

  // --- Ataques ---
  const linhasAtaque = personagem.ataques.map((at) => `
    <tr><td>${esc(at.nome || "—")}</td><td>${formatarMod(bonusDeAtaque(at, d))}</td>
    <td>${esc(at.dano || "—")}</td><td>${esc(at.critico || "20/x2")}</td></tr>`).join("")
    || '<tr><td colspan="4">—</td></tr>';

  // --- Equipamento ---
  const equipamento = personagem.equipamentos.map((it) => {
    const rec = registroDoItem(it);
    return `<li>${it.equipado ? "<b>[equipado]</b> " : ""}${esc(it.nome)}${it.qtd > 1 ? ` ×${it.qtd}` : ""}${rec.peso ? ` <i>${rec.peso}kg</i>` : ""}</li>`;
  }).join("") || "<li>—</li>";

  const dinheiro = ["tt", "to", "tp", "tc"].map((k) => `${k.toUpperCase()}$ ${personagem.dinheiro?.[k] ?? 0}`).join(" · ");

  const pagina1 = `<div class="fi-pagina">
    <header class="fi-topo">
      <div class="fi-nome">
        ${campoImpresso("Nome do personagem", esc(personagem.nome || "—"))}
        <div class="fi-campo-linha">
          ${campoImpresso("Raça", esc(raca?.nome || "—"))}
          ${campoImpresso("Classe e nível", esc(classeTexto) + ` — nível ${d.nivel}`)}
        </div>
        <div class="fi-campo-linha">
          ${campoImpresso("Origem", esc(personagem.origem || "—"))}
          ${campoImpresso("Divindade", esc(personagem.divindade || "—"))}
          ${campoImpresso("Jogador", esc(personagem.jogador || "—"))}
        </div>
      </div>
      <div class="fi-escudo"><span>Defesa</span><b>${d.defesa}</b></div>
      <div class="fi-vitais">
        <div><span>PV</span><b>${personagem.pv.atual ?? 0}</b><small>de ${d.pvMax ?? "—"}</small></div>
        <div><span>PM</span><b>${personagem.pm.atual ?? 0}</b><small>de ${d.pmMax ?? "—"}</small></div>
      </div>
    </header>

    <div class="fi-colunas">
      <div class="fi-coluna fi-coluna-estreita">
        ${caixaImpressa("Atributos", `<div class="fi-atributos">${atributos}</div>`)}
        ${caixaImpressa("Combate", `
          <div class="fi-mini">
            <div><span>Iniciativa</span><b>${formatarMod(d.iniciativa)}</b></div>
            <div><span>Deslocamento</span><b>${esc(raca?.deslocamento || "9m")}</b></div>
            <div><span>Penal. armadura</span><b>${d.penalidadeArmadura ? `−${d.penalidadeArmadura}` : "0"}</b></div>
            <div><span>Carga</span><b>${Math.round(d.carga * 10) / 10}/${d.cargaMax}</b></div>
          </div>`)}
        ${caixaImpressa("Resistências", `<div class="fi-mini">${["for", "ref", "von"].map((id) => {
          const p = db.pericias.find((x) => x.id === id) || db.pericias.find((x) => x.salvamento && x.id.startsWith(id));
          return p ? `<div><span>${esc(p.nome)}</span><b>${formatarMod(bonusDePericiaSeguro(p, d))}</b></div>` : "";
        }).join("")}</div>`)}
        ${caixaImpressa("Dinheiro e carga", `<p>${esc(dinheiro)}</p><p>Carga máxima: <b>${d.cargaMax}</b></p>`)}
      </div>
      <div class="fi-coluna">
        ${caixaImpressa("Perícias", `<div class="fi-pericias">${pericias}</div>
          <p class="fi-nota">● treinada · o bônus já soma metade do nível, atributo, treino, racial e penalidade de armadura.</p>`)}
        ${caixaImpressa("Ataques", `<table class="fi-tabela">
          <thead><tr><th>Arma</th><th>Ataque</th><th>Dano</th><th>Crítico</th></tr></thead>
          <tbody>${linhasAtaque}</tbody></table>`)}
      </div>
    </div>
  </div>`;

  // --- Página 2: poderes, magias, notas ---
  const poderOrigem = escolhas().poderOrigem ? db.poderes.find((x) => x.id === escolhas().poderOrigem) : null;
  const escolhasClasseTexto = Object.values(escolhas().escolhasClasse || {})
    .map((id) => db.poderes.find((p) => p.id === id)?.nome).filter(Boolean);
  const poderes = [
    ...(poderOrigem ? [`${poderOrigem.nome} <i>(origem)</i>`] : []),
    ...escolhasClasseTexto.map((n) => `${esc(n)} <i>(escolha de classe)</i>`),
    ...personagem.poderes.map((id) => {
      const p = db.poderes.find((x) => x.id === id);
      return p ? `${esc(p.nome)}${p.custo ? ` <i>(${p.custo} PM)</i>` : ""}` : "";
    }).filter(Boolean),
  ];
  const magias = personagem.magias.map((id) => {
    const m = db.magias.find((x) => x.id === id);
    return m ? `${esc(m.nome)} <i>(${m.circulo}º · ${regras.custoDaMagia(m)} PM)</i>` : "";
  }).filter(Boolean);
  const condicoes = condicoesAtivas().map((c) => esc(c.nome));
  const notas = personagem.notas.slice(-6).reverse().map((n) => `<li>${esc(n.texto)}</li>`).join("");

  const pagina2 = `<div class="fi-pagina">
    <header class="fi-topo-2"><h2>${esc(personagem.nome || "Personagem")}</h2><span>${esc(classeTexto)} — nível ${d.nivel}</span></header>
    <div class="fi-colunas">
      <div class="fi-coluna">
        ${caixaImpressa(`Poderes (${poderes.length})`, `<ul class="fi-lista">${poderes.map((x) => `<li>${x}</li>`).join("") || "<li>—</li>"}</ul>`)}
        ${caixaImpressa("Equipamento", `<ul class="fi-lista">${equipamento}</ul>`)}
      </div>
      <div class="fi-coluna">
        ${magias.length ? caixaImpressa(`Magias (${magias.length})`, `<ul class="fi-lista">${magias.map((x) => `<li>${x}</li>`).join("")}</ul>`) : ""}
        ${condicoes.length ? caixaImpressa("Condições ativas", `<p>${condicoes.join(" · ")}</p>`) : ""}
        ${caixaImpressa("Biografia e aparência", `<p>${esc(personagem.biografia || "—")}</p><p>${esc(personagem.aparencia || "")}</p>`)}
        ${caixaImpressa("Anotações", `<ul class="fi-lista">${notas || "<li>—</li>"}</ul>`)}
      </div>
    </div>
  </div>`;

  return pagina1 + pagina2;
}

function imprimirFicha() {
  montarPreviewImpressao();
  // Espera o layout assentar antes de abrir o diálogo de impressão.
  requestAnimationFrame(() => window.print());
}

// Pré-visualização: mostra as duas páginas na tela, do jeito que vão sair no
// papel, sem precisar abrir o diálogo de impressão pra conferir.
function montarPreviewImpressao(mostrar = false) {
  const alvo = document.getElementById("ficha-impressa");
  if (!alvo) return;
  alvo.innerHTML = montarFichaImpressa();
  alvo.classList.toggle("visivel", mostrar);
  return alvo;
}
function alternarPreviewImpressao() {
  const alvo = document.getElementById("ficha-impressa");
  if (!alvo) return;
  const abrindo = !alvo.classList.contains("visivel");
  montarPreviewImpressao(abrindo);
  if (abrindo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ==============================================================
// Link somente-leitura — codifica o personagem inteiro (sem notas) num
// hash de URL (#share=gz:<dados>). Sem servidor: quem abre roda o mesmo
// app; a ficha vira read-only até salvar uma cópia editável.
// ==============================================================
let viewOnlyMode = false;
function base64UrlEncode(bytes) {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + (b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function gzipEncode(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === "undefined") return `raw:${base64UrlEncode(bytes)}`;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return `gz:${base64UrlEncode(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
}
async function gzipDecode(payload) {
  const sep = payload.indexOf(":");
  const mode = payload.slice(0, sep), bytes = base64UrlDecode(payload.slice(sep + 1));
  if (mode === "raw") return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
function shareSnapshot(p) { const out = { ...p }; delete out.notas; return out; }
async function buildShareUrl() {
  const payload = await gzipEncode(JSON.stringify(shareSnapshot(personagem)));
  const url = new URL(location.href);
  url.hash = `share=${payload}`;
  return url.toString();
}
async function decodeShareHash(hash) {
  const m = /^#?share=(.+)$/.exec(hash || "");
  if (!m) return null;
  try { return JSON.parse(await gzipDecode(decodeURIComponent(m[1]))); }
  catch (err) { console.error("Link somente-leitura inválido ou corrompido:", err); return null; }
}
const VIEW_ONLY_SAFE_IDS = new Set(["skin-select", "lang-select", "compendio-busca", "compendio-tipo", "poderes-busca", "poderes-filtro-categoria", "magias-busca", "magias-filtro-circulo", "equip-busca", "equip-filtro-tipo", "dashboard-toggle", "view-only-copy", "btn-pdf", "btn-pdf-topo"]);
function lockViewOnlyControls() {
  if (!viewOnlyMode) return;
  document.querySelectorAll("main input, main textarea, main select").forEach((el) => { if (!VIEW_ONLY_SAFE_IDS.has(el.id)) el.disabled = true; });
  document.querySelectorAll("main button").forEach((el) => { if (el.classList.contains("aba-btn") || VIEW_ONLY_SAFE_IDS.has(el.id)) return; el.disabled = true; });
}
function enterViewOnlyMode() {
  viewOnlyMode = true;
  document.body.classList.add("view-only");
  document.querySelector('.aba-btn[data-aba="construcao"]')?.classList.add("hidden");
  document.querySelectorAll(".aba-btn").forEach((b) => b.classList.remove("ativo"));
  document.querySelectorAll(".aba").forEach((a) => a.classList.remove("ativo"));
  document.querySelector('.aba-btn[data-aba="ficha"]')?.classList.add("ativo");
  $("aba-ficha")?.classList.add("ativo");
  ["btn-personagens", "btn-novo", "btn-templates", "btn-aleatorio", "btn-gerador", "input-importar", "btn-link-leitura"].forEach((id) => { const el = $(id); if (el) el.disabled = true; });
  lockViewOnlyControls();
  const banner = $("view-only-banner");
  if (banner) {
    banner.classList.remove("hidden");
    $("view-only-text").textContent = `📖 Modo visualização — esta é a ficha de ${personagem.nome || "um personagem"}, aberta por um link somente-leitura. Nada é salvo neste navegador enquanto estiver assim.`;
  }
}

// ==============================================================
// Ambiente do Mestre — kit independente do personagem aberto: listas de
// ameaças por mesa/campanha (bestiário oficial + criadas na mão), busca
// no bestiário completo (298 ameaças centrais + 1850 da Coleção Arton) e
// um jeito rápido de mandar uma ameaça pra iniciativa da sala com as
// estatísticas reais dela (em vez de digitar tudo na mão em "Iniciativa").
// ==============================================================
let monsterState = { view: "roster", listId: "", fonte: "" };
function genMonsterEntryId() { return `mon-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }
// A "fonte" bruta de cada ameaça vem cheia de detalhe (capítulo/seção do
// livro entre parênteses) — só o prefixo antes do "(" já separa as 3
// origens reais dos dados (regras centrais, Compendium Extra, Coleção
// Arton), o suficiente pra filtrar sem virar uma lista de 350+ opções.
function fontePrincipal(a) { return (a.fonte || "").split(" (")[0]; }
function ensureMonsterListsState() {
  let lists = storage.getMonsterLists();
  if (!lists.length) {
    lists = [{ id: storage.newMonsterListId(), name: "Meus Monstros", monsters: [] }];
    storage.saveMonsterLists(lists);
  }
  if (!monsterState.listId || !lists.some((l) => l.id === monsterState.listId)) {
    monsterState.listId = storage.getActiveMonsterListId();
    if (!lists.some((l) => l.id === monsterState.listId)) monsterState.listId = lists[0].id;
    storage.setActiveMonsterListId(monsterState.listId);
  }
  return lists;
}
function activeMonsterList(lists) {
  lists = lists || ensureMonsterListsState();
  return lists.find((l) => l.id === monsterState.listId) || lists[0];
}
function renderMonsterListSelect(lists) {
  lists = lists || ensureMonsterListsState();
  const sel = $("monster-list-select");
  if (!sel) return;
  sel.innerHTML = lists.map((l) => `<option value="${esc(l.id)}"${l.id === monsterState.listId ? " selected" : ""}>${esc(l.name)} (${l.monsters.length})</option>`).join("");
}
function openMonsterListNameModal(mode) {
  const lists = ensureMonsterListsState();
  const current = mode === "rename" ? activeMonsterList(lists) : null;
  $("modal-content").innerHTML = `<div class="modal-title"><div><span class="eyebrow">LISTA DE AMEAÇAS</span><h2>${mode === "rename" ? "Renomear lista" : "Nova lista"}</h2></div></div>
    <div class="modal-body">
      <label>Nome da lista<br><input id="ml-name" style="width:100%" value="${esc(current?.name || "")}" placeholder="Ex.: Mesa de sexta"></label>
      <div class="linha-botoes-modal"><button type="button" id="ml-cancel">Cancelar</button><button type="button" class="primary" id="ml-save">${mode === "rename" ? "Renomear" : "Criar"}</button></div>
    </div>`;
  $("modal").classList.remove("hidden");
  $("ml-name").focus();
  $("ml-cancel").addEventListener("click", () => $("modal").classList.add("hidden"));
  $("ml-save").addEventListener("click", () => {
    const name = $("ml-name").value.trim();
    if (!name) { toast("Dê um nome pra lista."); return; }
    const freshLists = ensureMonsterListsState();
    if (mode === "rename") { activeMonsterList(freshLists).name = name; }
    else {
      const nl = { id: storage.newMonsterListId(), name, monsters: [] };
      freshLists.push(nl);
      monsterState.listId = nl.id;
      storage.setActiveMonsterListId(nl.id);
    }
    storage.saveMonsterLists(freshLists);
    $("modal").classList.add("hidden");
    renderMonsters();
  });
}
function deleteActiveMonsterList() {
  const lists = ensureMonsterListsState();
  const target = activeMonsterList(lists);
  if (!confirm(`Excluir a lista "${target.name}" e ${target.monsters.length} ameaça(s) nela?`)) return;
  const remaining = lists.filter((l) => l.id !== target.id);
  const finalLists = remaining.length ? remaining : [{ id: storage.newMonsterListId(), name: "Meus Monstros", monsters: [] }];
  storage.saveMonsterLists(finalLists);
  monsterState.listId = finalLists[0].id;
  storage.setActiveMonsterListId(monsterState.listId);
  renderMonsters();
}
function addMonsterToRoster(m) {
  const lists = ensureMonsterListsState();
  const target = activeMonsterList(lists);
  const exists = target.monsters.some((x) => x.nome === m.nome && (x.fonte || "") === (m.fonte || ""));
  if (!exists) target.monsters.push({ ...m, _id: genMonsterEntryId() });
  storage.saveMonsterLists(lists);
  toast(exists ? `"${m.nome}" já está em "${target.name}".` : `"${m.nome}" adicionado a "${target.name}".`);
}
function removeMonsterFromRoster(id) {
  const lists = ensureMonsterListsState();
  const target = activeMonsterList(lists);
  target.monsters = target.monsters.filter((x) => x._id !== id);
  storage.saveMonsterLists(lists);
  renderMonsters();
}
function monsterCardHtml(m, opts = {}) {
  return `<article class="catalog-card">
    <div class="pick-top"><strong>${esc(m.nome || "Sem nome")}</strong><span class="tag ${m.custom ? "brew" : "official"}">${m.custom ? "CRIADA" : "OFICIAL"}${m.nd != null ? ` · ND ${esc(String(m.nd))}` : ""}</span></div>
    <div class="pick-meta">${esc(m.tipo || "—")} · PV ${esc(String(m.pv ?? "?"))} · Defesa ${esc(String(m.defesa ?? "?"))}</div>
    <div class="catalog-actions">
      <button type="button" data-mon-view="${esc(opts.viewKey)}">ⓘ Ver detalhes</button>
      ${opts.addable ? `<button type="button" class="add-btn" data-mon-add="${esc(opts.viewKey)}">+ Adicionar à lista</button>` : ""}
      ${opts.removable ? `<button type="button" data-mon-init="${esc(m._id)}">⚔️ Add à iniciativa</button><button type="button" class="perigo" data-mon-remove="${esc(m._id)}">🗑️ Remover</button>` : ""}
    </div>
  </article>`;
}
function addMonsterToIniciativa(m) {
  // m.atributos guarda o modificador de Tormenta 20 direto (não uma "pontuação"
  // de atributo à moda d20 — ao contrário dos atributos do personagem nesta
  // ficha, que passam por regras.mod()), então soma-se direto na iniciativa.
  const init = regras.rollDie(20) + (Number(m.atributos?.des) || 0);
  sendCombatAction("addManual", { name: m.nome, init, ac: Number(m.defesa) || 10, hpMax: Number(m.pv) || 1 });
  toggleRoomChat(true);
  document.querySelectorAll("#room-chat-tabs [data-roomtab]").forEach((x) => x.classList.toggle("active", x.dataset.roomtab === "combat"));
  $("room-chat-list")?.classList.add("hidden");
  $("room-chat-compose")?.classList.add("hidden");
  $("room-combat-panel")?.classList.remove("hidden");
  renderCombatTracker();
  toast(`"${m.nome}" adicionado à iniciativa da sala (${regras.fmt(init)}).`);
}
function renderMonsters() {
  const lists = ensureMonsterListsState();
  renderMonsterListSelect(lists);
  $("monster-browse-toolbar")?.classList.toggle("hidden", monsterState.view !== "browse");
  const box = $("monster-results");
  if (!box) return;
  if (monsterState.view === "roster") {
    const active = activeMonsterList(lists);
    box.innerHTML = active.monsters.length
      ? active.monsters.map((m) => monsterCardHtml(m, { viewKey: `roster:${m._id}`, removable: true })).join("")
      : `<div class="empty">A lista "${esc(active.name)}" ainda está vazia. Adicione ameaças na aba "Bestiário Oficial" ou clique em "+ Criar ameaça".</div>`;
    box.querySelectorAll("[data-mon-view]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.monView.slice("roster:".length);
      const m = activeMonsterList(ensureMonsterListsState()).monsters.find((x) => x._id === id);
      if (m) abrirDetalheAmeaca(m);
    }));
    box.querySelectorAll("[data-mon-init]").forEach((b) => b.addEventListener("click", () => {
      const m = activeMonsterList(ensureMonsterListsState()).monsters.find((x) => x._id === b.dataset.monInit);
      if (m) addMonsterToIniciativa(m);
    }));
    box.querySelectorAll("[data-mon-remove]").forEach((b) => b.addEventListener("click", () => { if (confirm("Remover esta ameaça da lista?")) removeMonsterFromRoster(b.dataset.monRemove); }));
    return;
  }
  // view === "browse"
  const fonteSel = $("monster-fonte");
  if (fonteSel && !fonteSel.dataset.filled) {
    const fontes = [...new Set(db.ameacas.map(fontePrincipal).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    fonteSel.insertAdjacentHTML("beforeend", fontes.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join(""));
    fonteSel.dataset.filled = "1";
  }
  const q = ($("monster-search")?.value || "").trim().toLowerCase();
  const fonte = $("monster-fonte")?.value || "";
  const pool = db.ameacas.filter((a) => (!fonte || fontePrincipal(a) === fonte) && (!q || a.nome.toLowerCase().includes(q)));
  const filtered = pool.slice(0, 240);
  box.innerHTML = filtered.length
    ? filtered.map((m) => monsterCardHtml(m, { viewKey: JSON.stringify([m.nome, m.fonte]), addable: true })).join("")
    : `<div class="empty">Nenhum resultado — ${pool.length === 0 ? "tente outro filtro" : "muitos resultados, refine a busca"}.</div>`;
  box.querySelectorAll("[data-mon-view]").forEach((b) => b.addEventListener("click", () => {
    const [nome, fonteM] = JSON.parse(b.dataset.monView);
    const m = pool.find((x) => x.nome === nome && x.fonte === fonteM);
    if (m) abrirDetalheAmeaca(m);
  }));
  box.querySelectorAll("[data-mon-add]").forEach((b) => b.addEventListener("click", () => {
    const [nome, fonteM] = JSON.parse(b.dataset.monAdd);
    const m = pool.find((x) => x.nome === nome && x.fonte === fonteM);
    if (m) { addMonsterToRoster(m); renderMonsterListSelect(); }
  }));
  const addAllBtn = $("monster-add-all-fonte");
  if (addAllBtn) addAllBtn.textContent = `📦 Adicionar os ${pool.length} resultado(s) à lista ativa`;
}
function addAllFilteredMonstersToActiveList() {
  const q = ($("monster-search")?.value || "").trim().toLowerCase();
  const fonte = $("monster-fonte")?.value || "";
  const pool = db.ameacas.filter((a) => (!fonte || fontePrincipal(a) === fonte) && (!q || a.nome.toLowerCase().includes(q)));
  if (!pool.length) { toast("Nenhuma ameaça encontrada com esse filtro."); return; }
  if (!confirm(`Adicionar ${pool.length} ameaça(s) à lista ativa?`)) return;
  const lists = ensureMonsterListsState();
  const target = activeMonsterList(lists);
  let added = 0;
  for (const m of pool) {
    const exists = target.monsters.some((x) => x.nome === m.nome && (x.fonte || "") === (m.fonte || ""));
    if (!exists) { target.monsters.push({ ...m, _id: genMonsterEntryId() }); added++; }
  }
  storage.saveMonsterLists(lists);
  toast(`${added} ameaça(s) adicionada(s) a "${target.name}".`);
  renderMonsters();
}
function openMonsterCreateModal() {
  $("modal-content").innerHTML = `<div class="modal-title"><div><span class="eyebrow">AMEAÇA</span><h2>Criar ameaça</h2></div></div>
    <div class="modal-body monster-create-form">
      <div class="two-input"><label>Nome<input id="mc-nome" placeholder="Ex.: Bandido veterano"></label><label>ND<input id="mc-nd" placeholder="Ex.: 3"></label></div>
      <div class="two-input"><label>Tamanho<input id="mc-tamanho" value="Médio"></label><label>Tipo<input id="mc-tipo" placeholder="Ex.: Humanoide"></label></div>
      <div class="two-input"><label>PV<input id="mc-pv" type="number" value="10"></label><label>Defesa<input id="mc-defesa" type="number" value="12"></label></div>
      <label class="buff-field">Atributos
        <div class="buff-abilities">${db.atributos.map((a) => `<label>${a.nome}<input type="number" id="mc-${a.id}" value="0"></label>`).join("")}</div>
      </label>
      <label>Deslocamento<input id="mc-deslocamento" value="9m"></label>
      <label>Descrição<textarea id="mc-descricao" rows="3"></textarea></label>
      <div class="modal-actions"><button type="button" id="mc-cancel">Cancelar</button><button type="button" class="primary" id="mc-save">Criar</button></div>
    </div>`;
  $("modal").classList.remove("hidden");
  $("mc-cancel").addEventListener("click", () => $("modal").classList.add("hidden"));
  $("mc-save").addEventListener("click", () => {
    const nome = $("mc-nome").value.trim();
    if (!nome) { toast("Dê um nome pra ameaça."); return; }
    const m = {
      nome, custom: true, nd: $("mc-nd").value.trim() || "—", tamanho: $("mc-tamanho").value.trim(), tipo: $("mc-tipo").value.trim(),
      pv: Number($("mc-pv").value) || 1, defesa: Number($("mc-defesa").value) || 10, deslocamento: $("mc-deslocamento").value.trim(),
      atributos: Object.fromEntries(db.atributos.map((a) => [a.id, Number($(`mc-${a.id}`).value) || 0])),
      descricao: $("mc-descricao").value.trim(), fonte: "Criado no navegador",
    };
    addMonsterToRoster(m);
    $("modal").classList.add("hidden");
    renderMonsters();
  });
}

// ==============================================================
// Tema (skin) e idioma da casca do app, e menus agrupados no topo
// (Personagem/Arquivo/Ferramentas/Ajustes) — comportamento de abrir um
// por vez e fechar ao clicar fora/Escape/num item.
// ==============================================================
const SKIN_THEME_COLOR = { noite: "#101013", mesa: "#131417", papel: "#f2f2f0", pergaminho: "#e7ddc6" };
function applySkin(skin) {
  const v = storage.SKINS.includes(skin) ? skin : storage.SKIN_PADRAO;
  document.documentElement.setAttribute("data-skin", v);
  storage.saveSkin(v);
  const sel = $("skin-select");
  if (sel && sel.value !== v) sel.value = v;
  const meta = $("meta-theme-color");
  if (meta) meta.setAttribute("content", SKIN_THEME_COLOR[v] || SKIN_THEME_COLOR.noite);
}
function wireMenus() {
  const menus = [...document.querySelectorAll(".appbar .menu")];
  for (const m of menus) {
    m.addEventListener("toggle", () => { if (m.open) menus.forEach((o) => { if (o !== m) o.open = false; }); });
    m.querySelector(".menu-body")?.addEventListener("click", (e) => { if (e.target.closest("button")) m.open = false; });
  }
  document.addEventListener("click", (e) => { if (!e.target.closest(".appbar .menu")) menus.forEach((m) => { m.open = false; }); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") menus.forEach((m) => { m.open = false; }); });
}

// ==============================================================
// Eventos dos novos recursos (sala, discord, apoio, ajuda, novidades,
// aviso legal, relatar bug) — tudo isolado aqui pra não mexer em
// registrarEventos() já existente.
// ==============================================================
function registrarEventosSala() {
  $("modal-close")?.addEventListener("click", () => $("modal").classList.add("hidden"));
  $("modal")?.addEventListener("click", (e) => { if (e.target === $("modal")) $("modal").classList.add("hidden"); });

  $("btn-discord")?.addEventListener("click", renderDiscordSettings);
  $("btn-sala")?.addEventListener("click", renderRoomSettings);
  $("btn-ajuda")?.addEventListener("click", renderHelpModal);
  $("btn-novidades")?.addEventListener("click", renderUpdatesModal);
  $("btn-relatar-bug")?.addEventListener("click", () => {
    const url = "https://github.com/vangruver/ficha-tormenta20/issues/new?" + new URLSearchParams({
      labels: "bug",
      title: "",
      body: "**O que aconteceu?**\n\n\n**Como reproduzir?**\n\n\n**Navegador/dispositivo (ex.: Chrome no Android, Safari no iPhone):**\n",
    }).toString();
    window.open(url, "_blank", "noopener");
  });
  $("disclaimer-link")?.addEventListener("click", renderDisclaimerModal);
  $("support-btn")?.addEventListener("click", renderSupportModal);
  $("fan-disclaimer-dismiss")?.addEventListener("click", () => {
    storage.dismissDisclaimer();
    $("fan-disclaimer-banner")?.classList.add("hidden");
  });

  $("room-chat-fab")?.addEventListener("click", () => toggleRoomChat());
  $("room-chat-close")?.addEventListener("click", () => toggleRoomChat(false));
  $("room-chat-settings-btn")?.addEventListener("click", renderRoomSettings);
  document.querySelectorAll("#room-chat-tabs [data-roomtab]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#room-chat-tabs [data-roomtab]").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.dataset.roomtab; // "rolls" | "combat" | "music"
    $("room-chat-list").classList.toggle("hidden", tab !== "rolls");
    $("room-chat-compose").classList.toggle("hidden", tab !== "rolls");
    $("room-combat-panel").classList.toggle("hidden", tab !== "combat");
    $("room-music-panel").classList.toggle("hidden", tab !== "music");
    if (tab === "combat") renderCombatTracker();
    if (tab === "music") { renderMusicPanel(); syncMusicPlayer(); }
  }));
  $("room-chat-send-btn")?.addEventListener("click", sendRoomChatText);
  $("room-chat-text-input")?.addEventListener("keydown", (e) => { if (e.key === "Enter") sendRoomChatText(); });
  $("room-chat-text-input")?.addEventListener("paste", (e) => {
    const imgItem = Array.from(e.clipboardData?.items || []).find((it) => it.type?.startsWith("image/"));
    if (!imgItem) return;
    e.preventDefault();
    sendRoomChatImage(imgItem.getAsFile());
  });
  $("room-chat-image-btn")?.addEventListener("click", () => $("room-chat-image-input")?.click());
  $("room-chat-image-input")?.addEventListener("change", (e) => {
    const file = e.target.files[0]; e.target.value = "";
    sendRoomChatImage(file);
  });
  $("dice-roll-btn")?.addEventListener("click", () => rollExpression($("dice-expr-input").value.trim() || "1d20"));
  $("dice-expr-input")?.addEventListener("keydown", (e) => { if (e.key === "Enter") rollExpression(e.target.value.trim() || "1d20"); });
  document.querySelectorAll("[data-dice-quick]").forEach((b) => b.addEventListener("click", () => {
    $("dice-expr-input").value = `1d${b.dataset.diceQuick}`;
    rollExpression($("dice-expr-input").value);
  }));
}

// ==============================================================
// Eventos: menus agrupados, tema/idioma, dashboard recolhível,
// construção do personagem, modelos, personagem aleatório, link
// somente-leitura e Ambiente do Mestre.
// ==============================================================
function registrarEventosExtra() {
  wireMenus();

  $("skin-select")?.addEventListener("change", (e) => applySkin(e.target.value));
  $("skin-select") && ($("skin-select").value = storage.getSavedSkin());
  const langSel = $("lang-select");
  if (langSel) langSel.value = getLang();
  langSel?.addEventListener("change", (e) => { setLang(e.target.value); });

  if (storage.isDashboardCollapsed()) {
    $("dashboard")?.classList.add("collapsed");
    $("dashboard-toggle") && ($("dashboard-toggle").textContent = t("dashboard.expand"));
  }
  $("dashboard-toggle")?.addEventListener("click", () => {
    const collapsed = $("dashboard").classList.toggle("collapsed");
    $("dashboard-toggle").textContent = collapsed ? t("dashboard.expand") : t("dashboard.collapse");
    storage.setDashboardCollapsed(collapsed);
  });

  $("btn-pdf-topo")?.addEventListener("click", imprimirFicha);
  $("btn-preview-pdf")?.addEventListener("click", alternarPreviewImpressao);
  $("btn-dados")?.addEventListener("click", renderDiceRollerModal);
  $("btn-subir-nivel")?.addEventListener("click", subirDeNivel);

  // Construção
  document.querySelectorAll("#creation-mode-toggle [data-modo]").forEach((b) => b.addEventListener("click", () => setCreationMode(b.dataset.modo)));
  const filtroSup = $("filtro-suplementos");
  if (filtroSup) {
    filtroSup.checked = usaSuplementos();
    filtroSup.addEventListener("change", () => setUsaSuplementos(filtroSup.checked));
  }
  document.querySelectorAll(".change-choice[data-pick]").forEach((b) => b.addEventListener("click", () => openPickerModal(b.dataset.pick)));
  const CHOICE_TITULOS = { raca: "Raça", classe: "Classe", origem: "Origem", divindade: "Divindade" };
  document.querySelectorAll(".tiny-info[data-info]").forEach((b) => b.addEventListener("click", () => abrirDetalheTexto(CHOICE_TITULOS[b.dataset.info] || b.dataset.info, CHOICE_INFO[b.dataset.info])));
  $("wizard-back")?.addEventListener("click", wizardVoltar);
  $("wizard-next")?.addEventListener("click", wizardProximo);

  // Personagem/Arquivo
  $("btn-templates")?.addEventListener("click", openTemplatesModal);
  $("btn-gerador")?.addEventListener("click", abrirGeradorModal);
  $("btn-aleatorio")?.addEventListener("click", () => { if (confirm("Sortear um novo personagem? Isso substitui as escolhas do personagem atualmente aberto.")) gerarPersonagemAleatorio(); });
  $("btn-link-leitura")?.addEventListener("click", async () => {
    try {
      const url = await buildShareUrl();
      await navigator.clipboard.writeText(url);
      toast("Link somente-leitura copiado!");
    } catch (err) {
      console.error(err);
      toast("Não deu pra gerar o link — seu navegador pode não suportar compressão nativa.");
    }
  });
  $("view-only-copy")?.addEventListener("click", () => {
    storage.setPersonagemAtivoId(null);
    personagem.id = crypto.randomUUID();
    storage.salvarPersonagem(personagem);
    storage.setPersonagemAtivoId(personagem.id);
    location.hash = "";
    location.reload();
  });

  // Ambiente do Mestre
  $("btn-mestre")?.addEventListener("click", () => {
    document.querySelector("main.ficha-shell")?.classList.add("hidden");
    $("mestre-shell")?.classList.remove("hidden");
    renderMonsters();
  });
  $("mestre-sair")?.addEventListener("click", () => {
    $("mestre-shell")?.classList.add("hidden");
    document.querySelector("main.ficha-shell")?.classList.remove("hidden");
  });
  document.querySelectorAll("#monster-view-tabs [data-monview]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#monster-view-tabs [data-monview]").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    monsterState.view = b.dataset.monview;
    renderMonsters();
  }));
  $("monster-search")?.addEventListener("input", () => { if (monsterState.view === "browse") renderMonsters(); });
  $("monster-fonte")?.addEventListener("change", () => { if (monsterState.view === "browse") renderMonsters(); });
  $("monster-add-all-fonte")?.addEventListener("click", addAllFilteredMonstersToActiveList);
  $("monster-create-btn")?.addEventListener("click", openMonsterCreateModal);
  $("monster-list-select")?.addEventListener("change", () => {
    monsterState.listId = $("monster-list-select").value;
    storage.setActiveMonsterListId(monsterState.listId);
    renderMonsters();
  });
  $("monster-list-new")?.addEventListener("click", () => openMonsterListNameModal("new"));
  $("monster-list-rename")?.addEventListener("click", () => openMonsterListNameModal("rename"));
  $("monster-list-delete")?.addEventListener("click", deleteActiveMonsterList);
}

function rolarDado(lados, bonus, rotulo, opts = {}) {
  const bruto = regras.rollDie(lados);
  const total = bruto + bonus;
  const critico = bruto === lados ? " 🎉 CRÍTICO!" : bruto === 1 ? " 💥 falha crítica" : "";
  const detalhe = `d${lados} (${bruto}) ${formatarMod(bonus)}${critico}`;
  toast(`${rotulo}: ${detalhe} = ${total}`);
  registrarNoHistorico(rotulo, detalhe, total);
  broadcastRoll(rotulo, detalhe, total, opts);
  return total;
}

iniciar();
