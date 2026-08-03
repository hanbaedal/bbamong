/**
 * 테스트용 몰 상품 시드 (야구백화점 카테고리 페이지 참고)
 * 사용: node scripts/seed-mall-test-products.mjs [--fresh] [--limit=10]
 *
 * --fresh  해당 카테고리 기존 상품 삭제 후 재시드
 * --limit  소분류당 상품 수 (기본 10)
 */
import "dotenv/config";
import mongoose from "mongoose";

const BASE = "https://baseballdepartment.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const DEFAULT_LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "10", 10);
const FRESH = process.argv.includes("--fresh");

/** parent|child → cafe24 category path segment */
const SEED_SOURCES = {
  "글러브|투수/올라운드": "/category/%ED%88%AC%EC%88%98%EC%98%AC%EB%9D%BC%EC%9A%B4%EB%93%9C/185/",
  "글러브|내야": "/category/%EB%82%B4%EC%95%BC/188/",
  "글러브|외야": "/category/%EC%99%B8%EC%95%BC/189/",
  "글러브|1루": "/category/1%EB%A3%A8/190/",
  "글러브|포수": "/category/%ED%8F%AC%EC%88%98/191/",
  "글러브|좌투": "/category/%EC%A2%8C%ED%88%AC/194/",
  "글러브|중고": "/category/%EC%A4%91%EA%B3%A0/196/",
  "글러브|트레이닝": "/category/%ED%8A%B8%EB%A0%88%EC%9D%B4%EB%8B%9D/198/",
  "글러브|관련용품": "/category/%EA%B4%80%EB%A0%A8%EC%9A%A9%ED%92%88/199/",
  "배트|알루미늄": "/category/%EC%95%8C%EB%A3%A8%EB%AF%B8%EB%8A%84/51/",
  "배트|나무": "/category/%EB%82%98%EB%AC%B4/81/",
  "배트|펑고": "/category/%ED%8E%91%EA%B3%A0/82/",
  "배트|트레이닝": "/category/%ED%8A%B8%EB%A0%88%EC%9D%B4%EB%8B%9D/83/",
  "배트|유소년": "/category/%EC%9C%A0%EC%86%8C%EB%85%84/133/",
  "장갑|배팅": "/category/%EB%B0%B0%ED%8C%85/88/",
  "장갑|수비": "/category/%EC%88%98%EB%B9%84/89/",
  "장갑|주루": "/category/%EC%A3%BC%EB%A3%A8/90/",
  "장갑|방한": "/category/%EB%B0%A9%ED%95%9C/91/",
  "야구화|징스파이크": "/category/%EC%A7%95%EC%8A%A4%ED%8C%8C%EC%9D%B4%ED%81%AC/93/",
  "야구화|인조잔디": "/category/%EC%9D%B8%EC%A1%B0%EC%9E%94%EB%94%94/94/",
  "야구화|포인트": "/category/%ED%8F%AC%EC%9D%B8%ED%8A%B8/95/",
  "야구화|심판": "/category/%EC%8B%AC%ED%8C%90/97/",
  "야구공|경식구(시합/일반)": "/category/%EA%B2%BD%EC%8B%9D%EA%B5%AC(%EC%8B%9C%ED%95%A9%EC%9D%BC%EB%B0%98)/101/",
  "야구공|안전구(연식)": "/category/%EC%95%88%EC%A0%84%EA%B5%AC(%EC%97%B0%EC%8B%9D)/102/",
  "야구공|스냅볼": "/category/%EC%8A%A4%EB%83%85%EB%B3%BC/103/",
  "야구공|트레이닝": "/category/%ED%8A%B8%EB%A0%88%EC%9D%B4%EB%8B%9D%EA%B8%B0%ED%83%80/104/",
  "가방|백팩": "/category/%EB%B0%B1%ED%8C%A9/138/",
  "가방|크로스백": "/category/%ED%81%AC%EB%A1%9C%EC%8A%A4%EB%B0%B1/137/",
  "가방|배트 가방": "/category/%EB%B0%B0%ED%8A%B8-%EA%B0%80%EB%B0%A9/140/",
  "가방|팀·볼·포수 가방": "/category/%ED%8C%80%C2%B7%EB%B3%BC%C2%B7%ED%8F%AC%EC%88%98-%EA%B0%80%EB%B0%A9/141/",
  "보호장비|타자헬멧": "/category/%ED%83%80%EC%9E%90%ED%97%AC%EB%A9%A7/112/",
  "보호장비|손등보호대": "/category/%EC%86%90%EB%93%B1%EB%B3%B4%ED%98%B8%EB%8C%80/113/",
  "보호장비|암가드": "/category/%EC%95%94%EA%B0%80%EB%93%9C/114/",
  "보호장비|풋가드": "/category/%ED%92%8B%EA%B0%80%EB%93%9C/115/",
  "보호장비|포수장비": "/category/%ED%8F%AC%EC%88%98%EC%9E%A5%EB%B9%84/151/",
  "보호장비|손목보호대": "/category/%EC%86%90%EB%AA%A9%EB%B3%B4%ED%98%B8%EB%8C%80/116/",
  "의류·악세사리|언더웨어(상의)": "/category/%EC%96%B8%EB%8D%94%EC%9B%A8%EC%96%B4(%EC%83%81%EC%9D%98)/142/",
  "의류·악세사리|언더웨어(하의)": "/category/%EC%96%B8%EB%8D%94%EC%9B%A8%EC%96%B4(%ED%95%98%EC%9D%98)/143/",
  "의류·악세사리|야구유니폼": "/category/%EC%95%BC%EA%B5%AC%EC%9C%A0%EB%8B%88%ED%8F%BC/166/",
  "의류·악세사리|야구의류": "/category/%EC%95%BC%EA%B5%AC%EC%9D%98%EB%A5%98/178/",
  "의류·악세사리|아이싱티": "/category/%EC%95%84%EC%9D%B4%EC%8B%B1%ED%8B%B0/159/",
  "의류·악세사리|반바지": "/category/%EB%B0%98%EB%B0%94%EC%A7%80/145/",
  "의류·악세사리|바람막이": "/category/%EB%B0%94%EB%9E%8C%EB%A7%89%EC%9D%B4/146/",
  "의류·악세사리|선글라스": "/category/%EC%84%A0%EA%B8%80%EB%9D%BC%EC%8A%A4/148/",
  "의류·악세사리|야구양말": "/category/%EC%95%BC%EA%B5%AC%EC%96%91%EB%A7%90/172/",
  "기타야구용품|루 베이스": "/category/%EB%A3%A8-%EB%B2%A0%EC%9D%B4%EC%8A%A4/156/",
  "기타야구용품|트레이닝 용품": "/category/%ED%8A%B8%EB%A0%88%EC%9D%B4%EB%8B%9D-%EC%9A%A9%ED%92%88/158/",
  "기타야구용품|로진 ·아이패치": "/category/%EB%A1%9C%EC%A7%84-%C2%B7%EC%95%84%EC%9D%B4%ED%8C%A8%EC%B9%98/165/",
  "기타야구용품|기타": "/category/%EA%B8%B0%ED%83%80/186/",
};

