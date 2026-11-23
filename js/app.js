import {
  STORAGE_KEY, GROUPS, uid, monthKey, shiftMonth, monthName,
  blankMonth, cloneMonth, defaultState, brl, num, pct, parseMoney,
  activeIncomes, compute, diagnose, sanitize,
} from './data.js';

// ---------------------------------------------------------------- estado
let state = load();
let view = 'resumo';
const ui = { search: '', onlyFilled: false, sort: 'default', collapsed: {} };

function load() {
  try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return defaultState(); }
}
let saveTimer;
function save() {
  state.updatedAt = new Date().toISOString();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('Não foi possível salvar no navegador.'); }
  }, 250);
}
const S = () => state.settings;
const cur = () => state.months[state.current] || null;
const calc = () => (cur() ? compute(cur(), S()) : null);

// ---------------------------------------------------------------- Android
// Quando roda dentro do app Android (WebView), o objeto AndroidBridge é injetado
// pelo código nativo e só aceita mensagens vindas da origem do próprio app.
const android = window.AndroidBridge && typeof window.AndroidBridge.postMessage === 'function' ? window.AndroidBridge : null;
const nativeSend = msg => android && android.postMessage(JSON.stringify(msg));
if (android) document.documentElement.classList.add('android');

// ---------------------------------------------------------------- utilidades
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#main');

function personName(p) {
  if (p === 1) return S().name1 || 'Você';
  if (p === 2) return S().name2 || 'Outra pessoa';
  return '';
}

// Título do bloco de renda: "Renda de Ana" quando há nome; senão, frase natural.
function incomeTitle(p) {
  const n = p === 1 ? S().name1 : S().name2;
  if (n && n.trim()) return `Renda de ${n.trim()}`;
  return p === 1 ? 'Sua renda' : 'Renda da outra pessoa';
}

let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) $('button', t).onclick = () => { action.fn(); t.classList.remove('show'); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 3000);
}

function moneyInput(item, extra = '') {
  const v = item.value ? num(item.value) : '';
  return `<div class="money ${item.value ? 'filled' : ''}">
    <span aria-hidden="true">R$</span>
    <input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"
      data-money="${item.id}" value="${v}" aria-label="Valor de ${esc(item.label)}" ${extra}>
  </div>`;
}

function findItem(id) {
  const m = cur();
  return m && (m.incomes.find(i => i.id === id) || m.expenses.find(e => e.id === id));
}

// ---------------------------------------------------------------- tema
function applyTheme() {
  const t = S().theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#themeBtn').textContent = dark ? '☀︎' : '☾';
  $('meta[name="theme-color"]').content = dark ? '#151514' : '#f5c400';
  nativeSend({ type: 'theme', dark });
}
$('#themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  S().theme = dark ? 'light' : 'dark';
  save(); applyTheme();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------------------------------------------------------------- navegação
function setView(v, { focus = false } = {}) {
  view = v;
  $$('.tabs button').forEach(b => {
    const on = b.dataset.view === v;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  render();
  window.scrollTo({ top: 0 });
  if (focus) main.focus({ preventScroll: true });
}
$$('.tabs button').forEach(b => (b.onclick = () => setView(b.dataset.view, { focus: true })));
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto]');
  if (g) { e.preventDefault(); setView(g.dataset.goto, { focus: true }); }
});

function setMonth(key) {
  state.current = key;
  save();
  renderMonthLabel();
  render();
}
function renderMonthLabel() {
  $('#monthLabel').textContent = monthName(state.current);
  $('#monthPicker').value = state.current;
}
$('#prevMonth').onclick = () => setMonth(shiftMonth(state.current, -1));
$('#nextMonth').onclick = () => setMonth(shiftMonth(state.current, 1));
$('#monthLabel').onclick = () => {
  const p = $('#monthPicker');
  if (p.showPicker) { try { p.showPicker(); return; } catch { /* segue */ } }
  setView('historico');
};
$('#monthPicker').onchange = e => e.target.value && setMonth(e.target.value);

// ---------------------------------------------------------------- render
function render() {
  const liveViews = ['entradas', 'despesas', 'reserva'];
  $('#liveBar').hidden = !(cur() && liveViews.includes(view));
  if (!cur() && !['historico', 'sobre'].includes(view)) {
    main.innerHTML = viewNewMonth();
  } else {
    main.innerHTML = {
      resumo: viewResumo, entradas: viewEntradas, despesas: viewDespesas,
      reserva: viewReserva, historico: viewHistorico, sobre: viewSobre,
    }[view]();
  }
  refresh();
}

// Atualiza apenas números calculados (sem recriar inputs, para não perder o foco)
function refresh() {
  const c = calc();
  if (!c) return;
  const bind = {
    entradas: brl(c.entradas), despesas: brl(c.despesas), sobra: brl(c.sobra),
    essenciais: brl(c.essenciais), naoEssenciais: brl(c.naoEssenciais),
    reservaIdeal: brl(c.reservaIdeal), comprometido: pct(c.comprometido),
  };
  $$('[data-bind]').forEach(el => { if (bind[el.dataset.bind] != null) el.textContent = bind[el.dataset.bind]; });
  $$('.live-sobra, [data-sign]').forEach(el => {
    el.classList.toggle('neg', c.sobra < 0);
    el.classList.toggle('pos', c.sobra > 0);
  });
  // barras de participação de cada despesa
  $$('[data-share]').forEach(el => {
    const it = findItem(el.dataset.share);
    const v = it?.value || 0;
    const base = c.entradas || c.despesas || 1;
    el.classList.toggle('zero', !v);
    el.querySelector('i').style.width = Math.min(100, (v / base) * 100) + '%';
    el.querySelector('span').textContent = v ? `${pct(v / base, 1)} ${c.entradas ? 'da renda' : 'das despesas'}` : '';
  });
  $$('[data-group-total]').forEach(el => {
    const g = el.dataset.groupTotal;
    const v = g === 'ess' ? c.essenciais : c.naoEssenciais;
    el.textContent = brl(v) + (c.entradas ? ` · ${pct(v / c.entradas)} da renda` : '');
  });
  if (view === 'reserva') updateReserva(c);
  $$('[data-person-label]').forEach(el => (el.textContent = personName(Number(el.dataset.personLabel))));
  $$('[data-income-title]').forEach(el => (el.textContent = incomeTitle(Number(el.dataset.incomeTitle))));
}

