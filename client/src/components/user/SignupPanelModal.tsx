import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface SignupPanelModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}

/** 회원가입 우측 패널 전문보기 — 가로: 우측만 덮음, 세로: 중앙 카드 */
export default function SignupPanelModal({
  open,
  title,
  onClose,
  children,
  testId = "signup-panel-modal",
}: SignupPanelModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="user-signup-panel-modal" role="dialog" aria-modal="true" data-testid={testId}>
      <button
        type="button"
        className="user-signup-panel-modal-backdrop"
        onClick={onClose}
        aria-label="닫기"
        data-testid={`${testId}-backdrop`}
      />
      <div className="user-signup-panel-modal-sheet">
        <div className="user-signup-panel-modal-header">
          <h2 className="user-signup-panel-modal-title" data-testid={`${testId}-title`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="user-signup-panel-modal-close"
            aria-label="닫기"
            data-testid={`${testId}-close`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="user-signup-panel-modal-body">{children}</div>
      </div>
    </div>
  );
}
