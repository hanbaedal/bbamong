# 쇼핑몰 상품 이미지 — Cloudflare R2 (Replit)

상품 이미지를 Replit이 아니라 **Cloudflare R2 + CDN**에서 바로 받아 로딩을 줄입니다.  
앱 서버는 계속 Replit Deploy(`ppamong.com`)입니다.

## 우선순위

업로드 시: **R2 → Replit GCS → 로컬(`data/uploads`)**

Secrets가 없으면 기존과 동일하게 GCS/로컬로 동작합니다. 배포가 깨지지 않습니다.

## Cloudflare (한 번만)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → Create bucket  
   - 예: `ppamong-mall`
2. 버킷 **Settings** → **Public access** 켜기  
   - 공개 URL 예: `https://pub-xxxx.r2.dev`  
   - (선택) 나중에 `img.ppamong.com` 커스텀 도메인 연결
3. R2 → **Manage R2 API Tokens** → Create  
   - Object Read & Write  
   - Access Key ID / Secret Access Key / Account ID 메모

## Replit Secrets

Repl → **Secrets**에 아래 **5개 모두** 추가한 뒤 **Deploy → Redeploy**.

| Secret | 예시 |
|--------|------|
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | API Access Key |
| `R2_SECRET_ACCESS_KEY` | API Secret |
| `R2_BUCKET` | `ppamong-mall` |
| `R2_PUBLIC_BASE_URL` | `https://pub-xxxx.r2.dev` (끝 `/` 없음) |

`BASE_URL`은 계속 `https://ppamong.com` — 바꾸지 마세요.

## 코드 반영

```bash
git pull origin main
```

그다음 **Redeploy**.

## 확인

1. 관리자 → 상품 이미지 업로드
2. 저장된 URL이 `R2_PUBLIC_BASE_URL`로 시작하는지
3. `/shop`에서 이미지가 Cloudflare URL로 로드되는지

## 범위

- **적용:** 쇼핑몰 상품 cover/detail **새 업로드**
- **유지:** 기존 `/objects/...`, `/uploads/...` URL
- **비대상:** 광고·영상 업로드, 기존 이미지 일괄 이전
