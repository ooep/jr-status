/* jr-status — UI logic
   读取 data/status.json（GitHub Actions 每 10 分钟更新），渲染全国线路运行情报。 */

'use strict';

/* ───────── i18n ───────── */
const I18N = {
  zh: {
    appName: 'JR-Status',
    brandSub: '全日本铁道运行情报 · Mini JapanRail',
    searchPh: '搜索线路 / 铁道公司…',
    refresh: '刷新',
    heroTitle: '全日本铁道 · 运行情报',
    all: '全部', troubleOnly: '仅异常', mappedOnly: '仅已映射主站',
    srcLabel: '数据来源', mainSite: 'Mini JapanRail 主站',
    updateNote: '每 10 分钟由 GitHub Actions 自动采集更新',
    stat: { lines: '线路总数', normal: '平常运营', trouble: '异常合计', suspend: '停运', companies: '铁道公司', mapped: '已映射主站' },
    st: { normal: '平常运营', delay: '列车晚点', suspend: '停运', irregular: '运行异常', plan: '计划调整', resume: '恢复运行', other: '其他', unknown: '未知' },
    verdict: { ok: '全国线路基本正常运营', warn: '部分线路出现异常，出行前请确认', bad: '多条线路停运，请务必确认' },
    updated: '更新于', ago: '前', justNow: '刚刚', sec: '秒', min: '分钟', hour: '小时',
    count: '条', opBadge: '条线路', mappedTag: '已映射主站：', noResult: '没有匹配的线路', loading: '正在读取数据…',
    loadFail: '数据读取失败，请稍后重试', autoRefresh: '自动刷新', companyCount: '家公司'
  },
  ja: {
    appName: 'JR-Status',
    brandSub: '全国鉄道 運行情報 · Mini JapanRail',
    searchPh: '路線・鉄道会社を検索…',
    refresh: '更新',
    heroTitle: '全国鉄道 · 運行情報',
    all: 'すべて', troubleOnly: '異常のみ', mappedOnly: 'マッピング済みのみ',
    srcLabel: 'データ元', mainSite: 'Mini JapanRail 本サイト',
    updateNote: 'GitHub Actions が10分ごとに自動取得・更新',
    stat: { lines: '路線数', normal: '平常運転', trouble: '異常計', suspend: '運転見合わせ', companies: '鉄道会社', mapped: 'マッピング済み' },
    st: { normal: '平常運転', delay: '列車遅延', suspend: '運転見合わせ', irregular: '運転状況', plan: '運転計画', resume: '運転再開', other: 'その他', unknown: '不明' },
    verdict: { ok: '全国の路線はおおむね平常運転です', warn: '一部路線に乱れがあります。お出かけ前にご確認ください', bad: '複数の路線で運転見合わせが発生しています' },
    updated: '更新', ago: '前', justNow: 'たった今', sec: '秒', min: '分', hour: '時間',
    count: '件', opBadge: '路線', mappedTag: 'マッピング：', noResult: '該当する路線がありません', loading: '読み込み中…',
    loadFail: 'データ取得に失敗しました', autoRefresh: '自動更新', companyCount: '社'
  },
  en: {
    appName: 'JR-Status',
    brandSub: 'Japan Railway Service Status · Mini JapanRail',
    searchPh: 'Search lines / operators…',
    refresh: 'Refresh',
    heroTitle: 'Japan Railways · Live Status',
    all: 'All', troubleOnly: 'Disrupted only', mappedOnly: 'Mapped only',
    srcLabel: 'Source', mainSite: 'Mini JapanRail main site',
    updateNote: 'Auto-collected every 10 minutes by GitHub Actions',
    stat: { lines: 'Lines', normal: 'Normal', trouble: 'Disrupted', suspend: 'Suspended', companies: 'Operators', mapped: 'Mapped' },
    st: { normal: 'Normal', delay: 'Delayed', suspend: 'Suspended', irregular: 'Irregular', plan: 'Planned change', resume: 'Resuming', other: 'Other', unknown: 'Unknown' },
    verdict: { ok: 'Lines nationwide are running normally', warn: 'Some lines are disrupted — check before you travel', bad: 'Multiple lines suspended — please check carefully' },
    updated: 'Updated', ago: 'ago', justNow: 'just now', sec: 's', min: 'm', hour: 'h',
    count: '', opBadge: 'lines', mappedTag: 'Mapped: ', noResult: 'No matching lines', loading: 'Loading…',
    loadFail: 'Failed to load data', autoRefresh: 'Auto refresh', companyCount: 'operators'
  }
};

