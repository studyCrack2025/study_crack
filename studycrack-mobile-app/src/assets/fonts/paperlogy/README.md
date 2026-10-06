# Paperlogy mobile font assets

Official Paperlogy 1.000: https://freesentation.blog/paperlogyfont
Source package: https://raw.githubusercontent.com/Freesentation/paperlogy/main/Paperlogy-1.000.zip
License: SIL Open Font License 1.1 (see OFL.txt). The full license is also embedded in name ID 13 of every distributed WOFF2 file.

Weights: 400, 700, 800. Other requested weights use the browser's nearest available face. System Korean fonts remain the fallback for loading failures and characters absent from the original font.

Each weight is split into disjoint core and extended character sets. Core contains characters used by mobile JS/JSX and the original font's Latin range. Extended preserves the rest of the original cmap and loads only when needed. The two sets retain all 11,723 original mapped characters; they do not claim coverage beyond the original font. CSS declares the extended face before the preferred core face with overlapping Unicode ranges; the browser selects the core face first and falls back to the extended face for missing glyphs. This avoids repeating large per-weight character-range declarations. Browser tests cover core-only labels, an extended Korean glyph, and download failure.

Core total: 132,052 bytes (~129 KiB). All six files: 515,556 bytes. Vite hashes and emits these assets; existing release asset rules apply immutable caching.

Rebuild using an isolated Python environment with fonttools[woff], from the official extracted TTFs and OFL.txt:

    python tools/build_mobile_fonts.py /path/to/official-ttfs /path/to/OFL.txt

The builder prints the corresponding font-face rules in extended-then-core priority order. Rebuild the subsets when source character coverage changes; update existing foundation/base.css rules if filenames or selected weights change. No runtime Python dependency or external font CSS is required.
