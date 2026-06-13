interface AdminConfirmPopupProps {
  title: string;
  details?: Array<{ label: string; value: string }>;
  message?: string;
  footerText?: string;
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}

export default function AdminConfirmPopup({
  title,
  details,
  message,
  footerText,
  cancelText = "취소",
  confirmText = "확인",
  confirmVariant = "primary",
  onCancel,
  onConfirm,
}: AdminConfirmPopupProps) {
  const confirmButtonClasses =
    confirmVariant === "danger"
      ? "bg-red-500 hover:bg-red-600 text-white border-red-500"
      : "bg-blue-500 hover:bg-blue-600 text-white border-blue-500";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[70]" onClick={onCancel} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-white rounded-lg z-[70] overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-gray-900 text-lg font-bold text-center">
            {title}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          {message && (
            <p className="text-gray-700 text-sm text-center">{message}</p>
          )}

          {details && details.length > 0 && (
            <div className="space-y-3">
              {details.map((detail, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">{detail.label}</span>
                  <span className="text-gray-900 text-sm font-medium">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {footerText && (
            <div className="bg-gray-100 rounded-lg p-3 mt-4">
              <p className="text-gray-600 text-sm text-center">{footerText}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <div className="flex gap-3">
            {cancelText && (
              <button
                data-testid="admin-button-cancel"
                onClick={onCancel}
                className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              data-testid="admin-button-confirm"
              onClick={onConfirm}
              className={`flex-1 h-11 rounded-lg font-bold transition-colors border ${confirmButtonClasses}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
