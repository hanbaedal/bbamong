/** 슈퍼바이저 시스템 매뉴얼 — docs/ GitHub 원본 매핑 */
export type SystemManualAudience = "관리자" | "쇼핑몰" | "운영자" | "사용자" | "DB";

export type SystemManualCategory = "usage" | "db";

export interface SystemManualEntry {
  id: string;
  category: SystemManualCategory;
  audience: SystemManualAudience;
  title: string;
  description: string;
  /** docs/ 아래 DOCX 파일명 (GitHub main 기준) */
  fileName: string;
}

export const SYSTEM_MANUALS: SystemManualEntry[] = [
  {
    id: "usage-admin",
    category: "usage",
    audience: "관리자",
    title: "관리자 페이지 설명서",
    description:
      "관리자 웹 메뉴·일일 체크·실황 ON·수동 스코어·예측 화면·광고 80초·타석 배당",
    fileName: "빠몽이_사용설명서_관리자.docx",
  },
  {
    id: "usage-mall",
    category: "usage",
    audience: "쇼핑몰",
    title: "쇼핑몰 설명서",
    description: "쇼핑센터 URL·정회원 주문·현금 접수·관리자 몰 메뉴·포인트 직접결제 없음",
    fileName: "빠몽이_사용설명서_쇼핑몰.docx",
  },
  {
    id: "usage-operator",
    category: "usage",
    audience: "운영자",
    title: "운영자 설명서",
    description:
      "하이브리드 실황(토글 없음)·타석 머신·예외 수동·대타 유지·광고 80초·회원 화면 7단계",
    fileName: "빠몽이_사용설명서_운영자.docx",
  },
  {
    id: "usage-user",
    category: "usage",
    audience: "사용자",
    title: "사용자 설명서",
    description:
      "로그인·홈·경기전→주루 화면 변화·사이드벳·리워드 광고(배너 없음)·배당",
    fileName: "빠몽이_사용설명서.docx",
  },
  {
    id: "db-structure",
    category: "db",
    audience: "DB",
    title: "빠몽이 DB 구조 설명서",
    description: "MongoDB 전용 컬렉션·Match 운영 필드·백업(Postgres는 레거시)",
    fileName: "빠몽이_DB구조_설명서.docx",
  },
];

export function getSystemManualById(id: string): SystemManualEntry | undefined {
  return SYSTEM_MANUALS.find((m) => m.id === id);
}

/** DOCX 파일명 → 같은 이름의 PDF (모달 읽기용) */
export function systemManualPdfFileName(docxFileName: string): string {
  return docxFileName.replace(/\.docx$/i, ".pdf");
}

export const SYSTEM_MANUALS_GITHUB_REPO = "hanbaedal/bbamong";
export const SYSTEM_MANUALS_GITHUB_BRANCH = "main";
export const SYSTEM_MANUALS_GITHUB_DOCS_DIR = "docs";