// ---------------------------------------------------------------- telas
function viewNewMonth() {
  const keys = Object.keys(state.months).sort();
  const prev = keys.filter(k => k < state.current).at(-1) || keys.at(-1);
  return `<section class="card empty-month">
    <h1>${monthName(state.current)}</h1>
    <p>Este mês ainda está vazio. Como o app usa <b>valores médios</b>, o mais prático é copiar o último mês e ajustar o que mudou.</p>
    <div class="row-actions">
      ${prev ? `<button class="btn primary" data-act="copy-month" data-from="${prev}">Copiar de ${monthName(prev)}</button>` : ''}
      <button class="btn" data-act="blank-month">Começar do zero</button>
    </div>
  </section>`;
}

function viewResumo() {
  const c = calc();
  const m = cur();
  const tips = diagnose(c, m);
  const top = [...m.expenses].filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const maxBar = Math.max(c.entradas, c.despesas, 1);
  const bar = (label, parts, total) => `
    <div class="hbar" data-tip="${esc(label)}: ${brl(total)}${c.entradas ? ' (' + pct(total / c.entradas) + ' da renda)' : ''}">
      <div class="hbar-label">${esc(label)}</div>
      <div class="hbar-track">${parts.map(([cls, v]) => v > 0 ? `<i class="${cls}" style="width:${(v / maxBar) * 100}%"></i>` : '').join('')}</div>
      <div class="hbar-value">${brl(total)}</div>
    </div>`;
  // composição da renda (100%)
  const base = Math.max(c.entradas, c.despesas, 1);
  const segs = [
    ['s-ess', 'Essenciais', c.essenciais],
    ['s-nao', 'Não essenciais', c.naoEssenciais],
    ['s-sobra', c.sobra >= 0 ? 'Sobra' : 'Déficit', Math.abs(c.sobra)],
  ];
  const segTotal = c.sobra >= 0 ? base : c.despesas;
  const empty = c.entradas <= 0 && c.despesas <= 0;

  return `
  <section class="hero card ${c.sobra < 0 ? 'neg' : ''}" data-sign>
    <p class="eyebrow">Com as contas em dia, todo mês sobra:</p>
    <p class="hero-value"><span aria-hidden="true">${c.sobra < 0 ? '▼' : c.sobra > 0 ? '▲' : '•'}</span> <b data-bind="sobra"></b></p>
    <p class="hero-sub">${c.entradas > 0 ? `Você compromete <b data-bind="comprometido"></b> da renda com despesas (investimentos incluídos).` : 'Preencha suas entradas e despesas para ver o resultado.'}</p>
  </section>

  <section class="tiles">
    <a class="tile" href="#entradas" data-goto="entradas"><small>Total de entradas</small><b data-bind="entradas"></b></a>
    <a class="tile" href="#despesas" data-goto="despesas"><small><i class="dot s-ess"></i>Essenciais</small><b data-bind="essenciais"></b></a>
    <a class="tile" href="#despesas" data-goto="despesas"><small><i class="dot s-nao"></i>Não essenciais</small><b data-bind="naoEssenciais"></b></a>
    <a class="tile" href="#reserva" data-goto="reserva"><small>Reserva de emergência ideal</small><b data-bind="reservaIdeal"></b></a>
  </section>

  <div class="grid-2">
    <section class="card">
      <h2>Entradas x Saídas</h2>
      ${empty ? '<p class="muted">Nada para mostrar ainda.</p>' : `
      <div class="hbars">
        ${bar('Total de entradas', [['s-in', c.entradas]], c.entradas)}
        ${bar('Despesas essenciais', [['s-ess', c.essenciais]], c.essenciais)}
        ${bar('Despesas não essenciais', [['s-nao', c.naoEssenciais]], c.naoEssenciais)}
        ${bar('Total geral de despesas', [['s-ess', c.essenciais], ['s-nao', c.naoEssenciais]], c.despesas)}
      </div>
      <div class="legend"><span><i class="dot s-in"></i>Entradas</span><span><i class="dot s-ess"></i>Essenciais</span><span><i class="dot s-nao"></i>Não essenciais</span></div>`}
    </section>

    <section class="card">
      <h2>Para onde vai sua renda</h2>
      ${empty ? '<p class="muted">Nada para mostrar ainda.</p>' : `
      <div class="stack" role="img" aria-label="${segs.map(s => `${s[1]} ${brl(s[2])}`).join(', ')}">
        ${segs.map(([cls, label, v]) => v > 0 ? `<i class="${cls} ${label === 'Déficit' ? 'deficit' : ''}" style="flex:${v}" data-tip="${label}: ${brl(v)} (${pct(v / segTotal)})"></i>` : '').join('')}
      </div>
      <ul class="stack-legend">
        ${segs.map(([cls, label, v]) => `<li><i class="dot ${cls} ${label === 'Déficit' ? 'deficit' : ''}"></i><span>${label}</span><b>${brl(v)}</b><small>${pct(v / segTotal)}</small></li>`).join('')}
      </ul>
      ${c.sobra < 0 ? '<p class="note critical">⚠ As despesas passam da renda: a barra mostra o total gasto, e o déficit é a parte que falta.</p>' : ''}`}
    </section>
  </div>

  <div class="grid-2">
    <section class="card">
      <h2>Diagnóstico</h2>
      <ul class="tips">
        ${tips.map(t => `<li class="tip ${t.tone}">
          <span class="tip-ico" aria-hidden="true">${{ good: '✔', warning: '!', critical: '✖', info: 'i' }[t.tone]}</span>
          <div><b>${esc(t.title)}</b><p>${esc(t.text)}</p>${t.goto ? `<a href="#${t.goto}" data-goto="${t.goto}">Ir para ${t.goto} →</a>` : ''}</div>
        </li>`).join('')}
      </ul>
    </section>

    <section class="card">
      <h2>Maiores despesas</h2>
      ${top.length ? `<ol class="toplist">
        ${top.map(e => `<li data-tip="${esc(e.label)}: ${brl(e.value)}">
          <span class="ti" aria-hidden="true">${e.icon || '•'}</span>
          <span class="tl">${esc(e.label)}<small>${GROUPS[e.group].label}</small></span>
          <span class="tb"><i class="${e.group === 'ess' ? 's-ess' : 's-nao'}" style="width:${(e.value / top[0].value) * 100}%"></i></span>
          <b>${brl(e.value)}</b>
        </li>`).join('')}
      </ol>` : '<p class="muted">Quando você preencher as despesas, as maiores aparecem aqui.</p>'}
    </section>
  </div>`;
}

