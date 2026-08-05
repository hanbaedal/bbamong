import { PREDICTION_ODDS, BET_AMOUNT_OPTIONS, AD_REWARD_POINTS, SIDE_BET_AMOUNT_OPTIONS, WINNER_ODDS, EXACT_SCORE_ODDS } from "@shared/predictionOdds";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "앱 시작·로그인",
    items: [
      "앱을 완전히 종료했다가 다시 열면, 저장된 로그인(세션)을 확인합니다.",
      "세션이 있으면 인트로 없이 바로 홈으로 이동합니다.",
      "세션이 없으면 환영 인트로(약 3.5초) 후 로그인 화면이 나옵니다. 로그인 화면 왼쪽에 이용 안내(15세·재화)가 표시됩니다.",
      "로그인: 회원 아이디·비밀번호, 소셜(카카오·구글·애플), 또는 게스트로 시작할 수 있습니다.",
      "다른 앱을 보다가 돌아올 때(백그라운드 복귀)는 로그인 화면 없이 마지막 화면을 이어갑니다.",
    ],
  },
  {
    title: "홈 화면",
    items: [
      "가로 화면 기준으로 왼쪽·오른쪽 두 영역으로 나뉩니다.",
      "왼쪽: 빠몽이 캐릭터(탭 가능)와 그 아래 「게임하러가기」 등 참여 버튼 — 둘 다 예측 게임으로 이동합니다.",
      "오른쪽: 인사말과 메뉴 — 「야구 예측 게임이란?」, 「사용 설명서」, 「공지사항」, 「문의하기」, 「게시판」, 「빠몽이 선물상자」 등",
      "공지·문의·게시판·게임 소개는 왼쪽 패널 모달에서 열립니다.",
      "홈 화면에는 하단 메뉴가 없습니다.",
    ],
  },
  {
    title: "예측 화면 진입",
    items: [
      "홈 왼쪽의 빠몽이 또는 「게임하러가기」로 예측 화면(/prediction)에 들어갑니다.",
      "경기 시작 1분 전 이전(또는 타석 참여 가능 시간이 아닐 때)에는 「오늘의 경기」 모달이 자동으로 열립니다.",
      "모달에는 DB에 등록된 오늘 경기(최대 5경기)가 모두 표시됩니다.",
      "경기가 시작되어 타석 예측이 가능한 시간대에는 모달이 자동으로 뜨지 않습니다.",
    ],
  },
  {
    title: "예측 게임 (타석)",
    items: [
      "타석 예측은 경기 시작 1분 전부터 종료 전까지 가능합니다.",
      "상단에서 경기·경기장을 바꿀 수 있습니다(참여 가능한 경기만).",
      "운영자가 예측을 시작하면 아웃·1루·2루·3루·홈런 중 하나를 고릅니다.",
      "배팅 포인트(50~1000)를 선택한 뒤 확인하면 즉시 차감됩니다.",
      "적중 시 선택금액 × 고정배당이 지급되고, 미적중 시 배팅분은 소멸합니다.",
      "같은 라운드에서는 결과 확정 전까지 선택만 바꿀 수 있습니다(추가 차감 없음).",
    ],
  },
  {
    title: "승리팀 · 최종 스코어",
    items: [
      "「오늘의 경기」 모달에서 경기마다 「우승팀 맞추기」「점수 맞추기」 버튼으로 배팅합니다.",
      "버튼이 활성(클릭 가능)인 경기만 배팅할 수 있습니다 — 관리자 「API 폴링 ON/OFF」와 같은 기준입니다.",
      "예: 테스트 중 op1만 ON이면 1경기만 버튼 활성, 나머지 2~5경기는 비활성(회색)입니다.",
      "팀 표시는 「홈팀」「원정팀」만 사용합니다 (구단명은 표시하지 않음).",
      `배팅 금액: ${SIDE_BET_AMOUNT_OPTIONS.join(", ")}P`,
      `승리팀 맞추기: ${WINNER_ODDS}배 (100P → ${100 * WINNER_ODDS}P)`,
      `최종 스코어 정확히: ${EXACT_SCORE_ODDS}배 (100P → ${100 * EXACT_SCORE_ODDS}P)`,
      "1회 시작 시 자동 마감 — 이후 신규·변경 불가 (마감된 경기는 버튼 비활성)",
      "경기 종료 후 API 최종 스코어로 자동 정산 · 모달에 적중/미적중/환불 표시",
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
    title: "예측 화면 메뉴",
    items: [
      "왼쪽 세로 메뉴에서 「내 이야기」「내 정보」를 열 수 있습니다.",
      "내 이야기: 승리현황, 친구 초대, 출석 체크, 나의 콘텐츠, 사회공헌 참여현황",
      "내 정보: 회원정보, 추가 참여, Q&A, 서비스 이용약관, 탈퇴하기",
    ],
  },
  {
    title: "헤더·기타",
    items: [
      "가운데 로고: 홈으로 이동",
      "우측 「기념품」: 빠몽이 선물상자(쇼핑)로 이동",
      "홈 우측 상단: 로그아웃",
      "공수교대 시 전면/보상 광고가 나올 수 있습니다. 끝까지 보면 보상 "
        + `${AD_REWARD_POINTS}P, 너무 일찍 취소하면 보상 없음.`,
      "타자 교체 시 하단에 배너 광고가 표시될 수 있습니다.",
    ],
  },
  {
    title: "연습 팁",
    items: [
      "게임 규칙·소개는 홈의 「야구 예측 게임이란?」에서 확인하세요.",
      "「게임 시뮬레이션」에서 오늘 5경기 목록·사이드 배팅·타석·정산 흐름을 연습하세요.",
      "시뮬레이션은 연습용이며 보유 포인트에 영향이 없습니다.",
      `타석 선택 금액: ${BET_AMOUNT_OPTIONS.join(", ")}P · 사이드: ${SIDE_BET_AMOUNT_OPTIONS.join(", ")}P`,
    ],
  },
];

interface UserGuideContentProps {
  onGoSimulation: () => void;
  onGoPrediction: () => void;
  showActions?: boolean;
}

export default function UserGuideContent({
  onGoSimulation,
  onGoPrediction,
  showActions = true,
}: UserGuideContentProps) {
  return (
    <div className="user-guide-content">
      <p className="user-guide-content-intro">
        빠몽이 앱 사용법·메뉴·게임 흐름을 안내합니다. 게임 소개는 「야구 예측 게임이란?」을 참고하세요.
      </p>

      {SECTIONS.map((section) => (
        <section key={section.title} className="user-guide-content-section">
          <h3 className="user-guide-content-section-title">{section.title}</h3>
          <ul className="user-guide-content-list">
            {section.items.map((item) => (
              <li key={item} className="user-guide-content-item">
                <span className="user-guide-content-bullet" aria-hidden>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {showActions ? (
        <div className="user-guide-content-actions">
          <button
            type="button"
            onClick={onGoSimulation}
            className="user-guide-content-btn user-guide-content-btn--primary"
            data-testid="button-guide-to-sim"
          >
            게임 시뮬레이션 연습하기
          </button>
          <button
            type="button"
            onClick={onGoPrediction}
            className="user-guide-content-btn user-guide-content-btn--secondary"
          >
            실제 경기 참여하기
          </button>
        </div>
      ) : null}
    </div>
  );
}
