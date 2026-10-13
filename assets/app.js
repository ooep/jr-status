/* jr-status — UI logic
   读取 data/status.json（定期更新），渲染全国线路运行情报。 */

'use strict';

/* ───────── i18n ───────── */
const I18N = {
  zh: {
    appName: 'JR-Status',
    brandSub: '全日本铁道运行情报 · Mini JapanRail',
    searchPh: '搜索线路 / 铁道公司…',
    refresh: '刷新',
    eyebrow: 'MINI JAPANRAIL · STATUS',
    heroTitle: '全日本铁道 · 运行情报',
    all: '全部', troubleOnly: '仅异常', mappedOnly: '仅已映射主站',
    srcLabel: '数据来源', mainSite: 'Mini JapanRail 主站',
    theme: '主题', langLabel: '语言', clear: '清除',
    viewOriginal: '查看原文', modalOk: '确定', noDetail: '（暂无更详细的说明）',
    publishLabel: '发布于',
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
    eyebrow: 'MINI JAPANRAIL · STATUS',
    heroTitle: '全国鉄道 · 運行情報',
    all: 'すべて', troubleOnly: '異常のみ', mappedOnly: 'マッピング済みのみ',
    srcLabel: 'データ元', mainSite: 'Mini JapanRail 本サイト',
    theme: 'テーマ', langLabel: '言語', clear: 'クリア',
    viewOriginal: '原文を表示', modalOk: 'OK', noDetail: '（詳細な説明はありません）',
    publishLabel: '掲載',
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
    eyebrow: 'MINI JAPANRAIL · STATUS',
    heroTitle: 'Japan Railways · Live Status',
    all: 'All', troubleOnly: 'Disrupted only', mappedOnly: 'Mapped only',
    srcLabel: 'Source', mainSite: 'Mini JapanRail main site',
    theme: 'Theme', langLabel: 'Language', clear: 'Clear',
    viewOriginal: 'View original', modalOk: 'OK', noDetail: '(No further details)',
    publishLabel: 'Published',
    stat: { lines: 'Lines', normal: 'Normal', trouble: 'Disrupted', suspend: 'Suspended', companies: 'Operators', mapped: 'Mapped' },
    st: { normal: 'Normal', delay: 'Delayed', suspend: 'Suspended', irregular: 'Irregular', plan: 'Planned change', resume: 'Resuming', other: 'Other', unknown: 'Unknown' },
    verdict: { ok: 'Lines nationwide are running normally', warn: 'Some lines are disrupted — check before you travel', bad: 'Multiple lines suspended — please check carefully' },
    updated: 'Updated', ago: 'ago', justNow: 'just now', sec: 's', min: 'm', hour: 'h',
    count: '', opBadge: 'lines', mappedTag: 'Mapped: ', noResult: 'No matching lines', loading: 'Loading…',
    loadFail: 'Failed to load data', autoRefresh: 'Auto refresh', companyCount: 'operators'
  }
};

/* ───────── 图标（内联 SVG，避免 emoji 的跨平台观感差异） ───────── */
const ICONS = {
  moon:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  sun:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  auto:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></svg>',
  alert:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17.5h.01"/></svg>',
  globe:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13.5 13.5 0 0 1 3.5 9A13.5 13.5 0 0 1 12 21a13.5 13.5 0 0 1-3.5-9A13.5 13.5 0 0 1 12 3Z"/></svg>'
};