function viewEntradas() {
  const m = cur();
  const s = S();
  const groups = [
    [1, `<span data-income-title="1"></span>`],
    ...(s.twoPeople ? [[2, `<span data-income-title="2"></span>`]] : []),
    [0, 'Rendas extras'],
  ];
  return `
  <section class="card">
    <h1>Entradas <small class="muted">· quanto entra por mês</small></h1>
    <div class="people">
      <label>Seu nome <input type="text" data-setting="name1" value="${esc(s.name1)}" placeholder="Escreva seu nome aqui" maxlength="40"></label>
      <label class="switch"><input type="checkbox" data-setting="twoPeople" ${s.twoPeople ? 'checked' : ''}><span></span> Divido as contas com outra pessoa</label>
      ${s.twoPeople ? `<label>Nome da outra pessoa <input type="text" data-setting="name2" value="${esc(s.name2)}" placeholder="Escreva o nome da outra pessoa" maxlength="40"></label>` : ''}
    </div>
  </section>
  ${groups.map(([p, title]) => `
  <section class="card">
    <h2>${title}</h2>
    <ul class="items">
      ${m.incomes.filter(i => i.person === p).map(i => itemRow(i)).join('')}
    </ul>
    <button class="btn ghost add" data-act="add-income" data-person="${p}">＋ Adicionar entrada</button>
  </section>`).join('')}
  <section class="card total-card">
    <span>Total de entradas</span><b data-bind="entradas"></b>
  </section>
  <p class="muted center">Use sempre o <b>salário líquido</b> (o que realmente cai na conta, depois dos descontos).</p>`;
}

function itemRow(it, { share = false } = {}) {
  return `<li class="item ${it.tone === 'warn' ? 'warn' : ''}" data-id="${it.id}">
    <button class="item-ico ${it.icon ? '' : 'empty'}" data-act="edit" data-id="${it.id}" aria-label="Editar ${esc(it.label)}" title="Editar ícone, nome e observação">${it.icon ? esc(it.icon) : '＋'}</button>
    <div class="item-main">
      <button class="label-btn" data-act="edit" data-id="${it.id}" title="Editar">${esc(it.label)}<span class="pen" aria-hidden="true">✎</span></button>
      ${it.hint ? `<span class="hint ${it.tone === 'warn' ? 'warn' : ''}">${it.tone === 'warn' ? '⚠ ' : ''}${esc(it.hint)}</span>` : ''}
      ${share ? `<div class="share" data-share="${it.id}"><div class="share-track"><i class="${it.group === 'ess' ? 's-ess' : 's-nao'}"></i></div><span></span></div>` : ''}
    </div>
    ${moneyInput(it)}
    <button class="icon-btn del" data-act="del" data-id="${it.id}" aria-label="Remover ${esc(it.label)}" title="Remover">✕</button>
  </li>`;
}

function viewDespesas() {
  const m = cur();
  const q = ui.search.trim().toLowerCase();
  const filterSort = list => {
    let l = list.filter(e => (!q || (e.label + ' ' + (e.hint || '')).toLowerCase().includes(q)) && (!ui.onlyFilled || e.value > 0));
    if (ui.sort === 'value') l = [...l].sort((a, b) => b.value - a.value);
    if (ui.sort === 'alpha') l = [...l].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return l;
  };
  return `
  <section class="card">
    <h1>Despesas <small class="muted">· valor médio mensal</small></h1>
    <div class="filters">
      <input type="search" id="search" placeholder="Buscar despesa…" value="${esc(ui.search)}" aria-label="Buscar despesa">
      <select id="sort" aria-label="Ordenar">
        <option value="default" ${ui.sort === 'default' ? 'selected' : ''}>Ordem padrão</option>
        <option value="value" ${ui.sort === 'value' ? 'selected' : ''}>Maior valor</option>
        <option value="alpha" ${ui.sort === 'alpha' ? 'selected' : ''}>A–Z</option>
      </select>
      <label class="switch"><input type="checkbox" id="onlyFilled" ${ui.onlyFilled ? 'checked' : ''}><span></span> Só preenchidas</label>
    </div>
  </section>
  ${['ess', 'nao'].map(g => {
    const list = filterSort(m.expenses.filter(e => e.group === g));
    const col = ui.collapsed[g];
    return `<section class="card group ${col ? 'collapsed' : ''}">
      <button class="group-head" data-act="toggle-group" data-group="${g}" aria-expanded="${!col}">
        <span class="dot ${g === 'ess' ? 's-ess' : 's-nao'}"></span>
        <h2>${GROUPS[g].long}</h2>
        <span class="group-total" data-group-total="${g}"></span>
        <span class="chev" aria-hidden="true">▾</span>
      </button>
      <div class="group-body">
        ${g === 'ess' ? '<p class="muted small">O básico para viver. Também é a base da sua reserva de emergência.</p>' : '<p class="muted small">Gastos que dá para reduzir ou cortar se o mês apertar.</p>'}
        <ul class="items">${list.map(e => itemRow(e, { share: true })).join('') || '<li class="muted small">Nenhuma despesa encontrada.</li>'}</ul>
        <button class="btn ghost add" data-act="add-expense" data-group="${g}">＋ Adicionar despesa ${g === 'ess' ? 'essencial' : 'não essencial'}</button>
      </div>
    </section>`;
  }).join('')}
  <section class="card total-card">
    <span>Total geral de despesas</span><b data-bind="despesas"></b>
  </section>`;
}

