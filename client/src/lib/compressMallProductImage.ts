import {
  getMallProductImageLimits,
  type MallProductImageKind,
} from "@shared/mallProduct";

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 압축에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

/** 브라우저에서 몰 상품 이미지를 WebP로 압축 (서버 sharp와 동일 목표 용량) */
export async function compressMallProductImageFile(
  file: File,
  kind: MallProductImageKind = "cover",
): Promise<Blob> {
  const { maxBytes, maxWidth } = getMallProductImageLimits(kind);
  const img = await loadImageFromFile(file);
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("이미지 처리를 지원하지 않는 브라우저입니다.");
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = kind === "detail" ? 0.85 : 0.82;
  let lastBlob = await canvasToBlob(canvas, quality);

  while (lastBlob.size > maxBytes && (quality > 0.15 || width > 240)) {
    if (quality > 0.2) {
      quality -= 0.08;
    } else {
      width = Math.max(240, Math.round(width * 0.82));
      height = Math.max(1, Math.round((img.naturalHeight * width) / img.naturalWidth));
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      quality = 0.72;
    }
    lastBlob = await canvasToBlob(canvas, Math.max(0.12, quality));
  }

  return lastBlob;
}
