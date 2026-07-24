import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { PREDICTION_ODDS, BET_AMOUNT_OPTIONS, AD_REWARD_POINTS, SIDE_BET_AMOUNT_OPTIONS, WINNER_ODDS, EXACT_SCORE_ODDS } from "@shared/predictionOdds";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "예측 게임 (타석)",
    items: [
      "홈에서 「경기 참여하기」 또는 로고 옆이 아닌 참여 버튼으로 예측 화면에 들어갑니다.",
      "오늘 경기(1~5경기) 중 하나를 선택합니다.",
      "운영자가 예측을 시작하면 아웃·1루·2루·3루·홈런 중 하나를 고릅니다.",
      "배팅 포인트(50~1000)를 선택한 뒤 확인하면 즉시 차감됩니다.",
      "적중 시 선택금액 × 고정배당이 지급되고, 미적중 시 배팅분은 소멸합니다.",
      "같은 라운드에서는 결과 확정 전까지 선택만 바꿀 수 있습니다(추가 차감 없음).",
    ],
  },
  {
    title: "승리팀 · 최종 스코어",
    items: [
      "경기 선택 화면 상단(스코어보드 아래)에서 승리팀·최종 스코어를 별도로 배팅합니다.",
      "팀 표시는 「홈팀」「원정팀」만 사용합니다 (구단명은 표시하지 않음).",
      `배팅 금액: ${SIDE_BET_AMOUNT_OPTIONS.join(", ")}P (100P 단위만)`,
      `승리팀 맞추기: ${WINNER_ODDS}배 (100P → ${100 * WINNER_ODDS}P)`,
      `최종 스코어 정확히: ${EXACT_SCORE_ODDS}배 (100P → ${100 * EXACT_SCORE_ODDS}P)`,
      "1회 시작 시 자동 마감 — 이후 신규·변경 불가",
      "경기 종료 후 API 최종 스코어로 자동 정산",
      "경기 취소·무승부 시 해당 배팅은 환불",
    ],
  },
  {
    title: "배당표",
    items: Object.entries(PREDICTION_ODDS).map(
      ([k, v]) => `${k}: ${v}배 (예: 100P 적중 → ${Math.floor(100 * v)}P)`,
    ),
  },
  {
    title: "하단 메뉴",
    items: [
      "초대: 친구 초대 코드·초대 현황",
      "출석: 출석 체크 및 출석 보상",
      "게시: 회원 게시판 글 읽기·쓰기",
      "추가: 포인트 충전/참여 기회 관련 화면",
      "로그아웃: 계정에서 로그아웃",
    ],
  },
  {
    title: "헤더·기타",
    items: [
      "로고: 이 홈(설명·연습 허브)으로 이동",
      "쇼핑몰: 스포츠 몰(/shop)로 이동",
      "설정(톱니): 프로필, 고객센터, 공지, FAQ, 약관 등",
      "공수교대 시 전면/보상 광고가 나올 수 있습니다. 끝까지 보면 보상 "
        + `${AD_REWARD_POINTS}P, 너무 일찍 취소하면 보상 없음.`,
      "타자 교체 시 하단에 배너 광고가 표시될 수 있습니다.",
    ],
  },
  {
    title: "연습 팁",
    items: [
      "실제 배팅 전에 「게임 시뮬레이션」에서 금액·예측·정산 흐름을 연습하세요.",
      "시뮬레이션은 연습용이며 보유 포인트에 영향이 없습니다.",
      `선택 가능 금액: ${BET_AMOUNT_OPTIONS.join(", ")}P`,
    ],
  },
];

export default function UserGuidePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader
        title="사용 설명서"
        showSettings={false}
        leftAction={
          <button type="button" onClick={() => setLocation("/home")} className="p-1" data-testid="button-guide-back">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-scroll-touch px-5 pb-bottom-nav pt-4 space-y-4">
        <p className="text-[#AAAAAA] text-sm leading-relaxed">
          빠몽이 앱의 게임·메뉴·기타 기능을 한눈에 안내합니다.
        </p>

        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4"
          >
            <h2 className="text-white text-sm font-bold mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item} className="text-[#D5D5D5] text-[13px] leading-relaxed flex gap-2">
                  <span className="text-[#CDFF00] flex-shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <button
          type="button"
          onClick={() => setLocation("/home/simulation")}
          className="w-full py-3 bg-[#CDFF00] text-black font-bold rounded-lg"
          data-testid="button-guide-to-sim"
        >
          게임 시뮬레이션 연습하기
        </button>
        <button
          type="button"
          onClick={() => setLocation("/prediction")}
          className="w-full py-3 border border-[#373539] text-white font-semibold rounded-lg"
        >
          실제 경기 참여하기
        </button>
      </div>

      <BottomNavigation />
    </div>
  );
}
