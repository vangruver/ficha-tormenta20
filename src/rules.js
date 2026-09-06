// Fórmulas do sistema Tormenta 20 (Jogo Básico).
// Números de progressão de classe (PV/PM) são estimativas revisadas manualmente — ver README.

export function mod(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 0;
  return Math.floor((valor - 10) / 2);
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

// Bônus de treino de perícia: metade do nível (arred. p/ cima) + 2, mínimo +2, só se treinado.
export function bonusTreino(nivel, treinado) {
  if (!treinado) return 0;
  const n = Math.max(1, nivel || 1);
  return Math.ceil(n / 2) + 2;
}

export function bonusPericia({ nivel, treinado, modAtributo, outros = 0, penalidadeArmadura = 0 }) {
  return bonusTreino(nivel, treinado) + (modAtributo || 0) + (outros || 0) - (penalidadeArmadura || 0);
}

export function pvMaximo({ classe, nivel, modCon, extra = 0 }) {
  if (!classe) return null;
  const n = Math.max(1, nivel || 1);
  const inicial = (classe.pvInicial ?? 0) + modCon;
  const porNivel = (classe.pvPorNivel ?? 0) + modCon;
  return Math.max(1, inicial + porNivel * (n - 1) + extra);
}

export function pmMaximo({ classe, nivel, atributos, extra = 0 }) {
  if (!classe || !classe.pmAtributo) return extra;
  const n = Math.max(1, nivel || 1);
  const modChave = mod(atributos?.[classe.pmAtributo]);
  const inicial = (classe.pmInicial ?? 0) + modChave;
  const porNivel = (classe.pmPorNivel ?? 0) + modChave;
  return Math.max(0, inicial + porNivel * (n - 1) + extra);
}

export function defesaTotal({ modDes, armadura = 0, escudo = 0, outros = 0, temp = 0, limiteDesArmadura = null }) {
  const des = limiteDesArmadura !== null ? Math.min(modDes, limiteDesArmadura) : modDes;
  return 10 + des + armadura + escudo + outros + temp;
}

export function iniciativa({ modDes, outros = 0 }) {
  return modDes + outros;
}

// Deslocamento reduzido pela carga (regra simplificada de "carga máxima").
export function cargaMaxima(modFor) {
  const base = [1, 3, 6, 10, 15, 20, 25, 30, 40, 50];
  const f = Math.max(-5, Math.min(4, modFor));
  const idx = f + 5;
  return base[idx] ?? 50 + (f - 4) * 10;
}

export function treinosIniciaisTotal({ classe, modInt }) {
  if (!classe) return 0;
  return Math.max(1, (classe.treinosIniciais ?? 2) + modInt);
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

export const NIVEIS_ATRIBUTO = [1, 4, 8, 12, 16, 19]; // níveis em que T20 concede pontos de atributo (regra da "melhoria de atributo")