const CAT = ['suspend', 'irregular', 'delay', 'resume', 'other', 'plan', 'normal', 'unknown'];
const CAT_COLOR = {
  suspend: 'var(--c-suspend)', irregular: 'var(--c-irr)', delay: 'var(--c-delay)',
  resume: 'var(--c-resume)', other: 'var(--c-other)', plan: 'var(--c-plan)',
  normal: 'var(--c-normal)', unknown: 'var(--fg-faint)'
};

/* ───────── state ───────── */
const state = {
  data: null,
  lang: localStorage.getItem('jrs_lang') || null,
  theme: localStorage.getItem('jrs_theme') || 'auto',
  q: '', area: 'ALL', troubleOnly: false, mappedOnly: false
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function t(key) {
  const L = I18N[state.lang] || I18N.zh;
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), L) ?? key;
}
const stLabel = (cat) => t('st.' + cat);
const severityOf = (c) => CAT.indexOf(c) === -1 ? 1 : (8 - CAT.indexOf(c));

/* ───────── theme & lang ───────── */
function resolveTheme() {
  return state.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : state.theme;
}
function applyTheme() {
  const mode = resolveTheme();
  document.documentElement.dataset.theme = mode;
  $('#themeIcon').textContent = mode === 'dark' ? '🌙' : '☀️';
  $('#themeTxt').textContent = state.theme === 'auto'
    ? (state.lang === 'en' ? 'Auto' : state.lang === 'ja' ? '自動' : '跟随')
    : (mode === 'dark'
      ? (state.lang === 'en' ? 'Dark' : state.lang === 'ja' ? 'ダーク' : '深色')
      : (state.lang === 'en' ? 'Light' : state.lang === 'ja' ? 'ライト' : '浅色'));
}
function applyLang() {
  document.documentElement.lang = state.lang === 'ja' ? 'ja' : state.lang === 'en' ? 'en' : 'zh';
  $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
  $$('[data-i18n-ph]').forEach(el => { const v = t(el.dataset.i18nPh); if (v) el.placeholder = v; });
  $('#langTxt').textContent = state.lang === 'ja' ? '日' : state.lang === 'en' ? 'EN' : '中';
}

/* ───────── helpers ───────── */
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function ago(iso) {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return t('justNow');
  if (s < 3600) return Math.floor(s / 60) + t('min') + t('ago');
  if (s < 86400) return Math.floor(s / 3600) + t('hour') + t('ago');
  return Math.floor(s / 86400) + 'd ' + t('ago');
}

/* ───────── render ───────── */
function renderStats() {
  const d = state.data;
  const bs = d.totals.by_status || {};
  const normal = bs.normal || 0;
  const suspend = bs.suspend || 0;
  const trouble = d.totals.trouble || 0;
  const cells = [
    ['lines', d.totals.lines, ''],
    ['companies', d.totals.companies, ''],
    ['normal', normal, 'is-normal'],
    ['trouble', trouble, trouble ? 'is-trouble' : ''],
    ['suspend', suspend, suspend ? 'is-suspend' : ''],
    ['mapped', d.totals.mapped, '']
  ];
  $('#stats').innerHTML = cells.map(([k, v, cls]) =>
    `<div class="scell ${cls}"><div class="k">${esc(t('stat.' + k))}</div><div class="v">${v}</div></div>`
  ).join('');

  // verdict
  const pulse = $('#verdictPulse');
  let cls = '', key = 'verdict.ok';
  if (suspend > 0) { cls = 'bad'; key = 'verdict.bad'; }
  else if (trouble > 0) { cls = 'warn'; key = 'verdict.warn'; }
  pulse.className = 'pulse ' + cls;
  $('#verdictText').textContent = t(key);

  // 更新时间 + 采集频率
  const meta = $('#meta');
  if (meta) {
    meta.innerHTML =
      `<span class="live"><i></i>${esc(t('updated'))} <b>${esc(d.updated_at_display)}</b>（${esc(ago(d.updated_at))}）</span>` +
      `<span>· ${esc(t('updateNote'))}</span>`;
  }
  $('#footMeta').textContent = `${t('updateNote')} · ${t('updated')} ${d.updated_at_display} · data/status.json`;
}

