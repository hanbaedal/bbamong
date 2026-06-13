#!/bin/bash

# Redis 데이터 디렉토리 생성
mkdir -p .redis-data

# Redis 서버 시작 (백그라운드)
echo "Starting Redis server..."
redis-server --daemonize yes \
  --dir .redis-data \
  --dbfilename dump.rdb \
  --port 6379 \
  --bind 0.0.0.0 \
  --protected-mode no \
  --save 60 1 \
  --loglevel notice

# Redis가 시작될 때까지 대기
echo "Waiting for Redis to be ready..."
timeout=10
counter=0
until redis-cli ping &>/dev/null || [ $counter -eq $timeout ]; do
  sleep 0.5
  counter=$((counter + 1))
done

if redis-cli ping &>/dev/null; then
  echo "Redis is ready!"
else
  echo "Warning: Redis may not have started properly"
fi

# Node.js 애플리케이션 시작
echo "Starting application..."
npm run dev
