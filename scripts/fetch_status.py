#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jr-status / fetch_status.py
采集「公开运行情报源 / diainfo」全部地区 -> 公司 -> 线路 的运行状况。

（数据源为公开的运行情报站点，按品牌中立化原则，仓库与界面文案中不出现品牌名；
  功能用 URL 与目录路径保留原样，仅去除表述层面的品牌信息。）

合规说明：
  - 数据源 robots.txt 仅禁止 /diainfo/search，公开的 /diainfo 与 /diainfo/area/* 均允许抓取。
  - 其 robots.txt 仅对 GPTBot 有全域禁令，本脚本使用常规浏览器 UA（不自称爬虫机器人）。
  - 请求间 SLEEP 限速 + 失败退避重试，对源站友好；只读，不向源站写入任何内容。

输出：原始记录列表（company / line / status raw / detail raw / source url ...）
"""

import re
import time
import random
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

BASE = "https://transit.yahoo.co.jp"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# 地区入口：/diainfo/area/2 ... /diainfo/area/9
AREA_IDS = list(range(2, 10))

SLEEP = 0.7          # 每次请求之间的礼貌间隔（秒）
TIMEOUT = 20
RETRIES = 3

# 这些标题是分区标题而非公司名，其后的表格为「当前有异常」的重复摘要（跳过，
# 这些线路在其所属公司的表格中会再次出现，归属才正确）
SKIP_TITLE_MARK = "現在運行情報"


@dataclass
class LineRecord:
    src_id: str
    company: str
    area: str
    line_name: str
    status_label: str          # 源站 原文状况标签，如「平常運転」「列車遅延」
    trouble: bool              # 是否 lil 解释为异常（colTrouble / icnAlert）
    detail: str                # 源站 原文详情（可能被截断）
    url: str
    detail_full: str = ""      # 详情页完整原文（异常线路补抓，见 enrich_trouble_details）


@dataclass
class CompanyRecord:
    name: str
    area: str
    lines: List[LineRecord] = field(default_factory=list)


def _get(url: str, session: requests.Session) -> Optional[str]:
    """带重试与退避的 GET，返回文本。"""
    last = None
    for attempt in range(RETRIES):
        try:
            r = session.get(
                url,
                headers={"User-Agent": UA, "Accept-Language": "ja,zh-CN;q=0.8,en;q=0.6"},
                timeout=TIMEOUT,
            )
            if r.status_code == 200:
                r.encoding = "utf-8"
                return r.text
            last = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            last = repr(e)
        time.sleep(SLEEP * (2 ** attempt) + random.uniform(0, 0.3))
    print(f"[warn] fetch failed {url} ({last})")
    return None


_ID_RE = re.compile(r"/diainfo/(\d+)(?:/(\d+))?")


def _lineid_from_href(href: str) -> Optional[str]:
    m = _ID_RE.search(href or "")
    return m.group(1) if m else None


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\u3000", " ")).strip()


def _area_name(soup: BeautifulSoup, fallback: str) -> str:
    """地区名：只取 .labelLarge 内的 h1 标题。
    注意 .labelLarge 容器里还嵌套了「更新时刻」與「路線を登録」按钮，
    直接对整个容器 get_text 会把这些串进来污染地区名。"""
    el = soup.select_one(".labelLarge h1.title") or soup.select_one(".labelLarge h1")
    txt = _clean(el.get_text(" ", strip=True)) if el else ""
    txt = txt.replace("運行情報", "").strip()
    return txt or fallback


def parse_area(html: str, area_label: str) -> List[CompanyRecord]:
    """解析单个地区页：按顺序配对 .title（公司名）与其后的 .elmTblLstLine 表格。"""
    soup = BeautifulSoup(html, "html.parser")
    main = soup.select_one(".mainWrp")
    if main is None:
        return []

    area = _area_name(soup, area_label)
    companies: Dict[str, CompanyRecord] = {}
    cur_title: Optional[str] = None
    order: List[str] = []

    def want(tag) -> bool:
        cls = tag.get("class") or []
        if not (("title" in cls) or ("elmTblLstLine" in cls)):
            return False
        # 跳过页面级大标题（.labelLarge 内的 h1.title「運行情報関東」），它不是公司名
        return tag.find_parent(class_="labelLarge") is None

    for node in main.find_all(want):
        cls = node.get("class") or []
        if "title" in cls:
            cur_title = _clean(node.get_text(" ", strip=True))
            continue
        # elmTblLstLine -> 一个公司的线路表
        title_flat = re.sub(r"\s+", "", cur_title or "")
        if not title_flat or SKIP_TITLE_MARK in title_flat:
            continue
        if cur_title not in companies:
            companies[cur_title] = CompanyRecord(name=cur_title, area=area)
            order.append(cur_title)
        comp = companies[cur_title]
        for tr in node.select("tr"):
            tds = tr.select("td")
            if len(tds) < 3:
                continue  # 表头行（<th>）
            a = tr.select_one("td a")
            if a is None:
                continue
            href = a.get("href") or ""
            lid = _lineid_from_href(href)
            if lid is None:
                continue
            name = _clean(a.get_text(" ", strip=True))
            if not name:
                continue
            trouble = bool(tr.select_one(".colTrouble") or tr.select_one(".icnAlert"))
            status = _clean(tds[1].get_text(" ", strip=True))
            detail = _clean(tds[2].get_text(" ", strip=True))
            comp.lines.append(
                LineRecord(
                    src_id=lid,
                    company=cur_title,
                    area=area,
                    line_name=name,
                    status_label=status,
                    trouble=trouble,
                    detail=detail,
                    url=f"{BASE}/diainfo/{lid}/0",
                )
            )

    return [companies[k] for k in order]


def fetch_all(verbose: bool = True) -> List[CompanyRecord]:
    """抓取全部地区。返回公司记录列表（内含各自线路）。"""
    session = requests.Session()
    seen: Dict[str, CompanyRecord] = {}
    order: List[str] = []

    for aid in AREA_IDS:
        url = f"{BASE}/diainfo/area/{aid}"
        html = _get(url, session)
        if html is None:
            continue
        if verbose:
            print(f"[info] fetched area {aid}")
        comps = parse_area(html, f"area{aid}")
        for c in comps:
            key = f"{c.area}||{c.name}"
            if key not in seen:
                seen[key] = c
                order.append(key)
        time.sleep(SLEEP)

    return [seen[k] for k in order]


def all_lines(companies: List[CompanyRecord]) -> List[LineRecord]:
    """展平为线路列表，按 源站 线路 ID 去重（保留首次出现）。"""
    out: Dict[str, LineRecord] = {}
    for c in companies:
        for ln in c.lines:
            out.setdefault(ln.src_id, ln)
    return list(out.values())


def fetch_detail_full(session: requests.Session, src_id: str) -> str:
    """抓取线路详情页 /diainfo/{id}/0，提取完整原文（dd.trouble）。
    列表页只给截断摘要（固定以…结尾），全文在详情页。失败返回空串。"""
    html = _get(f"{BASE}/diainfo/{src_id}/0", session)
    if html is None:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    dd = soup.select_one("dd.trouble")
    if dd is not None:
        txt = _clean(dd.get_text(" ", strip=True))
        if txt:
            return txt
    # 兜底：#main 内第一个足够长的正文段落（排除推文流 p.tweet）
    main = soup.select_one("#main")
    if main is not None:
        for p in main.select("p"):
            if "tweet" in (p.get("class") or []):
                continue
            txt = _clean(p.get_text(" ", strip=True))
            if len(txt) >= 30:
                return txt
    return ""


def enrich_trouble_details(lines: List[LineRecord], verbose: bool = True) -> int:
    """为异常线路补抓详情页完整原文（仅异常线路，通常 ~30 条，控制请求量）。
    非异常线路没有「查看原文」入口，无需补抓。"""
    session = requests.Session()
    n = 0
    for ln in lines:
        if not ln.trouble:
            continue
        full = fetch_detail_full(session, ln.src_id)
        if full:
            ln.detail_full = full
            n += 1
        time.sleep(SLEEP)
    if verbose:
        print(f"[info] enriched full detail for {n} trouble lines")
    return n


if __name__ == "__main__":
    import json

    comps = fetch_all()
    lines = all_lines(comps)
    print(f"\n=== companies: {len(comps)} | lines: {len(lines)} ===")

    labels: Dict[str, int] = {}
    for ln in lines:
        labels[ln.status_label] = labels.get(ln.status_label, 0) + 1
    print("\n=== status labels (真实分布) ===")
    for k, v in sorted(labels.items(), key=lambda x: -x[1]):
        print(f"  {v:>5}  {k}")

    trouble = [l for l in lines if l.trouble]
    print(f"\n=== trouble lines: {len(trouble)} ===")
    for l in trouble[:15]:
        print(f"  [{l.company}] {l.line_name} | {l.status_label} | {l.detail[:40]}")

    with open("/tmp/raw_lines.json", "w", encoding="utf-8") as f:
        json.dump([asdict(l) for l in lines], f, ensure_ascii=False, indent=1)
    print("\nsaved -> /tmp/raw_lines.json")
