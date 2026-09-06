import { carregarBanco, porId, poderesDe, poderesDaClasse, poderesDaRaca, poderesDaOrigem, poderesGerais, magiasFiltradas, equipamentosFiltrados, ameacasFiltradas, panteaoFiltrado } from "./database.js";
import * as regras from "./rules.js";
import * as storage from "./storage.js";
import { applyI18n, setLang, getLang, t } from "./i18n.js";

const CONDICOES = [
  { id: "abalado", nome: "Abalado", efeito: "-2 em testes de perícia, de resistência e de ataque." },
  { id: "acuado", nome: "Acuado", efeito: "Não pode atacar corpo a corpo, apenas se defender ou fugir." },
  { id: "alquebrado", nome: "Alquebrado", efeito: "-5 em testes de perícia, resistência e ataque; sofre o dobro de dano crítico." },
  { id: "apavorado", nome: "Apavorado", efeito: "Deve fugir da fonte do medo por 1d4 rodadas." },
  { id: "atordoado", nome: "Atordoado", efeito: "Perde a ação padrão e de movimento; -2 na Defesa." },
  { id: "caido", nome: "Caído", efeito: "-2 de ataque corpo a corpo, +2 de ataque à distância contra o alvo caído." },
  { id: "cego", nome: "Cego", efeito: "-5 em testes de Luta/Pontaria e Percepção baseada em visão; 50% de falha em ataques." },
  { id: "confuso", nome: "Confuso", efeito: "Ação determinada aleatoriamente pelo mestre." },
  { id: "desprevenido", nome: "Desprevenido", efeito: "Sofre ataque furtivo e -2 na Defesa contra o atacante." },
  { id: "enjoado", nome: "Enjoado", efeito: "Só pode realizar uma ação padrão ou de movimento por rodada." },
  { id: "envenenado", nome: "Envenenado", efeito: "Sofre os efeitos do veneno aplicado (dano ou penalidades)." },
  { id: "fatigado", nome: "Fatigado", efeito: "-2 em For e Des; não pode correr nem investir." },
  { id: "exausto", nome: "Exausto", efeito: "-6 em For e Des; desloca-se à metade." },
  { id: "imóvel", nome: "Imóvel", efeito: "Não pode se mover, mas pode agir normalmente." },
  { id: "indefeso", nome: "Indefeso", efeito: "Defesa 5; sofre ataque furtivo." },
  { id: "inconsciente", nome: "Inconsciente", efeito: "Indefeso e incapaz de agir." },
  { id: "ofuscado", nome: "Ofuscado", efeito: "-2 em testes de Luta/Pontaria e Percepção baseada em visão." },
  { id: "paralisado", nome: "Paralisado", efeito: "Não pode agir nem se mover; Destreza tratada como 0." },
  { id: "petrificado", nome: "Petrificado", efeito: "Transformado em pedra; indefeso e inconsciente dos sentidos." },
  { id: "sangrando", nome: "Sangrando", efeito: "Perde 5 PV no início de cada turno até ser curado ou estabilizado." },
  { id: "surdo", nome: "Surdo", efeito: "-4 em Percepção e testes de iniciativa baseados em audição." },
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
  origem.innerHTML = '<option value="">— escolha —</option>' + db.origens.map((o) => `<option value="${o.id}">${o.id}</option>`).join("");

  const condSel = document.getElementById("condicao-select");
  condSel.innerHTML = CONDICOES.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");

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

function bonusRacial(atributoId) {
  const r = racaAtual();
  const v = r?.atributos?.[atributoId];
  return typeof v === "number" ? v : 0;
}

function atributoFinal(id) {
  const base = personagem.atributos[id] ?? 10;
  const temp = personagem.atributosTemp?.[id] ?? 0;
  return base + bonusRacial(id) + temp;
}

function atributosFinais() {
  const out = {};
  for (const a of db.atributos) out[a.id] = atributoFinal(a.id);
  return out;
}

function calcularDerivados() {
  const classe = classeAtual();
  const atrs = atributosFinais();
  const nivel = personagem.nivel || 1;

  const pvMax = classe ? regras.pvMaximo({ classe, nivel, modCon: regras.mod(atrs.con) }) : null;
  const pmMax = classe ? regras.pmMaximo({ classe, nivel, atributos: atrs }) : 0;
  const defesa = regras.defesaTotal({ modDes: regras.mod(atrs.des), outros: personagem.defesaOutros || 0 });
  const iniciativa = regras.iniciativa({ modDes: regras.mod(atrs.des) });
  const cargaMax = regras.cargaMaxima(regras.mod(atrs.for));

  return { classe, atrs, nivel, pvMax, pmMax, defesa, iniciativa, cargaMax };
}

// ---------- Render geral ----------

function renderizarTudo() {
  renderIdentidade();
  renderConstrucao();
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

function renderAtributos() {
  const cont = document.getElementById("atributos");
  cont.innerHTML = db.atributos.map((a) => {
    const final = atributoFinal(a.id);
    const b = bonusRacial(a.id);
    return `
      <div class="atributo-caixa">
        <label>${a.nome}</label>
        <input type="number" data-atributo="${a.id}" value="${personagem.atributos[a.id] ?? 10}" />
        <div class="mod">${formatarMod(regras.mod(final))}</div>
        <div class="dica">final ${final}${b ? ` (${b > 0 ? "+" : ""}${b} racial)` : ""}</div>
      </div>`;
  }).join("");
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
  document.getElementById("dash-defesa").textContent = d.defesa;
  document.getElementById("dash-iniciativa").textContent = formatarMod(d.iniciativa);
  document.getElementById("dash-deslocamento").textContent = (racaAtual()?.deslocamento || "9m") + (personagem.deslocamentoExtra ? ` (${personagem.deslocamentoExtra})` : "");
  document.getElementById("carga-max").textContent = `${d.cargaMax} kg`;

  const barra = document.getElementById("barra-pv");
  const faixa = regras.faixaPV(personagem.pv.atual ?? 0, d.pvMax || 1);
  const pct = d.pvMax ? Math.max(0, Math.min(100, ((personagem.pv.atual ?? 0) / d.pvMax) * 100)) : 0;
  barra.style.width = `${pct}%`;
  barra.className = `dash-barra-fill ${faixa}`;
}

// ---------- Perícias ----------

function renderPericias() {
  const d = calcularDerivados();
  const tbody = document.getElementById("lista-pericias");
  tbody.innerHTML = db.pericias.map((p) => {
    const treinado = personagem.periciasTreinadas.includes(p.id);
    const outros = personagem.periciasOutros?.[p.id] ?? 0;
    const bonus = regras.bonusPericia({
      nivel: d.nivel, treinado, modAtributo: regras.mod(d.atrs[p.atributo]),
      outros, penalidadeArmadura: 0,
    });
    return `
      <tr class="${treinado ? "treinada" : ""}">
        <td><input type="checkbox" data-pericia-treino="${p.id}" ${treinado ? "checked" : ""} /></td>
        <td>${p.nome}${p.somenteTreinado ? ' <span class="tag">só treinado</span>' : ""}${p.salvamento ? ' <span class="tag">resistência</span>' : ""}</td>
        <td>${p.atributo.toUpperCase()}</td>
        <td><strong>${formatarMod(bonus)}</strong>
          <input type="number" class="mod-outros" data-pericia-outros="${p.id}" value="${outros}" title="Outros modificadores" style="width:3.5em" />
        </td>
        <td><button class="secundario" data-rolar-pericia="${p.id}">🎲</button></td>
      </tr>`;
  }).join("");

  document.getElementById("treinos-usados").textContent = personagem.periciasTreinadas.length;
  const c = classeAtual();
  document.getElementById("treinos-sugeridos").textContent = c ? regras.treinosIniciaisTotal({ classe: c, modInt: regras.mod(d.atrs.int) }) : "-";
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

function renderPoderes() {
  const escolhidos = personagem.poderes;
  const listaEsc = document.getElementById("lista-poderes-personagem");
  listaEsc.innerHTML = escolhidos.map((id) => {
    const p = db.poderes.find((x) => x.id === id);
    if (!p) return "";
    return `<li data-abrir-poder="${p.id}"><span>${p.nome} <span class="tag">${p.subtipo}</span>${p.custo ? ` <span class="tag">${p.custo} PM</span>` : ""}</span><button class="perigo" data-remover-poder="${p.id}">Remover</button></li>`;
  }).join("") || "<li>Nenhum poder escolhido ainda.</li>";

  document.getElementById("poderes-escolhidos-n").textContent = escolhidos.length;
  document.getElementById("poderes-esperados").textContent = Math.max(0, (personagem.nivel || 1) - 1);

  renderCatalogoPoderes();
}

function renderCatalogoPoderes() {
  const categoria = document.getElementById("poderes-filtro-categoria").value;
  const busca = document.getElementById("poderes-busca").value;
  let lista = categoria || busca ? poderesDe(db, { categoria: categoria || undefined, busca: busca || undefined }) : poolPoderesDisponiveis();
  lista = lista.slice(0, 200);
  const catalogo = document.getElementById("lista-poderes-catalogo");
  catalogo.innerHTML = lista.map((p) => `
    <li data-abrir-poder="${p.id}">
      <span>${p.nome} <span class="tag">${p.subtipo}</span>${p.custo ? ` <span class="tag">${p.custo} PM</span>` : ""}</span>
      <button data-add-poder="${p.id}">${personagem.poderes.includes(p.id) ? "✓" : "➕"}</button>
    </li>`).join("");
}

// ---------- Magias ----------

function renderMagias() {
  const c = classeAtual();
  const semConjuracao = !c || !c.conjuracao;
  document.getElementById("magias-sem-conjuracao").hidden = !semConjuracao;
  document.getElementById("magias-conteudo").style.display = semConjuracao ? "none" : "";
  if (semConjuracao) return;

  const conhecidas = personagem.magias;
  const listaConh = document.getElementById("lista-magias-personagem");
  listaConh.innerHTML = conhecidas.map((id) => {
    const m = db.magias.find((x) => x.id === id);
    if (!m) return "";
    const preparada = personagem.magiasPreparadas.includes(id);
    return `<li data-abrir-magia="${m.id}"><span>${m.nome} <span class="tag">${m.circulo}º círc.</span> <span class="tag">${m.custo ?? "?"} PM</span></span>
      <span><button data-preparar-magia="${m.id}">${preparada ? "★ preparada" : "☆ preparar"}</button>
      <button class="perigo" data-remover-magia="${m.id}">Remover</button></span></li>`;
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
  catalogo.innerHTML = lista.map((m) => `
    <li data-abrir-magia="${m.id}">
      <span>${m.nome} <span class="tag">${m.tipo}</span> <span class="tag">${m.circulo}º círc.</span></span>
      <button data-add-magia="${m.id}">${personagem.magias.includes(m.id) ? "✓" : "➕"}</button>
    </li>`).join("");
}

// ---------- Combate ----------

function renderCombate() {
  const d = calcularDerivados();
  const resist = document.getElementById("lista-resistencias");
  resist.innerHTML = db.pericias.filter((p) => p.salvamento).map((p) => {
    const treinado = personagem.periciasTreinadas.includes(p.id);
    const bonus = regras.bonusPericia({ nivel: d.nivel, treinado, modAtributo: regras.mod(d.atrs[p.atributo]) });
    return `<div class="resistencia-caixa"><label>${p.nome}</label><div class="valor">${formatarMod(bonus)}</div></div>`;
  }).join("");

  const tbody = document.getElementById("lista-ataques");
  tbody.innerHTML = personagem.ataques.map((at, i) => {
    const periciaObj = db.pericias.find((p) => p.id === at.pericia);
    const treinado = personagem.periciasTreinadas.includes(at.pericia);
    const bonus = periciaObj ? regras.bonusPericia({ nivel: d.nivel, treinado, modAtributo: regras.mod(d.atrs[periciaObj.atributo]) }) : 0;
    return `<tr>
      <td><input data-ataque-campo="nome" data-ataque-idx="${i}" value="${at.nome || ""}" placeholder="Arma" /></td>
      <td><select data-ataque-campo="pericia" data-ataque-idx="${i}">
        <option value="lut" ${at.pericia === "lut" ? "selected" : ""}>Luta</option>
        <option value="pon" ${at.pericia === "pon" ? "selected" : ""}>Pontaria</option>
      </select></td>
      <td><input data-ataque-campo="dano" data-ataque-idx="${i}" value="${at.dano || ""}" placeholder="1d8+for" /></td>
      <td><input data-ataque-campo="critico" data-ataque-idx="${i}" value="${at.critico || "20/x2"}" /></td>
      <td><button data-rolar-ataque="${i}">🎲 ${formatarMod(bonus)}</button></td>
      <td><button class="perigo" data-remover-ataque="${i}">✕</button></td>
    </tr>`;
  }).join("");

  const listaCond = document.getElementById("lista-condicoes");
  listaCond.innerHTML = personagem.condicoes.map((cid, i) => {
    const c = CONDICOES.find((x) => x.id === cid);
    if (!c) return "";
    return `<li><strong>${c.nome}</strong> — ${c.efeito} <button class="perigo" data-remover-condicao="${i}">remover</button></li>`;
  }).join("") || "<li>Nenhuma condição ativa.</li>";
}

// ---------- Equipamentos ----------

function renderEquipamentos() {
  const tbody = document.getElementById("lista-inventario");
  tbody.innerHTML = personagem.equipamentos.map((item, i) => `
    <tr>
      <td>${item.nome}</td>
      <td><input type="number" min="1" data-inv-qtd="${i}" value="${item.qtd || 1}" style="width:4em" /></td>
      <td>${item.peso ?? "-"}</td>
      <td><button class="perigo" data-remover-item="${i}">✕</button></td>
    </tr>`).join("") || "";

  const tipo = document.getElementById("equip-filtro-tipo").value;
  const busca = document.getElementById("equip-busca").value;
  const catalogo = document.getElementById("lista-equip-catalogo");
  const lista = equipamentosFiltrados(db, { tipoItem: tipo || undefined, busca: busca || undefined }).slice(0, 200);
  catalogo.innerHTML = lista.map((e) => `
    <li data-abrir-equip="${e.id}">
      <span>${e.nome} ${e.dano ? `<span class="tag">${e.dano}</span>` : ""} ${e.peso ? `<span class="tag">${e.peso}kg</span>` : ""}</span>
      <button data-add-item="${e.id}">➕</button>
    </li>`).join("");
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
  const atrs = Object.entries(a.atributos).map(([k, v]) => `${k.toUpperCase()} ${v ?? "-"}`).join(" · ");
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
  document.getElementById("raca").addEventListener("change", (e) => { personagem.raca = e.target.value; salvarERenderizar(); });
  document.getElementById("classe").addEventListener("change", (e) => { personagem.classe = e.target.value; salvarERenderizar(); });
  document.getElementById("origem").addEventListener("change", (e) => { personagem.origem = e.target.value; salvarERenderizar(); });
  document.getElementById("divindade").addEventListener("change", (e) => { personagem.divindade = e.target.value; salvar(); });
  document.getElementById("biografia").addEventListener("input", (e) => { personagem.biografia = e.target.value; salvar(); });
  document.getElementById("aparencia").addEventListener("input", (e) => { personagem.aparencia = e.target.value; salvar(); });
  document.getElementById("nivel").addEventListener("input", (e) => { personagem.nivel = Math.max(1, Math.min(20, Number(e.target.value) || 1)); salvarERenderizar(); });

  for (const id of ["tt", "to", "tp", "tc"]) {
    document.getElementById(`dinheiro-${id}`).addEventListener("input", (e) => {
      personagem.dinheiro[id] = Number(e.target.value) || 0; salvar();
    });
  }

  // Atributos
  document.getElementById("atributos").addEventListener("input", (e) => {
    const id = e.target.dataset.atributo;
    if (!id) return;
    personagem.atributos[id] = Number(e.target.value) || 0;
    salvarERenderizar();
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
    const treinado = personagem.periciasTreinadas.includes(id);
    const bonus = regras.bonusPericia({ nivel: d.nivel, treinado, modAtributo: regras.mod(d.atrs[p.atributo]), outros: personagem.periciasOutros?.[id] ?? 0 });
    rolarDado(20, bonus, `${p.nome}`, { type: "outro" });
  });

  // Poderes
  document.getElementById("poderes-filtro-categoria").addEventListener("change", renderCatalogoPoderes);
  document.getElementById("poderes-busca").addEventListener("input", renderCatalogoPoderes);
  document.getElementById("lista-poderes-catalogo").addEventListener("click", (e) => {
    const add = e.target.dataset.addPoder;
    if (add) { if (!personagem.poderes.includes(add)) personagem.poderes.push(add); salvarERenderizar(); return; }
    const abrir = e.target.closest("[data-abrir-poder]")?.dataset.abrirPoder;
    if (abrir) abrirDetalhePoder(db.poderes.find((p) => p.id === abrir));
  });
  document.getElementById("lista-poderes-personagem").addEventListener("click", (e) => {
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
    const rolar = e.target.dataset.rolarAtaque;
    if (rolar !== undefined) {
      const d = calcularDerivados();
      const at = personagem.ataques[rolar];
      const p = db.pericias.find((x) => x.id === at.pericia);
      const treinado = personagem.periciasTreinadas.includes(at.pericia);
      const bonus = regras.bonusPericia({ nivel: d.nivel, treinado, modAtributo: regras.mod(d.atrs[p.atributo]) });
      rolarDado(20, bonus, `Ataque: ${at.nome || p.nome}`, { type: "ataque" });
    }
  });

  document.getElementById("btn-add-condicao").addEventListener("click", () => {
    personagem.condicoes.push(document.getElementById("condicao-select").value);
    salvarERenderizar();
  });
  document.getElementById("lista-condicoes").addEventListener("click", (e) => {
    const rem = e.target.dataset.removerCondicao;
    if (rem !== undefined) { personagem.condicoes.splice(Number(rem), 1); salvarERenderizar(); }
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
      else personagem.equipamentos.push({ id: item.id, nome: item.nome, peso: item.peso, qtd: 1 });
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
    if (rem !== undefined) { personagem.equipamentos.splice(Number(rem), 1); salvarERenderizar(); }
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

  document.getElementById("btn-pdf").addEventListener("click", () => window.print());

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
function rollExpression(expr, type) {
  const parsed = regras.parseDiceExpr(expr);
  if (!parsed || !parsed.faces) { toast("Expressão inválida. Use algo como 2d6+3, 1d20 ou d8."); return null; }
  const { n, faces, bonus } = parsed;
  const { rolls, total } = regras.rollDice(n, faces);
  const result = total + bonus;
  diceHistory.unshift({ n, faces, bonus, rolls, result });
  diceHistory = diceHistory.slice(0, 12);
  renderDiceHistory();
  const t = type || $("dice-roll-type")?.value || "outro";
  broadcastRoll(`${n}d${faces}${bonus ? regras.fmt(bonus) : ""}`, `[${rolls.join(", ")}]${bonus ? ` ${regras.fmt(bonus)}` : ""}`, result, { type: t, amount: (t === "cura" || t === "dano") ? result : null });
  return result;
}
function renderDiceHistory() {
  const box = $("dice-history");
  if (!box) return;
  box.innerHTML = diceHistory.length ? diceHistory.map((h) => `<div class="dice-history-row"><span class="dice-history-expr">${h.n}d${h.faces}${h.bonus ? regras.fmt(h.bonus) : ""}</span><span class="dice-history-rolls">[${h.rolls.join(", ")}]</span><b class="dice-history-total">${h.result}</b></div>`).join("")
    : `<div class="empty">Nenhuma rolagem ainda.</div>`;
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
      <h3>Abas</h3>
      <ul>
        <li><strong>Ficha</strong> — identidade, raça, classe, origem, divindade, atributos e biografia.</li>
        <li><strong>Perícias</strong> — todas as perícias com bônus calculado (treino + atributo + outros), com botão de rolagem (🎲) em cada uma.</li>
        <li><strong>Poderes</strong> — poderes escolhidos e catálogo filtrável por categoria (classe/racial/origem/geral/concedido).</li>
        <li><strong>Magias</strong> — só aparece pra classes conjuradoras; grimório/lista de magias conhecidas e catálogo por círculo.</li>
        <li><strong>Combate</strong> — testes de resistência, tabela de ataques (com rolagem) e condições ativas.</li>
        <li><strong>Equipamentos</strong> — inventário e catálogo de itens do compêndio.</li>
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
      <h3>🎲 Rolador de dados (dentro da Sala)</h3>
      <p>Digite uma expressão como "2d6+3" e role. O histórico é só da sessão atual. Marcar o tipo como <strong>Cura</strong> ou <strong>Dano</strong> antes de rolar habilita o botão de ajustar PV no chat da sala.</p>
      <h3>💛 Sobre ser gratuito</h3>
      <p>A ficha é 100% gratuita — conteúdo de fã, feito por fãs de Tormenta 20. Quem quiser apoiar pode clicar em "💛 Apoiar o projeto" no aviso do topo — isso é opcional e nunca destrava nada.</p>
    </div>`);
}

// ==============================================================
// Novidades — resumo das atualizações da ficha, mais recente primeiro.
// ==============================================================
const CHANGELOG = [
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
      <p>O conteúdo de regras exibido na ficha (raças, classes, poderes, magias, equipamentos, ameaças, panteão) é lido em tempo de execução, direto do navegador de quem usa, a partir do compêndio comunitário <a href="https://github.com/Kull4ck/tormenta20-compendium" target="_blank" rel="noopener">tormenta20-compendium</a> (Kull4ck) — <strong>nenhum arquivo de conteúdo oficial é copiado ou distribuído por este repositório</strong>, só o código da ficha em si.</p>
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
let wizardStepIndex = 0;
const WIZARD_STEPS = ["raca", "classe", "origem", "divindade"];

function nomePericia(id) { return db.pericias.find((p) => p.id === id)?.nome || id; }

function pickerOptionsFor(kind) {
  if (kind === "raca") return db.racas.map((r) => ({ id: r.id, nome: r.nome, meta: `${r.tamanho} · desloc. ${r.deslocamento}`, desc: r.traços }));
  if (kind === "classe") return db.classes.map((c) => ({ id: c.id, nome: c.nome, meta: `Atributo-chave ${c.atributoChave.toUpperCase()}${c.conjuracao ? ` · conjuração ${c.conjuracao}` : ""}`, desc: c.iniciais }));
  if (kind === "origem") return db.origens.map((o) => ({ id: o.id, nome: o.id, meta: "Origem", desc: `Perícias sugeridas: ${(o.periciasSugeridas || []).map(nomePericia).join(", ") || "—"}` }));
  if (kind === "divindade") return db.panteao.map((d) => ({ id: d.nome, nome: d.nome, meta: "Divindade", desc: (d.descricao || "").replace(/<[^>]+>/g, "").slice(0, 220) }));
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
  const feitas = ["raca", "classe"].filter((k) => valorAtualDoCampo(k)).length;
  $("auto-status").textContent = feitas === 2 ? "Construção completa" : `${feitas}/2 escolhas principais feitas`;
  $("auto-empty")?.classList.toggle("hidden", feitas > 0);
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

function wizardStepBodyHtml(kind) {
  const opts = pickerOptionsFor(kind);
  const atual = valorAtualDoCampo(kind);
  const titulos = { raca: "Escolha uma raça", classe: "Escolha uma classe", origem: "Escolha uma origem", divindade: "Escolha uma divindade (opcional)" };
  return `<p class="dica">${esc(titulos[kind])}</p>
    ${kind === "divindade" ? `<button type="button" class="change-choice" data-wiz-opt="" style="margin-bottom:8px">— Nenhuma —</button>` : ""}
    <div class="pick-list">${opts.map((o) => `
      <button type="button" class="pick-card${o.id === atual ? " selected" : ""}" data-wiz-opt="${esc(o.id)}">
        <b>${esc(o.nome)}</b><small>${esc(o.meta)}</small>
      </button>`).join("")}</div>`;
}
function renderWizard() {
  const kind = WIZARD_STEPS[wizardStepIndex];
  $("wizard-steps").innerHTML = WIZARD_STEPS.map((k, i) => {
    const done = !!valorAtualDoCampo(k);
    return `<span class="wizard-step-chip${i === wizardStepIndex ? " active" : ""}${done ? " done" : ""}">${i + 1}. ${k[0].toUpperCase()}${k.slice(1)}${done ? " ✓" : ""}</span>`;
  }).join("");
  $("wizard-body").innerHTML = wizardStepBodyHtml(kind);
  $("wizard-body").querySelectorAll("[data-wiz-opt]").forEach((b) => b.addEventListener("click", () => {
    definirCampo(kind, b.dataset.wizOpt);
    renderWizard();
  }));
  $("wizard-progress").textContent = `Passo ${wizardStepIndex + 1} de ${WIZARD_STEPS.length}`;
  $("wizard-back").disabled = wizardStepIndex === 0;
  $("wizard-next").textContent = wizardStepIndex === WIZARD_STEPS.length - 1 ? "Concluir ✓" : "Próximo →";
}
function avancarWizardSeSelecionado() {
  if (wizardStepIndex < WIZARD_STEPS.length - 1) { wizardStepIndex++; renderWizard(); }
}
function setCreationMode(mode) {
  creationMode = mode;
  document.querySelectorAll("#creation-mode-toggle [data-modo]").forEach((b) => b.classList.toggle("active", b.dataset.modo === mode));
  $("wizard").classList.toggle("hidden", mode !== "guiado");
  $("modo-livre-conteudo").classList.toggle("hidden", mode === "guiado");
  if (mode === "guiado") { wizardStepIndex = 0; renderWizard(); }
}

const CHOICE_INFO = {
  raca: "A raça define atributos, tamanho, deslocamento e traços iniciais do personagem.",
  classe: "A classe define PV/PM iniciais, perícias de classe, atributo-chave e se o personagem conjura magias.",
  origem: "A origem representa a vida do personagem antes da aventura — sugere perícias treinadas e concede um poder de origem.",
  divindade: "Divindade opcional — relevante sobretudo pra Clérigos e Paladinos, e pra perícia de Religião.",
};

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
// Personagem aleatório — sorteia raça, classe, origem, divindade e
// atributos (4d6, descarta o menor, seis vezes) pra um personagem
// pronto pra jogar.
// ==============================================================
const NOMES_ALEATORIOS = [
  "Aldrin", "Bran", "Cassia", "Doriel", "Elenwe", "Fenris", "Galadur", "Helvi", "Ithir", "Jarik",
  "Kaelen", "Liora", "Morwen", "Nerion", "Orwin", "Perah", "Quenna", "Rhandir", "Selune", "Torvald",
];
function rolarAtributoUnico() {
  const rolls = Array.from({ length: 4 }, () => regras.rollDie(6)).sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}
function gerarPersonagemAleatorio() {
  const raca = db.racas[Math.floor(Math.random() * db.racas.length)];
  const classe = db.classes[Math.floor(Math.random() * db.classes.length)];
  const origem = db.origens[Math.floor(Math.random() * db.origens.length)];
  const divindade = Math.random() < 0.5 ? db.panteao[Math.floor(Math.random() * db.panteao.length)] : null;
  personagem.nome = `${NOMES_ALEATORIOS[Math.floor(Math.random() * NOMES_ALEATORIOS.length)]} de ${raca.nome}`;
  personagem.raca = raca.id;
  personagem.classe = classe.id;
  personagem.origem = origem.id;
  personagem.divindade = divindade ? divindade.nome : "";
  for (const a of db.atributos) personagem.atributos[a.id] = rolarAtributoUnico();
  personagem.periciasTreinadas = (origem.periciasSugeridas || []).slice();
  salvarERenderizar();
  toast(`Personagem aleatório gerado: ${personagem.nome}.`);
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
  ["btn-personagens", "btn-novo", "btn-templates", "btn-aleatorio", "input-importar", "btn-link-leitura"].forEach((id) => { const el = $(id); if (el) el.disabled = true; });
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
const SKIN_THEME_COLOR = { pergaminho: "#7a1f1f", noite: "#2a1a12", papel: "#8e2a2a" };
function applySkin(skin) {
  const v = storage.SKINS.includes(skin) ? skin : "pergaminho";
  document.documentElement.setAttribute("data-skin", v);
  storage.saveSkin(v);
  const sel = $("skin-select");
  if (sel && sel.value !== v) sel.value = v;
  const meta = $("meta-theme-color");
  if (meta) meta.setAttribute("content", SKIN_THEME_COLOR[v]);
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

  $("btn-pdf-topo")?.addEventListener("click", () => window.print());

  // Construção
  document.querySelectorAll("#creation-mode-toggle [data-modo]").forEach((b) => b.addEventListener("click", () => setCreationMode(b.dataset.modo)));
  document.querySelectorAll(".change-choice[data-pick]").forEach((b) => b.addEventListener("click", () => openPickerModal(b.dataset.pick)));
  const CHOICE_TITULOS = { raca: "Raça", classe: "Classe", origem: "Origem", divindade: "Divindade" };
  document.querySelectorAll(".tiny-info[data-info]").forEach((b) => b.addEventListener("click", () => abrirDetalheTexto(CHOICE_TITULOS[b.dataset.info] || b.dataset.info, CHOICE_INFO[b.dataset.info])));
  $("wizard-back")?.addEventListener("click", () => { if (wizardStepIndex > 0) { wizardStepIndex--; renderWizard(); } });
  $("wizard-next")?.addEventListener("click", () => {
    if (wizardStepIndex < WIZARD_STEPS.length - 1) { wizardStepIndex++; renderWizard(); }
    else { setCreationMode("livre"); toast("Construção concluída — revise na aba Construção ou siga pra Ficha."); }
  });

  // Personagem/Arquivo
  $("btn-templates")?.addEventListener("click", openTemplatesModal);
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
  toast(`${rotulo}: d${lados} (${bruto}) ${formatarMod(bonus)} = ${total}${critico}`);
  broadcastRoll(rotulo, `d${lados} (${bruto}) ${formatarMod(bonus)}${critico}`, total, opts);
  return total;
}

iniciar();
