# 빠몽이 DB 구조 설명서

기준일: 2026-08-27

## 클러스터 · 데이터베이스

| 항목 | 값 |
| --- | --- |
| 제품 | PPAMONG (빠몽이) |
| Atlas 클러스터 | ppamong clusters (MongoDB Atlas) |
| 데이터베이스 이름 | `ppamong` |
| 연결 URI | 환경변수 `MONGODB_URI` |
| DB 이름 옵션 | 환경변수 `MONGODB_DB_NAME` (mongoose `dbName`, URI 경로보다 우선) |

연결은 mongoose.connect(uri, { dbName }). URI 경로에 DB가 있어도 dbName 옵션이 우선합니다. PostgreSQL/Drizzle는 레거시 마이그레이션용이며 런타임에 쓰지 않습니다.

세션·인증코드·광고 보상 중복방지·휴대폰 인증은 Redis 키입니다. Mongo 컬렉션이 아닙니다.

컬렉션 이름은 Mongoose 기본 복수형입니다. **Stadium만 `stadia`** 입니다. `stadiums`로 조회하면 비어 있습니다.

## 컬렉션 목록

| 영역 | Model | collection | 역할 |
| --- | --- | --- | --- |
| 인프라 | Counter | `counters` | 숫자 id 채번 (게시글·주문·예측 등) |
| 회원 | User | `users` | 앱 회원·게스트 계정과 보유 포인트 |
| 회원 | AttendanceRecord | `attendancerecords` | 일일 출석 기록 |
| 회원 | PointTransaction | `pointtransactions` | 포인트 증감 원장 |
| 경기 | Stadium | `stadia` | 구장 마스터. Mongoose 복수형이 stadiums가 아니라 stadia |
| 경기 | Match | `matches` | 오늘 KBO 경기·실황 스냅샷·운영자 타석 커서. 예측 게임의 중심 문서 |
| 경기 | ApiSportsScheduleCache | `apisportsschedulecaches` | 일정 캐시 문서. 이름은 레거시이며 값은 다음 스포츠 일정으로 채움 |
| 경기 | KboPlayer | `kboplayers` | KBO 선수 마스터(타율 등). 선발명단·대타 검색 |
| 예측 | Prediction | `predictions` | 타석(라운드) 한 건의 회원 예측 |
| 예측 | RoundStatistics | `roundstatistics` | 타석 라운드 상태. atBatPhase 도출의 근거 |
| 예측 | MatchSideBet | `matchsidebets` | 경기 단위 사이드벳(우승팀·최종 스코어). 1회 시작 전 마감 |
| 운영 | AdminUser | `adminusers` | 슈퍼어드민·일반어드민·운영자 계정 |
| 콘텐츠 | Notice | `notices` | 공지. 예측 화면 HUD가 아니라 설정·홈에서 봄 |
| 콘텐츠 | NoticeRead | `noticereads` | 공지 읽음·게임 배너 닫기(레거시 배너) |
| 콘텐츠 | Inquiry | `inquiries` | 회원 1:1 문의 |
| 콘텐츠 | Post | `posts` | 커뮤니티 게시글 |
| 콘텐츠 | Comment | `comments` | 게시글 댓글 |
| 콘텐츠 | Term | `terms` | 이용약관·개인정보 처리방침 |
| 콘텐츠 | Faq | `faqs` | 자주 묻는 질문 |
| 콘텐츠 | Ebook | `ebooks` | 전자책 상품 |
| 콘텐츠 | EbookPurchase | `ebookpurchases` | 전자책 구매 기록 |
| 홈·광고 | HomePageSettings | `homepagesettings` | 사용자 홈 문구·버튼·게임 안내 |
| 홈·광고 | WaitingScreen | `waitingscreens` | 대기 화면 영상 관리. 예측 7단계 시네마틱과는 별개 |
| 홈·광고 | Advertisement | `advertisements` | 리워드 영상 메타. 예측 중 하단 배너는 사용하지 않음 |
| 홈·광고 | AdViewHistory | `adviewhistories` | 광고 시청 기록 |
| 홈·광고 | AppAdmobConfig | `appadmobconfigs` | 네이티브 AdMob 앱/유닛 ID. 예측 화면 배너 유닛은 넣어도 게임 HUD에 쓰지 않음 |
| 쇼핑몰 | GoodsCategory | `goodscategories` | 몰 카테고리 |
| 쇼핑몰 | GoodsProduct | `goodsproducts` | 몰 상품. 게임 포인트로 직접 결제하지 않음 |
| 쇼핑몰 | MallOrder | `mallorders` | 현금 주문 접수. 상태 pending→preparing→confirmed→shipped |
| 쇼핑몰 | MallWishlist | `mallwishlists` | 상품 찜 |
| 쇼핑몰 | ShopInquiry | `shopinquiries` | 상품 문의 |
| 쇼핑몰 | MallProductReview | `mallproductreviews` | 상품 리뷰 |
| 쇼핑몰 | MallWarehouse | `mallwarehouses` | 창고 마스터 |
| 쇼핑몰 | MallLocation | `malllocations` | 창고 로케이션 |
| 쇼핑몰 | MallStockMovement | `mallstockmovements` | 재고 이동(입고·출고·이동) |
| 쇼핑몰 | MallSupplier | `mallsuppliers` | 매입처 |
| 쇼핑몰 | MallPurchaseOrder | `mallpurchaseorders` | 발주 |
| 소셜 | FriendRoom | `friendrooms` | 친구·동호회 방. 방 전용 경기가 아니라 오늘 공개 예측에 함께 참여 |
| 소셜 | FriendRoomMember | `friendroommembers` | 방 멤버 |
| 소셜 | FriendRoomAudit | `friendroomaudits` | 방 종료 후 면책·부정이용 대응 로그. expiresAt TTL 삭제 |

