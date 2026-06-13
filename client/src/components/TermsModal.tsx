import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Term } from "@shared/schema";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: Term | null; // 미리 로드된 약관
}

export function TermsModal({ open, onOpenChange, term }: TermsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-full w-full h-full m-0 p-0 bg-[#111111] border-0 rounded-none flex flex-col [&>button:last-child]:hidden"
        data-testid="terms-modal"
      >

        {/* 접근성을 위한 숨겨진 설명 */}
        <DialogDescription className="sr-only">
          {term?.title || "약관"} 내용을 확인하세요
        </DialogDescription>

        {/* 헤더 */}
        <div className="min-h-[60px] flex items-center justify-between px-5 bg-[#111111] pt-safe-top">
          {/* 투명 왼쪽 공간 (레이아웃 균형용) */}
          <div className="w-6 h-6 opacity-0" />
          
          {/* 제목 - DialogTitle 사용으로 접근성 개선 */}
          <DialogTitle 
            className="text-white text-lg font-semibold text-center"
            data-testid="terms-modal-title"
          >
            {term?.title || "약관"}
          </DialogTitle>

          {/* 닫기 버튼 */}
          <button
            onClick={() => onOpenChange(false)}
            data-testid="button-close-terms"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#D5D5D5] hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8">
          {term?.content ? (
            <p 
              className="text-[#BFBFBF] text-base leading-[160%] whitespace-pre-wrap"
              data-testid="terms-content"
            >
              {term.content}
            </p>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#BFBFBF] text-base">약관 내용을 불러올 수 없습니다.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
