#!/usr/bin/env bash
# DOCX → PDF (LibreOffice). docs/ 사용 설명서·DB 구조 PDF 생성.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"

if ! command -v soffice >/dev/null 2>&1 && ! command -v libreoffice >/dev/null 2>&1; then
  echo "LibreOffice(soffice)가 필요합니다." >&2
  exit 1
fi
SOFFICE="$(command -v soffice || command -v libreoffice)"

FILES=(
  "빠몽이_사용설명서.docx"
  "빠몽이_사용설명서_관리자.docx"
  "빠몽이_사용설명서_쇼핑몰.docx"
  "빠몽이_사용설명서_운영자.docx"
  "빠몽이_DB구조_설명서.docx"
)

cd "$DOCS"
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "skip missing: $f" >&2
    continue
  fi
  "$SOFFICE" --headless --convert-to pdf --outdir "$DOCS" "$f"
done

echo "PDF generation done."
ls -la "$DOCS"/빠몽이_*.pdf 2>/dev/null || true