## 필드별 역할

### Counter (`counters`)

숫자 id 채번 (게시글·주문·예측 등)

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| name | string | 시퀀스 키 | unique |
| value | number | 마지막 발급 값 |  |

### User (`users`)

앱 회원·게스트 계정과 보유 포인트

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 앱 사용자 UUID | unique, 필수 |
| username | string | 로그인 아이디 | unique |
| name | string | 표시 이름 |  |
| password | string\|null | 해시 비밀번호. 소셜은 null |  |
| passwordPlain | string | 운영 복구용 평문(레거시). 신규는 비움 권장 |  |
| phone | string | 휴대폰 | sparse unique |
| email | string\|null | 이메일 |  |
| provider | string | 가입 경로 | local\|kakao\|google\|apple\|guest |
| providerId | string | 소셜/게스트 고유 ID. 게스트는 UUID |  |
| inviteCode | string | 내 초대코드 6자리 | sparse unique |
| referralCode | string\|null | 가입 시 입력한 추천인 코드 |  |
| verificationCode | string\|null | SMS 인증 코드(폴백 표시용) |  |
| verificationCodeExpiry | Date\|null | 인증 코드 만료 |  |
| points | number | 보유 포인트. 타석·사이드벳·광고 보상 반영 |  |
| lastAttendanceDate | Date\|null | 마지막 출석일 |  |
| isSuspended | number | 1이면 정지(소프트 삭제) |  |
| suspendedAt | Date\|null | 정지 시각 |  |
| isOnline | number | 최근 온라인 표시. 1=온라인 |  |
| lastLogin | Date\|null | 마지막 로그인 |  |
| lastLogout | Date\|null | 마지막 로그아웃 |  |
| lastActive | Date\|null | keepAlive·활동 ping |  |
| totalDonationAmount | number | 기부 누적 포인트 |  |
| dataSource | string | ppamong \| badminton9 등 출처 |  |
| createdAt | Date | 가입 시각 |  |

인덱스: unique(provider, providerId) sparse

### AttendanceRecord (`attendancerecords`)

일일 출석 기록

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 출석 레코드 번호 |  |
| userId | string | users.id |  |
| attendanceDate | Date | 출석 날짜 |  |

### PointTransaction (`pointtransactions`)

포인트 증감 원장

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 거래 번호 |  |
| userId | string | users.id |  |
| transactionType | string | earned\|spent\|donation\|donated_spent 등 |  |
| amount | number | 양수=적립, 음수=사용 |  |
| balance | number | 거래 후 잔액 |  |
| description | string | 타석 적중, 사이드벳, 광고 등 설명 |  |
| createdAt | Date | 시각 |  |

### Stadium (`stadia`)

구장 마스터. Mongoose 복수형이 stadiums가 아니라 stadia

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 구장 번호. Match.stadiumId가 참조 |  |
| name | string | 고척, 잠실 등 표시명 | unique |
| createdAt | Date | 등록 시각 |  |

> 컬렉션 이름이 stadia 입니다. stadiums로 조회하면 비어 있습니다.

### Match (`matches`)

