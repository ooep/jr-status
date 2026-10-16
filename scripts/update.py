#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jr-status / update.py
编排一次完整更新：采集运行情报源 -> 映射到主站线路 -> 落盘格式化数据。
（数据源按品牌中立化原则处理：功能 URL 保留，文案与对外字段去品牌。）

产出：
  data/status.json            最新快照（前端消费的主数据，不含源站 Yahoo URL）
  data/summary.json           轻量概览（统计 + 有异常线路，便于快速轮询）
  data/history/YYYY-MM-DD.jsonl  当日状态变化事件流（仅在发生变化时追加）
  data/history/index.json       历史故障分页索引（含指纹，数据无变化时不改写）
  data/history/page-N.json       历史故障分页数据（仅状态变化事件，时间倒序，30 条/页）
  mapping/unmapped.json       未映射线路清单（便于人工补充 aliases.json）

提交策略（配合 workflow 的 git diff 判断）：
  - 语义无变化 且 未到心跳时间 → 不改写文件 → git 干净 → 不产生提交
  - 语义有变化 或 心跳超时 → 刷新时间戳 → 产生提交
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Tuple

from fetch_status import fetch_all, all_lines, enrich_trouble_details, LineRecord
from map_lines import Mapper

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MAPDIR = ROOT / "mapping"
JST = timezone(timedelta(hours=9))

HEARTBEAT_SEC = int(os.environ.get("HEARTBEAT_SEC", "1800"))  # 30 分钟
FORCE = str(os.environ.get("FORCE", "")).lower() in ("1", "true", "yes")
SCHEMA = "jr-status/v1"
HISTORY_SCHEMA = "jr-status/history/v1"
HISTORY_PAGE_SIZE = 30
MAIN_SITE = "https://jr.suki.ing/"

STATUS_RULES = [
    # (关键字, category, severity)   —— 顺序即优先级
    ("運転見合わせ", "suspend", 4),
    ("運休", "suspend", 4),
    ("運転再開", "resume", 3),
    ("遅延", "delay", 3),
    ("運転状況", "irregular", 3),
    ("運転計画", "plan", 2),
    ("その他", "other", 2),
    ("平常運転", "normal", 0),
]
SEVERITY = {"normal": 0, "plan": 1, "resume": 2, "other": 2, "delay": 3, "irregular": 3, "suspend": 4}


def classify(label: str) -> Tuple[str, int]:
    """把 源站 原文状况标签归一化。"""
    t = (label or "").strip()
    for kw, cat, sev in STATUS_RULES:
        if kw in t:
            return cat, sev
    return "unknown", 1


def _semantic(payload: dict) -> dict:
    """去掉时间戳后的语义体，用于判断「是否真的有变化」。"""
    return {
        "lines": [
            (l["id"], l["status"], l["detail"], l["mainline"]["seq"] if l.get("mainline") else None)
            for l in payload["lines"]
        ]
    }


def build() -> dict:
    mapper = Mapper()
    companies = fetch_all(verbose=False)
    lines = all_lines(companies)
    enrich_trouble_details(lines, verbose=True)   # 异常线路补抓详情页全文（供「查看原文」弹窗）
    now = datetime.now(JST)

    records: List[dict] = []
    unmatched: List[dict] = []
    main_used: Dict[int, int] = {}

    for ln in lines:
        cat, sev = classify(ln.status_label)
        res = mapper.map_composite(ln.line_name, ln.company)
        mains = []
        for rec, method, conf in res:
            main_used[rec["seq"]] = main_used.get(rec["seq"], 0) + 1
            mains.append({
                "seq": rec["seq"],
                "line": rec["line"],
                "rw_ids": rec.get("rw_ids", []),
                "method": method,
                "confidence": round(conf, 3),
                "site": MAIN_SITE,
            })
        obj = {
            "id": ln.src_id,
            "company": ln.company,
            "area": ln.area,
            "name": ln.line_name,
            "status": cat,
            "severity": sev,
            "label": ln.status_label,
            "detail": ln.detail,
            "mainline": mains[0] if mains else None,
            "mainlines": mains if len(mains) > 1 else None,
        }
        if ln.detail_full:
            obj["detail_full"] = ln.detail_full
        records.append(obj)
        if not mains:
            unmatched.append({
                "id": ln.src_id, "company": ln.company, "area": ln.area,
                "name": ln.line_name, "label": ln.status_label,
            })

    # 有异常的排前面（按严重度 -> 公司 -> 名称）
    records.sort(key=lambda r: (-r["severity"], r["company"], r["name"]))

    counts: Dict[str, int] = {}
    for r in records:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    payload = {
        "schema": SCHEMA,
        "updated_at": now.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "updated_at_display": now.strftime("%Y/%m/%d %H:%M"),
        "source": "公开运行情报源（日本鉄道 運行情報）",
        "totals": {
            "lines": len(records),
            "companies": len(companies),
            "mapped": sum(1 for r in records if r["mainline"]),
            "unmapped": len(unmatched),
            "trouble": sum(1 for r in records if r["severity"] > 0),
            "by_status": counts,
        },
        "companies": sorted(list({c.name for c in companies})),
        "areas": sorted(list({c.area for c in companies})),
        "lines": records,
    }
    payload["areas"] = [a for a in payload["areas"] if a]
    return payload, unmatched, now


