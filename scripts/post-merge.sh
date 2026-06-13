#!/bin/bash
set -e
npm install
echo "no" | timeout 60 npx drizzle-kit push --force 2>&1 || true
