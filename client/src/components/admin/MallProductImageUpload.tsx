import { useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiRequest } from "@/lib/adminQueryClient";
import { compressMallProductImageFile } from "@/lib/compressMallProductImage";
import { Button } from "@/components/ui/button";
import { MALL_PRODUCT_IMAGE_MAX_BYTES } from "@shared/mallProduct";

interface MallProductImageUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  onClear?: () => void;
  compact?: boolean;
}

async function uploadCompressedBlob(blob: Blob): Promise<{ url: string; sizeBytes: number }> {
  const res = await apiRequest("POST", "/api/admin/mall/product-images/upload-url");
  const data = (await res.json()) as { uploadURL: string; canonicalPath: string; maxBytes: number };

  const uploadRes = await fetch(data.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error(`스토리지 업로드 실패 (${uploadRes.status})`);
  }

  return { url: data.canonicalPath, sizeBytes: blob.size };
}

export default function MallProductImageUpload({
  label,
  value,
  onChange,
  onClear,
  compact = false,
}: MallProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState<string>("");

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setUploading(true);
    try {
      const blob = await compressMallProductImageFile(file);
      const { url, sizeBytes } = await uploadCompressedBlob(blob);
      onChange(url);
      setMeta(`${Math.round(sizeBytes / 1024)}KB / ${Math.round(MALL_PRODUCT_IMAGE_MAX_BYTES / 1024)}KB`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#201E22]">{label}</p>
      <p className="text-xs text-[#888]">
        JPG·PNG 등 업로드 시 {Math.round(MALL_PRODUCT_IMAGE_MAX_BYTES / 1024)}KB 이하로 자동 압축 저장
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSelect}
        />
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              업로드 중...
            </>
          ) : (
            "이미지 선택"
          )}
        </Button>
        {value && onClear ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="w-4 h-4 mr-1" />
            제거
          </Button>
        ) : null}
        {meta ? <span className="text-xs text-[#888]">{meta}</span> : null}
      </div>
      {value ? (
        <div className={`${compact ? "w-20 h-20" : "w-32 h-32"} rounded border border-[#E9E9E9] overflow-hidden bg-[#FAFAFA]`}>
          <img src={value} alt="" className="w-full h-full object-cover" />
        </div>
      ) : null}
    </div>
  );
}

export async function uploadMallProductImageFile(file: File): Promise<string> {
  const blob = await compressMallProductImageFile(file);
  const { url } = await uploadCompressedBlob(blob);
  return url;
}