오늘 KBO 경기·실황 스냅샷·운영자 타석 커서. 예측 게임의 중심 문서

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 경기 UUID. WS·예측·사이드벳 키 |  |
| name | string | 제N경기 등 표시명 |  |
| stadiumId | number | stadia.id |  |
| matchDate | string\|null | KST YYYY-MM-DD |  |
| startTime | Date | 예정 시작. 예측 버튼은 이 시각 5분 전부터 |  |
| endTime | Date | 예정 종료 |  |
| matchStatus | string | scheduled\|ongoing\|completed\|cancelled. ongoing은 다음 스포츠 실황만 |  |
| currentRound | number | 타석 라운드 번호 |  |
| predictionEnabled | boolean | 운영자 「예측 시작」이 켠 타석 창. matchStatus를 올리지 않음 |  |
| liveAutoEnabled | boolean | 실황 타석 힌트 ON. UI 토글 없음. 기본 true |  |
| registrationOrder | number\|null | 제1~5 슬롯 순서 |  |
| apiSportsGameId | number\|null | 레거시. 실황에 쓰지 않음 |  |
| daumGameId | number\|null | 다음 스포츠 경기 ID. 점수·일정 연동 |  |
| apiSportsHomeTeam | string\|null | 홈 팀명 (필드명 레거시) |  |
| apiSportsAwayTeam | string\|null | 원정 팀명 (필드명 레거시) |  |
| apiSportsHomeTeamId | number\|null | 홈 팀 ID (레거시 이름) |  |
| apiSportsAwayTeamId | number\|null | 원정 팀 ID (레거시 이름) |  |
| apiSportsHomeTeamLogo | string\|null | 홈 로고 URL (다음 스포츠) |  |
| apiSportsAwayTeamLogo | string\|null | 원정 로고 URL (다음 스포츠) |  |
| liveScoreboard | Mixed | 실황 보드. 득점·이닝표=다음, 주자·B-S·OUT·타자=네이버. 구조는 LiveScoreboard |  |
| lastInningKey | string\|null | 이닝 키 캐시 |  |
| controlMode | string | auto=다음 점수 덮어씀, manual=운영자/관리자 PATCH 점수 유지 |  |
| sideBetsLocked | boolean | 1회 시작 시 사이드벳 마감 |  |
| gameInning | number | 운영자 기준 이닝(1=1회). 표시는 실황 우선 |  |
| inningHalf | string | top=초(원정), bottom=말(홈) |  |
| batterIndexInHalf | number | 현재 공격 팀 타순 1~9 |  |
| awayBatterOrder | number | 원정(초) 타순 커서 1~9 |  |
| homeBatterOrder | number | 홈(말) 타순 커서 1~9 |  |
| outsInHalf | number | 운영자 누적 아웃. 3아웃 카운트·예측 종료 권위. 공수교대는 네이버 3아웃 대기(강제 가능) |  |
| pinchHitter | Mixed\|null | 현재 타석 대타. 다음타자·공수 시 해제, 투수교체 유지 |  |
| matchLineup | Mixed\|null | 선발 타순 스냅샷 (네이버) |  |
| matchPlayerStats | Mixed\|null | 타자 시즌 스탯 캐시 |  |
| matchHeadToHead | Mixed\|null | 상대전적 awayWins/homeWins |  |
| matchTeamSeasonStats | Mixed\|null | 팀 시즌 성적(순위·승무패) |  |
| createdAt | Date | 등록 시각 |  |

> 실황 ON은 Match 필드가 아니라 AdminUser.apiSyncEnabled(운영자 슬롯)입니다. 회원 선택 모달의 sideBetEnabled는 API가 붙입니다.
> atBatPhase는 Match에 저장하지 않고 RoundStatistics + predictionEnabled로 도출합니다.

### ApiSportsScheduleCache (`apisportsschedulecaches`)

일정 캐시 문서. 이름은 레거시이며 값은 다음 스포츠 일정으로 채움

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| matchDate | string | 날짜 키 YYYY-MM-DD |  |
| apiSportsGameId | number | 외부 경기 ID (레거시 필드명, 값은 다음 스포츠) |  |
| season | number\|null | 시즌 연도 |  |
| leagueId | number | 리그 ID. 기본 5(KBO 레거시) |  |
| date | string | 일정 날짜 원문 |  |
| time | string | 시작 시각 문자열 |  |
| timestamp | number | 유닉스 시각 |  |
| statusShort | string | NS, LIVE, FT, BEFORE 등 |  |
| statusLong | string | 상태 설명 |  |
| homeTeamId | number\|null | 홈 팀 ID |  |
| homeTeamName | string | 홈 팀명 |  |
| awayTeamId | number\|null | 원정 팀 ID |  |
| awayTeamName | string | 원정 팀명 |  |
| venueName | string | 구장명 |  |
| venueCity | string | 도시 |  |
| homeScore | number | 홈 점수 캐시 |  |
| awayScore | number | 원정 점수 캐시 |  |
| fetchedAt | Date | 수집 시각 |  |