function viewReserva() {
  const s = S();
  return `
  <section class="card">
    <h1>Reserva de emergência</h1>
    <p>Uma referência comum é ter uma reserva de <b>${s.reserveMultiplier} vezes o seu custo de vida básico</b> (o total das despesas essenciais). É o dinheiro que segura as pontas se você perder a renda ou tiver um imprevisto.</p>
    <div class="reserve-hero">
      <div class="ring" id="ring" role="img" aria-label="Progresso da reserva">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" id="ringFg" pathLength="100" stroke-dasharray="0 100"/></svg>
        <div><b id="ringPct">0%</b><small>da meta</small></div>
      </div>
      <dl class="kv">
        <div><dt>Reserva ideal</dt><dd data-bind="reservaIdeal"></dd></div>
        <div><dt>Custo de vida básico</dt><dd data-bind="essenciais"></dd></div>
        <div><dt>Falta juntar</dt><dd id="resFalta"></dd></div>
        <div><dt>Hoje você aguentaria</dt><dd id="resMeses"></dd></div>
      </dl>
    </div>
  </section>
  <section class="card">
    <h2>Simule</h2>
    <div class="form-grid">
      <label>Quanto você já tem guardado
        <div class="money"><span aria-hidden="true">R$</span><input type="text" inputmode="decimal" data-setting-money="reserveSaved" value="${s.reserveSaved ? num(s.reserveSaved) : ''}" placeholder="0,00"></div>
      </label>
      <label>Quanto vai guardar por mês
        <div class="money"><span aria-hidden="true">R$</span><input type="text" inputmode="decimal" data-setting-money="reserveMonthly" value="${s.reserveMonthly ? num(s.reserveMonthly) : ''}" placeholder="igual aos investimentos"></div>
      </label>
      <label class="range"><span>Meta: <b id="multLabel">${s.reserveMultiplier} meses</b> de custo de vida</span>
        <input type="range" min="3" max="12" step="1" value="${s.reserveMultiplier}" data-setting="reserveMultiplier" aria-label="Meses de reserva">
        <span class="range-scale"><small>3</small><small>6</small><small>12</small></span>
      </label>
    </div>
    <p class="forecast" id="forecast"></p>
  </section>`;
}

function updateReserva(c) {
  const s = S();
  const saved = s.reserveSaved || 0;
  const ideal = c.reservaIdeal;
  const p = ideal > 0 ? Math.min(1, saved / ideal) : 0;
  const fg = $('#ringFg');
  if (!fg) return;
  fg.setAttribute('stroke-dasharray', `${p * 100} 100`);
  $('#ringPct').textContent = ideal > 0 ? pct(p) : '—';
  $('#resFalta').textContent = brl(Math.max(0, ideal - saved));
  $('#resMeses').textContent = c.essenciais > 0 ? `${(saved / c.essenciais).toFixed(1).replace('.', ',')} meses` : '—';
  const monthly = s.reserveMonthly || c.investimentos;
  const falta = ideal - saved;
  let txt;
  if (ideal <= 0) txt = 'Preencha suas despesas essenciais para calcular a meta.';
  else if (falta <= 0) txt = '🎉 Reserva completa! Agora o que você investir pode ir para objetivos de longo prazo.';
  else if (monthly <= 0) txt = 'Defina quanto vai guardar por mês (ou preencha “Investimentos” nas despesas) para ver a previsão.';
  else {
    const n = Math.ceil(falta / monthly);
    const end = monthName(shiftMonth(monthKey(), n));
    txt = `Guardando <b>${brl(monthly)}</b> por mês, você completa a reserva em <b>${n} ${n === 1 ? 'mês' : 'meses'}</b> (por volta de <b>${end}</b>), sem contar os rendimentos.`;
  }
  $('#forecast').innerHTML = txt;
}

