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
    srcLabel: '数据来源', mainSite: 'Mini JapanRail 主站', historyLink: '历史故障',
    theme: '主题', langLabel: '语言', clear: '清除',
    viewOriginal: '查看原文', modalOk: '确定', noDetail: '（暂无更详细的说明）',
    publishLabel: '发布于',
    stat: { lines: '线路总数', normal: '平常运营', trouble: '异常合计', suspend: '停运', companies: '铁道公司', mapped: '已映射主站' },
    st: { normal: '平常运营', delay: '列车晚点', suspend: '停运', irregular: '运行异常', plan: '计划调整', resume: '恢复运行', other: '其他', unknown: '未知' },
    verdict: { ok: '全国线路基本正常运营', warn: '部分线路出现异常，出行前请确认', bad: '多条线路停运，请务必确认' },
    updated: '更新于', ago: '前', justNow: '刚刚', sec: '秒', min: '分钟', hour: '小时',
    count: '条', opBadge: '条线路', mappedTag: '已映射主站：', noResult: '没有匹配的线路',
    noResultSub: '换个关键词，或切换地区与筛选条件试试',
    skipToResults: '跳到线路列表',
    mapTitle: '全国运行态势图', mapSuspend: '停运', mapDelay: '延迟 · 异常', mapOk: '正常',
    mapNote: '点击地区筛选 · 示意地图，非精确比例',
    mapAllOk: '这一侧暂无异常线路',
    loading: '正在读取数据…',
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
    srcLabel: 'データ元', mainSite: 'Mini JapanRail 本サイト', historyLink: '過去の障害',
    theme: 'テーマ', langLabel: '言語', clear: 'クリア',
    viewOriginal: '原文を表示', modalOk: 'OK', noDetail: '（詳細な説明はありません）',
    publishLabel: '掲載',
    stat: { lines: '路線数', normal: '平常運転', trouble: '異常計', suspend: '運転見合わせ', companies: '鉄道会社', mapped: 'マッピング済み' },
    st: { normal: '平常運転', delay: '列車遅延', suspend: '運転見合わせ', irregular: '運転状況', plan: '運転計画', resume: '運転再開', other: 'その他', unknown: '不明' },
    verdict: { ok: '全国の路線はおおむね平常運転です', warn: '一部路線に乱れがあります。お出かけ前にご確認ください', bad: '複数の路線で運転見合わせが発生しています' },
    updated: '更新', ago: '前', justNow: 'たった今', sec: '秒', min: '分', hour: '時間',
    count: '件', opBadge: '路線', mappedTag: 'マッピング：', noResult: '該当する路線がありません',
    noResultSub: '別のキーワードや地域・条件でお試しください',
    skipToResults: '路線一覧へスキップ',
    mapTitle: '全国運行状況マップ', mapSuspend: '見合わせ', mapDelay: '遅延・乱れ', mapOk: '平常',
    mapNote: '地域クリックで絞り込み · 概略地図',
    mapAllOk: 'こちらに異常はありません',
    loading: '読み込み中…',
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
    srcLabel: 'Source', mainSite: 'Mini JapanRail main site', historyLink: 'Incident history',
    theme: 'Theme', langLabel: 'Language', clear: 'Clear',
    viewOriginal: 'View original', modalOk: 'OK', noDetail: '(No further details)',
    publishLabel: 'Published',
    stat: { lines: 'Lines', normal: 'Normal', trouble: 'Disrupted', suspend: 'Suspended', companies: 'Operators', mapped: 'Mapped' },
    st: { normal: 'Normal', delay: 'Delayed', suspend: 'Suspended', irregular: 'Irregular', plan: 'Planned change', resume: 'Resuming', other: 'Other', unknown: 'Unknown' },
    verdict: { ok: 'Lines nationwide are running normally', warn: 'Some lines are disrupted — check before you travel', bad: 'Multiple lines suspended — please check carefully' },
    updated: 'Updated', ago: 'ago', justNow: 'just now', sec: 's', min: 'm', hour: 'h',
    count: '', opBadge: 'lines', mappedTag: 'Mapped: ', noResult: 'No matching lines',
    noResultSub: 'Try a different keyword, region or filter',
    skipToResults: 'Skip to line list',
    mapTitle: 'Live Status Map', mapSuspend: 'Suspended', mapDelay: 'Delayed · Irregular', mapOk: 'Normal',
    mapNote: 'Click a region to filter · schematic map, not to scale',
    mapAllOk: 'No disruptions on this side',
    loading: 'Loading…',
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

/* 组标题警示标的颜色：按最高严重度取色 */
const WARN_COLOR = {
  4: CAT_COLOR.suspend, 3: CAT_COLOR.irregular,
  2: CAT_COLOR.resume, 1: CAT_COLOR.plan
};

