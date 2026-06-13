interface AdminSimpleConfirmPopupProps {
  message: string;
  leftButtonText: string;
  rightButtonText: string;
  onLeftClick: () => void;
  onRightClick: () => void;
  rightButtonDisabled?: boolean;
}

export default function AdminSimpleConfirmPopup({
  message,
  leftButtonText,
  rightButtonText,
  onLeftClick,
  onRightClick,
  rightButtonDisabled = false,
}: AdminSimpleConfirmPopupProps) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-[#000000CC] z-[70]" />

      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[266px] bg-white shadow-[0_8px_36px_rgba(0,0,0,0.16)] rounded-[8px] flex flex-col items-center p-[20px_20px_16px] gap-2 z-[70]">
        {/* 안내문 */}
        <div className="w-[226px] flex flex-col justify-center items-center gap-[10px]">
          <p className="text-center text-[#201E22] font-[Pretendard] font-normal text-[16px] leading-[140%] tracking-[-0.025em] whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* 버튼 */}
        <div className="w-[226px] flex flex-row justify-center items-center gap-2">
          <button
            data-testid="button-confirm-left"
            className="flex-1 h-[40px] bg-[#E9E9E9] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#4D4B4E] whitespace-nowrap"
            onClick={onLeftClick}
            disabled={rightButtonDisabled}
          >
            {leftButtonText}
          </button>
          <button
            data-testid="button-confirm-right"
            className={`flex-1 h-[40px] bg-[#E11936] border border-[#E11936] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-white whitespace-nowrap ${rightButtonDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={onRightClick}
            disabled={rightButtonDisabled}
          >
            {rightButtonDisabled ? "처리중..." : rightButtonText}
          </button>
        </div>
      </div>
    </>
  );
}