function viewHistorico() {
  const keys = Object.keys(state.months).sort();
  const rows = keys.map(k => ({ k, c: compute(state.months[k], S()) }));
  const max = Math.max(1, ...rows.map(r => Math.max(r.c.entradas, r.c.despesas)));
  const last = rows.slice(-12);
  return `
  <section class="card">
    <h1>Histórico</h1>
    ${rows.length > 1 ? `
    <div class="cols" role="img" aria-label="Entradas e despesas por mês">
      ${last.map(r => `<div class="col-group ${r.k === state.current ? 'current' : ''}" data-tip="${monthName(r.k)} — Entradas ${brl(r.c.entradas)} · Despesas ${brl(r.c.despesas)} · Sobra ${brl(r.c.sobra)}">
        <div class="col-bars">
          <i class="s-in" style="height:${(r.c.entradas / max) * 100}%"></i>
          <span class="col-stack" style="height:${(r.c.despesas / max) * 100}%">
            <i class="s-nao" style="flex:${r.c.naoEssenciais || 0}"></i><i class="s-ess" style="flex:${r.c.essenciais || 0}"></i>
          </span>
        </div>
        <small>${monthName(r.k, true).replace('.', '')}</small>
      </div>`).join('')}
    </div>
    <div class="legend"><span><i class="dot s-in"></i>Entradas</span><span><i class="dot s-ess"></i>Essenciais</span><span><i class="dot s-nao"></i>Não essenciais</span></div>`
    : '<p class="muted">Quando você tiver mais de um mês preenchido, a evolução aparece aqui em gráfico. Use as setas ‹ › no topo para ir ao próximo mês.</p>'}
  </section>
  <section class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Mês</th><th>Entradas</th><th>Despesas</th><th>Sobra</th><th></th></tr></thead>
        <tbody>
          ${rows.slice().reverse().map(r => `<tr class="${r.k === state.current ? 'current' : ''}">
            <td><button class="link" data-act="open-month" data-key="${r.k}">${monthName(r.k)}</button></td>
            <td>${brl(r.c.entradas)}</td><td>${brl(r.c.despesas)}</td>
            <td class="${r.c.sobra < 0 ? 'neg' : 'pos'}">${r.c.sobra < 0 ? '▼ ' : ''}${brl(r.c.sobra)}</td>
            <td><button class="icon-btn del" data-act="del-month" data-key="${r.k}" aria-label="Excluir ${monthName(r.k)}" title="Excluir mês">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <button class="btn ghost add" data-act="new-next-month">＋ Criar ${monthName(shiftMonth(keys.at(-1) || monthKey(), 1))}</button>
  </section>`;
}

function viewSobre() {
  const t = S().theme;
  return `
  <section class="card credits">
    <h1>Sobre o Bolso Organizado</h1>
    <p>O Bolso Organizado ajuda você a ver para onde vai o seu dinheiro: quanto entra, quanto sai, quanto sobra no fim do mês
      e de quanto precisa ser a sua reserva de emergência.</p>
    <p>Gratuito, funciona sem internet e os seus dados ficam só no seu aparelho.</p>
    <p class="disclaimer">Ferramenta de organização pessoal. Não é recomendação de investimento.
      Desenvolvido por <a href="https://josue-caetano.github.io" target="_blank" rel="noopener">Josué Caetano</a>.</p>
  </section>

  <section class="card">
    <h2>Seus dados</h2>
    <p class="muted">Tudo fica salvo <b>só neste navegador</b>. Nada é enviado para servidor nenhum. Faça backup para levar para outro aparelho.</p>
    <div class="row-actions wrap">
      <button class="btn" data-act="export-json">⬇ Backup (.json)</button>
      <label class="btn">⬆ Restaurar backup<input type="file" accept="application/json,.json" id="importFile" hidden></label>
      <button class="btn" data-act="export-csv">⬇ Exportar mês (CSV/Excel)</button>
      <button class="btn" data-act="print">🖨 Imprimir / PDF</button>
    </div>
    <h2>Aparência</h2>
    <div class="seg" role="radiogroup" aria-label="Tema">
      ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${t === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
    </div>
    <h2>Zona de perigo</h2>
    <button class="btn danger" data-act="reset">Apagar todos os dados</button>
  </section>`;
}

// ---------------------------------------------------------------- eventos
main.addEventListener('focusin', e => {
  const inp = e.target.closest('[data-money], [data-setting-money]');
  if (inp) {
    const v = parseMoney(inp.value);
    const raw = v ? String(v).replace('.', ',') : '';
    if (inp.value !== raw) inp.value = raw;
    inp.select();
  }
});
main.addEventListener('focusout', e => {
  const inp = e.target.closest('[data-money], [data-setting-money]');
  if (inp) {
    const v = parseMoney(inp.value);
    inp.value = v ? num(v) : '';
    inp.closest('.money')?.classList.toggle('filled', !!v);
  }
});
main.addEventListener('keydown', e => {
  // Enter num valor pula para o próximo campo de valor (preenchimento rápido)
  if (e.key === 'Enter' && e.target.matches('[data-money]')) {
    e.preventDefault();
    const all = $$('[data-money]', main);
    (all[all.indexOf(e.target) + 1] || e.target).focus();
  }
});
main.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.money) {
    const it = findItem(t.dataset.money);
    if (it) { it.value = parseMoney(t.value); save(); refresh(); }
  } else if (t.dataset.settingMoney) {
    S()[t.dataset.settingMoney] = parseMoney(t.value); save(); refresh();
  } else if (t.dataset.setting === 'name1' || t.dataset.setting === 'name2') {
    S()[t.dataset.setting] = t.value; save(); refresh();
  } else if (t.dataset.setting === 'reserveMultiplier') {
    S().reserveMultiplier = Number(t.value);
    $('#multLabel').textContent = `${t.value} meses`;
    const p = t.closest('.card').previousElementSibling.querySelector('p b');
    if (p) p.textContent = `${t.value} vezes o seu custo de vida básico`;
    save(); refresh();
  } else if (t.id === 'search') {
    ui.search = t.value;
    const pos = t.selectionStart;
    render();
    const s = $('#search'); s.focus(); s.setSelectionRange(pos, pos);
  }
});
main.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.setting === 'twoPeople') { S().twoPeople = t.checked; save(); render(); }
  else if (t.id === 'onlyFilled') { ui.onlyFilled = t.checked; render(); }
  else if (t.id === 'sort') { ui.sort = t.value; render(); }
  else if (t.name === 'theme') { S().theme = t.value; save(); applyTheme(); }
  else if (t.id === 'importFile' && t.files[0]) importJSON(t.files[0]);
});

main.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const m = cur();
  const act = b.dataset.act;
  if (act === 'del') {
    const id = b.dataset.id;
    for (const listName of ['incomes', 'expenses']) {
      const list = m[listName];
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) {
        const [removed] = list.splice(idx, 1);
        save(); render();
        toast(`“${removed.label}” removido.`, { label: 'Desfazer', fn: () => { list.splice(idx, 0, removed); save(); render(); } });
      }
    }
  } else if (act === 'add-income') {
    const item = { id: uid(), label: 'Nova entrada', person: Number(b.dataset.person), value: 0, custom: true };
    m.incomes.push(item); save(); render(); openEditor(item.id, { isNew: true });
  } else if (act === 'add-expense') {
    const g = b.dataset.group;
    const item = { id: uid(), label: 'Nova despesa', group: g, icon: '🏷️', value: 0, custom: true };
    const lastIdx = m.expenses.map(x => x.group).lastIndexOf(g);
    m.expenses.splice(lastIdx + 1, 0, item);
    ui.search = ''; ui.onlyFilled = false; ui.collapsed[g] = false;
    save(); render(); openEditor(item.id, { isNew: true });
  } else if (act === 'edit') {
    openEditor(b.dataset.id);
  } else if (act === 'toggle-group') {
    ui.collapsed[b.dataset.group] = !ui.collapsed[b.dataset.group];
    const card = b.closest('.group');
    card.classList.toggle('collapsed');
    b.setAttribute('aria-expanded', !card.classList.contains('collapsed'));
  } else if (act === 'copy-month') {
    state.months[state.current] = cloneMonth(state.months[b.dataset.from]);
    save(); render(); toast(`Copiado de ${monthName(b.dataset.from)}. Ajuste o que mudou.`);
  } else if (act === 'blank-month') {
    state.months[state.current] = blankMonth(); save(); render();
  } else if (act === 'open-month') {
    setMonth(b.dataset.key); setView('resumo');
  } else if (act === 'new-next-month') {
    const keys = Object.keys(state.months).sort();
    const k = shiftMonth(keys.at(-1) || monthKey(), 1);
    state.months[k] = keys.length ? cloneMonth(state.months[keys.at(-1)]) : blankMonth();
    setMonth(k); toast(`${monthName(k)} criado.`);
  } else if (act === 'del-month') {
    const k = b.dataset.key;
    if (!confirm(`Excluir os dados de ${monthName(k)}?`)) return;
    const backup = state.months[k];
    delete state.months[k];
    save(); render(); renderMonthLabel();
    toast(`${monthName(k)} excluído.`, { label: 'Desfazer', fn: () => { state.months[k] = backup; save(); render(); } });
  } else if (act === 'export-json') {
    download(`bolso-organizado-backup-${monthKey()}.json`, JSON.stringify(state, null, 2), 'application/json');
  } else if (act === 'export-csv') {
    exportCSV();
  } else if (act === 'print') {
    printReport();
  } else if (act === 'reset') {
    if (!confirm('Apagar TODOS os meses e configurações? Faça um backup antes se quiser guardar.')) return;
    state = defaultState(); save(); applyTheme(); renderMonthLabel(); setView('resumo');
    toast('Tudo apagado. Comece de novo!');
  }
});

// ---------------------------------------------------------------- editor de item
const EMOJIS = ['🏠', '🏢', '🏡', '🏗️', '🛒', '🍎', '🥖', '☕', '🍔', '🍕', '🍺', '🚿', '💡', '⚡', '☀️', '🔥',
  '📄', '🩺', '💊', '🦷', '🧠', '🛡️', '📈', '💰', '💵', '💳', '🏦', '🧾', '📱', '☎️', '🌐', '📺',
  '🎬', '🎮', '🎵', '📚', '🎓', '✏️', '🚗', '🏍️', '⛽', '🚌', '🚕', '✈️', '🐾', '👶', '🧒', '👕',
  '💇', '💅', '🏋️', '⚽', '🎁', '🎉', '⛪', '🤝', '🔧', '🧹', '🌱', '📦', '💼', '🏷️', '⭐', '➕'];

let editor = null; // { id, isNew }

function openEditor(id, { isNew = false } = {}) {
  const it = findItem(id);
  if (!it) return;
  const isExp = !!it.group;
  editor = { id, isNew, opener: document.activeElement };
  tip.hidden = true;
  const s = S();
  const personOpts = [[1, personName(1)], ...(s.twoPeople || it.person === 2 ? [[2, personName(2)]] : []), [0, 'Renda extra']];
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-backdrop" data-sheet="close"></div>
    <form class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" novalidate>
      <header><h2 id="sheetTitle">${isNew ? (isExp ? 'Nova despesa' : 'Nova entrada') : 'Editar item'}</h2>
        <button type="button" class="icon-btn" data-sheet="close" aria-label="Fechar">✕</button></header>

      <div class="sheet-body">
        <div class="ed-preview">
          <span class="ed-ico" id="edIcoPreview">${esc(it.icon || '＋')}</span>
          <label class="ed-field">Nome
            <input type="text" id="edLabel" value="${esc(isNew ? '' : it.label)}" placeholder="${isExp ? 'Ex.: Energia solar' : 'Ex.: Freelance'}" maxlength="120" required>
          </label>
        </div>

        <fieldset class="ed-field">
          <legend>Ícone</legend>
          <div class="emoji-grid" role="radiogroup" aria-label="Escolha um ícone">
            <button type="button" class="emoji ${!it.icon ? 'on' : ''}" data-emoji="" aria-label="Sem ícone">∅</button>
            ${EMOJIS.map(e => `<button type="button" class="emoji ${it.icon === e ? 'on' : ''}" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}
          </div>
          <label class="ed-inline">Ou digite qualquer emoji:
            <input type="text" id="edIcon" value="${esc(it.icon || '')}" maxlength="16" placeholder="😀" inputmode="text">
          </label>
        </fieldset>

        <label class="ed-field">Observação <small>(opcional)</small>
          <input type="text" id="edHint" value="${esc(it.hint || '')}" placeholder="Ex.: parcela 3 de 12, vence dia 10…" maxlength="120">
        </label>
        <label class="switch"><input type="checkbox" id="edWarn" ${it.tone === 'warn' ? 'checked' : ''}><span></span> Destacar observação como alerta ⚠</label>

        ${isExp ? `<fieldset class="ed-field"><legend>Grupo</legend>
          <div class="seg">
            <label><input type="radio" name="edGroup" value="ess" ${it.group === 'ess' ? 'checked' : ''}><span>Essencial</span></label>
            <label><input type="radio" name="edGroup" value="nao" ${it.group === 'nao' ? 'checked' : ''}><span>Não essencial</span></label>
          </div></fieldset>`
        : `<label class="ed-field">De quem é essa renda
          <select id="edPerson">${personOpts.map(([v, l]) => `<option value="${v}" ${it.person === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        </label>`}
        <p class="muted small">As mudanças valem para ${monthName(state.current)}. Os próximos meses criados a partir deste já vêm com elas.</p>
      </div>

      <footer>
        ${isNew ? '' : `<button type="button" class="btn danger" data-sheet="delete">Excluir</button>`}
        <span class="grow"></span>
        <button type="button" class="btn" data-sheet="close">Cancelar</button>
        <button type="submit" class="btn primary">Salvar</button>
      </footer>
    </form>`;
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => sheet.classList.add('show'));
  const label = $('#edLabel');
  label.focus({ preventScroll: true });
}

function closeEditor({ saved = false } = {}) {
  if (!editor) return;
  const { id, isNew, opener } = editor;
  editor = null;
  const sheet = $('#sheet');
  sheet.classList.remove('show');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { if (!editor) { sheet.hidden = true; sheet.innerHTML = ''; } }, 200);
  if (isNew && !saved) {
    // cancelou a criação: descarta o item vazio
    const m = cur();
    m.incomes = m.incomes.filter(x => x.id !== id);
    m.expenses = m.expenses.filter(x => x.id !== id);
    save(); render();
    return;
  }
  const back = $(`.item[data-id="${id}"] .label-btn`) || (document.contains(opener) ? opener : null);
  back?.focus({ preventScroll: true });
}

