/**
 * PPAMONG 마스코트로 Android 런처 아이콘·스플래시 생성
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

const BG = { r: 17, g: 17, b: 17, alpha: 1 };

async function iconFromMascot(mascotPath, outDir, sizes, fileBase) {
  const buf = fs.readFileSync(mascotPath);
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(outDir, "app", "src", "main", "res", folder);
    fs.mkdirSync(dir, { recursive: true });
    const inner = Math.round(size * 0.72);
    const resized = await sharp(buf).resize(inner, inner, { fit: "contain" }).png().toBuffer();
    const canvas = await sharp({
      create: { width: size, height: size, channels: 4, background: BG },
    })
      .composite([{ input: resized, gravity: "centre" }])
      .png()
      .toBuffer();
    await sharp(canvas).toFile(path.join(dir, `${fileBase}.png`));
  }
}

async function splashFromMascot(mascotPath, outDir) {
  const buf = fs.readFileSync(mascotPath);
  for (const [folder, { w, h }] of Object.entries(SPLASH_SIZES)) {
    const dir = path.join(outDir, "app", "src", "main", "res", folder);
    fs.mkdirSync(dir, { recursive: true });
    const logoW = Math.min(w, h) * 0.35;
    const resized = await sharp(buf).resize(Math.round(logoW), Math.round(logoW), { fit: "contain" }).png().toBuffer();
    const canvas = await sharp({
      create: { width: w, height: h, channels: 4, background: BG },
    })
      .composite([{ input: resized, gravity: "centre" }])
      .png()
      .toBuffer();
    await sharp(canvas).toFile(path.join(dir, "splash.png"));
  }
  const drawable = path.join(outDir, "app", "src", "main", "res", "drawable", "splash.png");
  fs.mkdirSync(path.dirname(drawable), { recursive: true });
  await sharp(buf).resize(256, 256, { fit: "contain" }).png().toFile(drawable);
}

async function brandAndroid(androidDir, mascotPath) {
  console.log(`브랜딩: ${path.basename(androidDir)}`);
  await iconFromMascot(mascotPath, androidDir, LAUNCHER_SIZES, "ic_launcher");
  await iconFromMascot(mascotPath, androidDir, LAUNCHER_SIZES, "ic_launcher_round");
  await iconFromMascot(mascotPath, androidDir, FOREGROUND_SIZES, "ic_launcher_foreground");
  await splashFromMascot(mascotPath, androidDir);
}

await brandAndroid(path.join(root, "android"), path.join(root, "assets/user/user-mascot.png"));
await brandAndroid(path.join(root, "android-manager"), path.join(root, "assets/manager/manager-mascot.png"));
console.log("PPAMONG Android 아이콘·스플래시 적용 완료");
