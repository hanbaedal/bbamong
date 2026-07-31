/**
 * PPAMONG 마스코트로 Android 런처 아이콘·스플래시·favicon 생성
 * 실행: node scripts/update-ppamong-android-branding.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const LAUNCHER_SIZES = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const FOREGROUND_SIZES = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 288,
  "mipmap-xxxhdpi": 432,
};

const SPLASH_SIZES = {
  "drawable-port-mdpi": { w: 320, h: 480 },
  "drawable-port-hdpi": { w: 480, h: 800 },
  "drawable-port-xhdpi": { w: 720, h: 1280 },
  "drawable-port-xxhdpi": { w: 1080, h: 1920 },
  "drawable-port-xxxhdpi": { w: 1440, h: 2560 },
  "drawable-land-mdpi": { w: 480, h: 320 },
  "drawable-land-hdpi": { w: 800, h: 480 },
  "drawable-land-xhdpi": { w: 1280, h: 720 },
  "drawable-land-xxhdpi": { w: 1920, h: 1080 },
  "drawable-land-xxxhdpi": { w: 2560, h: 1440 },
};

const LAUNCHER_BG = { r: 17, g: 17, b: 17, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** 테두리와 연결된 검은/흰 배경만 투명 처리 (유니폼 흰색은 유지) */
async function loadMascotWithAlpha(mascotPath) {
  const { data, info } = await sharp(mascotPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const pixels = Buffer.from(data);
  const visited = new Uint8Array(w * h);
  const queue = [];

  const idx = (x, y) => (y * w + x) * 4;
  const pi = (x, y) => y * w + x;

  const isBackground = (i) => {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= 238 || max <= 35;
  };

  for (let x = 0; x < w; x++) {
    queue.push([x, 0], [x, h - 1]);
  }
  for (let y = 0; y < h; y++) {
    queue.push([0, y], [w - 1, y]);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = pi(x, y);
    if (visited[p]) continue;
    const i = idx(x, y);
    if (!isBackground(i)) continue;
    visited[p] = 1;
    pixels[i + 3] = 0;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return sharp(pixels, {
    raw: { width: w, height: h, channels: 4 },
  }).png();
}

async function iconFromMascot(mascotBuf, outDir, sizes, fileBase, { background }) {
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(outDir, "app", "src", "main", "res", folder);
    fs.mkdirSync(dir, { recursive: true });
    const inner = Math.round(size * (background.alpha === 0 ? 0.62 : 0.72));
    const resized = await sharp(mascotBuf).resize(inner, inner, { fit: "contain" }).png().toBuffer();
    const canvas = await sharp({
      create: { width: size, height: size, channels: 4, background },
    })
      .composite([{ input: resized, gravity: "centre" }])
      .png()
      .toBuffer();
    await sharp(canvas).toFile(path.join(dir, `${fileBase}.png`));
  }
}

async function splashFromMascot(mascotBuf, outDir) {
  for (const [folder, { w, h }] of Object.entries(SPLASH_SIZES)) {
    const dir = path.join(outDir, "app", "src", "main", "res", folder);
    fs.mkdirSync(dir, { recursive: true });
    const logoW = Math.min(w, h) * 0.35;
    const resized = await sharp(mascotBuf)
      .resize(Math.round(logoW), Math.round(logoW), { fit: "contain" })
      .png()
      .toBuffer();
    const canvas = await sharp({
      create: { width: w, height: h, channels: 4, background: LAUNCHER_BG },
    })
      .composite([{ input: resized, gravity: "centre" }])
      .png()
      .toBuffer();
    await sharp(canvas).toFile(path.join(dir, "splash.png"));
  }
  const drawable = path.join(outDir, "app", "src", "main", "res", "drawable", "splash.png");
  fs.mkdirSync(path.dirname(drawable), { recursive: true });
  await sharp(mascotBuf).resize(256, 256, { fit: "contain" }).png().toFile(drawable);
}

async function writeFavicon(mascotBuf, outPaths, size = 512) {
  const resized = await sharp(mascotBuf)
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  for (const outPath of outPaths) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await sharp(resized).toFile(outPath);
  }
}

async function brandAndroid(androidDir, mascotPath, { launcherBackgroundColor = "#111111" } = {}) {
  console.log(`브랜딩: ${path.basename(androidDir)}`);
  const mascotSharp = await loadMascotWithAlpha(mascotPath);
  const mascotBuf = await mascotSharp.toBuffer();

  await iconFromMascot(mascotBuf, androidDir, LAUNCHER_SIZES, "ic_launcher", {
    background: LAUNCHER_BG,
  });
  await iconFromMascot(mascotBuf, androidDir, LAUNCHER_SIZES, "ic_launcher_round", {
    background: LAUNCHER_BG,
  });
  await iconFromMascot(mascotBuf, androidDir, FOREGROUND_SIZES, "ic_launcher_foreground", {
    background: TRANSPARENT,
  });
  await splashFromMascot(mascotBuf, androidDir);

  const bgXml = path.join(androidDir, "app", "src", "main", "res", "values", "ic_launcher_background.xml");
  fs.mkdirSync(path.dirname(bgXml), { recursive: true });
  fs.writeFileSync(
    bgXml,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${launcherBackgroundColor}</color>\n</resources>\n`,
  );
}

const userMascot = path.join(root, "assets/user/user-mascot.png");
const managerMascot = path.join(root, "assets/manager/manager-mascot.png");

await brandAndroid(path.join(root, "android"), userMascot, { launcherBackgroundColor: "#111111" });
await brandAndroid(path.join(root, "android-manager"), managerMascot, { launcherBackgroundColor: "#111111" });

const userMascotBuf = await (await loadMascotWithAlpha(userMascot)).toBuffer();
await writeFavicon(userMascotBuf, [
  path.join(root, "assets/user/user-mascot-favicon.png"),
  path.join(root, "client/public/favicon.png"),
]);

const managerMascotBuf = await (await loadMascotWithAlpha(managerMascot)).toBuffer();
await writeFavicon(managerMascotBuf, [
  path.join(root, "assets/manager/manager-mascot-favicon.png"),
  path.join(root, "client/public/manager-favicon.png"),
]);

console.log("PPAMONG Android 아이콘·스플래시·favicon(투명) 적용 완료");