function saveEditor() {
  const it = findItem(editor.id);
  if (!it) return closeEditor();
  const label = $('#edLabel').value.trim();
  if (!label) { $('#edLabel').focus(); $('#edLabel').classList.add('invalid'); return; }
  it.label = label;
  const icon = $('#edIcon').value.trim();
  if (icon) it.icon = icon; else delete it.icon;
  const hint = $('#edHint').value.trim();
  if (hint) it.hint = hint; else delete it.hint;
  if ($('#edWarn').checked && hint) it.tone = 'warn'; else delete it.tone;
  if (it.group) {
    const g = $('input[name="edGroup"]:checked')?.value || it.group;
    if (g !== it.group) {
      // muda de grupo: vai para o fim do novo grupo
      const m = cur();
      m.expenses = m.expenses.filter(x => x !== it);
      it.group = g;
      const last = m.expenses.map(x => x.group).lastIndexOf(g);
      m.expenses.splice(last + 1, 0, it);
      ui.collapsed[g] = false;
      toast(`Movido para ${GROUPS[g].long.toLowerCase()}.`);
    }
  } else {
    it.person = Number($('#edPerson').value);
  }
  const id = editor.id;
  save();
  closeEditor({ saved: true });
  render();
  const row = $(`.item[data-id="${id}"]`);
  if (row) {
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash');
    const money = row.querySelector('[data-money]');
    if (money && !findItem(id).value) money.focus({ preventScroll: true });
  }
}

