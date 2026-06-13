interface SimpleInfoPopupProps {
  message: string;
  buttonText?: string;
  onClose: () => void;
}

export default function SimpleInfoPopup({
  message,
  buttonText = "확인",
  onClose,
}: SimpleInfoPopupProps) {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-[#000000CC] z-[70]" />

      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[266px] bg-[#2F2F2F] shadow-[0_8px_36px_rgba(0,0,0,0.16)] rounded-[8px] flex flex-col items-center p-[20px_20px_16px] gap-2 z-[75]">
        {/* 안내문 */}
        <div className="w-[226px] flex flex-col justify-center items-center gap-[10px]">
          <p className="text-center text-[#E9E9E9] font-[Pretendard] font-normal text-[16px] leading-[140%] tracking-[-0.025em] whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* 버튼 */}
        <div className="w-[226px] flex justify-center items-center">
          <button
            data-testid="button-info-confirm"
            className="w-full h-[40px] bg-[#CCF501] active:bg-[#C8D48D] border border-[#CDFF00] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#111111]"
            onClick={onClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </>
  );
}
