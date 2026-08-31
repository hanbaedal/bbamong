import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";

export interface ManagerGuideStep {
  title: string;
  summary: string;
  bullets: string[];
}

export const MANAGER_GUIDE_STEPS: ManagerGuideStep[] = [
  {
    title: "로그인 · 한 기기",
    summary: "관리자가 발급한 링크로 로그인합니다.",
    bullets: [
      "동시에 한 기기에서만 로그인 가능",
      "다른 곳에서 이미 로그인 중이면 거부",
      "네트워크가 끊기면 재로그인하지 말고 재연결",
      "다른 기기로 바꾸려면 예전 기기에서 먼저 로그아웃",
      "홈에 오늘 배정된 경기만 표시",
    ],
  },
  {
    title: "배정 경기 입장",
    summary: "홈에서 오늘의 경기를 선택해 입장합니다.",
    bullets: [
      "「입장 가능」인 경기만 선택",
      "경기 전·경기 중에 운영 가능",
      "처음부터 있는 것이 원칙. 중간 입장도 됨",
      "중간 합류 시 화면에 켜진 다음 버튼만 누름",
      "실황이 켜진 경기만 회원 게임 연동",
    ],
  },
  {
    title: "스코어보드 확인",
    summary: "상단 스코어·이닝을 중계와 맞춰 확인합니다.",
    bullets: [
      "다음 스포츠 이닝·점수 자동 표시",
      "연동이 없으면 자동 종료·점수 미반영",
      "비상 수동 모드 시 빨간 안내 표시",
    ],
  },
  {
    title: "예측 시작",
    summary: "타자가 타석에 들어가기 전 「예측 시작」을 누릅니다.",
    bullets: [
      "경기 중(ongoing)일 때만 가능",
      "회원 앱에 타석 예측 화면 오픈",
      "시작 후 약 10초 내 취소 가능",
    ],
  },
  {
    title: "예측 중지",
    summary: "타석 결과 직전 「예측 중지」로 배팅을 마감합니다.",
    bullets: [
      "중지 전에는 결과 입력 불가",
      "중지 후 약 10초 내 취소 가능",
      "회원 배팅 마감",
    ],
  },
  {
    title: "결과 입력",
    summary: "실제 타석 결과를 선택해 전송합니다.",
    bullets: [
      "아웃 · 1루 · 2루 · 3루 · 홈런",
      "적중 회원에게 금액 × 고정배당 지급",
      "전송 후 자동 진행 없음 — 「다음 타자」또는 「공수교대」를 직접 누름",
    ],
  },
  {
    title: "다음 타자 · 교체 · 공수",
    summary: "하단 버튼으로 타석·이닝을 진행합니다.",
    bullets: [
      "「다음 타자」— 결과 전송 후 직접 클릭 (자동 없음)",
      "「공수 교대」— 3아웃 시 직접 클릭 (자동 없음)",
      "「투수 교체」— 3아웃 전 교체 · 광고 시작",
    ],
  },
  {
    title: "광고 · 종료 · 비상",
    summary: "이닝 전환·종료·수동 모드를 처리합니다.",
    bullets: [
      "「투수 교체」「공수 교대」→ 사용자 전면 광고 시작",
      "「예측 시작」또는 하단「광고 종료」→ 광고 중지",
      "API 경기 종료(FT) 시 자동 완료 / API 불안정 시 관리자 수동 제어",
    ],
  },
];

interface ManagerGuideModalProps {
  open: boolean;
  onClose: () => void;
  onOpenSimulation?: () => void;
}

export default function ManagerGuideModal({
  open,
  onClose,
  onOpenSimulation,
}: ManagerGuideModalProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const step = MANAGER_GUIDE_STEPS[stepIndex]!;
  const total = MANAGER_GUIDE_STEPS.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const progress = ((stepIndex + 1) / total) * 100;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      data-testid="manager-guide-modal-overlay"
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-guide-title"
        data-testid="manager-guide-modal"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#1A6DFF]">
              {stepIndex + 1} / {total}
            </p>
            <h2 id="manager-guide-title" className="truncate text-[16px] font-bold text-gray-900">
              운영자 사용 설명
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
            data-testid="button-guide-close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="h-1 shrink-0 bg-gray-100">
          <div
            className="h-full bg-[#1A6DFF] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#1A6DFF]/10 text-[18px] font-bold text-[#1A6DFF]">
            {stepIndex + 1}
          </div>
          <h3 className="text-[18px] font-bold leading-snug text-gray-900">{step.title}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-gray-600">{step.summary}</p>
          <ul className="mt-4 space-y-2">
            {step.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex gap-2 text-[13px] leading-relaxed text-gray-700 before:mt-[7px] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-[#1A6DFF] before:content-['']"
              >
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        <footer className="shrink-0 space-y-2 border-t border-gray-100 px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="min-h-[44px] flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-40"
              data-testid="button-guide-prev"
            >
              이전
            </button>
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))}
                className="min-h-[44px] flex-1 rounded-lg bg-[#1A6DFF] text-sm font-semibold text-white"
                data-testid="button-guide-next"
              >
                다음
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] flex-1 rounded-lg bg-[#1A6DFF] text-sm font-semibold text-white"
                data-testid="button-guide-done"
              >
                확인
              </button>
            )}
          </div>
          {isLast && onOpenSimulation ? (
            <button
              type="button"
              onClick={onOpenSimulation}
              className="min-h-[44px] w-full rounded-lg border border-[#1A6DFF]/40 bg-[#1A6DFF]/5 text-sm font-semibold text-[#1A6DFF]"
              data-testid="button-guide-simulation"
            >
              시뮬레이션으로 연습하기
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

/** /manager/guide 라우트 — 모달만 띄우고 닫으면 홈 */
export function ManagerGuideRoute() {
  const [, setLocation] = useLocation();

  return (
    <ManagerGuideModal
      open
      onClose={() => setLocation("/manager/home")}
      onOpenSimulation={() => setLocation("/manager/simulation")}
    />
  );
}
