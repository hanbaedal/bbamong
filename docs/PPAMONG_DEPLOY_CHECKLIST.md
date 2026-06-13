# ppamong.com 배포 체크리스트

코드 변경은 GitHub에 push되었습니다. 아래는 **직접 Replit / DNS / OAuth 콘솔에서** 진행해야 하는 항목입니다.

## 2. Replit ↔ GitHub 동기화

1. https://replit.com → PPADUN9 프로젝트 열기
2. **Shell** 또는 Git 패널에서:
   ```bash
   git pull origin main
   ```
3. `.replit`의 `BASE_URL = "https://ppamong.com"` 확인

## 3. Replit Secrets 확인

**Tools → Secrets** 에 다음 변수 존재 여부 확인:

- `DATABASE_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `APPLE_*` (Apple 로그인 사용 시)
- `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`

## 4. Replit Deploy + 커스텀 도메인

1. **Deploy** → **Autoscale** → Deploy 실행
2. **Custom domains** → `ppamong.com` 추가
3. Replit이 표시하는 DNS 레코드를 5번에서 등록

## 5. DNS (도메인 업체)

Replit 안내값 그대로 등록 (예시):

| 타입 | 호스트 | 값 |
|------|--------|-----|
| CNAME | @ | (Replit 제공 주소) |
| CNAME | www | (Replit 제공 주소) |

확인: `https://ppamong.com/login`

## 6. OAuth Redirect URI

| 제공자 | Redirect URI |
|--------|----------------|
| Kakao | `https://ppamong.com/api/auth/kakao/callback` |
| Google | `https://ppamong.com/api/auth/google/callback` |
| Apple | `https://ppamong.com/api/auth/callback/apple` |

웹 도메인: `https://ppamong.com`

## 7. 모바일 앱 재빌드

```powershell
cd c:\PPADUN9\web
npm run build
```

- Android: Android Studio → `C:\PPADUN9\android` → APK/AAB
- iOS: Xcode → `C:\PPADUN9\ios\App` → Archive

Capacitor URL: `https://ppamong.com`
