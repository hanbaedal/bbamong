import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Term } from "@shared/schema";

interface AdminTermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: Term | null;
}

export function AdminTermsModal({ open, onOpenChange, term }: AdminTermsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[600px] w-full max-h-[80vh] m-0 p-0 bg-white border border-[#E0E0E0] rounded-lg flex flex-col [&>button:last-child]:hidden"
        data-testid="admin-terms-modal"
      >
        <DialogDescription className="sr-only">
          {term?.title || "약관"} 내용을 확인하세요
        </DialogDescription>

        <div className="h-[60px] flex items-center justify-between px-5 bg-white border-b border-[#E0E0E0]">
          <div className="w-6 h-6 opacity-0" />
          
          <DialogTitle 
            className="text-[#201E22] text-lg font-semibold text-center"
            data-testid="admin-terms-modal-title"
          >
            {term?.title || "약관"}
          </DialogTitle>

          <button
            onClick={() => onOpenChange(false)}
            data-testid="button-close-admin-terms"
            className="w-6 h-6 flex items-center justify-center text-[#4D4B4E] hover:text-[#201E22] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {term?.content ? (
            <p 
              className="text-[#4D4B4E] text-base leading-[160%] whitespace-pre-wrap"
              data-testid="admin-terms-content"
            >
              {term.content}
            </p>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#4D4B4E] text-base">약관 내용을 불러올 수 없습니다.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
