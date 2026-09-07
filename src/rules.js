// Fórmulas do sistema Tormenta 20 (Jogo Básico).
//
// As fórmulas abaixo seguem o livro básico:
//   • Perícia   = metade do nível (arred. baixo) + mod. do atributo-chave
//                 + bônus de treino (+2; +4 no 7º nível; +6 no 15º)
//                 + outros − penalidade de armadura.
//   • PV        = (PV inicial + mod. Con) + (PV por nível + mod. Con) × (nível − 1).
//   • PM        = PM inicial + PM por nível × (nível − 1). PM NÃO soma atributo.
//   • Defesa    = 10 + mod. Des + armadura + escudo + outros.
//   • Poderes   = um poder de classe no 2º nível e a cada nível seguinte.

// Em Tormenta 20 o valor do atributo JÁ É o modificador: um personagem tem
// "Força 2", não "Força 14". Não existe a conversão (valor − 10) ÷ 2 do d20.
// A função continua existindo (e é usada em toda a ficha) só para deixar
// explícito, em cada conta, que ali entra o modificador.
export function mod(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

// Conversão de fichas/estatísticas antigas escritas na escala d20 (3–20) para
// a escala de T20. Usada na migração de personagens salvos e para mostrar o
// modificador equivalente das ameaças do compêndio, que vieram em escala d20.
export function modDeEscalaD20(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.floor((n - 10) / 2) : 0;
}

// Compra de atributos do livro básico: todos começam em 0, você tem 10 pontos,
// e pode baixar um atributo para −1 para ganhar 1 ponto extra.
export const PONTOS_ATRIBUTOS = 10;
export const CUSTO_ATRIBUTO = { "-1": -1, 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 };
export function custoDoAtributo(valor) {
  const n = Math.round(Number(valor) || 0);
  if (CUSTO_ATRIBUTO[n] !== undefined) return CUSTO_ATRIBUTO[n];
  // Acima de +4 a tabela não vai: cada ponto extra custa 4 (extrapolação, e a
  // ficha nunca impede — o número é só um guia de criação).
  return n > 4 ? CUSTO_ATRIBUTO[4] + (n - 4) * 4 : n;
}
export function custoTotalAtributos(atributos) {
  return Object.values(atributos || {}).reduce((soma, v) => soma + custoDoAtributo(v), 0);
}

export function fmt(n) { n = Number(n || 0); return n >= 0 ? `+${n}` : `${n}`; }

export function rollDie(lados) { return 1 + Math.floor(Math.random() * Math.max(1, Number(lados) || 6)); }
export function rollDice(n, lados) {
  n = Math.max(1, Number(n) || 1);
  const rolls = Array.from({ length: n }, () => rollDie(lados));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}
// Expressão tipo "2d6+3" → { n, faces, bonus }.
export function parseDiceExpr(expr) {
  const m = String(expr || "").match(/(\d*)d(\d+)\s*([+-]\s*\d+)?/i);
  if (!m) return null;
  return { n: Number(m[1] || 1), faces: Number(m[2]), bonus: m[3] ? Number(m[3].replace(/\s+/g, "")) : 0 };
}

// Metade do nível (arredondada para baixo) — entra em TODO teste de perícia,
// treinada ou não.
export function metadeNivel(nivel) { return Math.floor(Math.max(1, Number(nivel) || 1) / 2); }

// Bônus de treino: +2 do 1º ao 6º nível, +4 do 7º ao 14º, +6 a partir do 15º.
export function bonusTreino(nivel, treinado) {
  if (!treinado) return 0;
  const n = Math.max(1, Number(nivel) || 1);
  if (n >= 15) return 6;
  if (n >= 7) return 4;
  return 2;
}

export function bonusPericia({ nivel, treinado, modAtributo, outros = 0, penalidadeArmadura = 0 }) {
  return metadeNivel(nivel) + bonusTreino(nivel, treinado) + (modAtributo || 0) + (outros || 0) - (penalidadeArmadura || 0);
}

export function pvMaximo({ classe, nivel, modCon, extraNivel1 = 0, extraPorNivel = 0, extra = 0 }) {
  if (!classe) return null;
  const n = Math.max(1, Number(nivel) || 1);
  const inicial = (classe.pvInicial ?? 0) + modCon + extraNivel1;
  const porNivel = (classe.pvPorNivel ?? 0) + modCon + extraPorNivel;
  return Math.max(1, inicial + porNivel * (n - 1) + extra);
}

// PM em T20 é um valor fixo por classe/nível — nenhum atributo entra na conta.
// Traços raciais (Sangue Mágico do elfo, por exemplo) entram por extraPorNivel.
export function pmMaximo({ classe, nivel, extraPorNivel = 0, extra = 0 }) {
  if (!classe) return extra;
  const n = Math.max(1, Number(nivel) || 1);
  const inicial = (classe.pmInicial ?? 0) + extraPorNivel;
  const porNivel = (classe.pmPorNivel ?? 0) + extraPorNivel;
  return Math.max(0, inicial + porNivel * (n - 1) + extra);
}

export function defesaTotal({ modDes, armadura = 0, escudo = 0, outros = 0, temp = 0, limiteDesArmadura = null }) {
  const des = limiteDesArmadura !== null ? Math.min(modDes, limiteDesArmadura) : modDes;
  return 10 + des + armadura + escudo + outros + temp;
}

// Carga máxima em espaços/quilos suportados sem penalidade.
export function cargaMaxima(modFor) {
  const base = [1, 3, 6, 10, 15, 20, 25, 30, 40, 50];
  const f = Math.max(-5, Math.min(4, modFor));
  const idx = f + 5;
  return base[idx] ?? 50 + (f - 4) * 10;
}

// Perícias treinadas iniciais: as fixas da classe + as escolhidas na lista da
// classe (número da classe + mod. Inteligência) + as 2 da origem + as raciais.
export function escolhasDePericiaDaClasse({ classe, modInt }) {
  if (!classe) return 0;
  return Math.max(0, (classe.treinosIniciais ?? 2) + (modInt || 0));
}

// Poderes de classe: um no 2º nível e um a cada nível seguinte.
export function poderesDeClassePorNivel(nivel) {
  return Math.max(0, (Math.max(1, Number(nivel) || 1)) - 1);
}

// "PV alto/médio/baixo" para a barra colorida do dashboard.
export function faixaPV(atual, maximo) {
  if (!maximo) return "ok";
  const p = atual / maximo;
  if (p <= 0) return "morto";
  if (p <= 0.25) return "critico";
  if (p <= 0.5) return "ferido";
  return "ok";
}

export const CIRCULOS_MAGIA = ["1", "2", "3", "4", "5"];

// Escudos não vêm com bônus de Defesa no compêndio (eles estão catalogados
// como armas); os valores do livro básico ficam aqui.
export const BONUS_ESCUDO = { "escudo leve": 1, "escudo pesado": 2 };

// Lê "Armadura Leve/Pesada", "+X Defesa" e "-Y Penalidade de Armadura" do texto
// descritivo dos itens do compêndio, que é onde esses números vivem.
export function lerArmadura(item) {
  const txt = `${item?.nome || ""}\n${item?.descricao || ""}`;
  const escudo = BONUS_ESCUDO[String(item?.nome || "").trim().toLowerCase()];
  if (escudo) return { tipo: "escudo", defesa: escudo, penalidade: 0 };
  if (!/armadura\s+(leve|pesada)/i.test(txt)) return null;
  const def = txt.match(/\+\s*(\d+)\s*Defesa/i);
  const pen = txt.match(/[-–—]\s*(\d+)\s*Penalidade/i);
  return {
    tipo: /armadura\s+pesada/i.test(txt) ? "armadura pesada" : "armadura leve",
    defesa: def ? Number(def[1]) : 0,
    penalidade: pen ? Number(pen[1]) : 0,
  };
}

// ==============================================================
// Geração de atributos — os quatro métodos que a ficha oferece.
//
//   compra   — os 10 pontos do livro básico (tabela CUSTO_ATRIBUTO acima).
//   arranjo  — conjuntos prontos que já fecham o orçamento de compra, pra
//              quem não quer distribuir ponto a ponto.
//   rolagem  — 4d6 descartando o menor, seis vezes. O resultado sai na
//              escala d20 (3–18) e é convertido pra escala de T20 por
//              modDeEscalaD20() — que é a mesma regra de conversão que o
//              livro usa pra ler estatísticas do d20.
//   livre    — sem orçamento nem sorteio; digita o que quiser.
// ==============================================================
export const MODOS_ATRIBUTO = ["compra", "arranjo", "rolagem", "livre"];

// Arranjos prontos, todos dentro (ou abaixo) dos 10 pontos de compra.
export const ARRANJOS_PADRAO = [
  { id: "equilibrado", nome: "Equilibrado", valores: [3, 2, 2, 1, 0, 0] },
  { id: "especialista", nome: "Especialista", valores: [4, 2, 1, 1, 0, -1] },
  { id: "duplo", nome: "Dois picos", valores: [3, 3, 1, 1, 0, -1] },
  { id: "generalista", nome: "Generalista", valores: [2, 2, 2, 2, 1, -1] },
];

// 4d6 descartando o menor: devolve os quatro dados, os três somados e o
// valor já convertido pra escala de T20.
export function rolar4d6MenorDescartado() {
  const dados = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)];
  const ordenados = dados.slice().sort((a, b) => a - b);
  const descartado = ordenados[0];
  const usados = ordenados.slice(1);
  const totalD20 = usados.reduce((a, b) => a + b, 0);
  return { dados, descartado, usados, totalD20, valorT20: modDeEscalaD20(totalD20) };
}