const CAT = ['suspend', 'irregular', 'delay', 'resume', 'other', 'plan', 'normal', 'unknown'];
const CAT_COLOR = {
  suspend: 'var(--c-suspend)', irregular: 'var(--c-irr)', delay: 'var(--c-delay)',
  resume: 'var(--c-resume)', other: 'var(--c-other)', plan: 'var(--c-plan)',
  normal: 'var(--c-normal)', unknown: 'var(--fg-faint)'
};
/* 与 CAT_COLOR 对应的原始 RGB，用于生成半透明底色（避免依赖 color-mix） */
const CAT_RGB = {
  suspend: '248,113,113', irregular: '251,146,60', delay: '251,191,36',
  resume: '45,212,191', other: '192,132,252', plan: '96,165,250',
  normal: '52,211,153', unknown: '160,174,192'
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
  // 跟随系统时用「半明半暗」图标，与显式深/浅区分
  $('#themeIcon').innerHTML = state.theme === 'auto' ? ICONS.auto : (mode === 'dark' ? ICONS.moon : ICONS.sun);
  $('#themeTxt').textContent = state.theme === 'auto'
    ? (state.lang === 'en' ? 'Auto' : state.lang === 'ja' ? '自動' : '跟随')
    : (mode === 'dark'
      ? (state.lang === 'en' ? 'Dark' : state.lang === 'ja' ? 'ダーク' : '深色')
      : (state.lang === 'en' ? 'Light' : state.lang === 'ja' ? 'ライト' : '浅色'));
  $('#btnTheme').setAttribute('aria-label', t('theme'));
  $('#btnTheme').title = t('theme');
}
function applyLang() {
  document.documentElement.lang = state.lang === 'ja' ? 'ja' : state.lang === 'en' ? 'en' : 'zh';
  $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
  $$('[data-i18n-ph]').forEach(el => { const v = t(el.dataset.i18nPh); if (v) el.placeholder = v; });
  $('#langTxt').textContent = state.lang === 'ja' ? '日' : state.lang === 'en' ? 'EN' : '中';
  $('#btnLang').setAttribute('aria-label', t('langLabel'));
  $('#btnLang').title = t('langLabel');
  $('#btnRefresh').setAttribute('aria-label', t('refresh'));
  $('#btnRefresh').title = t('refresh');
  $('#qClear').setAttribute('aria-label', t('clear'));
  $('#qClear').title = t('clear');
  applyTheme();   // 主题按钮文字随语言刷新
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

  // 状态图例（解释下方卡片中圆点色的语义）
  const LEG = ['normal', 'delay', 'irregular', 'suspend'];
  $('#legend').innerHTML = LEG.map(k =>
    `<span class="lg"><i style="background:${CAT_COLOR[k]}"></i>${esc(t('st.' + k))}</span>`
  ).join('');

  // verdict
  const pulse = $('#verdictPulse');
  let cls = '', key = 'verdict.ok';
  if (suspend > 0) { cls = 'bad'; key = 'verdict.bad'; }
  else if (trouble > 0) { cls = 'warn'; key = 'verdict.warn'; }
  pulse.className = 'pulse ' + cls;
  $('#verdictText').textContent = t(key);

  // 更新时间
  const meta = $('#meta');
  if (meta) {
    meta.innerHTML =
      `<span class="live"><i></i>${esc(t('updated'))} <b>${esc(d.updated_at_display)}</b>（${esc(ago(d.updated_at))}）</span>`;
  }
  $('#footMeta').textContent = `${t('updated')} ${d.updated_at_display} · data/status.json`;
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
  // 「查看原文」：不再跳转源站，改为站内弹窗展示完整原文
  const viewBtn = l.url
    ? `<button type="button" class="tag tag-act" data-view="1"
         data-name="${esc(l.name)}" data-status="${esc(l.status)}" data-label="${esc(l.label)}"
         data-company="${esc(l.company)}" data-area="${esc(l.area)}"
         data-detail="${esc(l.detail_full || l.detail)}">${esc(t('viewOriginal'))}</button>`
    : '';
  return `<div class="lrow">
      <span class="dotc" style="background:${col}"></span>
      <div class="body">
        <div class="ttl">
          <span class="nm">${esc(l.name)}</span>
          <span class="st" style="color:${col}">${esc(stLabel(l.status))}</span>
          <span class="tag">${esc(l.label)}</span>
        </div>
        ${detail}
        ${(mapped || viewBtn) ? `<div class="tags">
            ${mapped}
            ${viewBtn}
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

/* ───────── 原文弹窗 ───────── */
let modalLastFocus = null;

/* 从原文末尾剥离「（10月13日 12時30分掲載）」时间戳，单独展示 */
const PUBLISH_RE = /（(\d{1,2}月\d{1,2}日\s*\d{1,2}時\d{1,2}分)掲載）\s*$/;
function splitPublished(txt) {
  const m = (txt || '').match(PUBLISH_RE);
  if (!m) return { text: txt || '', published: '' };
  return { text: txt.slice(0, m.index).trim(), published: m[1].replace(/\s+/g, ' ') };
}

/* 滚动位置 -> 顶/底渐隐提示 */
function updateModalFades() {
  const sc = $('#srcModalScroll'), body = $('#srcModalBody');
  sc.classList.toggle('can-up', body.scrollTop > 4);
  sc.classList.toggle('can-down', body.scrollTop + body.clientHeight < body.scrollHeight - 4);
}

function openSourceModal(el) {
  const d = el.dataset;
  const col = CAT_COLOR[d.status] || CAT_COLOR.unknown;
  $('#srcModalDot').style.background = col;
  $('#srcModalTitle').textContent = d.name || '';
  $('#srcModalSub').textContent = [d.company, d.area].filter(Boolean).join(' · ');
  // 状态徽标：状态色文字 + 同色淡底 + 同色细边
  const chip = $('#srcModalStatus');
  const rgb = CAT_RGB[d.status] || CAT_RGB.unknown;
  chip.textContent = stLabel(d.status);
  chip.style.color = col;
  chip.style.background = `rgba(${rgb}, .13)`;
  chip.style.borderColor = `rgba(${rgb}, .34)`;
  // 正文：剥离掲載时间；无内容给兜底文案
  const { text, published } = splitPublished(d.detail || '');
  $('#srcModalBody').textContent = text.trim() || t('noDetail');
  $('#srcModalPub').textContent = published ? `${t('publishLabel')} ${published}` : '';

  modalLastFocus = el;
  $('#srcModal').hidden = false;
  document.body.style.overflow = 'hidden';   // 锁背后滚动
  $('#srcModalBody').scrollTop = 0;
  updateModalFades();
  $('#srcModalOk').focus();
}

function closeSourceModal() {
  const ov = $('#srcModal');
  if (ov.hidden) return;
  document.body.style.overflow = '';
  if (modalLastFocus) { modalLastFocus.focus(); modalLastFocus = null; }
  ov.classList.add('closing');
  setTimeout(() => { ov.hidden = true; ov.classList.remove('closing'); }, 180);
}

/* ───────── data ───────── */
let refreshTimer = null, countTimer = null;

async function load() {
  const rBtn = $('#btnRefresh');
  rBtn.classList.add('loading');
  rBtn.classList.remove('err');
  try {
    const r = await fetch('data/status.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    state.data = await r.json();
    renderStats(); renderAreaChips(); render();
    $('#refreshTxt').textContent = t('refresh');
  } catch (e) {
    const meta = $('#meta');
    if (meta) meta.innerHTML = `<span>${esc(t('loadFail'))}</span>`;
    $('#refreshIcon').innerHTML = ICONS.alert;
    rBtn.classList.add('err');
  } finally {
    rBtn.classList.remove('loading');
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
  $('#langIcon').innerHTML = ICONS.globe;
  $('#refreshIcon').innerHTML = ICONS.refresh;

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

  /* 搜索：输入态显隐（快捷键提示 ⇄ 清除按钮）、防抖过滤、Esc 清空 */
  const qEl = $('#q'), searchBox = $('#searchBox');
  let qTimer = null;
  qEl.addEventListener('input', () => {
    searchBox.classList.toggle('has-value', !!qEl.value);
    clearTimeout(qTimer);
    const v = qEl.value;
    qTimer = setTimeout(() => { state.q = v; render(); }, 160);
  });
  const clearSearch = () => {
    qEl.value = '';
    searchBox.classList.remove('has-value');
    if (state.q) { state.q = ''; render(); }
  };
  $('#qClear').addEventListener('click', () => { clearSearch(); qEl.focus(); });

  /* 快捷键：⌘K / Ctrl+K 聚焦，/ 聚焦，Esc 清空失焦 */
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $('#kbdHint').textContent = isMac ? '⌘K' : 'Ctrl K';
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement || {}).tagName || '';
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
    if (e.key === 'Escape' && !$('#srcModal').hidden) { closeSourceModal(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); qEl.focus(); qEl.select();
    } else if (e.key === '/' && !typing) {
      e.preventDefault(); qEl.focus();
    } else if (e.key === 'Escape' && document.activeElement === qEl) {
      clearSearch(); qEl.blur();
    }
  });

  /* 原文弹窗：行内按钮打开；确定/遮罩/Esc 关闭；滚动联动顶底渐隐 */
  $('#results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) openSourceModal(b);
  });
  $('#srcModalBody').addEventListener('scroll', updateModalFades, { passive: true });
  $('#srcModalOk').addEventListener('click', closeSourceModal);
  $('#srcModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSourceModal();   // 点遮罩关闭
  });

  /* 顶栏滚动状态：越过阈值后加深阴影，给出悬浮层次 */
  const topbar = $('#topbar');
  const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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
