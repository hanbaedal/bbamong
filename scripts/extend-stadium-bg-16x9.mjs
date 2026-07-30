/**
 * 3:2 game-stadium-bg.png → 16:9 (좌·우 관중석 구간 미러 확장)
 * 실행: node scripts/extend-stadium-bg-16x9.mjs
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = path.join(root, "assets/game/game-stadium-bg.png");
const output = path.join(root, "assets/game/game-stadium-bg.png");

const src = await sharp(input);
const meta = await src.metadata();
const srcW = meta.width;
const srcH = meta.height;
const targetW = Math.round((srcH * 16) / 9);
const pad = Math.floor((targetW - srcW) / 2);
const stripW = pad;

const leftStrip = await sharp(input)
  .extract({ left: stripW, top: 0, width: stripW, height: srcH })
  .flop()
  .toBuffer();

const rightStrip = await sharp(input)
  .extract({ left: srcW - stripW * 2, top: 0, width: stripW, height: srcH })
  .flip()
  .toBuffer();

const center = await sharp(input).toBuffer();

await sharp({
  create: {
    width: targetW,
    height: srcH,
    channels: 4,
    background: { r: 12, g: 21, b: 32, alpha: 1 },
  },
})
  .composite([
    { input: leftStrip, left: 0, top: 0 },
    { input: center, left: pad, top: 0 },
    { input: rightStrip, left: pad + srcW, top: 0 },
  ])
  .png()
  .toFile(output);

console.log(`Extended ${srcW}x${srcH} → ${targetW}x${srcH} (pad ${pad}px each side)`);
console.log(`Written: ${output}`);
