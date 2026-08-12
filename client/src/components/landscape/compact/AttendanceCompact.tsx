import { useState } from "react";
import { Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Popup from "@/components/customUi/infoPopup";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 게임 split 우측 — 한 화면에 요약·출석 버튼·달력 */
export default function AttendanceCompact() {
  const { user, setUser, refetchUser, hasCheckedInToday, isGuest } = useUser();
  const { toast } = useToast();
  const [showAlreadyCheckedPopup, setShowAlreadyCheckedPopup] = useState(false);
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const firstDayOfMonth = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
  const todayDate = now.getDate();

  const userPoints = user?.points ?? 0;
  const attendanceRecords = user?.attendanceRecords ?? [];
  const hasCheckedIn = hasCheckedInToday;
  /** 출석 1회당 보상 포인트 — 서버 attendanceStorage와 동일 */
  const ATTENDANCE_REWARD_POINTS = 100;

  const attendedDatesInMonth = new Set<number>();
  let totalAttendanceDays = 0;
  attendanceRecords.forEach((record) => {
    const recordDate = new Date(record.attendanceDate);
    totalAttendanceDays++;
    if (
      recordDate.getFullYear() === currentYear &&
      recordDate.getMonth() === currentMonth
    ) {
      attendedDatesInMonth.add(recordDate.getDate());
    }
  });
  const monthDays = attendedDatesInMonth.size;
  const participationPoints = totalAttendanceDays * ATTENDANCE_REWARD_POINTS;

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
        setUser({
          ...user,
          points: data.points,
          lastAttendanceDate: new Date().toISOString(),
        });
        await refetchUser();
        toast({
          title: "출석 체크 완료",
          description: "+100 참여기회가 적립되었습니다.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "출석 체크 실패",
        description: error.message || "출석 체크에 실패했습니다.",
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
    <div className="attendance-compact" data-testid="attendance-compact">
      <div className="attendance-compact__toolbar">
        <div className="attendance-compact__stats" data-testid="attendance-stats">
          <span>
            전체 <strong>{totalAttendanceDays}</strong>일
          </span>
          <span className="attendance-compact__sep" aria-hidden>
            ·
          </span>
          <span>
            이번달 <strong>{monthDays}</strong>일
          </span>
          <span className="attendance-compact__sep" aria-hidden>
            ·
          </span>
          <span>
            참여포인트 <strong>{participationPoints}</strong>
          </span>
          <span className="attendance-compact__sep" aria-hidden>
            ·
          </span>
          <span>
            보유포인트 <strong>{userPoints}</strong>
          </span>
        </div>
        {hasCheckedIn ? (
          <button
            type="button"
            data-testid="button-check-in-completed"
            onClick={handleAlreadyCheckedClick}
            className="attendance-compact__cta attendance-compact__cta--done"
          >
            ✓ 출석 완료
          </button>
        ) : (
          <button
            type="button"
            data-testid="button-check-in"
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending}
            className="attendance-compact__cta"
          >
            {checkInMutation.isPending ? "처리 중…" : "✓ 출석 체크"}
          </button>
        )}
      </div>

      <div className="attendance-compact__calendar">
        <h2 className="attendance-compact__cal-title">
          {currentYear}년 {currentMonth + 1}월 출석
        </h2>
        <div className="attendance-compact__weekdays">
          {DAYS.map((day) => (
            <div key={day} className="attendance-compact__weekday">
              {day}
            </div>
          ))}
        </div>
        <div className="attendance-compact__days">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => {
            const prevMonthDate = prevMonthLastDate - (firstDayOfMonth - 1 - i);
            return (
              <div key={`prev-${i}`} className="attendance-compact__day attendance-compact__day--muted">
                <span>{prevMonthDate}</span>
              </div>
            );
          })}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = i + 1;
            const isAttended = attendedDatesInMonth.has(date);
            const isToday = date === todayDate;
            return (
              <div
                key={date}
                data-testid={`date-${date}`}
                className={[
                  "attendance-compact__day",
                  isToday ? "attendance-compact__day--today" : "",
                  isAttended ? "attendance-compact__day--attended" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>{date}</span>
                {isAttended ? (
                  <Check
                    className="attendance-compact__check"
                    strokeWidth={3}
                    data-testid={`check-${date}`}
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {showAlreadyCheckedPopup ? (
        <Popup
          message="오늘의 출석체크를 완료하셨습니다."
          buttonText="확인"
          onConfirm={() => setShowAlreadyCheckedPopup(false)}
        />
      ) : null}
    </div>
  );
}
