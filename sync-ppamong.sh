#!/bin/bash
# Replit 등 배포 환경에서 GitHub main과 동기화 (GitHub = 기준)
set -e

cd "$(dirname "$0")"

echo "=== PPAMONG: GitHub 동기화 ==="
git fetch origin main

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "이미 GitHub main과 동일합니다. ($LOCAL)"
elif git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
  echo "Fast-forward: $LOCAL -> $REMOTE"
  git merge --ff-only origin/main
else
  echo "Replit 로컬과 GitHub main이 갈라졌습니다."
  echo "GitHub 기준으로 맞춥니다 (Replit에서만 만든 로컬 커밋은 사라집니다)."
  git reset --hard origin/main
fi

echo ""
echo "=== 의존성 설치 ==="
npm install

echo ""
echo "=== 최신 커밋 ==="
git log -3 --oneline

echo ""
echo "완료. Replit이면 Stop → Run 또는 Deploy 로 서버를 재시작하세요."
echo ""
echo "PostgreSQL → MongoDB 전체 미러:"
echo "  npm run discover:pg-db    # 어느 DB에 데이터가 있는지 먼저 탐색"
echo "  npm run sync:pg-to-mongo"
echo "  (Secrets: DATABASE_URL, MONGODB_URI, PG_DATABASE_NAME=ppadun9 권장)"
echo ""
echo "브라우저에서 Ctrl+Shift+R (강력 새로고침)도 해 주세요."
