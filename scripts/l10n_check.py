"""Checks a translation file against its English source.

Usage: python l10n_check.py <en.json> <lang.json> [<lang.json> ...]
Fails (exit 1) when a file isn't valid JSON, misses or adds keys, has an empty value, changes the placeholders of a
string ({count}, {name}, @:links), the number of plural forms ("a | b"), or HTML tags. Warns when more than a third
of the strings are identical to English (likely untranslated). The files must be .json files in the current folder or
under it (run it from the repository root).
"""
import json
import re
import sys
from pathlib import Path

PLACEHOLDER = re.compile(r"\{[^{}]*\}|@:[\w.]+|%[sd]")
TAG = re.compile(r"</?[a-zA-Z][^>]*>")


def flatten(node, prefix=""):
    if isinstance(node, dict):
        out = {}
        for key, value in node.items():
            out.update(flatten(value, f"{prefix}.{key}" if prefix else key))
        return out
    return {prefix: node}


def safe_path(arg):
    """The file an argument names: a .json file in the current folder or under it, else an error."""
    root = Path.cwd().resolve()
    path = (root / arg).resolve()
    if path.suffix.lower() != ".json" or not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"not a .json file under {root}: {arg}")
    return path


def load(path):
    with open(path, encoding="utf-8-sig") as file:
        return json.load(file)


def tags(text):
    return sorted(t.split()[0] for t in TAG.findall(text))


def compare(key, english, translated):
    """The problems of one translated string"""
    if not isinstance(translated, str) or (english.strip() and not translated.strip()):
        return [f"empty or not text: {key}"]
    problems = []
    if sorted(PLACEHOLDER.findall(english)) != sorted(PLACEHOLDER.findall(translated)):
        problems.append(
            f"placeholders differ in {key}: {PLACEHOLDER.findall(english)} vs {PLACEHOLDER.findall(translated)}"
        )
    if english.count(" | ") != translated.count(" | ") or english.count("|") != translated.count("|"):
        problems.append(f"plural forms differ in {key}")
    if tags(english) != tags(translated):
        problems.append(f"HTML tags differ in {key}")
    return problems


def check(en, path):
    """The problems of a translation file and the share of its strings identical to English"""
    try:
        tr = flatten(load(path))
    except ValueError as e:
        return [f"not valid JSON: {e}"], 0
    problems = [f"missing key {key}" for key in en.keys() - tr.keys()]
    problems += [f"extra key {key}" for key in tr.keys() - en.keys()]
    same = 0
    for key in en.keys() & tr.keys():
        english, translated = en[key], tr[key]
        if not isinstance(english, str):
            continue
        problems += compare(key, english, translated)
        if english == translated and len(english) > 3 and not english.startswith("http"):
            same += 1
    return problems, same / max(1, len(en))


def main(args):
    if len(args) < 2:
        print(__doc__)
        return 2
    try:
        en_path, paths = safe_path(args[0]), [safe_path(a) for a in args[1:]]
    except ValueError as e:
        print(e)
        return 2
    en = flatten(load(en_path))
    failed = False
    for arg, path in zip(args[1:], paths):
        problems, same = check(en, path)
        failed = failed or bool(problems)
        note = f" (warning: {same:.0%} identical to English)" if same > 0.34 else ""
        print(f"{'FAIL' if problems else 'OK'} {arg}{note}")
        for p in problems[:20]:
            print("   ", p)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
