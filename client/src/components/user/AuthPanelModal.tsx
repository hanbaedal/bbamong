import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface AuthPanelModalProps {
  anchor: "left" | "right";
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}

/** 인증 화면 패널 모달 — 가로: 해당 열만 덮음, 세로: 중앙 카드 */
export default function AuthPanelModal({
  anchor,
  open,
  title,
  onClose,
  children,
  testId = "auth-panel-modal",
}: AuthPanelModalProps) {
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
    <div
      className={`user-auth-panel-modal user-auth-panel-modal--${anchor}`}
      role="dialog"
      aria-modal="true"
      data-testid={testId}
    >
      <button
        type="button"
        className="user-auth-panel-modal-backdrop"
        onClick={onClose}
        aria-label="닫기"
        data-testid={`${testId}-backdrop`}
      />
      <div className="user-auth-panel-modal-sheet">
        <div className="user-auth-panel-modal-header">
          <h2 className="user-auth-panel-modal-title" data-testid={`${testId}-title`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="user-auth-panel-modal-close"
            aria-label="닫기"
            data-testid={`${testId}-close`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="user-auth-panel-modal-body">{children}</div>
      </div>
    </div>
  );
}