const sheetEl = $('#sheet');
sheetEl.addEventListener('click', e => {
  const em = e.target.closest('[data-emoji]');
  if (em) {
    $$('.emoji', sheetEl).forEach(b => b.classList.toggle('on', b === em));
    $('#edIcon').value = em.dataset.emoji;
    $('#edIcoPreview').textContent = em.dataset.emoji || '＋';
    return;
  }
  const act = e.target.closest('[data-sheet]')?.dataset.sheet;
  if (act === 'close') closeEditor();
  else if (act === 'delete') {
    const id = editor.id;
    closeEditor({ saved: true });
    main.querySelector(`.del[data-id="${id}"]`)?.click();
  }
});
sheetEl.addEventListener('input', e => {
  if (e.target.id === 'edIcon') {
    const v = e.target.value.trim();
    $('#edIcoPreview').textContent = v || '＋';
    $$('.emoji', sheetEl).forEach(b => b.classList.toggle('on', b.dataset.emoji === v));
  }
  if (e.target.id === 'edLabel') e.target.classList.remove('invalid');
});
sheetEl.addEventListener('submit', e => { e.preventDefault(); saveEditor(); });
document.addEventListener('keydown', e => {
  if (!editor) return;
  if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
  if (e.key === 'Tab') { // mantém o foco dentro da janela
    const f = $$('button, input, select', sheetEl).filter(x => !x.disabled && x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});

// ---------------------------------------------------------------- arquivos
function download(name, content, type) {
  if (android) { nativeSend({ type: 'saveFile', name, content, mime: type.split(';')[0] }); return; }
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data.months) throw new Error('formato');
      if (!confirm('Restaurar este backup? Os dados atuais deste navegador serão substituídos.')) return;
      state = sanitize(data); save(); applyTheme(); renderMonthLabel(); setView('resumo');
      toast('Backup restaurado!');
    } catch { toast('Arquivo inválido. Use um backup .json gerado por este app.'); }
  };
  r.readAsText(file);
}

