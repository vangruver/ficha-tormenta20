import { carregarBanco, porId, poderesDe, poderesDaClasse, poderesDaRaca, poderesDaOrigem, poderesGerais, magiasFiltradas, equipamentosFiltrados, ameacasFiltradas, panteaoFiltrado } from "./database.js";
import * as regras from "./rules.js";
import * as storage from "./storage.js";

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
  db = await carregarBanco();
  preencherDivindades();
  preencherSelectsEstáticos();

  const ativoId = storage.getPersonagemAtivoId();
  personagem = (ativoId && storage.carregarPersonagem(ativoId)) || storage.listarPersonagens()[0] || storage.novoPersonagem();
  storage.setPersonagemAtivoId(personagem.id);
  storage.salvarPersonagem(personagem);

  renderizarTudo();
  verificarAtualizacaoDados();
  registrarEventos();
  registrarServiceWorker();
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

  const c = classeAtual();
  const classeInfo = document.getElementById("classeInfo");
  classeInfo.innerHTML = c
    ? `<summary>Habilidades iniciais de ${c.nome}</summary><p>${c.iniciais}</p><p><em>Atributo-chave: ${c.atributoChave.toUpperCase()} · Conjuração: ${c.conjuracao ?? "nenhuma"}</em></p>`
    : "";
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
  abrirDetalheTexto(a.nome, `<em>ND ${a.nd} · ${a.tamanho} · ${a.tipo}</em><br>
    PV ${a.pv ?? "?"} · Defesa ${a.defesa ?? "?"} · Deslocamento ${a.deslocamento || "-"}<br>
    ${atrs}<br>${a.resistencias ? `<br>Resistências: ${a.resistencias}` : ""}<br><br>${a.descricao || ""}`);
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
    rolarDado(20, bonus, `${p.nome}`);
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
      rolarDado(20, bonus, `Ataque: ${at.nome || p.nome}`);
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

function rolarDado(lados, bonus, rotulo) {
  const bruto = 1 + Math.floor(Math.random() * lados);
  const total = bruto + bonus;
  const critico = bruto === lados ? " 🎉 CRÍTICO!" : bruto === 1 ? " 💥 falha crítica" : "";
  alert(`${rotulo}: d${lados} (${bruto}) ${formatarMod(bonus)} = ${total}${critico}`);
}

iniciar();