def write_history(new: dict, prev: dict, now: datetime) -> int:
    """对比新旧快照，仅在簇级状态变化时追加事件。返回追加条数。"""
    if not prev:
        return 0
    old = {l["id"]: l for l in prev.get("lines", [])}
    events = []
    for l in new["lines"]:
        o = old.get(l["id"])
        if o is None:
            continue
        if o["status"] != l["status"] or o["detail"] != l["detail"]:
            events.append({
                "at": now.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "id": l["id"], "company": l["company"], "name": l["name"],
                "from": o["status"], "to": l["status"],
                "from_label": o["label"], "to_label": l["label"],
                "detail": l["detail"],
            })
    if events:
        DATA.mkdir(exist_ok=True)
        p = DATA / "history" / f"{now.strftime('%Y-%m-%d')}.jsonl"
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a", encoding="utf-8") as f:
            for e in events:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
    return len(events)


def _history_fingerprint() -> str:
    """基于 data/history/*.jsonl 文件集合的指纹：任一文件增删改都会变化。"""
    h = hashlib.sha1()
    for p in sorted((DATA / "history").glob("*.jsonl")):
        st = p.stat()
        h.update(f"{p.name}:{st.st_size}:{st.st_mtime_ns}\n".encode())
    return h.hexdigest()[:16]


def build_history_pages() -> bool:
    """把 data/history/*.jsonl 汇总为分页故障记录：

      - 仅收录真正的状态变化事件（from != to）；同状态详情刷新不算故障。
      - 按时间倒序排列（最新在前），每页 30 条，写入
        data/history/index.json（索引 + 指纹）与 data/history/page-N.json。
      - 事件集合无变化时不做任何写入（避免产生无意义提交）。
      - 事件减少（历史清理）时删除多余的分页文件。

    返回是否写入了文件。
    """
    hist_dir = DATA / "history"
    hist_dir.mkdir(parents=True, exist_ok=True)
    fp = _history_fingerprint()
    index_p = hist_dir / "index.json"
    try:
        cur = json.loads(index_p.read_text(encoding="utf-8"))
        if cur.get("fingerprint") == fp:
            return False
    except Exception:
        cur = None

    events: List[dict] = []
    for p in sorted(hist_dir.glob("*.jsonl")):
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("from") != e.get("to"):
                events.append(e)
    events.sort(key=lambda e: str(e.get("at", "")), reverse=True)

    now = datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S%z")
    total = len(events)
    pages = (total + HISTORY_PAGE_SIZE - 1) // HISTORY_PAGE_SIZE
    index = {
        "schema": HISTORY_SCHEMA,
        "page_size": HISTORY_PAGE_SIZE,
        "pages": pages,
        "total": total,
        "updated_at": now,
        "fingerprint": fp,
        "range": {
            "from": events[-1]["at"] if events else None,
            "to": events[0]["at"] if events else None,
        },
    }
    index_p.write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    for i in range(1, pages + 1):
        chunk = events[(i - 1) * HISTORY_PAGE_SIZE: i * HISTORY_PAGE_SIZE]
        page = {
            "schema": HISTORY_SCHEMA,
            "page": i,
            "page_size": HISTORY_PAGE_SIZE,
            "updated_at": now,
            "events": chunk,
        }
        (hist_dir / f"page-{i}.json").write_text(
            json.dumps(page, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    for p in hist_dir.glob("page-*.json"):
        try:
            n = int(p.stem.split("-")[1])
        except Exception:
            continue
        if n > pages:
            p.unlink()

    print(f"[hist] {total} 条故障记录 -> {pages} 页（每页 {HISTORY_PAGE_SIZE} 条）")
    return True


def main() -> int:
    DATA.mkdir(exist_ok=True)
    prev = None
    status_p = DATA / "status.json"
    if status_p.exists():
        try:
            prev = json.loads(status_p.read_text(encoding="utf-8"))
        except Exception:
            prev = None

    payload, unmatched, now = build()

    changed = True
    if prev:
        try:
            t0 = datetime.strptime(prev["updated_at"], "%Y-%m-%dT%H:%M:%S%z")
            elapsed = (now - t0).total_seconds()
        except Exception:
            elapsed = HEARTBEAT_SEC + 1
        same = _semantic(prev) == _semantic(payload)
        changed = (not same) or (elapsed >= HEARTBEAT_SEC) or FORCE
        if not changed:
            print("[skip] 无语义变化且在心跳窗口内 -> 不改写文件（不产生提交）")
            # 历史文件集合可能因清理而变化（jsonl 被删除），此时仍需重建分页
            build_history_pages()
            return 0

    added = write_history(payload, prev, now)
    build_history_pages()
    status_p.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    summary = {
        "schema": SCHEMA,
        "updated_at": payload["updated_at"],
        "updated_at_display": payload["updated_at_display"],
        "totals": payload["totals"],
        "areas": payload["areas"],
        "trouble_lines": [
            {k: l[k] for k in ("id", "company", "area", "name", "status", "severity",
                               "label", "detail", "mainline")}
            for l in payload["lines"] if l["severity"] > 0
        ],
    }
    (DATA / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    MAPDIR.mkdir(exist_ok=True)
    (MAPDIR / "unmapped.json").write_text(
        json.dumps({"generated_at": payload["updated_at"], "count": len(unmatched),
                    "note": "源站 线路未能映射到主站线路。多为服务名（湘南新宿ライン）或主站暂无该线。"
                            "可补充 mapping/aliases.json 提高覆盖率。",
                    "lines": unmatched}, ensure_ascii=False, indent=1), encoding="utf-8")

    t = payload["totals"]
    print(f"[ok] {payload['updated_at_display']} | 线路 {t['lines']} | 公司 {t['companies']} | "
          f"已映射 {t['mapped']}({t['mapped']/max(t['lines'],1)*100:.1f}%) | 异常 {t['trouble']} | "
          f"事件 {added}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
