# ppamong.com — 가비아 DNS + Replit 연결 가이드

> **순서:** Replit Deploy → Replit에서 도메인 추가 → 가비아 DNS → Verified 확인

---

## 0단계: Replit Deploy (DNS 전에 필수)

가비아 DNS만 해도 **Replit Deploy가 안 되어 있으면** IP·TXT 값을 알 수 없습니다.

1. https://replit.com → bbamong(First-Visit) Repl
2. Shell: `git pull origin main`
3. **Deploy** → **Autoscale** → Deploy 실행
4. Deploy URL(`.replit.app`)이 열리는지 확인

---

## 1단계: Replit에 ppamong.com 등록

1. Repl → **Publishing** (또는 **Deploy**) → **Domains** 탭
2. **Link a domain** 클릭
3. `ppamong.com` 입력

### 방법 A — 자동 연결 (가능하면 이게 제일 쉬움)

Replit이 **「가비아에 로그인해서 자동 설정」** 을 제안하면:

1. 안내에 따라 **가비아 계정 로그인** 허용
2. Replit이 A·TXT 레코드를 대신 등록
3. Domains 탭에서 **Verified** 될 때까지 대기

→ 이 방법이 되면 **아래 2~4단계(수동) 생략**

### 방법 B — 수동 연결 (가비아에서 직접)

Replit 화면에 아래 **2개 값**이 표시됩니다. 메모하세요.

| 타입 | 호스트 | 값 (Replit에서 복사) |
|------|--------|----------------------|
| **A** | `@` | `xxx.xxx.xxx.xxx` (IP) |
| **TXT** | `@` | `replit-verify=...` |

`www.ppamong.com`도 쓰려면 Domains에서 **도메인을 하나 더 추가**하고, 그에 맞는 A·TXT도 등록합니다.

---

## 2단계: 가비아 DNS 관리 들어가기

1. https://www.gabia.com 로그인
2. 우측 상단 **My가비아** → **서비스 관리**
3. **DNS 관리툴**  
   - 또는 https://dns.gabia.com
4. **`ppamong.com`** 찾기 → **설정**
5. **DNS 설정** (또는 **레코드 수정**)

### 네임서버 확인

도메인 **네임서버**가 가비아인지 확인하세요.

- 예: `ns1.gabia.co.kr`, `ns.gabia.co.kr` 등
- 다른 업체 네임서버(Cloudflare 등)를 쓰면 **가비아 DNS 화면이 적용되지 않습니다.**

---

## 3단계: 레코드 등록 (수동 — 방법 B)

### 3-1. 기존 충돌 레코드 정리

`ppamong.com` (`@` 호스트)에 **다른 A 레코드**가 있으면:

- 가비아 기본 안내 페이지
- 예전 호스팅 IP

→ **삭제**하거나 Replit IP로 **수정** ( `@` A는 **Replit IP 하나**만)

### 3-2. A 레코드 추가

| 항목 | 입력 |
|------|------|
| 타입 | **A** |
| 호스트 | **@** |
| 값/위치 | Replit이 준 **IP 주소** |
| TTL | 3600 (기본) |

→ **확인** 클릭

### 3-3. TXT 레코드 추가 (SSL용, 삭제 금지)

| 항목 | 입력 |
|------|------|
| 타입 | **TXT** |
| 호스트 | **@** |
| 값 | `replit-verify=...` (**Replit 값 전체**) |
| TTL | 3600 |

→ **확인** 클릭

### 3-4. www (선택)

Replit Domains에 `www.ppamong.com`을 추가했다면:

| 타입 | 호스트 | 값 |
|------|--------|-----|
| A | **www** | Replit이 준 IP (www용 안내값) |
| TXT | **www** | www용 `replit-verify=...` |

---

## 4단계: 저장 (필수)

가비아는 **확인만으로는 반영 안 됩니다.**

1. 페이지 **맨 아래 「저장」** 클릭
2. 완료 메시지 확인

---

## 5단계: 연결 확인

1. Replit **Domains** 탭 → `ppamong.com` **Verified** (5분~48시간)
2. 브라우저:
   - https://ppamong.com/login
   - https://ppamong.com/admin/login

전파 확인: https://dnschecker.org → `ppamong.com` A 레코드

---

## 입력 체크리스트 (Replit 값 붙여넣기)

```
[ ] Replit Deploy 완료
[ ] Replit Domains에 ppamong.com 추가
[ ] A  @  → ___________________ (Replit IP)
[ ] TXT @  → replit-verify=___________________
[ ] (선택) www A / TXT
[ ] 가비아 「저장」 클릭
[ ] Replit Verified
[ ] https://ppamong.com 접속 OK
```

---

## 문제 해결

| 증상 | 조치 |
|------|------|
| 도메인을 찾을 수 없음 | 도메인 등록·연장 상태 확인, 네임서버 가비아인지 확인 |
| 예전 가비아 페이지만 보임 | `@` A가 Replit IP가 아님 → 수정 후 저장 |
| Replit만 되고 도메인 안 됨 | A·TXT 오타, 저장 안 함, 전파 대기 |
| SSL 오류 | TXT `replit-verify` 삭제/변경 여부 확인 |
| Verified 안 됨 | Replit Domains의 IP·TXT와 가비아 값 **완전 일치** 비교 |

가비아 고객센터: **1544-4370**

---

## 관련 문서

- [PPAMONG_DEPLOY_CHECKLIST.md](./PPAMONG_DEPLOY_CHECKLIST.md)
- [PPAMONG_프로젝트_구조.md](./PPAMONG_프로젝트_구조.md)
- [Replit Custom Domains](https://docs.replit.com/references/publishing/custom-domains)
