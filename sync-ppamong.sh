#!/bin/bash
# Replit 등 배포 환경에서 GitHub main과 동기화
set -e

cd "$(dirname "$0")"

echo "=== PPAMONG: GitHub 동기화 ==="
git fetch origin
git pull origin main

echo ""
echo "=== 의존성 설치 ==="
npm install

echo ""
echo "=== 최신 커밋 ==="
git log -3 --oneline

echo ""
echo "완료. Replit이면 Stop → Run 으로 서버를 재시작하세요."
echo "브라우저에서 Ctrl+Shift+R (강력 새로고침)도 해 주세요."
