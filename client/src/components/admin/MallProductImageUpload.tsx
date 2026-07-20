import { useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiRequest } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { MALL_PRODUCT_IMAGE_MAX_BYTES } from "@shared/mallProduct";

interface MallProductImageUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  onClear?: () => void;
  compact?: boolean;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
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
      const imageBase64 = await readFileAsBase64(file);
      const res = await apiRequest("POST", "/api/admin/mall/product-images", { imageBase64 });
      const data = (await res.json()) as { url: string; sizeBytes: number; maxBytes: number };
      onChange(data.url);
      setMeta(`${Math.round(data.sizeBytes / 1024)}KB / ${Math.round(data.maxBytes / 1024)}KB`);
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
  const imageBase64 = await readFileAsBase64(file);
  const res = await apiRequest("POST", "/api/admin/mall/product-images", { imageBase64 });
  const data = (await res.json()) as { url: string };
  return data.url;
}
