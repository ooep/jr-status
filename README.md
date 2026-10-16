# jr-status · 全日本铁道运行情报

自动采集 **公开运行情报源**（`transit.yahoo.co.jp/diainfo`）全国各铁道公司及其线路的运行状况，
格式化落库，并**与主站 [Mini JapanRail 3D](https://jr.suki.ing/)** 的线路做映射，
最后用一个液态玻璃风格的网页把全国运行情报呈现出来。

- 🌐 实时状态页：<https://jrstatus.jr.suki.ing/>
- 📜 历史故障页：<https://jrstatus.jr.suki.ing/history.html>（按时间倒序，30 条/页）
- 📦 数据表：`data/status.json`（主数据）、`data/summary.json`（轻量概览）、`data/history/index.json` + `data/history/page-N.json`（历史故障分页）、`data/translations.json`（日→中/英翻译缓存）

---

## 它做什么

```
公开运行情报源 ──(每 10 分钟 GitHub Actions)──> scripts/fetch_status.py
                                                    ↓ 原始记录（公司 / 线路 / 状况 / 详情）
                                               scripts/map_lines.py
                                                    ↓ 映射到主站 577 条权威线路
                                               scripts/update.py
                                                    ↓ 调用 scripts/translate.py（Index-Translate API）
                                               data/translations.json（日→中/英缓存）
                                                    ↓
                          data/status.json + summary.json + history/*.jsonl（含中英译文字段）
                                                    ↓
                          data/history/index.json + page-N.json（30 条/页）
                                                    ↓
                          index.html（实时状态 UI）· history.html（历史故障 UI）
```

**单次快照规模**：约 **166 家铁道公司 / 513 条线路**，其中 **82%** 可映射到主站线路。

## 数据格式

### `data/status.json`（主表）

```jsonc
{
  "schema": "jr-status/v1",
  "updated_at": "2026-10-13T00:58:00+0900",   // ISO8601，JST
  "updated_at_display": "2026/10/13 00:58",
  "source": "公开运行情报源（日本鉄道 運行情報）",   // 品牌中立化后的来源标注
  "totals": {
    "lines": 513, "companies": 166, "mapped": 421, "unmapped": 92, "trouble": 40,
    "by_status": { "normal": 473, "delay": 12, "irregular": 5, "other": 20, "plan": 3 }
  },
  "companies": ["JR東日本", "東京メトロ", …],
  "areas": ["北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州"],
  "lines": [
    {
      "id": "21",                     // 源站线路 ID
      "company": "JR東日本",
      "area": "関東",
      "name": "山手線",                // 源站原文名
      "status": "delay",              // 归一化分类（见下表）
      "severity": 3,                  // 0 正常，越大越严重
      "label": "列車遅延",             // 源站原文状况标签
      "label_zh": "列车晚点",          // ★ 中英译文（由翻译链路生成，缺失时前端回落日语原文）
      "label_en": "Train delay",
      "detail": "接続待ちの影響で、一部列車に遅れが出ています",
      "detail_zh": "受等待衔接列车的影响，部分列车出现晚点",
      "detail_en": "Some trains are delayed due to connection waits",
      // 注意：已按品牌中立化原则去掉源站 URL（data 中不再包含 Yahoo 链接）
      "mainline": {                   // ★ 与主站线路的映射，null 表示未映射
        "seq": 5, "line": "山手線", "rw_ids": [628],
        "method": "exact",            // exact / alias / company / operator / suffix / composite / fuzzy
        "confidence": 1.0,
        "site": "https://jr.suki.ing/"
      },
      "mainlines": null               // 「・」复合线名会映射到多条，此时此项为数组
    }
  ]
}
```

### 状态分类（`status` 字段）

| status | 含义 | 源站原文标签 | severity |
|---|---|---|---|
| `normal` | 平常运营 | 平常運転 | 0 |
| `plan` | 计划调整 / 施工 | 運転計画 | 2 |
| `resume` | 恢复运行 | 運転再開 | 3 |
| `delay` | 列车晚点 | 列車遅延 | 3 |
| `irregular` | 运行异常 | 運転状況 | 3 |
| `other` | 其他 | その他 | 2 |
| `suspend` | 停运 | 運転見合わせ / 運休 | 4 |

### 其它产物

| 文件 | 说明 |
|---|---|
| `data/summary.json` | 轻量概览（统计 + 仅异常线路），便于快速轮询 |
| `data/history/YYYY-MM-DD.jsonl` | 当日**状态变化**事件流（仅在变化时追加，>60 天自动清理） |
| `data/history/index.json` | 历史故障分页索引（页数 / 总条数 / 时间范围 / 指纹） |
| `data/history/page-N.json` | 历史故障分页数据（**仅状态变化事件**，按时间倒序，每页 30 条；分页避免单文件过大） |
| `data/translations.json` | 日→中/英翻译缓存（按原文 sha1 去重，只翻译新文本，控制 API 请求量） |
| `mapping/unmapped.json` | 未能映射到主站的线路清单，用于人工补 `aliases.json` |

### 多语言（翻译链路）

源站运行情报为日语。`update.py` 每次拉取到新文本后，调用 **Index-Translate 免费公共 API**
（`https://index-translate.bilibili.com/v1`，模型 `Index-Translate-35B-A3B`，`enable_thinking=false`）
把每条**状态标签 / 故障详情**翻译为中文和英语：

- **日语页面**始终展示源站原文；
- **中文 / 英语页面**展示对应译文；译文缺失（API 未返回）时**自动回落日语原文**；
- 翻译结果持久缓存在 `data/translations.json`，相同原文不重复请求；
- 详情全文末尾的「（10月16日 18時55分掲載）」时间戳在翻译前剥离，
  以 `detail_full_pub` 字段交给前端弹窗单独展示；
- 历史故障事件同样携带 `from_label_zh/_en`、`to_label_zh/_en`、`detail_zh/_en`。

> 翻译为尽力而为：单条失败会静默跳过并回落日语，不影响采集主流程。
> 人工调试可用 `scripts/call_api.py`（Index-Translate 官方参考脚本，本仓库随附）。

### 历史故障页（`history.html`）

页面底部「历史故障」入口指向 `history.html`：汇总 `data/history/*.jsonl` 中的**状态变化事件**（`from ≠ to`，
同状态详情刷新不计入「故障」），按时间倒序展示，30 条一页。分页数据由 `update.py` 每次运行同步重建：

- 事件集合无变化时不改写分页文件（不产生无意义提交）；
- 历史文件被清理（>60 天删除）后，下一次运行自动重建分页；
- 单页数据 ≤30 条，远低于 GitHub / Cloudflare Pages 的单文件体积限制。

**每条故障记录附带**：

- **故障持续时间**：`update.py` 按线路沿事件流自动追踪，事件携带 `dur_start`（故障开始时间）与
  `dur_state`（`ended` 已恢复 / `active` 进行中）。已结束的显示精确时长（如「持续 1小时35分」），
  进行中的显示实时时长（如「已持续 2小时52分」，前端每分钟自动刷新）；
- **查看全文**：事件记录完整详情 `detail_full`（含中英译文与掲載时间戳），
  卡片上的「查看全文」按钮打开弹窗展示完整故障详情（早期事件未留存全文时无此按钮）。

---

## 与主站的线路映射

主站权威线路表取自主站 [jr.suki.ing](https://jr.suki.ing/) 的 `data/lines_index.json`（**577 条**），已固化为
`mapping/lines_reference.json`。映射采用阶梯策略，**命中即停**：

| 级别 | 方式 | 置信度 |
|---|---|---|
| L1 | 归一化后完全一致 | 1.00 |
| L2 | 人工别名表 `aliases.json`（愛称：学園都市線→札沼線、花咲線→根室本線） | 0.98 |
| L3 | 剥离该线路**自身公司名**前缀（弘南鉄道弘南線→弘南線） | 0.92 |
| L4 | 继续剥离通用运营商前缀（東京メトロ / 東武 / `jr` / 〜市営 …） | 0.86 |
| L5 | 去结尾「線」后比对 | 0.80 |
| L6 | 含「・」复合线名拆多条（近鉄山田線・鳥羽線・志摩線→3 条） | 0.78 |
| L7 | 高阈值近似 | 0.68 |

**两个关键的正确性设计**：

1. **先整名、后拆分** —— `日暮里・舎人ライナー` 这类含「・」的名称必须整名优先，否则会被错拆。
2. **公司族校验** —— 剥离前缀后不同公司的同名线路会退化为同一个 key
   （`東京メトロ東西線` 与 `札幌市営地下鉄東西線` 都退化成「東西線」）。
   因此引入公司「族」（`神鉄⇄神戸電鉄`、`都営⇄東京都交通局`、`jr⇄JR東日本` …），
   候选命中多条时按族做归属校验，**跨公司互相判不了则宁可留空**。

> **原则：宁可留未映射，也不做错误映射。**
> 服务名（湘南新宿ライン、上野東京ライン）与主站暂无的线路（ゆりかもめ等）会如实落到 `unmapped.json`。
> 想提高覆盖率，往 `mapping/aliases.json` 补几行即可。

---

## 自动化

`.github/workflows/update.yml`：

- **调度**：`cron: "*/10 * * * *"`。GitHub cron 走 UTC，而 JST=UTC+9 是整小时偏移（分钟位不变），
  故 `*/10` 天然对齐 JST 的整 10 分钟。
- **配额**：仓库为**公开仓库**，GitHub 标准 runner 对公开仓库免费且不计时，10 分钟一次可持续运行。
- **提交策略**（控制仓库体积）：
  - 语义无变化且未到心跳窗口（默认 **30 分钟**）→ **不改写文件 → 不产生提交**
  - 语义有变化 → **立即提交**
  - 心跳超时 → 刷新时间戳提交（保证数据新鲜可见）
- **保活**：GitHub 会在仓库长期无活动后停用定时任务；本仓库持续提交正好维持活动。
- 也支持 `workflow_dispatch` 手动触发（可勾选 force 强制提交）。

> ⚠️ 定时任务是**尽力而为**语义，高峰期可能延迟或丢跑，因此页面显示更新时间戳供核对。

### 外部触发器（推荐，解决 schedule 延迟/丢跑）

GitHub 的 `schedule` 事件在高峰期可能延迟数十分钟甚至被跳过。可靠的做法是让**外部定时服务**每隔 10 分钟直接调用 GitHub API 的 `workflow_dispatch` 接口，秒级触发、不受调度积压影响。以免费服务 [cron-job.org](https://cron-job.org) 为例：

| 配置项 | 值 |
| --- | --- |
| URL | `https://api.github.com/repos/ooep/jr-status/actions/workflows/update.yml/dispatches` |
| 方法 | `POST` |
| 执行周期 | 每 10 分钟（`*/10 * * * *`） |
| 请求体 | `{"ref":"main"}` |

请求头（Headers）：

```
Authorization: Bearer <PAT>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json
```

**两个关键点：**

1. **成功状态码要包含 204**：GitHub 触发成功返回的是 `204 No Content`，默认只认 200 会误报失败。
   在 cron-job.org 的 Advanced → "Treat these status codes as success" 里填 `200-299`（或 `204`）。
2. **PAT 权限**：经典 token 勾选 `workflow` scope；或细粒度 token 仅授权本仓库、
   Actions 权限设为 `write`。token 有过期时间，到期前记得换。

其它可选服务：EasyCron、Cloudflare Workers（Cron Triggers，PAT 存为 Secret）。
UptimeRobot 等纯 GET 监控无法携带认证头，不适用。

> 安全提示：token 只填写到服务商后台，不要提交进仓库或贴到聊天里；怀疑泄露立即在
> GitHub → Settings → Developer settings 中吊销并重新生成。

---

## 本地运行

```bash
python3 -m pip install requests beautifulsoup4
python3 scripts/update.py          # 采集 + 映射 + 翻译 + 落盘
python3 -m http.server 8000        # 然后打开 http://127.0.0.1:8000/
```

（`file://` 直接打开无法 fetch 本地 JSON，必须走 HTTP。
翻译模块为纯 stdlib，无需额外安装；首次运行会真实调用翻译 API 生成 `data/translations.json`。）

单独调试映射：

```bash
python3 scripts/map_lines.py       # 打印若干典型线路的映射结果与方式
```

---

## 合规

- `robots.txt` 仅禁止 `/diainfo/search`；本项目只请求 `/diainfo` 与 `/diainfo/area/*`（均允许）。
- robots.txt 仅对 `GPTBot` 有全域禁令，本脚本使用常规浏览器 UA，不自称爬虫。
- 每次请求间隔限速 + 失败退避重试；**只读**，不向源站写入任何内容。
- 数据版权归运行情报源及各铁道事业者，本页面保留原始来源链接。

---

## 目录结构

```
jr-status/
├── index.html                 # 实时状态页（GitHub Pages / Cloudflare Pages 根）
├── history.html               # 历史故障页（按时间倒序，30 条/页）
├── assets/
│   ├── app.css                # 液态玻璃 UI（token 取自主站同源）
│   ├── app.js                 # 实时状态页逻辑
│   └── history.js             # 历史故障页逻辑
├── data/
│   ├── status.json            # 最新快照（生成，不含源站 Yahoo URL，含中英译文）
│   ├── summary.json           # 概览（生成）
│   ├── translations.json      # 日→中/英翻译缓存（生成）
│   └── history/
│       ├── YYYY-MM-DD.jsonl   # 变化事件流（生成）
│       ├── index.json         # 历史故障分页索引（生成）
│       └── page-N.json        # 历史故障分页数据（生成，30 条/页）
├── mapping/
│   ├── lines_reference.json   # 主站 577 条权威线路
│   ├── aliases.json           # ★ 人工别名表（可补充提升覆盖率）
│   └── unmapped.json          # 未映射清单（生成）
├── scripts/
│   ├── fetch_status.py        # 采集运行情报源
│   ├── map_lines.py           # 映射引擎
│   ├── translate.py           # ★ 日→中/英翻译（Index-Translate API + 缓存）
│   ├── call_api.py            # Index-Translate 官方参考脚本（人工调试用）
│   └── update.py              # 编排（含历史分页构建 + 翻译接入）
└── .github/workflows/update.yml
```