인덱스: unique(matchDate, apiSportsGameId)

### KboPlayer (`kboplayers`)

KBO 선수 마스터(타율 등). 선발명단·대타 검색

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 선수 문서 ID |  |
| team | string | 소속 팀명 |  |
| season | number | 시즌 연도 |  |
| name | string | 선수명 |  |
| position | string | 포지션 |  |
| jerseyNumber | string | 등번호 |  |
| batsThrows | string | 타석/투구 손 |  |
| battingAverage | string\|null | 타율 표시 |  |
| hits | number\|null | 안타 |  |
| homeRuns | number\|null | 홈런 |  |
| rbi | number\|null | 타점 |  |
| ops | string\|null | OPS |  |
| note | string | 메모 |  |
| active | boolean | 현역 여부 |  |
| apiSportsPlayerId | number\|null | 레거시 외부 ID |  |
| createdAt | Date | 등록 |  |
| updatedAt | Date | 갱신 |  |

인덱스: unique(team, season, name) · partial unique(season, apiSportsPlayerId)

### Prediction (`predictions`)

타석(라운드) 한 건의 회원 예측

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 예측 번호 |  |
| userId | string | users.id |  |
| matchId | string | matches.id |  |
| roundNumber | number | 타석 라운드. Match.currentRound와 대응 |  |
| prediction | string | 아웃\|1루\|2루\|3루\|홈런 |  |
| amount | number | 건 포인트 50~1000 |  |
| status | string | pending\|success\|fail |  |
| result | string\|null | 확정 결과. 투수교체 환불 시 생략 가능 |  |
| wonAmount | number | 적중 시 지급액 = amount × 배당 |  |
| donatedAmount | number | 기부 처리분 |  |
| createdAt | Date | 제출 시각 |  |

인덱스: unique(userId, matchId, roundNumber) — 한 타석 한 번

### RoundStatistics (`roundstatistics`)

타석 라운드 상태. atBatPhase 도출의 근거

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 라운드 통계 ID |  |
| matchId | string | matches.id |  |
| roundNumber | number | 라운드 번호 |  |
| totalParticipants | number | 참여자 수 |  |
| totalPoints | number | 해당 라운드 총 포인트 |  |
| totalWinners | number | 적중자 수 |  |
| predictionStartTime | Date\|null | 창 열림 |  |
| predictionStopTime | Date\|null | 창 닫힘 |  |
| isPredictionStarted | boolean | 예측 시작 여부 |  |
| isPredictionStopped | boolean | 예측 중지 여부 |  |
| isResultSent | boolean | 결과 확정 여부 |  |
| settledResult | string\|null | 확정 결과. UI stage=result 복원 |  |
| createdAt | Date | 생성 |  |

> idle / prediction_open / prediction_closed / result_confirmed 는 이 플래그 + Match.predictionEnabled로 계산합니다.

### MatchSideBet (`matchsidebets`)

경기 단위 사이드벳(우승팀·최종 스코어). 1회 시작 전 마감

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 사이드벳 번호 |  |
| userId / matchId | string | 회원·경기 |  |
| type | string | winner \| score |  |
| winnerPick | home\|away\|null | 우승팀 선택 |  |
| homeScorePick / awayScorePick | number\|null | 최종 스코어 선택 |  |
| amount | number | 건 포인트 |  |
| odds | number | 우승팀 2배, 스코어 20배 |  |
| status | string | pending\|success\|fail |  |
| wonAmount | number | 정산 지급 |  |
| createdAt | Date | 접수 시각 |  |

인덱스: unique(userId, matchId, type)

### AdminUser (`adminusers`)