/* ───────── state ───────── */
const state = {
  data: null,
  lang: localStorage.getItem('jrs_lang') || null,
  theme: localStorage.getItem('jrs_theme') || 'auto',
  q: '', area: 'ALL', troubleOnly: false, mappedOnly: false,
  statsKey: null, statsVals: null
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function t(key) {
  const L = I18N[state.lang] || I18N.zh;
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), L) ?? key;
}
const stLabel = (cat) => t('st.' + cat);
const severityOf = (c) => CAT.indexOf(c) === -1 ? 1 : (8 - CAT.indexOf(c));

/* ───────── 多语展示 ─────────
   数据携带 源站日语原文 + *_zh / *_en 翻译（缺失时回落日语原文）。 */
function i18nText(l, field) {
  const raw = l[field];
  if (!raw) return '';
  if (state.lang === 'ja') return raw;
  const key = field + (state.lang === 'zh' ? '_zh' : '_en');
  return l[key] || raw;
}
/* 详情全文：译文只覆盖正文，掲載时间戳由 detail_full_pub 单独展示 */
function fullDetail(l) {
  const main = l.detail_full_main || l.detail_full || '';
  if (state.lang === 'ja') return main;
  const key = state.lang === 'zh' ? 'detail_full_zh' : 'detail_full_en';
  return l[key] || main || i18nText(l, 'detail');
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
  renderMap();   // 光带状态文案随语言刷新
  applyTheme();   // 主题按钮文字随语言刷新
}

/* ───────── helpers ───────── */
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ───────── 公司 logo ─────────
   LOGO_FILES / LOGO_COLORS 由 assets/logo-map.js 提供；
   logo 加载失败时自动降级为「品牌色首字圆标」。 */
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
/* 统计数字滚动（ease-out cubic），值不变时不重播，避免 20s 心跳重绘闪动 */
function countUp(el, from, to) {
  const dur = 720, t0 = performance.now();
  el.textContent = from;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = to;
  };
  requestAnimationFrame(step);
}

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

  // 统计值变化时播放滚动；首屏从 0 滚到目标
  const skey = cells.map(c => c[1]).join('|');
  const first = state.statsKey === null;
  if (first || state.statsKey !== skey) {
    const prev = state.statsVals || [0, 0, 0, 0, 0, 0];
    $$('#stats .v').forEach((el, i) => {
      const to = Number(el.textContent);
      if (to !== prev[i]) countUp(el, prev[i], to);
      prev[i] = to;
    });
    state.statsVals = prev;
    state.statsKey = skey;
  }

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
  $('#footMeta').textContent = `${t('updated')} ${d.updated_at_display}`;
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

// 线路小图标：优先用已映射主站线路名查 LINE_ICON（多映射时逐个找），兜底 Yahoo 原名
function lineIconHtml(l) {
  const map = window.LINE_ICON || {};
  let name = '';
  if (l.mainline && l.mainline.line && map[l.mainline.line]) name = l.mainline.line;
  else if (l.mainlines) { for (const m of l.mainlines) { if (m.line && map[m.line]) { name = m.line; break; } } }
  else if (map[l.name]) name = l.name;
  return name ? `<img class="lic" src="${map[name]}" alt="" loading="lazy">` : '';
}

