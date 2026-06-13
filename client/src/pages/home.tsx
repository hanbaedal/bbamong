import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { assets } = useUserAssets();
  const [formattedDate, setFormattedDate] = useState("");

  useEffect(() => {
    const now = new Date();

    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short", // "화" 같은 요일 축약형
    };

    // ex) 2025. 6. 25. 화
    const localeDate = now.toLocaleDateString("ko-KR", options);
    // localeDate 예: "2025. 6. 25. 화"

    // "2025. 6. 25. 화" → "2025년 6월 25일 (화)" 변환
    const parts = localeDate.split(" ");
    // parts = ["2025.", "6.", "25.", "화"]
    const year = parts[0].replace(".", "년");
    const month = parts[1].replace(".", "월");
    const day = parts[2].replace(".", "일");
    const weekday = parts[3]; // "화"

    setFormattedDate(`${year} ${month} ${day} ${weekday}`);
  }, []);

  return (
    <div className="h-app-screen bg-[#111111]">
      <PageHeader title="" />

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 overflow-y-scroll-touch pb-bottom-nav">
        {/* 날짜 정보 */}
        <div className="text-center mb-4">
          <p className="text-white text-[14px] mb-1">{formattedDate}</p>
          <p className="text-[#6B6B6B] text-[20px]">
            {user ? `안녕하세요 ${user.name}님` : "안녕하세요"}
          </p>
        </div>

        {/* 마스코트 이미지 Placeholder */}
        <div className="w-[110px] h-[180px] mb-8 flex items-center justify-center">
          <img
            src={assets.mainLogo}
            alt=""
            className="w-[110px] h-[180px] object-contain"
            data-testid="icon-email"
          />
        </div>

        {/* 예측하기 버튼 */}
        <button
          data-testid="button-start-prediction"
          onClick={() => setLocation("/prediction")}
          className="w-auto max-w-[200px] h-auto px-5 py-2 bg-[#CDFF00] text-black font-bold rounded-[6px] hover:bg-[#CDFF00]/90 flex items-center justify-center gap-2"
        >
          <img
            src={assets.baseballLogo}
            alt=""
            className="w-4 h-4 object-contain"
            data-testid="icon-email"
          />
          경기 참여하기
        </button>
      </div>

      {/* 하단 네비게이션 */}
      <BottomNavigation />
    </div>
  );
}