const categorySchema = new mongoose.Schema(
  {
    id: Number,
    parentId: { type: Number, default: null },
    name: String,
    description: String,
    displayOrder: Number,
    isActive: { type: Boolean, default: true },
  },
  { versionKey: false, collection: "goodscategories" },
);

const productSchema = new mongoose.Schema(
  {
    id: Number,
    categoryId: Number,
    name: String,
    summary: String,
    detailContent: String,
    imageUrl: String,
    priceLabel: String,
    priceAmount: Number,
    originalPriceAmount: Number,
    brand: String,
    shippingLabel: String,
    purchaseUrl: String,
    displayOrder: Number,
    isActive: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: -1 },
  },
  { versionKey: false, collection: "goodsproducts" },
);

const counterSchema = new mongoose.Schema(
  { name: String, value: Number },
  { versionKey: false, collection: "counters" },
);

const Category = mongoose.model("SeedGoodsCategory", categorySchema);
const Product = mongoose.model("SeedGoodsProduct", productSchema);
const Counter = mongoose.model("SeedCounter", counterSchema);

async function nextSeq(name) {
  const doc = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return doc.value;
}

async function bootstrapCategories() {
  const tree = [
    { name: "글러브", children: ["투수/올라운드", "내야", "외야", "1루", "포수", "좌투", "중고", "트레이닝", "관련용품"] },
    { name: "배트", children: ["알루미늄", "나무", "펑고", "트레이닝", "유소년"] },
    { name: "장갑", children: ["배팅", "수비", "주루", "방한"] },
    { name: "야구화", children: ["징스파이크", "인조잔디", "포인트", "심판"] },
    { name: "야구공", children: ["경식구(시합/일반)", "안전구(연식)", "스냅볼", "트레이닝"] },
    { name: "가방", children: ["백팩", "크로스백", "배트 가방", "팀·볼·포수 가방"] },
    { name: "보호장비", children: ["타자헬멧", "손등보호대", "암가드", "풋가드", "포수장비", "손목보호대"] },
    {
      name: "의류·악세사리",
      children: ["언더웨어(상의)", "언더웨어(하의)", "야구유니폼", "야구의류", "아이싱티", "반바지", "바람막이", "선글라스", "야구양말"],
    },
    { name: "기타야구용품", children: ["루 베이스", "트레이닝 용품", "로진 ·아이패치", "기타"] },
    { name: "빠몽이상품", children: [] },
  ];

  let order = 1;
  const nameToId = new Map();

  for (const parent of tree) {
    let doc = await Category.findOne({ name: parent.name, parentId: null }).lean();
    if (!doc) {
      const id = await nextSeq("goodsCategory");
      doc = await Category.create({
        id,
        parentId: null,
        name: parent.name,
        description: "",
        displayOrder: order,
        isActive: true,
      });
    }
    nameToId.set(parent.name, doc.id);
    order++;
    for (const childName of parent.children) {
      const existing = await Category.findOne({ name: childName, parentId: doc.id }).lean();
      if (!existing) {
        const id = await nextSeq("goodsCategory");
        await Category.create({
          id,
          parentId: doc.id,
          name: childName,
          description: "",
          displayOrder: order++,
          isActive: true,
        });
      } else {
        order++;
      }
    }
  }

  await Category.updateMany({ name: "중고나라" }, { isActive: false });
  console.log("카테고리 동기화 완료");
}

