import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import BottomNavigation from "@/components/BottomNavigation";
import PageHeader from "@/components/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Popup from "@/components/customUi/infoPopup";
import { useUserAssets } from "@/contexts/UserAssetContext";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

export default function AttendancePage() {
  const [, setLocation] = useLocation();
  const { user, setUser, refetchUser, hasCheckedInToday, isGuest } = useUser();
  const { toast } = useToast();
  const [showAlreadyCheckedPopup, setShowAlreadyCheckedPopup] = useState(false);
  const { assets } = useUserAssets();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const daysOfWeek = ["월", "화", "수", "목", "금", "토", "일"];

  // 현재 날짜 정보
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  // 이번달 첫날의 요일 계산 (0=일요일, 1=월요일, ..., 6=토요일)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  // 월요일 시작 기준으로 변환 (0=월요일, 6=일요일)
  const firstDayOfMonth = firstDay === 0 ? 6 : firstDay - 1;

  // 이번달 총 일수
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 이전 달의 마지막 날짜
  const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();

  // 유저 포인트 (기본값 0)
  const userPoints = user?.points ?? 0;

  // UserContext에서 출석 기록 직접 사용 (API 호출 없이 즉시 표시)
  const attendanceRecords = user?.attendanceRecords ?? [];

  // UserContext에서 미리 계산된 오늘 출석 여부 사용 (렌더링 지연 없음)
  const hasCheckedIn = hasCheckedInToday;

  // 유저의 출석 기록에서 이번달 출석한 날짜들 추출
  const attendedDatesInMonth = new Set<number>();
  let totalAttendanceDays = 0;

  attendanceRecords.forEach((record) => {
    const recordDate = new Date(record.attendanceDate);
    totalAttendanceDays++;

    // 이번달 출석인지 확인
    if (
      recordDate.getFullYear() === currentYear &&
      recordDate.getMonth() === currentMonth
    ) {
      attendedDatesInMonth.add(recordDate.getDate());
    }
  });

  const monthDays = attendedDatesInMonth.size;

  // 출석 체크 Mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("사용자 정보가 없습니다.");
      const response = await apiRequest("POST", "/api/attendance/check-in", {
        userId: user.id,
      });
      return response.json() as Promise<{
        success: boolean;
        message: string;
        points: number;
      }>;
    },
    onSuccess: async (data) => {
      if (data.success && user) {
        // UserContext 업데이트 (포인트와 lastAttendanceDate)
        setUser({
          ...user,
          points: data.points,
          lastAttendanceDate: new Date().toISOString(),
        });

        // 최신 attendanceRecords 가져오기 (UserContext 갱신)
        await refetchUser();

        toast({
          title: "출석 체크 완료",
          description: "+100 참여기회가 적립되었습니다.",
        });
      }
    },
    onError: (error: any) => {
      const message = error.message || "출석 체크에 실패했습니다.";
      toast({
        title: "출석 체크 실패",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleCheckIn = () => {
    if (checkGuest()) return;
    checkInMutation.mutate();
  };

  const handleAlreadyCheckedClick = () => {
    if (checkGuest()) return;
    setShowAlreadyCheckedPopup(true);
  };

  return (
    <div className="h-app-screen bg-[#111111]">
      <PageHeader
        leftAction={
          <button
            data-testid="button-back"
            onClick={() => setLocation("/home")}
            className="p-1 focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
        rightAction={
          hasCheckedIn ? (
            <button
              data-testid="button-check-in-completed"
              onClick={handleAlreadyCheckedClick}
              className="flex flex-row justify-center items-center px-[10px] py-[10px] gap-[2px] w-[85px] h-[30px] bg-[#474747] rounded cursor-pointer"
            >
              <span className="text-white text-[12px] font-medium leading-[140%] tracking-[-0.025em] flex-none whitespace-nowrap">
                ✓ 출석 완료
              </span>
            </button>
          ) : (
            <button
              data-testid="button-check-in"
              onClick={handleCheckIn}
              disabled={checkInMutation.isPending}
              className="flex flex-row justify-center items-center gap-[2px] w-[85px] h-[30px] bg-[#E11936] rounded-[4px] pl-[6px] pr-[10px] py-[10px] hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-white text-[12px] font-medium leading-[140%] tracking-[-0.025em] text-center whitespace-nowrap">
                {checkInMutation.isPending ? "처리 중..." : "✓ 출석 체크"}
              </span>
            </button>
          )
        }
      />

      {/* 메인 컨텐츠 */}
      <div className="flex-1 px-5 pt-[10px] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">출석</h1>
        {/* 출석 현황 카드들 */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 mb-6">
          {/* 전체 출석 카드 */}
          <div className="relative w-full h-[137px] bg-[#1C1F20] rounded-[10px] overflow-hidden flex flex-col justify-between">
            {/* 붉은빛 그라데이션 블러 효과 */}
            <div className="absolute w-[223px] h-[223px] left-[-134px] top-[-183px] bg-[rgba(225,25,54,0.5)] blur-[50px] z-0" />

            {/* 상단 텍스트 */}
            <span className="absolute left-[16px] top-[20px] text-[#BFBFBF] text-[16px] font-medium leading-[140%] tracking-[-0.025em] z-10">
              전체 출석
            </span>

            {/* 하단 텍스트 */}
            <span className="absolute right-[15.5px] top-[83px] text-[#E9E9E9] text-[28px] font-bold leading-[140%] tracking-[-0.025em] text-right z-10">
              {totalAttendanceDays}일
            </span>
          </div>

          {/* 이번달 출석 카드 */}
          <div className="relative w-full h-[137px] bg-[#1C1F20] rounded-[10px] overflow-hidden">
            {/* 상단 텍스트 */}
            <span className="absolute left-[16px] top-[20px] text-[#BFBFBF] text-[16px] font-medium leading-[140%] tracking-[-0.025em] z-10">
              이번달 출석
            </span>

            {/* 하단 일수 텍스트 */}
            <span className="absolute right-[15.5px] top-[83px] text-[#E9E9E9] text-[28px] font-bold leading-[140%] tracking-[-0.025em] text-right z-10">
              {monthDays}일
            </span>

            {/* 왼쪽 이미지 (예시 이미지 경로 사용) */}
            <img
              src={assets.mascotImg} // 👈 실제 이미지로 교체
              alt="Mascot"
              className="absolute w-[86px] h-[90px] left-[-7.5px] top-[47px] object-contain z-0"
            />
          </div>

          {/* 보유 포인트 카드 */}
          <div className="relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#1C1F20] shadow-lg col-span-2 h-[65px] overflow-hidden">
            <span className="text-[#D5D5D5] text-sm font-medium">
              보유 참여기록
            </span>
            <span className="text-white text-2xl font-bold tracking-tight">
              {userPoints}
            </span>
          </div>
        </div>

        {/* 이번달 출석 현황 */}
        <div>
          <h2 className="text-white text-base font-bold mb-[14px]">
            이번달 출석 현황
          </h2>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="text-center text-[#6B6B6B] text-xs font-medium py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {/* 이전 달 날짜 (회색으로 표시) */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => {
              const prevMonthDate =
                prevMonthLastDate - (firstDayOfMonth - 1 - i);
              return (
                <div
                  key={`prev-${i}`}
                  className="aspect-square flex flex-col items-center justify-center relative"
                >
                  <span className="text-[#6B6B6B] text-sm">
                    {prevMonthDate}
                  </span>
                </div>
              );
            })}

            {/* 이번 달 날짜들 */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const date = i + 1;
              const isAttended = attendedDatesInMonth.has(date);

              return (
                <div
                  key={date}
                  data-testid={`date-${date}`}
                  className="aspect-square flex flex-col items-center justify-center relative"
                >
                  <span className="text-white text-sm">{date}</span>
                  {isAttended && (
                    <Check
                      className="w-3 h-3 text-red-500 absolute  bottom-0"
                      strokeWidth={3}
                      data-testid={`check-${date}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <BottomNavigation />

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {/* 출석 완료 확인 팝업 */}
      {showAlreadyCheckedPopup && (
        <Popup
          message="오늘의 출석체크를 완료하셨습니다."
          buttonText="확인"
          onConfirm={() => setShowAlreadyCheckedPopup(false)}
        />
      )}
    </div>
  );
}
