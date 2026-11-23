// Estrutura de dados, valores padrão e cálculos.
// Bolso Organizado: categorias de um orçamento doméstico comum e cálculos simples
// (sobra do mês e reserva de emergência).

export const STORAGE_KEY = 'bolso-organizado-v1';

// Entradas: person = 1 (você), 2 (outra pessoa) ou 0 (renda da casa)
export const DEFAULT_INCOMES = [
  { key: 'salario1', label: 'Salário líquido', person: 1 },
  { key: 'va1', label: 'Vale-alimentação', person: 1 },
  { key: 'vr1', label: 'Vale-refeição', person: 1 },
  { key: 'salario2', label: 'Salário líquido', person: 2 },
  { key: 'va2', label: 'Vale-alimentação', person: 2 },
  { key: 'vr2', label: 'Vale-refeição', person: 2 },
  { key: 'extra1', label: 'Renda extra 01', hint: 'Vendas, entregas…', person: 0 },
  { key: 'extra2', label: 'Renda extra 02', hint: 'Comissões, bônus…', person: 0 },
  { key: 'extra3', label: 'Renda extra 03', hint: 'Aluguel, aulas…', person: 0 },
];

// tone: dica neutra (info) ou alerta (warn)
export const DEFAULT_EXPENSES = [
  // ESSENCIAIS
  { key: 'moradia', group: 'ess', label: 'Moradia', hint: 'Aluguel/financiamento', icon: '🏠' },
  { key: 'condominio', group: 'ess', label: 'Condomínio', icon: '🏢' },
  { key: 'mercado', group: 'ess', label: 'Supermercado', hint: 'Valor médio', icon: '🛒' },
  { key: 'agua', group: 'ess', label: 'Água', hint: 'Incluso no condomínio?', icon: '🚿' },
  { key: 'luz', group: 'ess', label: 'Luz', hint: 'Incluso no condomínio?', icon: '💡' },
  { key: 'gas', group: 'ess', label: 'Gás', hint: 'Incluso no condomínio?', icon: '🔥' },
  { key: 'iptu', group: 'ess', label: 'IPTU', hint: 'Incluso no condomínio?', icon: '📄' },
  { key: 'saude', group: 'ess', label: 'Plano de saúde', hint: 'Incluso nos benefícios do trabalho?', icon: '🩺' },
  { key: 'seguro_vida', group: 'ess', label: 'Seguro de vida', hint: 'Incluso nos benefícios do trabalho?', icon: '🛡️' },
  { key: 'investimentos', group: 'ess', label: 'Investimentos', hint: 'Separe um valor fixo todo mês', tone: 'warn', icon: '📈' },
  { key: 'outras_ess1', group: 'ess', label: 'Outras despesas essenciais 01', icon: '➕' },
  { key: 'outras_ess2', group: 'ess', label: 'Outras despesas essenciais 02', icon: '➕' },
  // NÃO ESSENCIAIS
  { key: 'academia', group: 'nao', label: 'Academia/esportes', icon: '🏋️' },
  { key: 'apps', group: 'nao', label: 'Aplicativos, programas e assinaturas', icon: '📱' },
  { key: 'cartao', group: 'nao', label: 'Cartão de crédito', hint: 'Cuidado com o parcelamento', tone: 'warn', icon: '💳' },
  { key: 'celular', group: 'nao', label: 'Celular/telefonia', icon: '☎️' },
  { key: 'combustivel', group: 'nao', label: 'Combustível', icon: '⛽' },
  { key: 'emprestimos', group: 'nao', label: 'Empréstimos', hint: 'Quite primeiro os juros mais altos', tone: 'warn', icon: '🏦' },
  { key: 'educacao', group: 'nao', label: 'Escola/faculdade/cursos', icon: '🎓' },
  { key: 'farmacia', group: 'nao', label: 'Farmácia', icon: '💊' },
  { key: 'financ_veiculo', group: 'nao', label: 'Financiamento de veículos', hint: 'Carro ou moto', icon: '🚗' },
  { key: 'animais', group: 'nao', label: 'Gastos com animais', icon: '🐾' },
  { key: 'imprevistos', group: 'nao', label: 'Gastos imprevistos', hint: 'Valor médio', icon: '⚠️' },
  { key: 'transporte', group: 'nao', label: 'Transporte', hint: 'Ônibus, trem, aplicativo', icon: '🚌' },
  { key: 'internet', group: 'nao', label: 'Internet residencial', icon: '🌐' },
  { key: 'lazer', group: 'nao', label: 'Lazer', hint: 'Cinema, passeios, baladas…', icon: '🎬' },
  { key: 'streaming', group: 'nao', label: 'Plataformas de streaming', hint: 'Filmes, séries, música', icon: '📺' },
  { key: 'padaria', group: 'nao', label: 'Padaria/feira', icon: '🥖' },
  { key: 'restaurantes', group: 'nao', label: 'Restaurantes/delivery', icon: '🍔' },
  { key: 'salao', group: 'nao', label: 'Salão/manicure/depilação', icon: '💇' },
  { key: 'tarifas', group: 'nao', label: 'Tarifas bancárias', hint: 'Há contas sem tarifa', tone: 'warn', icon: '🧾' },
  { key: 'outras1', group: 'nao', label: 'Outras despesas 01', hint: 'IPVA, seguro…', icon: '➕' },
  { key: 'outras2', group: 'nao', label: 'Outras despesas 02', hint: 'Tratamentos médicos, psicólogo…', icon: '➕' },
];