슈퍼어드민·일반어드민·운영자 계정

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 스태프 UUID |  |
| email | string | 로그인 이메일 | unique |
| username | string | 로그인 아이디 | unique |
| name | string | 표시 이름 |  |
| phone | string | 연락처 |  |
| department | string\|null | 부서 |  |
| position | string\|null | 직책 |  |
| password | string | 해시 비밀번호 |  |
| passwordPlain | string | 운영 복구용 평문(주의) |  |
| userType | string | 슈퍼어드민\|일반어드민\|운영자 |  |
| approvalStatus | string | 대기중\|승인 |  |
| status | string | 활성화\|비활성 |  |
| assignedMatchNumber | string\|null | 배정 제N경기 |  |
| operatorSlot | number\|null | 운영자 슬롯 번호 |  |
| dailyPasswordPlain | string | 당일 운영자 비밀번호 평문 |  |
| dailyPasswordDate | string | 당일 비밀번호 날짜 |  |
| loginLinkToken | string | 카톡 자동 로그인 토큰 |  |
| loginLinkExpiresAt | Date\|null | 로그인 링크 만료 |  |
| apiSyncEnabled | boolean | 실황 ON. 다음+네이버 폴링 + 회원 게임 연동. 기본 1경기만 true |  |
| apiSyncDefaultPolicy | number | 실황 기본값 마이그레이션 버전 |  |
| logoutAllowed | boolean | 강제 로그아웃 허용 |  |
| lastLogin | Date\|null | 마지막 로그인 |  |
| lastLogout | Date\|null | 마지막 로그아웃 |  |
| lastLoginIp | string | 로그인 IP |  |
| lastLoginRegion | string | 로그인 지역 |  |
| notes | string | 관리 메모 |  |
| createdAt | Date | 계정 생성 |  |

### Notice (`notices`)

공지. 예측 화면 HUD가 아니라 설정·홈에서 봄

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 공지 번호 |  |
| tag | string | 분류 태그 |  |
| title | string | 제목 |  |
| content | string | 본문 |  |
| displayOrder | number | 정렬 |  |
| dataSource | string | 출처 |  |
| createdAt | Date | 작성 |  |
| updatedAt | Date | 수정 |  |

### NoticeRead (`noticereads`)

공지 읽음·게임 배너 닫기(레거시 배너)

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| userId | string | users.id |  |
| noticeId | number | notices.id |  |
| readAt | Date\|null | 읽은 시각 |  |
| gameBannerDismissedAt | Date\|null | 게임 배너 닫기. 현재 게임 배너는 없음 |  |
| dismissedAt | Date\|null | 구필드. gameBannerDismissedAt 사용 |  |

인덱스: unique(userId, noticeId)

### Inquiry (`inquiries`)

회원 1:1 문의

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 문의 번호 |  |
| userId | string | users.id |  |
| category | string | 분류 |  |
| title | string | 제목 |  |
| content | string | 본문 |  |
| status | string | pending\|in_progress\|resolved |  |
| response | string\|null | 관리자 답변 |  |
| isOfficial | boolean | 공식 문의 여부 |  |
| dataSource | string | 출처 |  |
| createdAt | Date | 접수 |  |

### Post (`posts`)

커뮤니티 게시글

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 글 번호 |  |
| title | string | 제목 |  |
| content | string | 본문 |  |
| authorId | string | users.id |  |
| dataSource | string | 출처 |  |
| isOfficial | boolean | 공식 글 |  |
| viewCount | number | 조회수 |  |
| createdAt | Date | 작성 |  |

### Comment (`comments`)

게시글 댓글

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 댓글 번호 |  |
| postId | number | posts.id |  |
| content | string | 본문 |  |
| authorId | string | users.id |  |
| createdAt | Date | 작성 |  |

### Term (`terms`)

이용약관·개인정보 처리방침

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 약관 번호 |  |
| title | string | 제목 |  |
| content | string | 본문 HTML/텍스트 |  |
| type | string | service\|privacy |  |
| createdAt | Date | 작성 |  |
| updatedAt | Date | 수정 |  |

### Faq (`faqs`)

자주 묻는 질문

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | FAQ 번호 |  |
| question | string | 질문 |  |
| answer | string | 답변 |  |
| order | number | 정렬 |  |
| createdAt | Date | 작성 |  |

### Ebook (`ebooks`)

전자책 상품

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 전자책 번호 |  |
| name | string | 제목 |  |
| price | number | 가격 |  |
| createdAt | Date | 등록 |  |

### EbookPurchase (`ebookpurchases`)

전자책 구매 기록

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 구매 번호 |  |
| userId | string | users.id |  |
| ebookId | number | ebooks.id |  |
| purchasedAt | Date | 구매 시각 |  |

### HomePageSettings (`homepagesettings`)

