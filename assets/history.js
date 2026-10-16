/* jr-status — 历史故障记录页 UI
   读取 data/history/index.json + data/history/page-N.json（分页数据，每页 30 条），
   按时间倒序展示全部状态变化事件。 */

'use strict';

/* ───────── i18n ───────── */
const I18N = {
  zh: {
    appName: 'JR-Status',
    brandSub: '全日本铁道运行情报 · Mini JapanRail',
    eyebrow: 'MINI JAPANRAIL · INCIDENT HISTORY',
    title: '历史故障记录',
    back: '返回实时状态',
    theme: '主题', langLabel: '语言',
    loading: '正在读取数据…',
    loadFail: '数据读取失败，请稍后重试',
    noData: '暂无故障记录',
    total: '共', records: '条故障记录', pages: '页',
    updated: '更新于', range: '记录范围',
    prev: '上一页', next: '下一页', first: '首页', last: '末页',
    pageInfo: '第 {p} / {n} 页 · 共 {t} 条',
    fromLabel: '变化前', toLabel: '变化后',
    viewFull: '查看全文', modalOk: '确定', noDetail: '无更多详情', publishLabel: '发布于',
    durEnd: '持续', durActive: '已持续', durH: '小时', durM: '分', durNow: '不足1分',
    st: { normal: '平常运营', delay: '列车晚点', suspend: '停运', irregular: '运行异常', plan: '计划调整', resume: '恢复运行', other: '其他', unknown: '未知' },
    mainSite: 'Mini JapanRail 主站',
    skipToResults: '跳到故障列表'
  },
  ja: {
    appName: 'JR-Status',
    brandSub: '全国鉄道 運行情報 · Mini JapanRail',
    eyebrow: 'MINI JAPANRAIL · 障害履歴',
    title: '過去の障害',
    back: 'リアルタイム状況へ戻る',
    theme: 'テーマ', langLabel: '言語',
    loading: '読み込み中…',
    loadFail: 'データ取得に失敗しました',
    noData: '障害記録はありません',
    total: '合計', records: '件の障害記録', pages: 'ページ',
    updated: '更新', range: '記録範囲',
    prev: '前へ', next: '次へ', first: '最初', last: '最後',
    pageInfo: '{p} / {n} ページ · 全 {t} 件',
    fromLabel: '変化前', toLabel: '変化後',
    viewFull: '全文を見る', modalOk: 'OK', noDetail: '詳細はありません', publishLabel: '掲載',
    durEnd: '継続', durActive: '継続中', durH: '時間', durM: '分', durNow: '1分未満',
    st: { normal: '平常運転', delay: '列車遅延', suspend: '運転見合わせ', irregular: '運転状況', plan: '運転計画', resume: '運転再開', other: 'その他', unknown: '不明' },
    mainSite: 'Mini JapanRail 本サイト',
    skipToResults: '障害一覧へスキップ'
  },
  en: {
    appName: 'JR-Status',
    brandSub: 'Japan Railway Service Status · Mini JapanRail',
    eyebrow: 'MINI JAPANRAIL · INCIDENT HISTORY',
    title: 'Incident History',
    back: 'Back to live status',
    theme: 'Theme', langLabel: 'Language',
    loading: 'Loading…',
    loadFail: 'Failed to load data',
    noData: 'No incidents recorded',
    total: '', records: 'incidents', pages: 'pages',
    updated: 'Updated', range: 'Range',
    prev: 'Prev', next: 'Next', first: 'First', last: 'Last',
    pageInfo: 'Page {p} / {n} · {t} records',
    fromLabel: 'Before', toLabel: 'After',
    viewFull: 'View full text', modalOk: 'OK', noDetail: 'No further details', publishLabel: 'Published',
    durEnd: 'Lasted', durActive: 'Ongoing for', durH: '', durM: '', durNow: '< 1 min',
    st: { normal: 'Normal', delay: 'Delayed', suspend: 'Suspended', irregular: 'Irregular', plan: 'Planned change', resume: 'Resuming', other: 'Other', unknown: 'Unknown' },
    mainSite: 'Mini JapanRail main site',
    skipToResults: 'Skip to incident list'
  }
};

/* ───────── 状态色（与主页面同一套 CSS 变量） ───────── */
const CAT = ['suspend', 'irregular', 'delay', 'resume', 'other', 'plan', 'normal', 'unknown'];
const CAT_COLOR = {
  suspend: 'var(--c-suspend)', irregular: 'var(--c-irr)', delay: 'var(--c-delay)',
  resume: 'var(--c-resume)', other: 'var(--c-other)', plan: 'var(--c-plan)',
  normal: 'var(--c-normal)', unknown: 'var(--fg-faint)'
};

