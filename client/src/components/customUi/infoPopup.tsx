interface PopupProps {
  message: string;
  subMessage?: string;
  buttonText: string;
  onConfirm?: () => void;
}

export default function Popup({ message, subMessage, buttonText, onConfirm }: PopupProps) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-[#000000CC] z-[70]" onClick={onConfirm} />

      {/* Popup */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[266px] bg-[#2F2F2F] shadow-[0_8px_36px_rgba(0,0,0,0.16)] rounded-[8px] flex flex-col items-center p-[20px_20px_16px] gap-2 z-[75]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 안내문 */}
        <div className="w-[226px] flex flex-col justify-center items-center gap-1">
          <p className="text-center text-[#E9E9E9] font-[Pretendard] font-normal text-[16px] leading-[140%] tracking-[-0.025em]">
            {message}
          </p>
          {subMessage && (
            <p className="text-center text-[#E9E9E9] font-[Pretendard] font-normal text-[16px] leading-[140%] tracking-[-0.025em]">
              {subMessage}
            </p>
          )}
        </div>

        {/* 버튼 */}
        <div className="w-[226px] flex flex-row justify-center items-center gap-2">
          <button
            data-testid="button-info-confirm"
            className="w-[226px] min-h-[48px] bg-[#CCF501] active:bg-[#C8D48D] border border-[#CDFF00] rounded-[6px] flex justify-center items-center font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#111111]"
            onClick={onConfirm}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </>
  );
}