function guessBrand(name) {
  const known = ["미즈노", "롤링스", "윌슨", "제트", "모리모토", "언더아머", "데마리니", "루이슬러", "프랭클린", "아디다스", "나ike", "나이키", "골드", "브라더", "인코자바", "SSK", "ZETT"];
  for (const b of known) {
    if (name.includes(b)) return b;
  }
  return name.split(/\s+/)[0]?.slice(0, 20) || "";
}

function parseProductsFromHtml(html, limit) {
  const items = [];
  const linkRe = /href="(\/product\/[^"]+\/(\d+)\/category\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const path = m[1];
    const productNo = m[2];
    if (path.includes("recent_view")) continue;
    if (seen.has(productNo)) continue;
    seen.add(productNo);
    items.push({ path, productNo });
    if (items.length >= limit * 3) break;
  }

  const alts = [...html.matchAll(/alt="([^"]{8,120})"/g)].map((x) => x[1]);
  const imgs = [...html.matchAll(/(?:src|data-src|ec-data-src)="(\/\/ecimg[^"]+)"/g)].map((x) => `https:${x[1]}`);
  const priceMatches = [...html.matchAll(/>([\d,]{4,})원</g)].map((x) => parseInt(x[1].replace(/,/g, ""), 10));

  const results = [];
  for (let i = 0; i < Math.min(items.length, limit); i++) {
    const name = alts[i] || `테스트 상품 ${items[i].productNo}`;
    const price = priceMatches[i] || 0;
    const imageUrl = imgs[i] || "";
    results.push({
      name,
      priceAmount: price,
      priceLabel: price > 0 ? `${price.toLocaleString("ko-KR")}원` : "가격 문의",
      imageUrl,
      brand: guessBrand(name),
      externalKey: items[i].productNo,
    });
  }
  return results;
}

