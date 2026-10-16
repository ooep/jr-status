#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jr-status / translate.py
调用 Index-Translate 免费公共 API（https://index-translate.bilibili.com/v1），
把日语运行情报（状态标签 / 故障详情）翻译为中文、英语。

设计：
  - 纯 stdlib（urllib），无第三方依赖；
  - 持久缓存 data/translations.json：按原文 sha1 去重，只翻译「从未见过的文本」，
    稳定运行期每次更新几乎不产生新请求；
  - 并发（线程池）控制请求耗时，单个失败静默跳过（返回 None），不中断采集流水线；
  - 调用参数与 scripts/call_api.py 一致：Index-Translate-35B-A3B、
    enable_thinking=False、temperature=0、max_tokens=1024。
"""

from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple

API_BASE = "https://index-translate.bilibili.com/v1"
MODEL = "Index-Translate-35B-A3B"
LANG_NAMES = {"zh": "中文", "en": "英语", "ja": "日语"}
UA = "Index-Translate-Client/1.0"
TIMEOUT = 60            # 单次请求超时（秒）
SLEEP = 0.15            # 结果收集间隙，礼貌限速
MAX_WORKERS = 4         # 并发数（免费公共 API，克制一点）
MAX_NEW_PER_RUN = 200   # 单次运行最多翻译的新文本数（防御保护）

# 领域术语表（硬性约束）：保证状态标签与常见故障词的译文稳定、地道
GLOSS = {
    "zh": ("運転見合わせ→停运、運転再開→恢复运行、運転状況→运行状况、運転計画→计划调整、"
           "平常運転→正常运营、列車遅延→列车晚点、人身事故→人身伤亡事故、振替輸送→替代运输、運休→停运"),
    "en": ("運転見合わせ→suspension of services、運転再開→resumption of services、"
           "運転状況→operation status、運転計画→planned schedule changes、平常運転→normal operation、"
           "列車遅延→train delays、人身事故→person-hit-by-train incident、振替輸送→substitute transportation、"
           "運休→service suspension"),
}

# 已知状态标签的精确映射（枚举值，本地固定译文，不调 API）：
# 源站的状态标签是一个很小的枚举集合，直接映射保证 100% 稳定且零请求；
# 出现的新标签会走 API 翻译并由缓存记住。
LABEL_MAP = {
    "平常運転": ("正常运营", "normal operation"),
    "平常運転（他1件）": ("正常运营（其他1项）", "Normal operation (and 1 other item)"),
    "列車遅延": ("列车晚点", "Train delays"),
    "運転見合わせ": ("停运", "Suspension of services"),
    "運転状況": ("运行状况", "Operation status"),
    "運転計画": ("计划调整", "Planned schedule changes"),
    "運転再開": ("恢复运行", "Resumption of services"),
    "その他": ("其他", "Other"),
    "運休": ("停运", "Service suspension"),
}

# 短文本（状态标签类）带术语约束时模型容易把术语对照表复述出来，
# 因此只有较长文本（故障详情）使用术语约束
GLOSS_MIN_LEN = 24


def sha1hex(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


class TranslationCache:
    """data/translations.json 的读写与查找。"""

    SCHEMA = "jr-status/translations/v1"

    def __init__(self, path: Path):
        self.path = path
        self.items: Dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            items = data.get("items") or {}
            self.items = {k: v for k, v in items.items()
                          if isinstance(v, dict) and v.get("ja")}
        except Exception:
            self.items = {}

    def get(self, text: str) -> Optional[dict]:
        if not text:
            return None
        return self.items.get(sha1hex(text))

    def put(self, text: str, zh: Optional[str], en: Optional[str]) -> None:
        key = sha1hex(text)
        entry = self.items.setdefault(key, {"ja": text})
        if zh:
            entry["zh"] = zh
        if en:
            entry["en"] = en

    def save(self, updated_at: str) -> bool:
        if not self.items:
            return False
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema": self.SCHEMA,
            "updated_at": updated_at,
            "count": len(self.items),
            "items": self.items,
        }
        self.path.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8")
        return True


def _chat(text: str, target_lang: str) -> Optional[str]:
    """单次调用 Index-Translate；失败返回 None（含一次重试）。"""
    tgt = LANG_NAMES.get(target_lang)
    if tgt is None:
        return None
    gloss = GLOSS.get(target_lang)
    if gloss and len(text.strip()) >= GLOSS_MIN_LEN:
        # 带术语硬约束（与 call_api.py 的 instTrans 约束形式一致）
        prompt = (
            f"请将以下日语文本翻译成{tgt}，并且严格遵循所有约束要求。\n\n"
            f"【源文】\n{text.strip()}\n\n"
            f"【约束要求】\n1. 【硬性要求】专名/术语对照: {gloss}\n\n"
            f"只输出译文，不要有任何额外说明。"
        )
    else:
        prompt = (f"请将以下日语文本翻译为{tgt}，直接输出翻译结果，不要进行任何解释。\n\n"
                  f"{text.strip()}")
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 1024,
        "stream": False,
        # 关闭 CoT 思考：模型被训练为直接输出译文，开启思考可能让思考文本顶替译文
        "chat_template_kwargs": {"enable_thinking": False},
    }
    req = urllib.request.Request(
        f"{API_BASE.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": UA},
    )
    last_err: Optional[str] = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                res = json.loads(resp.read().decode("utf-8"))
            content = res["choices"][0]["message"]["content"]
            if "</think>" in content:
                content = content.split("</think>", 1)[1]
            content = (content or "").strip().removeprefix("<think>").strip()
            return content or None
        except Exception as e:  # noqa: BLE001
            last_err = repr(e)
            time.sleep(0.5 * (attempt + 1))
    print(f"[i18n][warn] 翻译失败({tgt}): {text[:40]!r} ({last_err})")
    return None


def translate_texts(texts: List[str], cache: TranslationCache) -> Dict[str, Tuple[Optional[str], Optional[str]]]:
    """只为缓存缺失的新文本发起翻译；返回 {text: (zh, en)}，失败项为 None。"""
    seen, todo = set(), []
    for t in texts:
        if not t or t in seen:
            continue
        seen.add(t)
        e = cache.get(t)
        if not e or not e.get("zh") or not e.get("en"):
            todo.append(t)
    todo = todo[:MAX_NEW_PER_RUN]
    if not todo:
        return {}

    results: Dict[str, Tuple[Optional[str], Optional[str]]] = {}

    def work(t: str) -> Tuple[str, Tuple[Optional[str], Optional[str]]]:
        return t, (_chat(t, "zh"), _chat(t, "en"))

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = [ex.submit(work, t) for t in todo if t not in LABEL_MAP]
        for fut in as_completed(futures):
            try:
                t, pair = fut.result()
                results[t] = pair
            except Exception:  # noqa: BLE001
                pass
            time.sleep(SLEEP)

    # 已知状态标签：本地精确映射，不走 API
    for t in todo:
        if t in LABEL_MAP:
            results[t] = LABEL_MAP[t]

    for t, (zh, en) in results.items():
        cache.put(t, zh, en)
    print(f"[i18n] 本次新翻译 {len(todo)} 条，成功 {len(results)} 条")
    return results
