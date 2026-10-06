"""Build self-hosted font subsets from the official Paperlogy TTF package.

Requires fonttools[woff] in an isolated build environment; not a runtime dependency.
"""
import argparse
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("license", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
output = root / "studycrack-mobile-app/src/assets/fonts/paperlogy"
output.mkdir(parents=True, exist_ok=True)
license_text = args.license.read_text()
assert "SIL OPEN FONT LICENSE Version 1.1" in license_text
core = set(range(256))
for source in (root / "studycrack-mobile-app/src").rglob("*"):
    if source.suffix in (".js", ".jsx"):
        core.update(map(ord, source.read_text()))


faces = []
stats = []
for weight, name in [(400, "4Regular"), (700, "7Bold"), (800, "8ExtraBold")]:
    source = args.source / f"Paperlogy-{name}.ttf"
    original = TTFont(source).getBestCmap()
    subsets = {"core": set(original) & core, "extended": set(original) - core}
    restored = set()
    for label in ("extended", "core"):
        codepoints = subsets[label]
        font = TTFont(source)
        options = subset.Options()
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=codepoints)
        sub.subset(font)
        for platform, encoding, language in [(3, 1, 0x409), (1, 0, 0)]:
            font["name"].setName(license_text, 13, platform, encoding, language)
        font.flavor = "woff2"
        target = output / f"paperlogy-{weight}-{label}.woff2"
        font.save(target)
        restored.update(TTFont(target).getBestCmap())
        stats.append({"file": target.name, "bytes": target.stat().st_size, "glyphs": len(codepoints)})
        coverage = "U+0-10FFFF"
        faces.append(f'@font-face{{font-family:"Paperlogy";font-style:normal;font-weight:{weight};font-display:swap;src:url("../../assets/fonts/paperlogy/{target.name}") format("woff2");unicode-range:{coverage};}}')
    assert restored == set(original), "Subsets must preserve the full original character coverage"
print(json.dumps(stats))
print("\n".join(faces))
