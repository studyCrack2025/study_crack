#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 20260524b"
  exit 1
fi

VER="$1"

perl -pi -e 's{(href="/css/[^"?]+\.css)(?:\?v=[^"]*)?"}{$1?v='"$VER"'"}g; s{(src="/js/[^"?]+\.js)(?:\?v=[^"]*)?"}{$1?v='"$VER"'"}g' *.html

echo "Updated local /css and /js asset query version to: $VER"