export const GROUPS = {
  ess: { label: 'Essenciais', long: 'Despesas essenciais' },
  nao: { label: 'Não essenciais', long: 'Despesas não essenciais' },
};

let seq = 0;
export const uid = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthName(key, short = false) {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: short ? 'short' : 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(' de ', ' ');
}

export function blankMonth() {
  return {
    incomes: DEFAULT_INCOMES.map(i => ({ id: uid(), ...i, value: 0 })),
    expenses: DEFAULT_EXPENSES.map(e => ({ id: uid(), ...e, value: 0 })),
  };
}

export function cloneMonth(src) {
  return {
    incomes: src.incomes.map(i => ({ ...i, id: uid() })),
    expenses: src.expenses.map(e => ({ ...e, id: uid() })),
  };
}

export function defaultState() {
  const key = monthKey();
  return {
    version: 1,
    current: key,
    months: { [key]: blankMonth() },
    settings: {
      theme: 'auto',
      name1: '',
      name2: '',
      twoPeople: true,
      reserveMultiplier: 6,
      reserveSaved: 0,
      reserveMonthly: 0,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ----- dinheiro -----
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brl = v => fmt.format(Number.isFinite(v) ? v : 0);
export const num = v => fmtNum.format(Number.isFinite(v) ? v : 0);
export const pct = (v, digits = 0) => `${(Number.isFinite(v) ? v * 100 : 0).toFixed(digits).replace('.', ',')}%`;

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234", "1,5k" etc.
export function parseMoney(input) {
  if (typeof input === 'number') return input;
  let s = String(input ?? '').trim().toLowerCase().replace(/r\$|\s/g, '');
  if (!s) return 0;
  let mult = 1;
  if (s.endsWith('k')) { mult = 1000; s = s.slice(0, -1); }
  const neg = s.startsWith('-');
  s = s.replace(/[^0-9.,]/g, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) {
    // "1.234" ou "1.234.567" => milhar
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round((neg ? -n : n) * mult * 100) / 100;
}

// ----- cálculos -----
const sum = arr => arr.reduce((a, b) => a + (Number(b.value) || 0), 0);

export function activeIncomes(month, settings) {
  return month.incomes.filter(i => settings.twoPeople || i.person !== 2);
}

export function compute(month, settings) {
  const entradas = sum(activeIncomes(month, settings));          // =SUM(C6:C14)
  const essenciais = sum(month.expenses.filter(e => e.group === 'ess')); // =SUM(G6:G17)
  const naoEssenciais = sum(month.expenses.filter(e => e.group === 'nao')); // =SUM(G18:G38)
  const despesas = essenciais + naoEssenciais;                   // =G39+G40
  const sobra = entradas - despesas;                             // =C15-G41
  const mult = settings.reserveMultiplier || 6;
  const reservaIdeal = essenciais * mult;                        // =G39*6
  const investimentos = sum(month.expenses.filter(e => e.key === 'investimentos'));
  const val = k => sum(month.expenses.filter(e => e.key === k));
  return {
    entradas, essenciais, naoEssenciais, despesas, sobra, reservaIdeal, investimentos,
    cartao: val('cartao'), emprestimos: val('emprestimos'), tarifas: val('tarifas'),
    imprevistos: val('imprevistos'),
    comprometido: entradas > 0 ? despesas / entradas : 0,
  };
}

// Diagnóstico automático do mês
export function diagnose(c, month) {
  const out = [];
  const filled = month.expenses.some(e => e.value > 0);
  if (c.entradas <= 0) {
    out.push({ tone: 'info', title: 'Comece pelas entradas', text: 'Preencha quanto entra por mês (salário líquido, vales e rendas extras).', goto: 'entradas' });
    return out;
  }
  if (!filled) {
    out.push({ tone: 'info', title: 'Agora, as despesas', text: 'Coloque o valor médio de cada gasto mensal. Não sabe? Olhe o extrato dos últimos 3 meses.', goto: 'despesas' });
    return out;
  }
  if (c.sobra < 0) {
    out.push({ tone: 'critical', title: 'Você está gastando mais do que ganha', text: `Faltam ${brl(-c.sobra)} por mês. Comece cortando as despesas não essenciais.`, goto: 'despesas' });
  }
  if (c.investimentos <= 0) {
    out.push({ tone: 'warning', title: 'Nenhum valor guardado este mês', text: 'Mesmo que seja pouco, separe um valor fixo assim que o dinheiro entrar. Guardar primeiro funciona melhor do que guardar o que sobra.', goto: 'despesas' });
  }
  if (c.emprestimos > 0) {
    out.push({ tone: 'warning', title: 'Atenção aos empréstimos', text: `${brl(c.emprestimos)} por mês vão para empréstimos. Priorize quitar as dívidas com juros mais altos.` });
  }
  if (c.cartao > 0) {
    out.push({ tone: 'warning', title: 'Atenção ao cartão de crédito', text: `A fatura representa ${pct(c.cartao / c.entradas)} da sua renda. Parcelas acumuladas comprometem os próximos meses.` });
  }
  if (c.tarifas > 0) {
    out.push({ tone: 'info', title: 'Tarifas bancárias', text: `São ${brl(c.tarifas * 12)} por ano. Vale comparar com contas digitais sem tarifa.` });
  }
  if (c.sobra >= 0 && c.investimentos > 0) {
    out.push({ tone: 'good', title: 'Mês no azul!', text: `Você investe ${brl(c.investimentos)} (${pct(c.investimentos / c.entradas)} da renda) e ainda sobram ${brl(c.sobra)} por mês.` });
  }
  return out;
}

// Normaliza dados vindos do localStorage ou de um backup importado
export function sanitize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object' || !raw.months || typeof raw.months !== 'object') return base;
  const months = {};
  for (const [k, m] of Object.entries(raw.months)) {
    if (!/^\d{4}-\d{2}$/.test(k) || !m) continue;
    const fix = (list, isExp) => (Array.isArray(list) ? list : []).map(x => ({
      id: String(x.id || uid()),
      key: x.key ? String(x.key) : undefined,
      label: String(x.label ?? 'Item').slice(0, 120),
      hint: x.hint ? String(x.hint).slice(0, 120) : undefined,
      tone: x.tone === 'warn' ? 'warn' : undefined,
      icon: x.icon ? String(x.icon).slice(0, 16) : undefined,
      custom: !!x.custom,
      ...(isExp ? { group: x.group === 'ess' ? 'ess' : 'nao' } : { person: [0, 1, 2].includes(x.person) ? x.person : 0 }),
      value: Number.isFinite(Number(x.value)) ? Number(x.value) : 0,
    }));
    months[k] = { incomes: fix(m.incomes, false), expenses: fix(m.expenses, true) };
  }
  if (!Object.keys(months).length) return base;
  const s = raw.settings || {};
  const current = months[raw.current] ? raw.current : Object.keys(months).sort().at(-1);
  return {
    version: 1,
    current,
    months,
    settings: {
      theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
      name1: String(s.name1 || '').slice(0, 40),
      name2: String(s.name2 || '').slice(0, 40),
      twoPeople: s.twoPeople !== false,
      reserveMultiplier: Math.min(24, Math.max(1, Number(s.reserveMultiplier) || 6)),
      reserveSaved: Number(s.reserveSaved) || 0,
      reserveMonthly: Number(s.reserveMonthly) || 0,
    },
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}
