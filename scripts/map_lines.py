#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jr-status / map_lines.py
把 公开运行情报源 的「公司 + 线路名」映射到主站 Mini JapanRail 的权威线路表。

映射阶梯（越靠前置信度越高）：
  L1 exact      : NFKC + 去 [区间]/(注记) 后完全一致
  L2 alias      : 人工维护的别名表（愛称 / 异名）
  L3 company    : 剥离该线路「自己公司名」前缀后的形态
  L4 operator   : 继续剥离通用运营商前缀形態（東京メトロ / 東武 / jr / 〜市営 …）
  L5 suffix     : 再去结尾「線」後的形态
  L6 composite  : 含「・」的复合线名拆成多条（西武池袋線・秩父線 -> 池袋線 + 西武秩父線）
  L7 fuzzy      : 高阈值近似（低置信度，仍记录）

★ 歧义消解（关键）：不同公司的同名线路在剥离前缀后会退化为同一个 key
   （例：東京メトロ東西線 与 札幌市営地下鉄東西線 都会退化成「東西線」）。
   因此变体索引保留**全部候选**，命中多个候选时，用该线路的**所属公司名特征**
   在候选全称里做区分，仍无法唯一确定则判定为 unmapped。

设计原则：**宁可留未映射，也不做错误映射**。未映射线路会落到 mapping/unmapped.json。
"""

from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REF_PATH = ROOT / "mapping" / "lines_reference.json"
ALIAS_PATH = ROOT / "mapping" / "aliases.json"

CONFIDENCE = {
    "exact": 1.00,
    "alias": 0.98,
    "company": 0.92,
    "operator": 0.86,
    "suffix": 0.80,
    "composite": 0.78,
    "fuzzy": 0.68,
}
# 匹配时的尝试顺序（数字越小越优先）
LEVEL_ORDER = {"exact": 0, "alias": 1, "company": 2, "operator": 3, "suffix": 4, "composite": 5, "fuzzy": 6}

OPERATORS = [
    "JR北海道", "JR東日本", "JR東海", "JR西日本", "JR四国", "JR九州", "JR貨物", "JR", "jr",
    "東京地下鉄", "東京メトロ", "都営", "都電", "大阪メトロ", "Osaka Metro",
    "東武", "西武", "京王", "京急", "京成", "相鉄", "東急", "小田急",
    "阪急", "阪神", "近鉄", "南海", "名鉄", "西鉄", "新京成電鉄", "北総鉄道",
    "札幌市交通局", "札幌市営", "仙台市交通局", "仙台市営", "横浜市交通局", "横浜市営",
    "名古屋市交通局", "名古屋市営", "神戸市交通局", "神戸市営", "福岡市交通局", "福岡市営",
    "熊本市交通局", "熊本市営", "鹿児島市交通局", "鹿児島市営", "京都市交通局", "京都市営",
    "東京都交通局", "大阪市高速電気軌道", "函館市企業局", "函館市電", "札幌市電",
    "東武鉄道", "西武鉄道", "京王電鉄", "京浜急行電鉄", "京成電鉄", "相模鉄道", "東急電鉄",
    "小田急電鉄", "阪急電鉄", "阪神電気鉄道", "近畿日本鉄道", "南海電気鉄道",
    "名古屋鉄道", "西日本鉄道", "東京モノレール", "湘南モノレール", "千葉都市モノレール",
    "多摩都市モノレール", "大阪モノレール", "沖縄都市モノレール", "北九州高速鉄道",
    "舞浜リゾートライン", "広島高速交通", "埼玉新都市交通", "ゆりかもめ", "神戸新交通",
    "愛知高速交通", "名古屋ガイドウェイバス", "スカイレールサービス", "山万",
    "横浜新都市交通", "アストラムライン",
]

# 公司名 → 剥离用的后缀（用于从 company 推前缀候选与 Town-based 公司特征词）
CORP_SUFFIX = re.compile(
    r"(?:旅客鉄道|高速鉄道|電気鉄道|電鉄|鉄道|軌道|交通|企業局|都市開発|モノレール|"
    r"臨海鉄道|新交通|ライン|LINE|line)+$"
)
TOWN_STRIP = re.compile(r"(?:交通局|企業局|旅客鉄道|高速鉄道|電気鉄道|電鉄|鉄道|軌道|"
                        r"地下鉄|モノレール|新交通|市営|都営|局|市|県)+$")
INFIX_NOISE = re.compile(r"(地下鉄|市営鉄道|高架)")

# ---------------------------------------------------------------------------
# 公司「族」：主站线路名里常内嵌公司缩写或泛称（神鉄三田線 / 都営地下鉄三田線 /
# jr山田線 …）。同一个 stripping key（如「三田線」）会指向多家公司的不同线路，
# 因此用「族」做归属校验，避免跨公司张冠李戴：都営（东京）的线路不会被判给神戸電鉄。
COMPANY_FAMILIES: List[Tuple[str, List[str]]] = [
    ("JR北海道", ["JR北海道"]), ("JR東日本", ["JR東日本"]), ("JR東海", ["JR東海"]),
    ("JR西日本", ["JR西日本"]), ("JR四国", ["JR四国"]), ("JR九州", ["JR九州"]),
    ("JR貨物", ["JR貨物"]), ("JR", ["JR", "jr"]),
    ("東京地下鉄", ["東京メトロ", "東京地下鉄", "営団", "地下鉄"]),
    ("東京都交通局", ["都営", "都電", "東京都交通局"]),
    ("大阪市高速電気軌道", ["大阪メトロ", "Osaka Metro", "大阪市高速電気軌道"]),
    ("神戸電鉄", ["神鉄", "神戸電鉄", "神戸"]),
    ("名古屋鉄道", ["名鉄", "名古屋鉄道"]),
    ("近畿日本鉄道", ["近鉄", "近畿日本鉄道"]),
    ("京浜急行電鉄", ["京急", "京浜急行電鉄"]),
    ("東急電鉄", ["東急", "東急電鉄"]),
    ("相模鉄道", ["相鉄", "相模鉄道"]),
    ("東武鉄道", ["東武"]), ("西武鉄道", ["西武"]), ("京王電鉄", ["京王"]),
    ("京成電鉄", ["京成"]), ("小田急電鉄", ["小田急"]),
    ("阪急電鉄", ["阪急"]), ("阪神電気鉄道", ["阪神"]), ("南海電気鉄道", ["南海"]),
    ("西日本鉄道", ["西鉄", "西日本鉄道"]), ("新京成電鉄", ["新京成", "新京成電鉄"]),
    ("札幌市交通局", ["札幌市交通局", "札幌市営", "札幌"]),
    ("仙台市交通局", ["仙台市交通局", "仙台市営", "仙台"]),
    ("横浜市交通局", ["横浜市交通局", "横浜市営", "横浜"]),
    ("名古屋市交通局", ["名古屋市交通局", "名古屋市営", "名古屋"]),
    ("神戸市交通局", ["神戸市交通局", "神戸市営"]),
    ("福岡市交通局", ["福岡市交通局", "福岡市営", "福岡"]),
    ("京都市交通局", ["京都市交通局", "京都市営", "京都"]),
    ("札幌市電", ["札幌市電"]), ("函館市企業局", ["函館市企業局", "函館市電"]),
    ("東京モノレール", ["東京モノレール"]), ("湘南モノレール", ["湘南モノレール"]),
    ("大阪モノレール", ["大阪モノレール"]),
    ("千葉都市モノレール", ["千葉都市モノレール"]),
    ("多摩都市モノレール", ["多摩都市モノレール"]),
    ("埼玉新都市交通", ["ニューシャトル", "埼玉新都市交通"]),
    ("ゆりかもめ", ["ゆりかもめ"]),
    ("ウィラートレイン", ["ウィラートレイン", "WILLER", "京都丹後鉄道"]),
    ("秩父鉄道", ["秩父鉄道"]), ("富士山麓電鉄", ["富士急行", "富士山麓電鉄"]),
    ("いすみ鉄道", ["いすみ鉄道"]), ("真岡鐵道", ["真岡鐵道"]),
    ("上信電鉄", ["上信電鉄"]), ("上毛電鉄", ["上毛電鉄", "上毛電気鉄道"]),
    ("長野電鉄", ["長野電鉄"]), ("天竜浜名湖鉄道", ["天竜浜名湖鉄道"]),
    ("のと鉄道", ["のと鉄道"]), ("銚子電気鉄道", ["銚子電鉄", "銚子電気鉄道"]),
    ("筑豊電気鉄道", ["筑豊電鉄", "筑豊電気鉄道"]), ("近江鉄道", ["近江鉄道"]),
    ("甘木鉄道", ["甘木鉄道"]), ("長崎電気軌道", ["長崎電気軌道"]),
    ("熊本市交通局", ["熊本市電", "熊本市交通局"]),
    ("鹿児島市交通局", ["鹿児島市電", "鹿児島市交通局"]),
    ("わたらせ渓谷鐵道", ["わたらせ渓谷鐵道", "わたらせ渓谷"]),
    ("土佐くろしお鉄道", ["土佐くろしお鉄道"]), ("伊予鉄道", ["伊予鉄道", "伊予鉄"]),
    ("横浜シーサイドライン", ["シーサイドライン", "横浜シーサイドライン"]),
    ("富山地方鉄道", ["富山地方鉄道"]),
]


# 公司族别名同时作为「可剥离前缀」参与变体生成，
# 使主站侧缩写名（神鉄三田線 / 都営地下鉄三田線）也能生成通用候选形态。
OPERATORS = list(
    dict.fromkeys(
        OPERATORS + [a for _fam, aliases in COMPANY_FAMILIES for a in aliases]
    )
)


def families_of(text: str) -> Set[str]:
    """文本命中的公司族集合（不分大小写 / 半全角）。"""
    if not text:
        return set()
    low = nfkc(text).lower()
    out: Set[str] = set()
    for fam, aliases in COMPANY_FAMILIES:
        for a in aliases:
            if nfkc(a).lower() in low:
                out.add(fam)
                break
    # JR 与具体 JR 会社互相视为同族（jr山田線 vs JR東日本）
    if any(f.startswith("JR") for f in out):
        out.add("JR")
    return out


# ------------------------------------------------------------------ 归一化
def nfkc(s: str) -> str:
    return unicodedata.normalize("NFKC", s or "")


def clean(s: str) -> str:
    s = nfkc(s)
    s = re.sub(r"\[[^\]]*\]", "", s)        # 東海道本線[東京～熱海]
    s = re.sub(r"[（(][^）)]*[）)]", "", s)   # 中央総武線(各停)
    s = re.sub(r"\s+", "", s)
    return s.strip()


def company_tokens(company: str) -> List[str]:
    """从公司名生成用于在候选全称里做区分的特征词（由长到短）。
    例：札幌市交通局 -> ['札幌市交通局', '札幌市', '札幌'] ; JR東日本 -> ['JR東日本','jr']"""
    c = clean(company)
    if not c:
        return []
    toks: List[str] = [c]
    cur = CORP_SUFFIX.sub("", c) or c
    toks.append(cur)
    # 进一步剥 도시 etc：札幌市交通局 -> 札幌市 -> 札幌
    for _ in range(3):
        nxt = TOWN_STRIP.sub("", cur)
        if not nxt or nxt == cur:
            break
        cur = nxt
        if len(cur) >= 2:
            toks.append(cur)
    if c.lower().startswith("jr"):
        toks.append("jr")
    # 去重并保持长度降序（优先用最具体的特征词）
    out, seen = [], set()
    for t in sorted(set(toks), key=len, reverse=True):
        if t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out


def _strip_once(variants: Set[str], prefixes: List[str]) -> Set[str]:
    out: Set[str] = set()
    for x in variants:
        for p in prefixes:
            if x.startswith(p) and len(x) > len(p) + 1:
                out.add(x[len(p):])
    return out


def name_variants(name: str, company: str = "") -> Dict[str, str]:
    """线路名 -> {候选形态: 产生方式}。方式按剥离强度递进。"""
    base = clean(name)
    if not base:
        return {}
    var: Dict[str, str] = {base: "exact"}

    comp_pref = company_tokens(company)
    ops = [clean(p) for p in OPERATORS if clean(p)]
    all_pref = list(dict.fromkeys(comp_pref + ops))

    # round 1: 只剥「自己的公司名」-> company 级
    cur: Set[str] = {base}
    r1 = _strip_once(cur, comp_pref)
    for x in r1:
        var.setdefault(x, "company")
    # round 2: 再剥任意通用运营商 -> operator 级
    cur2 = r1 | cur
    r2 = _strip_once(cur2, ops)
    for x in r2:
        var.setdefault(x, "operator")
    cur3 = cur2 | r2
    # infix 去噪 + 去尾「線」
    for round_src, label in ((cur3, "operator"), (set(var.keys()), "operator")):
        add: Set[str] = set()
        for x in round_src:
            n = INFIX_NOISE.sub("", x)
            if n and n != x:
                add.add(n)
            s = re.sub(r"線$", "", x)
            if s and s != x:
                add.add(s)
        for x in add:
            var.setdefault(x, "suffix" if x in {re.sub(r'線$', '', y) for y in round_src} else "operator")
    # 再对已生成的变体做一次「去尾線」与 infix
    snapshot = list(var.items())
    for k, _how in snapshot:
        for cand, lbl in ((re.sub(r"線$", "", k), "suffix"), (INFIX_NOISE.sub("", k), "operator")):
            if cand and cand != k:
                var.setdefault(cand, lbl)
    return {k: v for k, v in var.items() if k}


class Mapper:
    def __init__(self, ref_path: Path = REF_PATH, alias_path: Path = ALIAS_PATH):
        self.ref: List[dict] = json.loads(ref_path.read_text(encoding="utf-8"))
        self.aliases: Dict[str, str] = (
            json.loads(alias_path.read_text(encoding="utf-8")) if alias_path.exists() else {}
        )
        self.aliases.pop("_note", None)
        self.aliases.pop("_source", None)

        # index: 候选形态 -> 候选 ref 列表（全部保留，匹配时再做歧义消解）
        self.index: Dict[str, List[dict]] = {}
        self.exact: Dict[str, dict] = {}
        for r in self.ref:
            self.exact.setdefault(clean(r["line"]), r)
            for k, _how in name_variants(r["line"]).items():
                lst = self.index.setdefault(k, [])
                if all(x["seq"] != r["seq"] for x in lst):
                    lst.append(r)
        self._keys = list(self.index.keys())

    # -------------------------------------------------------------- 单条匹配
    def compatible(self, ref_name: str, company: str) -> bool:
        """归属校验：只有当候选线路名与 源站 公司两侧都识别出「族」且互不相交时才拒绝。
        两侧任一为空（无法判定）则放行，避免因信息缺失误杀正确映射。"""
        fam_ref = families_of(ref_name)
        fam_cmp = families_of(company)
        if not fam_ref or not fam_cmp:
            return True
        return bool(fam_ref & fam_cmp)

    def _pick(self, cands: List[dict], company: str) -> Optional[dict]:
        """候选多于一条/或单条时，先用公司族过滤，再用公司特征词消歧；无法唯一则 None。"""
        keep = [c for c in cands if self.compatible(c["line"], company)]
        pool = keep or []
        if not pool:
            return None
        if len(pool) == 1:
            return pool[0]
        # 用公司名特征词逐层收缩（由具体到宽泛）
        narrower: List[dict] = pool
        for tok in company_tokens(company):
            if len(tok) < 2:
                continue
            tl = tok.lower()
            matched = [c for c in narrower if tl in c["line"].lower()]
            if len(matched) == 1:
                return matched[0]
            if len(matched) > 1:
                narrower = matched
        return None

    def map_one(self, src_name: str, company: str = "") -> Tuple[Optional[dict], str, float]:
        base = clean(src_name)

        # L1 exact
        if base in self.exact:
            return self.exact[base], "exact", CONFIDENCE["exact"]

        # L2 alias
        tgt = self.aliases.get(base) or self.aliases.get(nfkc(src_name)) or self.aliases.get(src_name)
        if tgt:
            rec = self.exact.get(clean(tgt))
            if rec:
                return rec, "alias", CONFIDENCE["alias"]

        # L3..L5 variants（按剥离强度递增尝试）
        var = name_variants(src_name, company)
        for k, how in sorted(var.items(), key=lambda kv: LEVEL_ORDER.get(kv[1], 9)):
            cands = self.index.get(k)
            if not cands:
                continue
            rec = self._pick(cands, company)
            if rec:
                return rec, how, CONFIDENCE.get(how, 0.8)

        # L7 fuzzy
        rec = self._fuzzy(base, company)
        if rec:
            return rec, "fuzzy", CONFIDENCE["fuzzy"]
        return None, "unmapped", 0.0

    def map_composite(self, src_name: str, company: str = "") -> List[Tuple[dict, str, float]]:
        """返回全部映射结果。
        先按**整名**匹配（日暮里・舎人ライナー 等含「・」的名称必须整名优先），
        整名失败时才按「・」「、」拆成多条分别匹配（西武池袋線・秩父線）。"""
        whole = clean(src_name)
        rec, m, c = self.map_one(whole, company)
        if rec:
            return [(rec, m, c)]

        parts = [p for p in re.split(r"[・、]", whole) if p]
        if not parts:
            return []
        out: List[Tuple[dict, str, float]] = []
        seen: Set[int] = set()
        for p in parts:
            rec, m, c = self.map_one(p, company)
            if rec and rec["seq"] not in seen:
                seen.add(rec["seq"])
                out.append((rec, "composite", min(c, CONFIDENCE["composite"])))
        if len(out) > 1:
            out.sort(key=lambda x: -x[2])
        return out

    def _fuzzy(self, key: str, company: str) -> Optional[dict]:
        if len(key) < 3:
            return None
        best_val, best_key = 0.0, None
        for k in self._keys:
            if abs(len(k) - len(key)) > 2:
                continue
            r = SequenceMatcher(None, key, k).ratio()
            if r > best_val:
                best_val, best_key = r, k
        if best_val >= 0.82 and best_key:
            return self._pick(self.index[best_key], company)
        return None


if __name__ == "__main__":
    m = Mapper()
    tests = [
        ("湘南新宿ライン", "JR東日本"),
        ("東海道本線[東京～熱海]", "JR東日本"),
        ("東京メトロ銀座線", "東京メトロ"),
        ("札幌市営東西線", "札幌市交通局"),
        ("弘南鉄道弘南線", "弘南鉄道"),
        ("学園都市線", "JR北海道"),
        ("山田線", "JR東日本"),
        ("日光線", "JR東日本"),
        ("西武池袋線・秩父線", "西武鉄道"),
        ("東武スカイツリーライン", "東武鉄道"),
        ("上野東京ライン", "JR東日本"),
        ("都営三田線", "東京都交通局"),
        ("仙台市営南北線", "仙台市交通局"),
    ]
    for name, comp in tests:
        res = m.map_composite(name, comp)
        tag = "  ".join(f"{r['line']}(seq={r['seq']},{mm},{cc})" for r, mm, cc in res) or "unmapped"
        print(f"{name:<22} [{comp:<8}] -> {tag}")
