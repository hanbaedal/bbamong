import { useState } from "react";

interface DonationPopupProps {
  onConfirm: (donationPercentage: number) => void;
}

export default function DonationPopup({ onConfirm }: DonationPopupProps) {
  const [selectedOption, setSelectedOption] = useState<"none" | "10">("none");

  const handleConfirm = () => {
    const percentage = selectedOption === "10" ? 10 : 0;
    onConfirm(percentage);
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-[#000000CC] z-[70]" />

      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[320px] bg-[#2F2F2F] rounded-lg z-[75] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#373539]">
          <h2 className="text-white text-base font-bold text-center">
            축하합니다. 예측에 성공하셨습니다.
          </h2>
          <p className="text-[#6B6B6B] text-xs text-center mt-2">
            포인트의 일부를 어려운 사람들에게
            <br />
            나눠주세요 감사합니다.
          </p>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          {/* 기부하지 않기 */}
          <button
            data-testid="donation-none"
            onClick={() => setSelectedOption("none")}
            className="w-full flex items-center justify-between p-3 bg-[#1A1A1A] rounded-lg border border-[#373539] hover:border-[#6B6B6B] transition-colors"
          >
            <span className="text-white text-sm">기부하지 않기</span>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedOption === "none"
                  ? "border-[#CDFF00]"
                  : "border-[#6B6B6B]"
              }`}
            >
              {selectedOption === "none" && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#CDFF00]"></div>
              )}
            </div>
          </button>

          {/* 10% 기부 */}
          <button
            data-testid="donation-10"
            onClick={() => setSelectedOption("10")}
            className="w-full flex items-center justify-between p-3 bg-[#1A1A1A] rounded-lg border border-[#373539] hover:border-[#6B6B6B] transition-colors"
          >
            <span className="text-white text-sm">10% 기부</span>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedOption === "10"
                  ? "border-[#CDFF00]"
                  : "border-[#6B6B6B]"
              }`}
            >
              {selectedOption === "10" && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#CDFF00]"></div>
              )}
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button
            data-testid="button-confirm-donation"
            onClick={handleConfirm}
            className="w-full h-12 bg-[#CDFF00] text-black rounded-lg font-bold active:bg-[#C8D48D] border border-[#CDFF00] transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </>
  );
}