// Seis rolagens de uma vez — a piscina que o jogador distribui pelos seis
// atributos. Ordenada do maior pro menor só pra facilitar a leitura.
export function rolarPiscinaDeAtributos() {
  return Array.from({ length: 6 }, () => rolar4d6MenorDescartado())
    .sort((a, b) => b.totalD20 - a.totalD20);
}

// ==============================================================
// Magia — círculo máximo por nível e gasto de PM.
//
// Em Tormenta 20 não existe "espaço de magia" do d20: toda magia é paga
// em PM (1/3/6/10/15 PM do 1º ao 5º círculo, valor que vem do próprio
// compêndio). O que o nível limita é o CÍRCULO que o conjurador alcança:
// 1º círculo no 1º nível e um círculo novo a cada quatro níveis (5º, 9º,
// 13º e 17º).
// ==============================================================
export function circuloMaximo(nivel) {
  const n = Math.max(1, Number(nivel) || 1);
  return Math.max(1, Math.min(5, Math.floor((n + 3) / 4)));
}

// Nível mínimo em que um conjurador alcança determinado círculo — o inverso
// da conta acima, usado nas mensagens ("o 3º círculo chega no 9º nível").
export function nivelDoCirculo(circulo) {
  const c = Math.max(1, Math.min(5, Number(circulo) || 1));
  return (c - 1) * 4 + 1;
}