/* ───────── state ───────── */
const state = {
  lang: localStorage.getItem('jrs_lang') || null,
  theme: localStorage.getItem('jrs_theme') || 'auto',
  index: null,
  page: 1
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function t(key) {
  const L = I18N[state.lang] || I18N.zh;
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), L) ?? key;
}
const stLabel = (cat) => t('st.' + cat) || cat;
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* 多语展示：ja 用原文；zh/en 用对应译文，缺失回落日语原文 */
function tr(e, field) {
  const raw = e[field];
  if (!raw) return '';
  if (state.lang === 'ja') return raw;
  return e[field + (state.lang === 'zh' ? '_zh' : '_en')] || raw;
}

/* ───────── theme & lang ───────── */
function resolveTheme() {
  return state.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : state.theme;
}
function applyTheme() {
  const mode = resolveTheme();
  document.documentElement.dataset.theme = mode;
  $('#themeTxt').textContent = state.theme === 'auto'
    ? (state.lang === 'en' ? 'Auto' : state.lang === 'ja' ? '自動' : '跟随')
    : (mode === 'dark'
      ? (state.lang === 'en' ? 'Dark' : state.lang === 'ja' ? 'ダーク' : '深色')
      : (state.lang === 'en' ? 'Light' : state.lang === 'ja' ? 'ライト' : '浅色'));
  $('#themeIcon').innerHTML = state.theme === 'auto'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></svg>'
    : (mode === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>');
  $('#btnTheme').setAttribute('aria-label', t('theme'));
  $('#btnTheme').title = t('theme');
}
function applyLang() {
  document.documentElement.lang = state.lang === 'ja' ? 'ja' : state.lang === 'en' ? 'en' : 'zh';
  $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
  $('#langTxt').textContent = state.lang === 'ja' ? '日' : state.lang === 'en' ? 'EN' : '中';
  $('#btnLang').setAttribute('aria-label', t('langLabel'));
  $('#btnLang').title = t('langLabel');
  applyTheme();
}

/* ───────── 公司 logo（复用 assets/logo-map.js） ───────── */
function companyColor(company) {
  const c = LOGO_COLORS[company];
  return (Array.isArray(c) && c.length === 3 ? c : [56, 189, 248]).join(',');
}
function logoShort(name) {
  const n = String(name || '');
  return /^JR/.test(n) ? 'JR' : (n.slice(0, 1) || '?');
}
function companyLogoHTML(company, size) {
  const file = LOGO_FILES[company];
  const style = `--bc:${companyColor(company)}${size ? `;--ls:${size}px` : ''}`;
  const short = esc(logoShort(company));
  if (!file) return `<span class="op-logo" style="${style}" data-short="${short}"></span>`;
  return `<span class="op-logo" style="${style}" data-short="${short}">
    <img src="assets/logos/${encodeURIComponent(file)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">
  </span>`;
}

/* ───────── 时间展示（事件 at 为 JST 偏移，直接取本地文本） ───────── */
function fmtTime(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return String(iso || '');
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
}

/* ───────── 渲染 ───────── */

/* 完整详情：译文只覆盖正文，掲載时间戳由 detail_full_pub 单独展示 */
function fullMore(e) {
  const main = e.detail_full_main || e.detail_full || '';
  if (state.lang === 'ja') return main;
  const key = state.lang === 'zh' ? 'detail_full_zh' : 'detail_full_en';
  return e[key] || main;
}

/* 故障持续时间：ended 用事件时间 - dur_start（精确固定）；active 用当前时间实时算 */
function fmtDur(mins) {
  if (mins < 1) return t('durNow');
  const h = Math.floor(mins / 60), m = mins % 60;
  if (state.lang === 'en') return h ? `${h}h ${m}m` : `${m}m`;
  return h ? `${h}${t('durH')}${m ? m + t('durM') : ''}` : `${m}${t('durM')}`;
}
function durHTML(e) {
  if (!e.dur_start) return '';
  const ended = e.dur_state === 'ended';
  const start = new Date(e.dur_start).getTime();
  const end = ended ? new Date(e.at).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const label = ended ? t('durEnd') : t('durActive');
  return `<span class="hdur ${ended ? 'ended' : 'active'}" data-dur="${ended ? '0' : '1'}"
      data-start="${esc(e.dur_start)}">${esc(label)} ${esc(fmtDur(mins))}</span>`;
}

function eventRow(e) {
  const colFrom = CAT_COLOR[e.from] || CAT_COLOR.unknown;
  const colTo = CAT_COLOR[e.to] || CAT_COLOR.unknown;
  const dot = (col, cat) => `<span class="dotc" style="background:${col};box-shadow:0 0 6px ${col}" title="${esc(stLabel(cat))}"></span>`;
  const chip = (col, cat, raw) => {
    const main = stLabel(cat);
    // ja：分类名 + 原文（与分类名不同才显示）；zh/en：优先显示更具体的标签译文
    const showRaw = raw && raw !== main;
    const body = state.lang === 'ja'
      ? `${main}${showRaw ? `<i class="hraw">${esc(raw)}</i>` : ''}`
      : (showRaw ? esc(raw) : main);
    return `<span class="hchip" style="color:${col};background:color-mix(in srgb, ${col} 12%, transparent);border-color:color-mix(in srgb, ${col} 38%, transparent)">
       ${body}
     </span>`;
  };
  // 「查看全文」：仅当该事件记录过完整详情（detail_full）时提供弹窗
  const hasMore = !!(e.detail_full_main || e.detail_full);
  const moreBtn = hasMore
    ? `<button type="button" class="tag tag-act" data-more="1"
         data-name="${esc(e.name)}" data-company="${esc(e.company)}" data-area="${esc(e.area || '')}"
         data-status="${esc(e.to)}" data-detail="${esc(fullMore(e))}" data-pub="${esc(e.detail_full_pub || '')}">${esc(t('viewFull'))}</button>`
    : '';
  return `<article class="hcard glass" style="--bc:${companyColor(e.company)}">
    <div class="hcard-head">
      <time class="htime">${esc(fmtTime(e.at))}</time>
      ${durHTML(e)}
      <span class="grow"></span>
      ${companyLogoHTML(e.company, 16)}
      <span class="hop" title="${esc(e.company)}">${esc(e.company)}</span>
      ${e.area ? `<span class="harea">${esc(e.area)}</span>` : ''}
    </div>
    <div class="lrow">
      ${dot(colFrom, e.from)}
      <div class="body">
        <div class="ttl">
          <span class="nm">${esc(e.name)}</span>
          ${chip(colFrom, e.from, tr(e, 'from_label'))}
          <span class="harrow" aria-hidden="true">→</span>
          ${chip(colTo, e.to, tr(e, 'to_label'))}
        </div>
        ${tr(e, 'detail') ? `<div class="dt">${esc(tr(e, 'detail'))}</div>` : ''}
        ${moreBtn ? `<div class="tags">${moreBtn}</div>` : ''}
      </div>
    </div>
  </article>`;
}

function renderList(events) {
  const box = $('#hList');
  if (!events || !events.length) {
    box.innerHTML = `<div class="empty glass">
        <svg class="empty-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.7-4.7" stroke-linecap="round"/>
        </svg>
        <div class="empty-t">${esc(t('noData'))}</div>
      </div>`;
    return;
  }
  box.innerHTML = events.map(eventRow).join('');
}

/* ───────── 分页 ───────── */
function pageWindow(cur, n) {
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
  const set = new Set([1, 2, cur - 1, cur, cur + 1, n - 1, n]);
  const items = [];
  let prev = 0;
  [...set].filter(p => p >= 1 && p <= n).sort((a, b) => a - b).forEach(p => {
    if (p - prev > 1) items.push('…');
    items.push(p);
    prev = p;
  });
  return items;
}

function renderPager() {
  const idx = state.index;
  if (!idx || idx.pages <= 1) { $('#hPager').hidden = true; return; }
  const n = idx.pages, cur = state.page;
  const btn = (label, key, disabled) =>
    `<button class="pbtn" type="button" data-p="${key}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
  $('#hPager').innerHTML =
    btn(t('first'), 1, cur === 1) +
    btn(t('prev'), cur - 1, cur === 1) +
    pageWindow(cur, n).map(p =>
      p === '…' ? '<span class="pell">…</span>'
        : `<button class="pbtn pnum ${p === cur ? 'active" aria-current="page' : ''}" type="button" data-p="${p}">${p}</button>`
    ).join('') +
    btn(t('next'), cur + 1, cur === n) +
    btn(t('last'), n, cur === n) +
    `<span class="pinfo">${t('pageInfo').replace('{p}', cur).replace('{n}', n).replace('{t}', idx.total)}</span>`;
  $('#hPager').hidden = false;
  $$('#hPager .pbtn').forEach(b => b.onclick = () => go(Number(b.dataset.p)));
}

/* ───────── 数据 ───────── */
let lastEvents = null;   // 当前页事件缓存（切换语言时按新语种重渲染）

async function loadPage(n) {
  const idx = state.index;
  const page = Math.max(1, Math.min(n, idx.pages || 1));
  state.page = page;
  try {
    const r = await fetch(`data/history/page-${page}.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    lastEvents = data.events;
    renderList(lastEvents);
    renderPager();
    const url = page === 1 ? location.pathname : `history.html?page=${page}`;
    history.replaceState(null, '', url);
    $('#hList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    const box = $('#hList');
    box.innerHTML = `<div class="empty glass">
        <svg class="empty-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <path d="M12 9v4M12 17.5h.01"/><circle cx="12" cy="12" r="9"/>
        </svg>
        <div class="empty-t">${esc(t('loadFail'))}</div>
      </div>`;
    renderPager();
  }
}

function go(n) { if (state.index && n >= 1 && n <= state.index.pages && n !== state.page) loadPage(n); }

async function loadIndex() {
  const meta = $('#hMeta');
  try {
    const r = await fetch('data/history/index.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    state.index = await r.json();
    const idx = state.index;
    $('#hFootMeta').textContent =
      `${t('updated')} ${fmtTime(idx.updated_at).slice(0, 16)} · ${t('total')} ${idx.total} ${t('records')} · ${idx.pages} ${t('pages')}`;
    const range = idx.range && idx.range.from && idx.range.to
      ? `<span class="hrange">${esc(t('range'))}：${esc(fmtTime(idx.range.to).slice(0, 16))} ~ ${esc(fmtTime(idx.range.from).slice(0, 16))}</span>`
      : '';
    meta.innerHTML = `<span class="live"><i></i>${esc(t('updated'))} <b>${esc(fmtTime(idx.updated_at).slice(0, 16))}</b></span>${range}`;
    const want = Math.max(1, parseInt(new URLSearchParams(location.search).get('page') || '1', 10) || 1);
    await loadPage(want);
  } catch (e) {
    meta.innerHTML = `<span>${esc(t('loadFail'))}</span>`;
    $('#hList').innerHTML = `<div class="empty glass"><div class="empty-t">${esc(t('loadFail'))}</div></div>`;
  }
}

/* ───────── 全文弹窗 ───────── */
let modalLastFocus = null;
function openFullModal(el) {
  const d = el.dataset;
  const col = CAT_COLOR[d.status] || CAT_COLOR.unknown;
  $('#srcModalDot').style.background = col;
  $('#srcModalTitle').textContent = d.name || '';
  $('#srcModalSub').innerHTML = `${companyLogoHTML(d.company, 18)}<span>${esc(d.company)}</span>${d.area ? ` · ${esc(d.area)}` : ''}`;
  const chip = $('#srcModalStatus');
  chip.textContent = stLabel(d.status);
  chip.style.color = col;
  $('#srcModalBody').textContent = (d.detail || '').trim() || t('noDetail');
  const pub = (d.pub || '').replace(/\s+/g, ' ');
  $('#srcModalPub').textContent = pub ? `${t('publishLabel')} ${pub}` : '';
  modalLastFocus = el;
  $('#srcModal').hidden = false;
  document.body.style.overflow = 'hidden';   // 锁背后滚动
  $('#srcModalBody').scrollTop = 0;
  $('#srcModalOk').focus();
}
function closeFullModal() {
  const ov = $('#srcModal');
  if (ov.hidden) return;
  document.body.style.overflow = '';
  if (modalLastFocus) { modalLastFocus.focus(); modalLastFocus = null; }
  ov.classList.add('closing');
  setTimeout(() => { ov.hidden = true; ov.classList.remove('closing'); }, 180);
}

/* 进行中故障的时长每分钟刷新一次（不重渲染整页） */
function refreshActiveDurations() {
  document.querySelectorAll('#hList .hdur[data-dur="1"]').forEach(el => {
    const start = new Date(el.dataset.start).getTime();
    const mins = Math.max(0, Math.round((Date.now() - start) / 60000));
    el.textContent = `${t('durActive')} ${fmtDur(mins)}`;
  });
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
  applyLang(); applyTheme();

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
    applyLang();
    if (lastEvents) renderList(lastEvents);
    if (state.index) renderPager();
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  /* 全文弹窗：事件委托（列表会随翻页重建，委托到容器最稳） */
  $('#hList').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-more="1"]');
    if (b) { openFullModal(b); return; }
  });
  $('#srcModalOk').onclick = closeFullModal;
  $('#srcModal').addEventListener('click', (ev) => {
    if (ev.target === $('#srcModal')) closeFullModal();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('#srcModal').hidden) closeFullModal();
  });
  setInterval(refreshActiveDurations, 60000);

  const topbar = $('#topbar');
  const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  loadIndex();
}

document.addEventListener('DOMContentLoaded', boot);
