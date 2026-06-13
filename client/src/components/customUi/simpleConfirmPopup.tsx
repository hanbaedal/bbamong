interface SimpleConfirmPopupProps {
  message: string;
  leftButtonText: string;
  rightButtonText: string;
  onLeftClick: () => void;
  onRightClick: () => void;
}

export default function SimpleConfirmPopup({
  message,
  leftButtonText,
  rightButtonText,
  onLeftClick,
  onRightClick,
}: SimpleConfirmPopupProps) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-[#000000CC] z-[70]" />

      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-auto min-w-[280px] bg-[#2F2F2F] shadow-[0_8px_36px_rgba(0,0,0,0.16)] rounded-[8px] flex flex-col items-center p-[20px_20px_16px] gap-2 z-[75]">
        {/* 안내문 */}
        <div className="flex flex-col justify-center items-center gap-[10px] px-2">
          <p className="text-center text-[#E9E9E9] font-[Pretendard] font-normal text-[16px] leading-[140%] tracking-[-0.025em] whitespace-nowrap">
            {message}
          </p>
        </div>

        {/* 버튼 */}
        <div className="w-full flex flex-row justify-center items-center gap-2 px-2">
          <button
            data-testid="button-confirm-left"
            className="flex-1 h-[40px] bg-[#474747] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#E9E9E9] whitespace-nowrap"
            onClick={onLeftClick}
          >
            {leftButtonText}
          </button>
          <button
            data-testid="button-confirm-right"
            className="flex-1 h-[40px] bg-[#CCF501] active:bg-[#C8D48D] border border-[#CDFF00] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#111111] whitespace-nowrap"
            onClick={onRightClick}
          >
            {rightButtonText}
          </button>
        </div>
      </div>
    </>
  );
}