function exportCSV() {
  const m = cur(); if (!m) return;
  const c = calc();
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [['Tipo', 'Grupo', 'Descrição', 'Valor'].join(';')];
  activeIncomes(m, S()).forEach(i => lines.push(['Entrada', personName(i.person) || 'Extra', q(i.label), num(i.value)].join(';')));
  m.expenses.forEach(e => lines.push(['Despesa', GROUPS[e.group].label, q(e.label), num(e.value)].join(';')));
  lines.push('');
  [['Total de entradas', c.entradas], ['Total de despesas essenciais', c.essenciais], ['Total de despesas não essenciais', c.naoEssenciais],
    ['Total geral de despesas', c.despesas], ['Sobra mensal', c.sobra], ['Reserva de emergência ideal', c.reservaIdeal]]
    .forEach(([l, v]) => lines.push(['Resumo', '', q(l), num(v)].join(';')));
  lines.push('', q('Gerado pelo Bolso Organizado'));
  download(`bolso-organizado-${state.current}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

function printReport() {
  const m = cur(); if (!m) { toast('Preencha este mês primeiro.'); return; }
  const c = calc();
  const base = c.entradas || c.despesas || 1;
  const names = [S().name1, S().twoPeople ? S().name2 : ''].filter(Boolean).map(esc).join(' &amp; ');
  const incomes = activeIncomes(m, S()).map(i => ({ ...i, label: i.person ? `${i.label} — ${personName(i.person)}` : i.label }));
  let omitted = 0;
  const table = (title, list, total, cls) => {
    const filled = list.filter(x => x.value);
    omitted += list.length - filled.length;
    return `<table class="pr-table ${cls}">
      <thead><tr><th>${title}</th><th>Valor</th><th>% renda</th></tr></thead>
      <tbody>${filled.length ? filled.map(x => `<tr><td>${esc(x.label)}${x.tone === 'warn' && x.hint ? ` <em>${esc(x.hint)}</em>` : ''}</td><td>${brl(x.value)}</td><td>${pct(x.value / base, 1)}</td></tr>`).join('')
        : '<tr><td colspan="3" class="pr-empty">Nenhum valor preenchido</td></tr>'}</tbody>
      <tfoot><tr><th>Total</th><th>${brl(total)}</th><th>${pct(total / base, 1)}</th></tr></tfoot>
    </table>`;
  };
  const segs = [['s-ess', 'Essenciais', c.essenciais], ['s-nao', 'Não essenciais', c.naoEssenciais], ['s-sobra', 'Sobra', Math.max(0, c.sobra)]];
  const segTotal = Math.max(c.entradas, c.despesas, 1);
  const tips = diagnose(c, m).filter(t => t.tone !== 'info' || t.title.startsWith('Tarifas'));
  const tablesHTML = [
    table('Receitas (entradas)', incomes, c.entradas, 'in'),
    table('Despesas essenciais', m.expenses.filter(e => e.group === 'ess'), c.essenciais, 'ess'),
    table('Despesas não essenciais', m.expenses.filter(e => e.group === 'nao'), c.naoEssenciais, 'nao'),
  ];
  $('#printReport').innerHTML = `
    <header class="pr-head">
      <div>
        <small>Bolso Organizado</small>
        <h1>${monthName(state.current)}</h1>
        ${names ? `<p>${names}</p>` : ''}
      </div>
      <div class="pr-date">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </header>

    <section class="pr-kpis">
      <div><small>Total de entradas</small><b>${brl(c.entradas)}</b></div>
      <div><small>Total de despesas</small><b>${brl(c.despesas)}</b><span>${pct(c.comprometido)} da renda</span></div>
      <div class="pr-sobra ${c.sobra < 0 ? 'neg' : 'pos'}"><small>${c.sobra < 0 ? 'Falta todo mês' : 'Todo mês vai te sobrar'}</small><b>${brl(Math.abs(c.sobra))}</b></div>
      <div><small>Reserva de emergência ideal</small><b>${brl(c.reservaIdeal)}</b><span>${S().reserveMultiplier}× o custo de vida básico</span></div>
    </section>

    <section class="pr-split">
      <div class="pr-stack">${segs.map(([cls, , v]) => v > 0 ? `<i class="${cls}" style="flex:${v}"></i>` : '').join('')}</div>
      <ul>${segs.map(([cls, label, v]) => `<li><i class="${cls}"></i>${label} <b>${brl(v)}</b> (${pct(v / segTotal)})</li>`).join('')}</ul>
    </section>

    <div class="pr-grid">
      <div>${tablesHTML[0]}${tablesHTML[1]}</div>
      <div>${tablesHTML[2]}</div>
    </div>

    ${tips.length ? `<section class="pr-tips"><h2>Diagnóstico</h2><ul>${tips.map(t => `<li class="${t.tone}"><b>${esc(t.title)}</b> ${esc(t.text)}</li>`).join('')}</ul></section>` : ''}

    <footer class="pr-foot">
      ${omitted ? `<p>${omitted} ${omitted === 1 ? 'item com valor zero foi omitido' : 'itens com valor zero foram omitidos'}.</p>` : ''}
      <p>Gerado pelo Bolso Organizado.</p>
    </footer>`;
  if (android) nativeSend({ type: 'print', title: `Bolso Organizado ${monthName(state.current)}` });
  else window.print();
}

// ---------------------------------------------------------------- tooltip
const tip = $('#tooltip');
document.addEventListener('pointerover', e => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
});
document.addEventListener('pointermove', e => {
  if (tip.hidden) return;
  const pad = 14;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + pad, y = e.clientY - h - pad;
  if (x + w > innerWidth - 8) x = e.clientX - w - pad;
  if (y < 8) y = e.clientY + pad;
  tip.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
});
document.addEventListener('pointerout', e => { if (!e.relatedTarget?.closest?.('[data-tip]')) tip.hidden = true; });
addEventListener('scroll', () => (tip.hidden = true), { passive: true });

// ---------------------------------------------------------------- início
applyTheme();
renderMonthLabel();
const initial = location.hash.slice(1);
setView(['resumo', 'entradas', 'despesas', 'reserva', 'historico', 'sobre'].includes(initial) ? initial
  : (calc()?.entradas ? 'resumo' : 'entradas'));
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== view && $(`.tabs [data-view="${h}"]`)) setView(h); });

// Botão "voltar" do Android: volta para o Resumo antes de fechar o app
window.__androidBack = () => {
  if (editor) { closeEditor(); return true; }
  if (view !== 'resumo') { setView('resumo'); return true; }
  return false;
};

// No app Android os arquivos já estão no aparelho: não precisa de service worker
if (!android && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