function renderAreaChips() {
  const counts = {};
  state.data.lines.forEach(l => { counts[l.area] = (counts[l.area] || 0) + 1; });
  const areas = ['ALL', ...(state.data.areas || [])];
  $('#areaChips').innerHTML = areas.map(a => {
    const isAll = a === 'ALL';
    const label = isAll ? t('all') : a;
    const cnt = isAll ? state.data.lines.length : (counts[a] || 0);
    if (!isAll && !cnt) return '';
    return `<button class="chip" data-area="${esc(a)}" aria-pressed="${state.area === a}">${esc(label)}<span class="cnt">${cnt}</span></button>`;
  }).join('');
  $$('#areaChips .chip').forEach(c => c.onclick = () => {
    state.area = c.dataset.area; renderAreaChips(); render();
  });
}

function lineMatch(l) {
  if (state.area !== 'ALL' && l.area !== state.area) return false;
  if (state.troubleOnly && l.severity <= 0) return false;
  if (state.mappedOnly && !l.mainline) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  const hay = [l.name, l.company, l.area, l.detail, l.label,
    l.mainline && l.mainline.line].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function lineRow(l) {
  const col = CAT_COLOR[l.status] || CAT_COLOR.unknown;
  const mapped = l.mainline
    ? `<span class="tag map">${esc(t('mappedTag'))}${esc(l.mainline.line)}</span>` : '';
  const detail = l.detail ? `<div class="dt">${esc(l.detail)}</div>` : '';
  return `<div class="lrow">
      <span class="dotc" style="background:${col}"></span>
      <div class="body">
        <div class="ttl">
          <span class="nm">${esc(l.name)}</span>
          <span class="st" style="color:${col}">${esc(stLabel(l.status))}</span>
          <span class="tag">${esc(l.label)}</span>
        </div>
        ${detail}
        ${(mapped || l.url) ? `<div class="tags">
            ${mapped}
            ${l.url ? `<span class="tag"><a href="${esc(l.url)}" target="_blank" rel="noopener">原文 ↗</a></span>` : ''}
          </div>` : ''}
      </div>
    </div>`;
}

function linePill(l) {
  const col = CAT_COLOR[l.status] || CAT_COLOR.unknown;
  return `<span class="line" title="${esc(l.label)}"><span class="s" style="background:${col}"></span><span class="line-name">${esc(l.name)}</span></span>`;
}

function render() {
  const lines = state.data.lines.filter(lineMatch);
  const box = $('#results');

  if (!lines.length) { box.innerHTML = `<div class="empty glass">${esc(t('noResult'))}</div>`; return; }

  const byCompany = new Map();
  lines.forEach(l => {
    const k = l.company + '||' + l.area;
    if (!byCompany.has(k)) byCompany.set(k, { company: l.company, area: l.area, lines: [] });
    byCompany.get(k).lines.push(l);
  });

  const cards = Array.from(byCompany.values()).map(g => {
    g.lines.sort((a, b) => (b.severity - a.severity) || a.name.localeCompare(b.name, 'ja'));
    const trouble = g.lines.filter(l => l.severity > 0);
    const ok = g.lines.filter(l => l.severity <= 0);
    return { ...g, trouble, ok, maxSev: trouble.length ? trouble[0].severity : 0 };
  });
  cards.sort((a, b) => (b.maxSev - a.maxSev) || a.company.localeCompare(b.company, 'ja'));

  box.innerHTML = cards.map(g => {
    const troubleHtml = g.trouble.length
      ? `<div>${g.trouble.map(lineRow).join('')}</div>` : '';
    const okHtml = (state.troubleOnly || !g.ok.length) ? '' :
      `<div class="lines">${g.ok.map(linePill).join('')}</div>`;
    return `<article class="card glass ${g.trouble.length ? '' : 'compact'}">
        <div class="card-head">
          <span class="op">${esc(g.company)}</span>
          <span class="area">${esc(g.area)}</span>
          <span class="badge">${g.lines.length} ${esc(t('opBadge'))}${g.trouble.length ? ` · ${g.trouble.length} ⚠` : ''}</span>
        </div>
        ${troubleHtml}
        ${okHtml}
      </article>`;
  }).join('');
}

/* ───────── data ───────── */
let refreshTimer = null, countTimer = null;

async function load() {
  $('#refreshIcon').textContent = '⟳';
  try {
    const r = await fetch('data/status.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    state.data = await r.json();
    renderStats(); renderAreaChips(); render();
    $('#refreshTxt').textContent = t('refresh');
    $('#refreshIcon').textContent = '↻';
  } catch (e) {
    const meta = $('#meta');
    if (meta) meta.innerHTML = `<span>${esc(t('loadFail'))}</span>`;
    $('#refreshIcon').textContent = '⚠';
  }
}

/* ───────── init ───────── */
function detectLang() {
  const nav = (navigator.language || '').toLowerCase();
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  if (tz.startsWith('Asia/Tokyo') || nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('zh') || tz.startsWith('Asia/Shanghai') ||
      tz.startsWith('Asia/Taipei') || tz.startsWith('Asia/Hong_Kong')) return 'zh';
  return 'en';
}

function boot() {
  state.lang = state.lang || detectLang();
  applyTheme(); applyLang();

  $('#btnTheme').onclick = () => {
    const seq = ['auto', 'dark', 'light'];
    state.theme = seq[(seq.indexOf(state.theme) + 1) % seq.length];
    localStorage.setItem('jrs_theme', state.theme);
    applyTheme();
  };
  $('#btnLang').onclick = () => {
    const seq = ['zh', 'ja', 'en'];
    state.lang = seq[(seq.indexOf(state.lang) + 1) % seq.length];
    localStorage.setItem('jrs_lang', state.lang);
    applyLang(); renderStats(); renderAreaChips(); render();
  };
  $('#btnRefresh').onclick = () => load();

  let qTimer = null;
  $('#q').oninput = (e) => {
    clearTimeout(qTimer);
    const v = e.target.value;
    qTimer = setTimeout(() => { state.q = v; render(); }, 160);
  };

  const link = (id, key) => {
    $(id).onclick = () => {
      state[key] = !state[key];
      $(id).setAttribute('aria-pressed', String(state[key]));
      render();
    };
  };
  const setTrouble = (v) => {
    state.troubleOnly = v;
    $('#filterTrouble').setAttribute('aria-pressed', String(v));
    $('#filterAll').setAttribute('aria-pressed', String(!v));
    render();
  };
  $('#filterTrouble').onclick = () => setTrouble(!state.troubleOnly);
  $('#filterAll').onclick = () => setTrouble(false);
  link('#toggleMapped', 'mappedOnly');

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  const meta = $('#meta');
  if (meta) meta.innerHTML = `<span class="live"><i></i>${esc(t('loading'))}</span>`;
  load();
  refreshTimer = setInterval(load, 60000);            // 每分钟检查新数据
  countTimer = setInterval(() => { if (state.data) renderStats(); }, 20000);
}

document.addEventListener('DOMContentLoaded', boot);