사용자 홈 문구·버튼·게임 안내

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 문서 키. 보통 default |  |
| greetingPrefix | string | 인사 앞말. 기본 안녕하세요 |  |
| subGreeting | string | 보조 인사 |  |
| buttonText | string | CTA. 기본 실시간 예측게임 |  |
| buttonEnabled | boolean | CTA 노출 |  |
| showDate | boolean | 홈 날짜 표시 |  |
| gameGuideTitle | string | 야구 예측 게임이란? 제목 |  |
| gameGuideSummary | string | 안내 요약 |  |
| gameGuideContent | string | 안내 본문 |  |
| gameGuideEnabled | boolean | 안내 섹션 노출 |  |
| gameGuideImageUrl | string | 안내 이미지 |  |
| goodsSectionTitle | string | 쇼핑센터 제목 |  |
| goodsSectionEnabled | boolean | 홈 쇼핑 섹션 노출 |  |
| introVideoUrl | string | 회사 소개 영상 URL |  |
| shopInquiryEmail | string | 몰 문의 이메일 |  |
| shopInquiryPhone | string | 몰 문의 전화 |  |
| updatedAt | Date | 수정 |  |

### WaitingScreen (`waitingscreens`)

대기 화면 영상 관리. 예측 7단계 시네마틱과는 별개

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 영상 번호 |  |
| videoName | string | 표시 이름 |  |
| displayDuration | number | 재생 초. 기본 4 |  |
| videoUrl | string | 영상 URL |  |
| dataSource | string | 출처 |  |
| createdAt | Date | 등록 |  |

### Advertisement (`advertisements`)

리워드 영상 메타. 예측 중 하단 배너는 사용하지 않음

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 광고 번호 |  |
| videoName | string | 표시 이름 |  |
| earnedPoints | number | 표시용 포인트. 실제 지급은 운영자 중지/80초 워치독 500P |  |
| videoUrl | string | 영상 URL |  |
| dataSource | string | 출처 |  |
| createdAt | Date | 등록 |  |

### AdViewHistory (`adviewhistories`)

광고 시청 기록

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 기록 번호 |  |
| userId | string | users.id |  |
| advertisementId | number | advertisements.id |  |
| viewedAt | Date | 시청 시각 |  |

### AppAdmobConfig (`appadmobconfigs`)

네이티브 AdMob 앱/유닛 ID. 예측 화면 배너 유닛은 넣어도 게임 HUD에 쓰지 않음

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 문서 키. 보통 default |  |
| androidAppId | string | Android 앱 ID |  |
| iosAppId | string | iOS 앱 ID |  |
| androidInterstitialAdUnitId | string | Android 전면 |  |
| iosInterstitialAdUnitId | string | iOS 전면 |  |
| androidRewardedAdUnitId | string | Android 리워드(공수·투수) |  |
| iosRewardedAdUnitId | string | iOS 리워드 |  |
| androidBannerAdUnitId | string | Android 배너(게임 미사용) |  |
| iosBannerAdUnitId | string | iOS 배너(게임 미사용) |  |
| updatedAt | Date | 수정 |  |

### GoodsCategory (`goodscategories`)

몰 카테고리

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 분류 번호 |  |
| parentId | number\|null | 상위 분류. null이면 루트 |  |
| name | string | 분류명 |  |
| description | string | 설명 |  |
| imageUrl | string | 이미지 |  |
| displayOrder | number | 정렬 |  |
| isActive | boolean | 노출 |  |
| createdAt | Date | 등록 |  |
| updatedAt | Date | 수정 |  |

인덱스: (parentId, displayOrder)

### GoodsProduct (`goodsproducts`)

몰 상품. 게임 포인트로 직접 결제하지 않음

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 상품 번호 |  |
| categoryId | number | goodscategories.id |  |
| name | string | 상품명 |  |
| summary | string | 짧은 설명 |  |
| detailContent | string | 상세 HTML |  |
| imageUrl | string | 대표 이미지 |  |
| thumbnailUrl | string | 썸네일 |  |
| priceLabel | string | 표시 가격 문구 |  |
| priceAmount | number | 판매가(원) |  |
| originalPriceAmount | number | 정가(원) |  |
| brand | string | 브랜드 |  |
| color | string | 기본 색상(단일 옵션) |  |
| size | string | 기본 사이즈 |  |
| stockQuantity | number | 재고. -1은 무제한 표시 |  |
| variants[] | subdoc[] | color, size, stock 옵션 재고 |  |
| fulfillmentType | string | stock=재고판매, procure=발주 |  |
| procureNotice | string | 발주 안내문 |  |
| reorderPoint | number | 발주점 |  |
| optimalStock | number | 적정 재고 |  |
| discountPercent | number | 할인율 |  |
| shippingLabel | string | 배송 문구. 기본 무료배송 |  |
| detailImages[] | string[] | 상세 이미지 URL |  |
| purchaseUrl | string | 외부 구매 링크(있으면) |  |
| displayOrder | number | 정렬 |  |
| isActive | boolean | 판매 중 |  |
| createdAt | Date | 등록 |  |
| updatedAt | Date | 수정 |  |

인덱스: (categoryId, displayOrder)

