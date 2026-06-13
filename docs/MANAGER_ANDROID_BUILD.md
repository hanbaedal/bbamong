# 매니저 앱 Android 빌드 가이드

## 개요

매니저 앱과 유저 앱은 별도의 Android 프로젝트로 분리되어 있어 충돌 없이 각각 빌드할 수 있습니다.

## 앱 구분

| 구분 | 유저 앱 | 매니저 앱 |
|------|---------|-----------|
| App ID | `com.bbanden.nine` | `com.bbanden.nine.manager` |
| App Name | 빠던9 | 빠던9 매니저 |
| Vite Config | `vite.config.ts` | `vite.manager.config.ts` |
| Capacitor Config | `capacitor.config.ts` | `capacitor.manager.config.ts` |
| Build Output | `dist/public` | `dist-manager/public` |
| Android Folder | `android/` | `android-manager/` |
| Deep Link Scheme | `ppadun9://auth` | `ppadun9manager://auth` |

## 빌드 명령어

### 1. 매니저 앱 웹 빌드

```bash
npx vite build --config vite.manager.config.ts
```

### 2. 웹 에셋을 Android 프로젝트에 복사

```bash
rm -rf android-manager/app/src/main/assets/public
cp -r dist-manager/public android-manager/app/src/main/assets/public
cp android-manager/app/src/main/assets/public/manager.html android-manager/app/src/main/assets/public/index.html
```

### 3. Android Studio 열기

```bash
# Android Studio에서 android-manager 폴더 열기
```

## 전체 빌드 과정 (한 번에)

```bash
# 1. 웹 빌드
npx vite build --config vite.manager.config.ts

# 2. 에셋 복사
rm -rf android-manager/app/src/main/assets/public
cp -r dist-manager/public android-manager/app/src/main/assets/public
cp android-manager/app/src/main/assets/public/manager.html android-manager/app/src/main/assets/public/index.html

# 3. Android Studio에서 android-manager 폴더 열고 빌드
```

## 주의사항

1. **유저 앱과 충돌 방지**: 각각 다른 `appId`를 사용하므로 같은 기기에 두 앱 모두 설치 가능
2. **별도 Android 폴더**: `android/`는 유저 앱, `android-manager/`는 매니저 앱
3. **딥링크 스킴 분리**: 유저 앱은 `ppadun9://`, 매니저 앱은 `ppadun9manager://`

## WebView 호환성 (핵심)

### API URL 설정
- `managerQueryClient.ts`에서 `Capacitor.isNativePlatform()` 체크
- 네이티브 앱: `https://ppadun9.com` (프로덕션 서버)
- 웹 브라우저: 상대 경로 (현재 호스트)

### WebSocket URL 설정
- `matchDetail.tsx`에서 Capacitor 플랫폼 감지
- 네이티브 앱: `wss://ppadun9.com/ws/match`
- 웹 브라우저: `wss://{window.location.host}/ws/match`

### 에셋 경로
- `vite.manager.config.ts`에서 `base: './'` 설정
- 빌드된 HTML에서 `./assets/...` 상대 경로 사용
- Capacitor WebView의 `file://` 프로토콜과 호환

### 네트워크 보안
- `network_security_config.xml`로 HTTPS 연결 설정
- `AndroidManifest.xml`에서 참조

## 파일 구조

```
android-manager/
├── app/
│   ├── build.gradle                 # appId: com.bbanden.nine.manager
│   └── src/main/
│       ├── AndroidManifest.xml      # 딥링크: ppadun9manager://auth
│       ├── assets/public/           # 빌드된 웹 에셋
│       ├── java/com/bbanden/nine/manager/
│       │   ├── MainActivity.java
│       │   └── LogoutPlugin.java
│       └── res/values/strings.xml   # app_name: 빠던9 매니저
├── capacitor-plugins/               # Capacitor 플러그인 (임베디드)
│   ├── capacitor-android/
│   ├── capacitor-app/
│   ├── capacitor-browser/
│   ├── capacitor-preferences/
│   ├── capacitor-share/
│   ├── capacitor-community-admob/
│   └── capacitor-community-http/
└── capacitor.settings.gradle        # 로컬 플러그인 경로 설정
```

## 독립 빌드 지원

`android-manager` 폴더는 **독립적으로 빌드 가능**합니다:
- Capacitor 플러그인이 `capacitor-plugins/` 폴더에 포함됨
- `node_modules` 참조 없이 Android Studio에서 바로 빌드 가능
- 폴더만 다운로드하여 즉시 APK 생성 가능