function lineRow(l) {
  const col = CAT_COLOR[l.status] || CAT_COLOR.unknown;
  const mapped = l.mainline
    ? `<span class="tag map">${esc(t('mappedTag'))}${esc(l.mainline.line)}</span>` : '';
  const detail = l.detail ? `<div class="dt">${esc(i18nText(l, 'detail'))}</div>` : '';
  // 「查看原文」：站内弹窗展示完整译文（缺失时回落日语），掲載时间戳单独展示
  const viewBtn = (l.detail_full || l.detail)
    ? `<button type="button" class="tag tag-act" data-view="1"
         data-name="${esc(l.name)}" data-status="${esc(l.status)}" data-label="${esc(l.label)}"
         data-company="${esc(l.company)}" data-area="${esc(l.area)}"
         data-detail="${esc(fullDetail(l))}" data-pub="${esc(l.detail_full_pub || '')}">${esc(t('viewOriginal'))}</button>`
    : '';
  return `<div class="lrow">
      <span class="dotc" style="background:${col}"></span>
      ${lineIconHtml(l)}
      <div class="body">
        <div class="ttl">
          <span class="nm">${esc(l.name)}</span>
          <span class="st" style="color:${col}">${esc(stLabel(l.status))}</span>
          <span class="tag">${esc(i18nText(l, 'label'))}</span>
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
  return `<span class="line" title="${esc(i18nText(l, 'label'))}"><span class="s" style="background:${col}"></span><span class="line-name">${esc(l.name)}</span></span>`;
}

function render() {
  const lines = state.data.lines.filter(lineMatch);
  const box = $('#results');

  if (!lines.length) {
    box.innerHTML = `<div class="empty glass">
        <svg class="empty-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.7-4.7" stroke-linecap="round"/>
        </svg>
        <div class="empty-t">${esc(t('noResult'))}</div>
        <div class="empty-s">${esc(t('noResultSub'))}</div>
      </div>`;
    return;
  }

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

  box.innerHTML = cards.map((g, i) => {
    const troubleHtml = g.trouble.length
      ? `<div>${g.trouble.map(lineRow).join('')}</div>` : '';
    const okHtml = (state.troubleOnly || !g.ok.length) ? '' :
      `<div class="lines">${g.ok.map(linePill).join('')}</div>`;
    return `<article class="card glass" style="--bc:${companyColor(g.company)};--i:${Math.min(i, 11)}">
        <div class="card-head">
          ${companyLogoHTML(g.company)}
          <span class="op" title="${esc(g.company)}">${esc(g.company)}</span>
          <span class="area">${esc(g.area)}</span>
          <span class="badge">${g.lines.length} ${esc(t('opBadge'))}${g.trouble.length ? ` · <span class="warn" style="color:${WARN_COLOR[g.maxSev] || CAT_COLOR.irregular}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.6 22.2 20.4H1.8z"/></svg>${g.trouble.length}</span>` : ''}</span>
        </div>
        ${troubleHtml}
        ${okHtml}
      </article>`;
  }).join('');
}

/* ───────── 全国态势图（日本八地区 + 异常线路光带） ───────── */
const AREAS8 = [
  { key: 'kyushu',   area: '九州',   side: 'L' },
  { key: 'chugoku',  area: '中国',   side: 'L' },
  { key: 'shikoku',  area: '四国',   side: 'L' },
  { key: 'kinki',    area: '近畿',   side: 'L' },
  { key: 'chubu',    area: '中部',   side: 'R' },
  { key: 'kanto',    area: '関東',   side: 'R' },
  { key: 'tohoku',   area: '東北',   side: 'R' },
  { key: 'hokkaido', area: '北海道', side: 'R' },
];
const SVG_NS = 'http://www.w3.org/2000/svg';
let mapBuilt = false;

function buildMap() {
  const svg = $('#jpMap');
  if (!svg || mapBuilt) return;
  svg.innerHTML = AREAS8.map(a =>
    `<g class="region" data-key="${a.key}" data-area="${esc(a.area)}" tabindex="0" role="button" aria-label="${esc(a.area)}">
       ${(window.JP_REGION_PATHS && JP_REGION_PATHS[a.key] && JP_REGION_PATHS[a.key].paths) || ''}
     </g>`).join('') +
    `<g id="mapPins"></g>`;
  mapBuilt = true;

  /* 地区点击 / 回车：切换地区筛选（再点一次取消），并滚到列表 */
  $$('#jpMap .region').forEach(g => {
    g.addEventListener('click', () => toggleArea(g.dataset.area));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleArea(g.dataset.area); }
    });
  });

  /* 光带点击 → 原文弹窗（与结果列表同一 data-view 机制） */
  $('.mapcard').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) openSourceModal(b);
  });
}

function toggleArea(area) {
  state.area = state.area === area ? 'ALL' : area;
  renderAreaChips(); render();
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 地区严重度：bad=有停运，warn=有其它异常，ok=全正常 */
function regionSev(lines) {
  const trouble = lines.filter(l => l.severity > 0);
  if (!trouble.length) return 'ok';
  if (trouble.some(l => l.status === 'suspend')) return 'bad';
  return 'warn';
}

/* 地区锚点：各 path 的包围盒中心若远离中位数（冲绳/小笠原等远岛），剔除后再取联合包围盒 */
function regionAnchor(g) {
  const bs = [...g.querySelectorAll('path')].map(p => p.getBBox());
  if (!bs.length) return [0, 0];
  const cx = bs.map(b => b.x + b.width / 2), cy = bs.map(b => b.y + b.height / 2);
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; };
  const mx = med(cx), my = med(cy);
  const keep = bs.filter((b, i) => Math.hypot(cx[i] - mx, cy[i] - my) < 200);
  const use = keep.length ? keep : bs;
  const x0 = Math.min(...use.map(b => b.x)), x1 = Math.max(...use.map(b => b.x + b.width));
  const y0 = Math.min(...use.map(b => b.y)), y1 = Math.max(...use.map(b => b.y + b.height));
  return [x0 + (x1 - x0) / 2, y0 + (y1 - y0) / 2];
}

function renderMap() {
  if (!state.data || !mapBuilt) return;
  const lines = state.data.lines;
  const svg = $('#jpMap');
  const pins = [];

  $$('#jpMap .region').forEach(g => {
    const ls = lines.filter(l => l.area === g.dataset.area);
    const trouble = ls.filter(l => l.severity > 0);
    const sev = regionSev(ls);
    g.dataset.sev = sev;
    g.classList.toggle('sel', state.area === g.dataset.area);
    g.setAttribute('aria-pressed', String(state.area === g.dataset.area));
    if (trouble.length) {
      const [cx, cy] = regionAnchor(g);
      pins.push({ cx, cy, n: trouble.length, sev, area: g.dataset.area });
    }
  });

  /* 异常徽标：地区包围盒中心 */
  $('#mapPins').innerHTML = pins.map(p => {
    const col = p.sev === 'bad' ? 'var(--c-suspend)' : 'var(--c-delay)';
    return `<g class="pin" data-sev="${p.sev}" data-area="${esc(p.area)}" transform="translate(${p.cx.toFixed(1)},${p.cy.toFixed(1)})">
        <circle class="halo" r="12"/>
        <circle class="core" r="7" style="fill:${col}"/>
        <text>${p.n}</text>
      </g>`;
  }).join('');
  $$('#mapPins .pin').forEach(p => {
    p.addEventListener('click', (e) => { e.stopPropagation(); toggleArea(p.dataset.area); });
  });

  renderBeams();
}

/* 异常线路光带：左列=日本海侧地区，右列=太平洋侧；红=停运、黄=延迟/异常 */
function renderBeams() {
  const trouble = state.data.lines.filter(l => l.severity > 0)
    .sort((a, b) => (b.severity - a.severity) || a.name.localeCompare(b.name, 'ja'));
  const beamHtml = (l) => {
    const sev = l.status === 'suspend' ? 'bad' : 'warn';
    const col = CAT_COLOR[l.status] || CAT_COLOR.unknown;
    return `<button type="button" class="beam" data-sev="${sev}" data-view="1"
        data-name="${esc(l.name)}" data-status="${esc(l.status)}" data-label="${esc(l.label)}"
        data-company="${esc(l.company)}" data-area="${esc(l.area)}"
        data-detail="${esc(fullDetail(l))}" data-pub="${esc(l.detail_full_pub || '')}">
        <span class="dotc" style="background:${col}"></span>
        <span class="beam-name">${esc(l.name)}</span>
        <span class="beam-st">${esc(stLabel(l.status))}</span>
      </button>`;
  };
  const west = [], east = [];
  trouble.forEach(l => {
    const meta = AREAS8.find(a => a.area === l.area);
    (meta && meta.side === 'L' ? west : east).push(beamHtml(l));
  });
  const empty = `<div class="beams-empty"><i></i>${esc(t('mapAllOk'))}</div>`;
  $('#mapBeamsL').innerHTML = west.join('') || empty;
  $('#mapBeamsR').innerHTML = east.join('') || empty;
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
  $('#srcModalSub').innerHTML = `${companyLogoHTML(d.company, 18)}<span>${esc(d.company)}</span>${d.area ? ` · ${esc(d.area)}` : ''}`;
  // 状态徽标：状态色文字 + 同色淡底 + 同色细边
  const chip = $('#srcModalStatus');
  const rgb = CAT_RGB[d.status] || CAT_RGB.unknown;
  chip.textContent = stLabel(d.status);
  chip.style.color = col;
  chip.style.background = `rgba(${rgb}, .13)`;
  chip.style.borderColor = `rgba(${rgb}, .34)`;
  // 正文：优先用数据自带的掲載时间戳（detail_full_pub），否则从原文末尾剥离
  const { text, published } = splitPublished(d.detail || '');
  $('#srcModalBody').textContent = text.trim() || t('noDetail');
  const pub = (d.pub || published || '').replace(/\s+/g, ' ');
  $('#srcModalPub').textContent = pub ? `${t('publishLabel')} ${pub}` : '';

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
    const data = await r.json();
    /* 数据未变时不重建列表/地图，避免每 60s 心跳造成卡片动效空闪；
       统计区仍刷新（ago 文案），count-up 有值比较保护不会重播 */
    const unchanged = state.data && state.data.updated_at === data.updated_at;
    state.data = data;
    if (!unchanged) { renderStats(); renderAreaChips(); render(); renderMap(); }
    else { renderStats(); }
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
  buildMap();
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
    if (state.data) renderMap();
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
