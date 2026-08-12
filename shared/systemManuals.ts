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
    description: "관리자·슈퍼바이저 웹(/admin) 메뉴·회원·경기·수익·운영 안내",
    fileName: "빠몽이_사용설명서_관리자.docx",
  },
  {
    id: "usage-mall",
    category: "usage",
    audience: "쇼핑몰",
    title: "쇼핑몰 설명서",
    description: "빠몽이 쇼핑센터·몰 관리·주문·재고·정책 안내",
    fileName: "빠몽이_사용설명서_쇼핑몰.docx",
  },
  {
    id: "usage-operator",
    category: "usage",
    audience: "운영자",
    title: "운영자 설명서",
    description: "운영자 앱 로그인·예측 시작/중지·결과·대타·광고 흐름",
    fileName: "빠몽이_사용설명서_운영자.docx",
  },
  {
    id: "usage-user",
    category: "usage",
    audience: "사용자",
    title: "사용자 설명서",
    description: "회원 앱 로그인·홈·예측·사이드벳·광고·메뉴 안내",
    fileName: "빠몽이_사용설명서.docx",
  },
  {
    id: "db-structure",
    category: "db",
    audience: "DB",
    title: "빠몽이 DB 구조 설명서",
    description: "주요 컬렉션·테이블·관계(ERD) 요약",
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
