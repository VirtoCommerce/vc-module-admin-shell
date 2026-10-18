"""Checks a translation file against its English source.

Usage: python l10n_check.py <en.json> <lang.json> [<lang.json> ...]
Fails (exit 1) when a file isn't valid JSON, misses or adds keys, has an empty value, changes the placeholders of a
string ({count}, {name}, @:links), the number of plural forms ("a | b"), or HTML tags. Warns when more than a third
of the strings are identical to English (likely untranslated).
"""
import json
import re
import sys

PLACEHOLDER = re.compile(r"\{[^{}]*\}|@:[\w.]+|%[sd]")
TAG = re.compile(r"</?[a-zA-Z][^>]*>")


def flatten(node, prefix=""):
    if isinstance(node, dict):
        out = {}
        for key, value in node.items():
            out.update(flatten(value, f"{prefix}.{key}" if prefix else key))
        return out
    return {prefix: node}


def check(en_path, path):
    problems = []
    try:
        lang = json.load(open(path, encoding="utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        return [f"not valid JSON: {e}"], 0
    en = flatten(json.load(open(en_path, encoding="utf-8-sig")))
    tr = flatten(lang)
    for key in en.keys() - tr.keys():
        problems.append(f"missing key {key}")
    for key in tr.keys() - en.keys():
        problems.append(f"extra key {key}")
    same = 0
    for key in en.keys() & tr.keys():
        a, b = en[key], tr[key]
        if not isinstance(a, str):
            continue
        if not isinstance(b, str) or (a.strip() and not b.strip()):
            problems.append(f"empty or not text: {key}")
            continue
        if sorted(PLACEHOLDER.findall(a)) != sorted(PLACEHOLDER.findall(b)):
            problems.append(f"placeholders differ in {key}: {PLACEHOLDER.findall(a)} vs {PLACEHOLDER.findall(b)}")
        if a.count(" | ") != b.count(" | ") or a.count("|") != b.count("|"):
            problems.append(f"plural forms differ in {key}")
        if sorted(t.split()[0] for t in TAG.findall(a)) != sorted(t.split()[0] for t in TAG.findall(b)):
            problems.append(f"HTML tags differ in {key}")
        if a == b and len(a) > 3 and not a.startswith("http"):
            same += 1
    return problems, same / max(1, len(en))


failed = False
en_path = sys.argv[1]
for path in sys.argv[2:]:
    problems, same = check(en_path, path)
    status = "OK" if not problems else "FAIL"
    if problems:
        failed = True
    note = f" (warning: {same:.0%} identical to English)" if same > 0.34 else ""
    print(f"{status} {path}{note}")
    for p in problems[:20]:
        print("   ", p)
sys.exit(1 if failed else 0)