// Custo padrão do círculo, usado quando o registro do compêndio não traz
// `custo` (acontece em uma magia solta).
export const CUSTO_POR_CIRCULO = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };
export function custoDaMagia(magia) {
  const c = Number(magia?.custo);
  if (Number.isFinite(c) && c > 0) return c;
  return CUSTO_POR_CIRCULO[Number(magia?.circulo)] ?? 1;
}

// ==============================================================
// Multiclasse.
//
// Em Tormenta 20 o personagem tem um nível TOTAL, repartido entre classes.
// Só a classe inicial dá os PV/PM "iniciais" (o pacote cheio do 1º nível);
// cada nível seguinte — na classe original ou numa nova — soma os valores
// "por nível" da classe em que o nível foi ganho. A classe nova também
// concede as perícias treinadas dela, mas o livro reduz a lista: só as
// fixas, não as escolhas livres do 1º nível.
//
// `classesDoPersonagem` chega como:
//   [{ classe, niveis }, ...]  — o primeiro item é a classe inicial.
// ==============================================================

// Distribui o nível total entre as classes, garantindo pelo menos 1 na
// inicial e nunca passando do total.
export function niveisPorClasse(entradas, nivelTotal) {
  const total = Math.max(1, Number(nivelTotal) || 1);
  const lista = (entradas || []).filter((x) => x && x.classe);
  if (!lista.length) return [];
  const extras = lista.slice(1).map((x) => ({ ...x, niveis: Math.max(1, Number(x.niveis) || 1) }));
  // Os níveis das classes extras não podem somar mais que total − 1.
  let disponivel = total - 1;
  const usados = [];
  for (const x of extras) {
    const n = Math.max(0, Math.min(x.niveis, disponivel));
    if (n > 0) { usados.push({ ...x, niveis: n }); disponivel -= n; }
  }
  return [{ ...lista[0], niveis: total - usados.reduce((a, b) => a + b.niveis, 0) }, ...usados];
}

export function pvMaximoMulticlasse({ classes, nivel, modCon, extraNivel1 = 0, extraPorNivel = 0, extra = 0 }) {
  const dist = niveisPorClasse(classes, nivel);
  if (!dist.length) return null;
  const [inicial, ...outras] = dist;
  // 1º nível: pacote inicial da classe de origem.
  let pv = (inicial.classe.pvInicial ?? 0) + modCon + extraNivel1;
  // Demais níveis da classe inicial.
  pv += ((inicial.classe.pvPorNivel ?? 0) + modCon + extraPorNivel) * Math.max(0, inicial.niveis - 1);
  // Níveis ganhos em outras classes.
  for (const o of outras) pv += ((o.classe.pvPorNivel ?? 0) + modCon + extraPorNivel) * o.niveis;
  return Math.max(1, pv + extra);
}

export function pmMaximoMulticlasse({ classes, nivel, extraPorNivel = 0, extra = 0 }) {
  const dist = niveisPorClasse(classes, nivel);
  if (!dist.length) return extra;
  const [inicial, ...outras] = dist;
  let pm = (inicial.classe.pmInicial ?? 0) + extraPorNivel;
  pm += ((inicial.classe.pmPorNivel ?? 0) + extraPorNivel) * Math.max(0, inicial.niveis - 1);
  for (const o of outras) pm += ((o.classe.pmPorNivel ?? 0) + extraPorNivel) * o.niveis;
  return Math.max(0, pm + extra);
}