async function fetchCategoryProducts(sourcePath, limit) {
  const url = `${BASE}${sourcePath}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const html = await res.text();
  return parseProductsFromHtml(html, limit);
}

function makePpamongPlaceholders(limit) {
  return Array.from({ length: limit }, (_, i) => ({
    name: `빠몽이 기념품 ${i + 1} (테스트)`,
    priceAmount: (i + 1) * 9900,
    priceLabel: `${((i + 1) * 9900).toLocaleString("ko-KR")}원`,
    imageUrl: "",
    brand: "빠몽이",
    externalKey: `ppamong-${i + 1}`,
  }));
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("MONGODB_URI 가 없습니다.");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || "ppamong" });

  await bootstrapCategories();

  const parents = await Category.find({ parentId: null, isActive: true }).lean();
  const parentByName = new Map(parents.map((p) => [p.name, p]));

  let total = 0;

  for (const [key, sourcePath] of Object.entries(SEED_SOURCES)) {
    const [parentName, childName] = key.split("|");
    const parent = parentByName.get(parentName);
    if (!parent) {
      console.warn("skip (no parent):", key);
      continue;
    }
    const child = await Category.findOne({ name: childName, parentId: parent.id }).lean();
    if (!child) {
      console.warn("skip (no child):", key);
      continue;
    }

    if (FRESH) {
      await Product.deleteMany({ categoryId: child.id, summary: /\[TEST_SEED\]/ });
    }

    const existing = await Product.countDocuments({ categoryId: child.id, summary: /\[TEST_SEED\]/ });
    if (existing >= DEFAULT_LIMIT && !FRESH) {
      console.log(`skip ${key} (already ${existing})`);
      continue;
    }

    let products;
    try {
      products = await fetchCategoryProducts(sourcePath, DEFAULT_LIMIT);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.warn(`fetch fail ${key}:`, e.message);
      continue;
    }

    for (const p of products) {
      const id = await nextSeq("goodsProduct");
      await Product.create({
        id,
        categoryId: child.id,
        name: p.name,
        summary: `[TEST_SEED] 오픈 전 교체 예정 · ${childName}`,
        detailContent: `[TEST_SEED]\n테스트용으로 수집된 상품입니다. 오픈 시 삭제·교체하세요.\n\n${p.name}`,
        imageUrl: p.imageUrl,
        priceLabel: p.priceLabel,
        priceAmount: p.priceAmount,
        originalPriceAmount: p.priceAmount,
        brand: p.brand,
        shippingLabel: "무료배송",
        purchaseUrl: "",
        displayOrder: id,
        isActive: true,
        stockQuantity: -1,
      });
      total++;
    }
    console.log(`✓ ${key}: ${products.length}개`);
  }

  const ppamong = parentByName.get("빠몽이상품");
  if (ppamong) {
    if (FRESH) await Product.deleteMany({ categoryId: ppamong.id, summary: /\[TEST_SEED\]/ });
    const existing = await Product.countDocuments({ categoryId: ppamong.id, summary: /\[TEST_SEED\]/ });
    if (existing < DEFAULT_LIMIT || FRESH) {
      for (const p of makePpamongPlaceholders(DEFAULT_LIMIT)) {
        const id = await nextSeq("goodsProduct");
        await Product.create({
          id,
          categoryId: ppamong.id,
          name: p.name,
          summary: `[TEST_SEED] 빠몽이 공식 상품 (등록 예정)`,
          detailContent: "[TEST_SEED]\n빠몽이 공식 굿즈 등록 예정",
          imageUrl: p.imageUrl,
          priceLabel: p.priceLabel,
          priceAmount: p.priceAmount,
          brand: p.brand,
          shippingLabel: "무료배송",
          purchaseUrl: "",
          displayOrder: id,
          isActive: true,
        });
        total++;
      }
      console.log(`✓ 빠몽이상품: ${DEFAULT_LIMIT}개 (플레이스홀더)`);
    }
  }

  console.log(`\n완료: ${total}개 상품 시드`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
