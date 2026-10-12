# jr-status · 全日本铁道运行情报

自动采集 **公开运行情报源**（`transit.yahoo.co.jp/diainfo`）全国各铁道公司及其线路的运行状况，
格式化落库，并**与主站 [Mini JapanRail 3D](https://ooep.github.io/floral-salad-8734/mini-japanrail-3d/)** 的线路做映射，
最后用一个液态玻璃风格的网页把全国运行情报呈现出来。

- 🌐 展示页：<https://ooep.github.io/jr-status/>
- 📦 数据表：`data/status.json`（主数据）、`data/summary.json`（轻量概览）

---

## 它做什么

```
公开运行情报源 ──(每 10 分钟 GitHub Actions)──> scripts/fetch_status.py
                                                    ↓ 原始记录（公司 / 线路 / 状况 / 详情）
                                               scripts/map_lines.py
                                                    ↓ 映射到主站 577 条权威线路
                                               scripts/update.py
                                                    ↓
                                   data/status.json + summary.json + history/*.jsonl
                                                    ↓
                                               index.html（液态玻璃 UI）
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
      "detail": "接続待ちの影響で、一部列車に遅れが出ています",
      "url": "https://transit.yahoo.co.jp/diainfo/21/0",
      "mainline": {                   // ★ 与主站线路的映射，null 表示未映射
        "seq": 5, "line": "山手線", "rw_ids": [628],
        "method": "exact",            // exact / alias / company / operator / suffix / composite / fuzzy
        "confidence": 1.0,
        "site": "https://ooep.github.io/floral-salad-8734/mini-japanrail-3d/"
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
| `mapping/unmapped.json` | 未能映射到主站的线路清单，用于人工补 `aliases.json` |

---

## 与主站的线路映射

主站权威线路表取自 `floral-salad-8734` 的 `data/lines_index.json`（**577 条**），已固化为
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

---

## 本地运行

```bash
python3 -m pip install requests beautifulsoup4
python3 scripts/update.py          # 采集 + 映射 + 落盘
python3 -m http.server 8000        # 然后打开 http://127.0.0.1:8000/
```

（`file://` 直接打开无法 fetch 本地 JSON，必须走 HTTP。）

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
├── index.html                 # 展示页（GitHub Pages 根）
├── assets/{app.css,app.js}    # 液态玻璃 UI（token 取自主站同源）
├── data/
│   ├── status.json            # 最新快照（生成）
│   ├── summary.json           # 概览（生成）
│   └── history/*.jsonl        # 变化事件流（生成）
├── mapping/
│   ├── lines_reference.json   # 主站 577 条权威线路
│   ├── aliases.json           # ★ 人工别名表（可补充提升覆盖率）
│   └── unmapped.json          # 未映射清单（生成）
├── scripts/
│   ├── fetch_status.py        # 采集运行情报源
│   ├── map_lines.py           # 映射引擎
│   └── update.py              # 编排
└── .github/workflows/update.yml
```
