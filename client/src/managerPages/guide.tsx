import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  {
    title: "1. 로그인·배정",
    body: "관리자가 발급한 운영자 계정·링크로 로그인합니다. 동시에 한 기기에서만 로그인할 수 있으며, 다른 곳에서 이미 로그인 중이면 거부됩니다. 홈에 오늘 배정된 경기(1~5경기)만 표시됩니다.",
  },
  {
    title: "2. 스코어보드 확인",
    body: "경기 상세 상단에 API-SPORTS 이닝·점수가 표시됩니다. 중계와 맞는지 확인하세요. 연결이 안 되어 있으면 점수 자동 표시·자동 종료가 동작하지 않습니다.",
  },
  {
    title: "3. 예측 시작",
    body: "타자가 타석에 들어가기 전 「예측 시작」을 누릅니다. 회원 앱에 예측 화면이 열립니다.",
  },
  {
    title: "4. 예측 중지",
    body: "타석 결과가 나오기 직전 「예측 중지」로 배팅을 마감합니다. 중지 전에는 결과를 넣을 수 없습니다.",
  },
  {
    title: "5. 결과 입력",
    body: "실제 타석 결과(아웃 / 1루 / 2루 / 3루 / 홈런)를 선택해 전송합니다. 적중 회원에게 금액×고정배당이 지급됩니다.",
  },
  {
    title: "6. 다음 라운드·광고",
    body: "결과 후 자동으로 다음 라운드로 갑니다. 공수교대/투수교체는 「다음 타자」 등으로 강제 진행할 수 있습니다. 이닝 변경 시 광고가 자동 제안될 수 있으며, 광고 시작/중지로 제어합니다.",
  },
  {
    title: "7. 비상 수동 모드",
    body: "API가 불안정하면 관리자가 「수동 제어 전환」을 켭니다. 자동 광고·자동 종료가 멈추고, 운영자가 중계를 보며 예측 종료·결과 정산을 강제로 이어갑니다.",
  },
  {
    title: "8. 경기 종료",
    body: "자동 모드에서는 API 경기 종료(FT 등) 시 방이 완료됩니다. 열린 라운드가 있으면 먼저 중지·결과 입력을 마치세요.",
  },
];

export default function ManagerGuidePage() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="h-[100dvh] bg-white flex flex-col overflow-hidden"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 44px)" }}
    >
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <button
          type="button"
          onClick={() => setLocation("/manager/home")}
          className="text-gray-700 min-h-[44px] px-2"
          data-testid="button-guide-back"
        >
          ← 홈
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900">운영자 사용 설명</h1>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-3">
        <p className="text-sm text-gray-600 leading-relaxed">
          실제 경기에 들어가기 전에 아래 순서를 숙지하세요. 버튼 연습은{" "}
          <button
            type="button"
            className="text-[#1A6DFF] font-semibold underline"
            onClick={() => setLocation("/manager/simulation")}
          >
            시뮬레이션
          </button>
          에서 할 수 있습니다. (실제 유저·포인트에 영향 없음)
        </p>

        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <h2 className="text-[15px] font-semibold text-gray-900 mb-2">{section.title}</h2>
            <p className="text-[14px] text-gray-700 leading-relaxed">{section.body}</p>
          </section>
        ))}

        <div className="pt-2 space-y-2">
          <Button
            className="w-full min-h-[48px] bg-[#1A6DFF] hover:bg-[#1558d6]"
            onClick={() => setLocation("/manager/simulation")}
            data-testid="button-go-simulation"
          >
            시뮬레이션으로 연습하기
          </Button>
          <Button
            variant="outline"
            className="w-full min-h-[48px]"
            onClick={() => setLocation("/manager/home")}
          >
            오늘의 경기로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}