### MallOrder (`mallorders`)

현금 주문 접수. 상태 pending→preparing→confirmed→shipped

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 주문 번호 |  |
| userId | string | users.id |  |
| customerName | string | 수령인 |  |
| customerPhone | string | 연락처 |  |
| shippingAddress | string | 배송지 |  |
| memo | string | 요청사항 |  |
| items[] | subdoc[] | productId, productName, priceAmount, quantity, imageUrl, color, size |  |
| totalAmount | number | 합계(원) |  |
| status | string | pending\|preparing\|confirmed\|shipped\|cancelled |  |
| courierCompany | string | 택배사 |  |
| trackingNumber | string | 운송장 |  |
| shippedAt | Date | 발송 시각 |  |
| stockRestored | boolean | 취소 시 재고 복구 여부 |  |
| rewardPointsGranted | boolean | 사후 포인트 적립 여부 |  |
| rewardPointsAmount | number | 적립 포인트 |  |
| createdAt | Date | 주문 |  |
| updatedAt | Date | 수정 |  |

인덱스: (userId, createdAt) · (status, createdAt)

### MallWishlist (`mallwishlists`)

상품 찜

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| userId | string | users.id |  |
| productId | number | goodsproducts.id |  |
| createdAt | Date | 담은 시각 |  |

인덱스: unique(userId, productId)

### ShopInquiry (`shopinquiries`)

상품 문의

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 문의 번호 |  |
| productId | number | goodsproducts.id |  |
| productName | string | 상품명 스냅샷 |  |
| customerName | string | 문의자 |  |
| phone | string | 전화 |  |
| email | string | 이메일 |  |
| message | string | 문의 내용 |  |
| response | string | 답변 |  |
| respondedAt | Date | 답변 시각 |  |
| status | string | pending\|done |  |
| createdAt | Date | 접수 |  |
| updatedAt | Date | 수정 |  |

### MallProductReview (`mallproductreviews`)

상품 리뷰

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 리뷰 번호 |  |
| productId | number | goodsproducts.id |  |
| authorName | string | 작성자 표시명 |  |
| rating | number | 1~5점 |  |
| content | string | 본문 |  |
| isVisible | boolean | 노출 |  |
| createdAt | Date | 작성 |  |

### MallWarehouse (`mallwarehouses`)

창고 마스터

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 창고 번호 |  |
| name | string | 창고명 |  |
| isDefault | boolean | 기본 창고 |  |
| createdAt | Date | 등록 |  |

### MallLocation (`malllocations`)

창고 로케이션

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 로케이션 번호 |  |
| warehouseId | number | mallwarehouses.id |  |
| code | string | 위치 코드 |  |
| description | string | 설명 |  |
| createdAt | Date | 등록 |  |

인덱스: unique(warehouseId, code)

### MallStockMovement (`mallstockmovements`)

재고 이동(입고·출고·이동)

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 이동 번호 |  |
| warehouseId | number | mallwarehouses.id |  |
| locationId | number | malllocations.id |  |
| productId | number | goodsproducts.id |  |
| productName | string | 상품명 스냅샷 |  |
| color | string | 색상 |  |
| size | string | 사이즈 |  |
| quantity | number | 수량. 출고는 음수일 수 있음 |  |
| movementType | string | 입고·출고·이동 구분 |  |
| referenceId | number | 주문·발주 참조 |  |
| memo | string | 메모 |  |
| createdAt | Date | 처리 시각 |  |

### MallSupplier (`mallsuppliers`)

매입처

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 매입처 번호 |  |
| name | string | 상호 |  |
| contactName | string | 담당자 |  |
| phone | string | 전화 |  |
| email | string | 이메일 |  |
| memo | string | 메모 |  |
| createdAt | Date | 등록 |  |

### MallPurchaseOrder (`mallpurchaseorders`)

발주

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | number | 발주 번호 |  |
| supplierId | number | mallsuppliers.id |  |
| supplierName | string | 매입처 스냅샷 |  |
| status | string | draft\|ordered\|partial\|received\|cancelled |  |
| lines[] | subdoc[] | productId, productName, color, size, quantity, receivedQuantity, unitCost |  |
| memo | string | 메모 |  |
| orderedAt | Date | 발주일 |  |
| createdAt | Date | 작성 |  |
| updatedAt | Date | 수정 |  |

### FriendRoom (`friendrooms`)

