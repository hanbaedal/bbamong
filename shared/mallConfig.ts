/** 쇼핑몰 경로 prefix (ppamong.com/shop) */
export const MALL_BASE_PATH = "/shop";

/** 향후 shop.ppamong.com 서브도메인 */
export const MALL_SUBDOMAIN = "shop.ppamong.com";

export const MALL_SECTION_TITLE = "빠몽이 기념품";

export interface MallCategoryDef {
  name: string;
  description?: string;
  children?: MallCategoryDef[];
}

/** 쇼핑몰 헤더·관리자 관리 화면 공통 카테고리 메뉴 (대분류 → 소분류) */
export const MALL_CATEGORY_TREE: MallCategoryDef[] = [
  {
    name: "글러브",
    description: "야구 글러브 · 미트",
    children: [
      { name: "투수/올라운드" },
      { name: "내야" },
      { name: "외야" },
      { name: "1루" },
      { name: "포수" },
      { name: "좌투" },
      { name: "중고" },
      { name: "트레이닝" },
      { name: "관련용품" },
    ],
  },
  {
    name: "배트",
    description: "야구 배트 · 타격용품",
    children: [
      { name: "알루미늄" },
      { name: "나무" },
      { name: "펑고" },
      { name: "트레이닝" },
      { name: "유소년" },
    ],
  },
  {
    name: "장갑",
    description: "배팅 · 필드 장갑",
    children: [
      { name: "배팅" },
      { name: "수비" },
      { name: "주루" },
      { name: "방한" },
    ],
  },
  {
    name: "야구화",
    description: "야구화 · 스파이크",
    children: [
      { name: "징스파이크" },
      { name: "인조잔디" },
      { name: "포인트" },
      { name: "심판" },
    ],
  },
  {
    name: "야구공",
    description: "공식구 · 연습구",
    children: [
      { name: "경식구(시합/일반)" },
      { name: "안전구(연식)" },
      { name: "스냅볼" },
      { name: "트레이닝" },
    ],
  },
  {
    name: "가방",
    description: "배트백 · 장비가방",
    children: [
      { name: "백팩" },
      { name: "크로스백" },
      { name: "배트 가방" },
      { name: "팀·볼·포수 가방" },
    ],
  },
  {
    name: "보호장비",
    description: "헬멧 · 보호대 · 마스크",
    children: [
      { name: "타자헬멧" },
      { name: "손등보호대" },
      { name: "암가드" },
      { name: "풋가드" },
      { name: "포수장비" },
      { name: "손목보호대" },
    ],
  },
  {
    name: "의류·악세사리",
    description: "유니폼 · 모자 · 액세서리",
    children: [
      { name: "언더웨어(상의)" },
      { name: "언더웨어(하의)" },
      { name: "야구유니폼" },
      { name: "야구의류" },
      { name: "아이싱티" },
      { name: "반바지" },
      { name: "바람막이" },
      { name: "선글라스" },
      { name: "야구양말" },
    ],
  },
  {
    name: "기타야구용품",
    description: "야구 관련 기타 용품",
    children: [
      { name: "루 베이스" },
      { name: "트레이닝 용품" },
      { name: "로진 ·아이패치" },
      { name: "기타" },
    ],
  },
  {
    name: "빠몽이상품",
    description: "빠몽이 공식 굿즈",
  },
];

export interface FlatMallCategoryDef {
  name: string;
  description: string;
  displayOrder: number;
  parentName: string | null;
}

export function flattenMallCategoryTree(tree: MallCategoryDef[] = MALL_CATEGORY_TREE): FlatMallCategoryDef[] {
  const flat: FlatMallCategoryDef[] = [];
  let order = 1;
  for (const parent of tree) {
    flat.push({
      name: parent.name,
      description: parent.description ?? "",
      displayOrder: order++,
      parentName: null,
    });
    for (const child of parent.children ?? []) {
      flat.push({
        name: child.name,
        description: child.description ?? parent.description ?? "",
        displayOrder: order++,
        parentName: parent.name,
      });
    }
  }
  return flat;
}

/** @deprecated flat list — DB sync용 */
export const MALL_DEFAULT_CATEGORIES = flattenMallCategoryTree().map(({ name, description, displayOrder }) => ({
  name,
  description,
  displayOrder,
}));

export const MALL_CATEGORY_NAMES = flattenMallCategoryTree().map((c) => c.name);

export type MallSort = "popular" | "newest" | "price_asc" | "price_desc" | "discount";

export function isMallHost(hostname: string): boolean {
  return hostname === MALL_SUBDOMAIN || hostname.startsWith("shop.");
}

export function mallPath(subpath = ""): string {
  if (!subpath || subpath === "/") return MALL_BASE_PATH;
  const normalized = subpath.startsWith("/") ? subpath : `/${subpath}`;
  if (normalized.startsWith(MALL_BASE_PATH)) return normalized;
  return `${MALL_BASE_PATH}${normalized}`;
}

/** parentName → child names (헤더 메가메뉴용) */
export function mallCategoryChildrenMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const parent of MALL_CATEGORY_TREE) {
    map[parent.name] = (parent.children ?? []).map((c) => c.name);
  }
  return map;
}
