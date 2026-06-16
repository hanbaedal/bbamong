/**
 * PPAMONG 운영 구조 및 메뉴 가이드 .docx 생성
 * 실행: node scripts/generate-ppamong-ops-doc.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "docs", "PPAMONG_운영_구조_및_메뉴_가이드.docx");

const h1 = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
const h2 = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const h3 = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
const p = (text) =>
  new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
const bullet = (text) =>
  new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
const blank = () => new Paragraph({ text: "", spacing: { after: 80 } });

function menuBlock(title, path, desc, children = []) {
  const items = [
    h3(title),
    p(`경로: ${path}`),
    p(desc),
    ...children.flatMap((c) => [
      bullet(`【${c.label}】 ${c.path} — ${c.desc}`),
    ]),
    blank(),
  ];
  return items;
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: "PPAMONG", bold: true, size: 56 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [
            new TextRun({ text: "운영 구조 및 메뉴 상세 가이드", bold: true, size: 36 }),
          ],
        }),
        p(`작성 기준일: ${new Date().toLocaleDateString("ko-KR")}`),
        p("서비스 URL: https://ppamong.com"),
        p("저장소: GitHub hanbaedal/bbamong · 배포: Replit Autoscale"),
        blank(),

        h1("1. 서비스 개요"),
        p(
          "PPAMONG은 야구 경기 실시간 예측·포인트·기부 참여 플랫폼입니다. 하나의 백엔드 서버(web)에서 API를 제공하며, 클라이언트는 사용자 앱·운영자(매니저) 앱·관리자 웹 세 가지로 구분됩니다.",
        ),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["역할", "대상", "접속 방법", "대표 URL"].map(
                (t) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })],
                  }),
              ),
            }),
            ...[
              ["일반 사용자", "참여자", "Android/iOS 앱", "/login, /home, /prediction"],
              ["운영자(매니저)", "현장 경기 운영", "Android/iOS 매니저 앱", "/manager/login, /manager/home"],
              ["관리자", "본사·슈퍼바이저", "웹 브라우저만", "/admin/login, /admin/home"],
            ].map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (c) => new TableCell({ children: [new Paragraph({ text: c })] }),
                  ),
                }),
            ),
          ],
        }),
        blank(),

        h1("2. 시스템 아키텍처"),
        h2("2.1 서버 구성"),
        bullet("백엔드: Node.js + Express (server/)"),
        bullet("운영 DB: MongoDB Atlas (MONGODB_URI) — ppamong.com 실제 서비스 데이터"),
        bullet("공통 DB: PostgreSQL Neon (DATABASE_URL, 선택) — 다른 프로그램과 공유, PPAMONG은 읽기만"),
        bullet("세션: Redis — 로그인 세션, SMS 인증, 소셜 로그인 일회성 코드"),
        bullet("영상: Replit Object Storage — 광고·대기 화면 URL 저장"),
        blank(),
        h2("2.2 데이터 흐름 (공통 PostgreSQL 연동 시)"),
        p(
          "다른 프로그램이 Neon PostgreSQL에 데이터를 기록하면, 슈퍼바이저는 관리자 웹 [업무 관리 → 디비 백업하기]에서 「받기」를 눌러 MongoDB로 upsert합니다. PostgreSQL에는 쓰지 않습니다.",
        ),
        bullet("자동 동기화: PG_MONGO_SYNC_INTERVAL_MS (기본 30분)"),
        bullet("수동: 테이블별 「받기」 / 「선택 항목 받기」 / 「전체 받기」"),
        blank(),
        h2("2.3 URL 분기 (client/src/main.tsx)"),
        bullet("/manager/* → ManagerApp (운영자)"),
        bullet("/admin/* → AdminApp (관리자)"),
        bullet("그 외 → UserApp (사용자)"),
        blank(),

        h1("3. 역할별 권한"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ["역할", "userType", "접근 범위"].map(
                (t) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })],
                  }),
              ),
            }),
            ...[
              ["슈퍼바이저", "슈퍼어드민", "전체 관리자 기능 + 관리자 관리 + 업무 관리"],
              ["일반 관리자", "일반어드민", "슈퍼바이저 전용 메뉴 제외한 백오피스 전체"],
              ["운영자", "매니저 (op1~op5)", "매니저 앱만, 고정 계정 + 관리자 발급 비밀번호"],
              ["사용자", "users 컬렉션", "사용자 앱 전 기능"],
            ].map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (c) => new TableCell({ children: [new Paragraph({ text: c })] }),
                  ),
                }),
            ),
          ],
        }),
        blank(),

        h1("4. 관리자 웹 메뉴 (상세)"),
        p("접속: https://ppamong.com/admin/login"),
        p("사이드바는 섹션별 구분선으로 묶여 있으며, 하위 메뉴가 있는 항목은 펼쳐서 이동합니다."),
        blank(),

        h2("4.1 메인"),
        ...menuBlock(
          "홈 페이지",
          "/admin/home",
          "관리자 로그인 후 첫 화면. 주요 메뉴로 바로 이동하는 바로가기를 제공합니다.",
        ),
        ...menuBlock(
          "홈페이지 관리",
          "/admin/homepage-management",
          "사용자 앱 홈 화면 콘텐츠를 관리합니다.",
          [
            { label: "기본 설정", path: "탭", desc: "인사말, 참여 버튼, 날짜 표시 등" },
            { label: "예측 게임 설명", path: "탭", desc: "게임 가이드 제목·요약·본문·이미지" },
            { label: "굿즈 분류/상품", path: "탭", desc: "굿즈 카테고리 및 상품 CRUD" },
          ],
        ),

        h2("4.2 슈퍼바이저 전용"),
        ...menuBlock(
          "관리자 관리",
          "(그룹)",
          "본사 관리자 계정(일반어드민) 등록·조회·수정·삭제.",
          [
            { label: "관리자 등록", path: "/admin/staff/register", desc: "신규 일반 관리자 즉시 승인 등록" },
            {
              label: "관리자 리스트",
              path: "/admin/staff/list",
              desc: "승인된 관리자 목록, 수정 시 비밀번호 평문 확인·변경",
            },
          ],
        ),
        ...menuBlock(
          "업무 관리",
          "(그룹)",
          "시스템 운영·감사 기능.",
          [
            {
              label: "디비 백업하기",
              path: "/admin/ops/db-backup",
              desc: "PostgreSQL→MongoDB 「받기」, MongoDB JSON 백업, 건수 비교",
            },
            {
              label: "관리자 로그인 현황",
              path: "/admin/ops/admin-login-status",
              desc: "일반·슈퍼 관리자 온라인/오프라인, 강제 로그아웃",
            },
            {
              label: "운영자 로그인 현황",
              path: "/admin/ops/manager-login-status",
              desc: "매니저(op1~5) 세션 현황, 강제 로그아웃",
            },
          ],
        ),

        h2("4.3 수익 · 운영자"),
        ...menuBlock(
          "수익 관리",
          "(그룹)",
          "광고·수익 관련 관리.",
          [
            {
              label: "동영상 광고 수익 현황",
              path: "/admin/revenue/video",
              desc: "동영상 광고 수익 조회 (Videos 페이지)",
            },
          ],
        ),
        ...menuBlock(
          "운영자 관리",
          "(그룹)",
          "현장 운영자 op1~op5 고정 계정 관리.",
          [
            {
              label: "운영자 등록",
              path: "/admin/operators/register",
              desc: "op1~op5 계정 생성(비밀번호는 리스트에서 수동 「생성」)",
            },
            {
              label: "운영자 리스트",
              path: "/admin/operators/list",
              desc: "비밀번호 생성·복사, 경기 자동 할당 확인, 활성/비활성",
            },
            {
              label: "운영자 상태 모니터링",
              path: "/admin/monitoring",
              desc: "운영자 실시간 상태 모니터링",
            },
          ],
        ),
        p("※ 경기 등록 순서 1~5번이 op1~op5에 자동 할당됩니다 (경기 관리에서 오늘 경기 등록 시)."),
        blank(),

        h2("4.4 경기 · 회원"),
        ...menuBlock(
          "경기 관리",
          "/admin/match-management",
          "경기장·경기 일정 등록·수정·삭제. 경기 등록 시 운영자 자동 할당 트리거.",
        ),
        ...menuBlock(
          "회원 관리",
          "(그룹)",
          "일반 사용자(앱 회원) 관리.",
          [
            { label: "회원 리스트", path: "/admin/members/list", desc: "회원 조회·정지·상세" },
            {
              label: "사회공헌참여기록 관리",
              path: "/admin/members/donation-rankings",
              desc: "기부·사회공헌 참여 기록 순위 관리",
            },
          ],
        ),

        h2("4.5 공지 · 고객지원"),
        ...menuBlock("공지 사항", "/admin/notices", "사용자 앱에 노출되는 공지사항 CRUD."),
        ...menuBlock(
          "고객 지원 관리",
          "(그룹)",
          "문의·약관 관리.",
          [
            { label: "고객 지원 센터", path: "/admin/support", desc: "사용자 문의(inquiries) 답변 처리" },
            { label: "약관 관리", path: "/admin/terms", desc: "서비스·개인정보 약관 편집" },
          ],
        ),

        h1("5. 운영자(매니저) 앱"),
        p("접속: https://ppamong.com/manager (Capacitor 앱: com.ppamong.manager)"),
        bullet("회원가입 비활성화 — 관리자가 발급한 op1~op5 + 「생성」으로 만든 비밀번호만 로그인"),
        bullet("홈(/manager/home): 오늘 담당 경기 목록, 경기 상세 진입"),
        bullet("경기 상세(/manager/match/:id): 예측 시작/중지, 라운드 결과 입력, 광고 시작/중지"),
        bullet("중복 로그인 차단: 기존 세션 있으면 새 로그인 시 기존 세션 종료"),
        blank(),

        h1("6. 사용자 앱 메뉴"),
        p("접속: https://ppamong.com/login (Capacitor 앱: com.ppamong.app)"),
        h2("6.1 하단 네비게이션"),
        bullet("초대 (/invitation) — 친구 초대·초대 코드"),
        bullet("출석 (/attendance) — 일일 출석 포인트"),
        bullet("게시 (/board) — 커뮤니티 게시판"),
        bullet("추가 (/point) — 포인트 획득(광고 시청 등)"),
        bullet("로그아웃"),
        blank(),
        h2("6.2 주요 화면"),
        bullet("홈 (/home) — 인사·경기 참여 버튼·굿즈·게임 설명 링크"),
        bullet("게임 설명 (/home/game-guide) — 관리자가 설정한 예측 게임 안내"),
        bullet("굿즈 (/home/goods/:categoryId) — PPAMONG 굿즈 목록·상세"),
        bullet("예측 (/prediction) — 실시간 경기 예측 참여"),
        bullet("설정 (/settings) — 회원정보, 고객센터, 공지, 승리현황, 전자책, 기부내역, FAQ, 약관 등"),
        blank(),

        h1("7. 데이터베이스 구조 요약"),
        p("상세 ERD: docs/db-erd.md · 스키마: shared/schema.ts (PostgreSQL), server/mongodb/models.ts (MongoDB)"),
        bullet("users — 일반 회원 (소셜 로그인 provider 구분)"),
        bullet("admin_users — 관리자·슈퍼어드민·매니저 (user_type 구분)"),
        bullet("matches, stadiums, predictions, round_statistics — 경기·예측"),
        bullet("point_transactions — 포인트 이동 이력"),
        bullet("notices, terms, faqs, inquiries — 공지·약관·문의"),
        bullet("advertisements, waiting_screens, ad_view_history — 광고·대기 영상"),
        bullet("MongoDB 전용: HomePageSettings, GoodsCategory, GoodsProduct"),
        blank(),

        h1("8. 배포·운영 체크리스트"),
        bullet("Replit Secrets: MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, (선택) DATABASE_URL"),
        bullet("배포: npm run build → npm run start (Autoscale)"),
        bullet("동기화: bash sync-ppamong.sh (git pull + npm install)"),
        bullet("도메인: ppamong.com — 가비아 DNS + Replit Custom domains"),
        blank(),

        h1("9. 문서·참고 파일"),
        bullet("docs/PPAMONG_프로젝트_구조.md — 프로젝트 구조"),
        bullet("docs/PPAMONG_DEPLOY_CHECKLIST.md — 배포 체크리스트"),
        bullet("docs/db-erd.md — DB ERD 및 테이블 설명"),
        bullet("docs/PPAMONG_가비아_DNS_설정.md — DNS 연결"),
        blank(),
        p("— 문서 끝 —"),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log(`생성 완료: ${outPath}`);