친구·동호회 방. 방 전용 경기가 아니라 오늘 공개 예측에 함께 참여

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 방 UUID |  |
| name | string | 방 이름 |  |
| description | string | 소개 |  |
| supportTeam | string | 응원팀. 기본 무관 |  |
| ageGroup | string | 연령대. 기본 무관 |  |
| region | string | 지역. 기본 무관 |  |
| capacity | number | 정원 |  |
| hostUserId | string | 방장 users.id |  |
| inviteToken | string | 초대 토큰 | unique |
| disclaimerAgreedAt | Date | 면책 동의 시각 |  |
| createdAt | Date | 개설 |  |

### FriendRoomMember (`friendroommembers`)

방 멤버

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 멤버십 UUID |  |
| roomId | string | friendrooms.id |  |
| userId | string | users.id |  |
| role | string | host\|member |  |
| joinedAt | Date | 입장 |  |

인덱스: unique(roomId, userId)

### FriendRoomAudit (`friendroomaudits`)

방 종료 후 면책·부정이용 대응 로그. expiresAt TTL 삭제

| field | type | 역할·내용 | 값/제약 |
| --- | --- | --- | --- |
| id | string | 로그 UUID |  |
| hostUserId | string | 방장 |  |
| roomNameSnapshot | string | 종료 시점 방 이름 |  |
| disclaimerAgreedAt | Date | 면책 동의 |  |
| createdAt | Date | 개설 시각 스냅샷 |  |
| closedAt | Date | 종료 시각 |  |
| memberCountAtClose | number | 종료 시 인원 |  |
| expiresAt | Date | TTL. 이 시각 이후 자동 삭제 |  |

인덱스: TTL(expiresAt)

## Match.liveScoreboard (Mixed)

점수·이닝·로고는 다음 스포츠, 주자·B-S·OUT·타자·구종은 네이버입니다. 같은 필드를 두 소스에서 섞지 않습니다.

| field | type | 역할 |
| --- | --- | --- |
| homeTeamName | string | 홈 팀명 |
| awayTeamName | string | 원정 팀명 |
| homeTeamLogo | string\|null | 홈 로고 URL(다음 teams.imageUrl) |
| awayTeamLogo | string\|null | 원정 로고 URL |
| homeScore | number | 홈 점수(다음) |
| awayScore | number | 원정 점수(다음) |
| homeHits | number | 홈 안타(다음) |
| awayHits | number | 원정 안타(다음) |
| homeErrors | number | 홈 실책(다음) |
| awayErrors | number | 원정 실책(다음) |
| homeWalks | number | 홈 볼넷(다음 ballfour). 네이버에서 가져오지 않음 |
| awayWalks | number | 원정 볼넷(다음) |
| homeInnings | object | 홈 이닝별 득점 맵 {"1":0,...} |
| awayInnings | object | 원정 이닝별 득점 맵 |
| inning | number\|null | 이닝. 표시 우선권은 다음 스포츠 |
| inningHalf | string\|null | top=초, bottom=말 |
| inningLabel | string | N회 초/말 표시 문자열 |
| statusShort | string | NS, LIVE, FT, BEFORE 등 |
| statusLong | string | 상태 설명 |
| syncedAt | string | 스냅샷 시각 ISO |
| situation.balls | number | 볼. 네이버. 타석 없으면 가짜 0으로 채우지 않음 |
| situation.strikes | number | 스트라이크. 네이버 |
| situation.outs | number | 실황 아웃. 공수교대 타이밍 가드. 카운트 권위는 Match.outsInHalf |
| situation.onFirst | boolean | 1루 주자. 네이버 |
| situation.onSecond | boolean | 2루 주자. 네이버 |
| situation.onThird | boolean | 3루 주자. 네이버 |
| situation.batterName | string | 타자명. 네이버 |
| situation.pitcherName | string | 투수명. 네이버 |
| situation.pitchType | string | 구종. 네이버 |
| situation.batsSide | left\|right | 타석 손. 포수 시점 배치 |
| situation.atBatResultDisplay | string | 실황 타격 결과 문구 |

## 관계 요약

```
users ──┬── predictions ── matches ── stadia
        ├── matchsidebets ──┘
        ├── pointtransactions
        └── mallorders

adminusers.apiSyncEnabled  =  실황 ON (회원 경기 선택 게이트)
roundstatistics + matches.predictionEnabled  =  atBatPhase (Match에 단계 필드 없음)
friendrooms ── friendroommembers
```

실황 ON은 Match 필드가 아니라 `adminusers.apiSyncEnabled` 입니다. 회원 선택 모달의 `sideBetEnabled`는 API가 붙입니다.
`atBatPhase`는 Match에 저장하지 않고 `roundstatistics` 플래그 + `matches.predictionEnabled`로 도출합니다.
