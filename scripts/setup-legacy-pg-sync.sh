#!/bin/bash
# 빠던9 PostgreSQL → PPAMONG MongoDB 연결·동기화 원스텝 가이드
set -e
cd "$(dirname "$0")"

echo "=== 1/3: GitHub 동기화 ==="
git fetch origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" != "$REMOTE" ]; then
  if git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
    git merge --ff-only origin/main
  else
    git reset --hard origin/main
  fi
fi
npm install --silent 2>/dev/null || npm install

echo ""
echo "=== 2/3: PostgreSQL Secrets 점검 ==="
npm run check:pg-secrets || {
  echo ""
  echo "Secrets 설정 후 Repl을 재시작하고 이 스크립트를 다시 실행하세요."
  exit 1
}

echo ""
echo "=== 3/3: PostgreSQL → MongoDB 미러 ==="
npm run sync:pg-to-mongo

echo ""
echo "완료. Replit Deploy 후 관리자 메뉴에서 데이터를 확인하세요."
