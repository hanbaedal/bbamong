interface ConfirmPopupProps {
  title: string;
  details: Array<{ label: string; value: string }>;
  footerLabel: string;
  footerValue: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmPopup({
  title,
  details,
  footerLabel,
  footerValue,
  onCancel,
  onConfirm,
}: ConfirmPopupProps) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-[#000000CC] z-[70]" onClick={onCancel} />

      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[320px] bg-[#2F2F2F] rounded-lg z-[75] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#373539]">
          <h2 className="text-white text-base font-bold text-center">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          {details.map((detail, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-[#AAAAAA] text-sm">{detail.label}</span>
              <span className="text-white text-sm">{detail.value}</span>
            </div>
          ))}
        </div>

        {/* Footer - Points section with top border */}
        <div className="px-5 pb-4">
          <div className="border-t border-[#373539] pt-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[#AAAAAA] text-sm">{footerLabel}</span>
              <span className="text-[#CDFF00] text-sm font-bold">
                {footerValue}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              data-testid="button-cancel"
              onClick={onCancel}
              className="flex-1 h-12 bg-[#474747] text-white rounded-lg font-medium hover:bg-[#2A2A2A] transition-colors"
            >
              취소
            </button>
            <button
              data-testid="button-confirm"
              onClick={onConfirm}
              className="flex-1 h-12 bg-[#CCF501] text-black rounded-lg font-bold active:bg-[#C8D48D] border border-[#CDFF00] transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
