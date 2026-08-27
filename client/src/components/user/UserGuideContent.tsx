import {
  PREDICTION_ODDS,
  BET_AMOUNT_OPTIONS,
  AD_REWARD_POINTS,
  AD_EARLY_DISMISS_SECONDS,
  SIDE_BET_AMOUNT_OPTIONS,
  WINNER_ODDS,
  EXACT_SCORE_ODDS,
} from "@shared/predictionOdds";
import { AD_PLAY_SECONDS } from "@shared/adBreakTiming";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "앱 시작·로그인",
    items: [
      "앱을 완전히 종료했다가 다시 열면, 저장된 로그인(세션)을 확인합니다.",
      "세션이 있으면 인트로 없이 바로 홈으로 이동합니다.",
      "세션이 없으면 환영 인트로(빠몽이 타격, 「문자 중계보다 빠른 직감! 빠던나인과 함께 다음 타자의 운명을 예측하세요.」) 후 로그인 화면이 나옵니다. 로그인 화면 왼쪽에 이용 안내(15세·재화)가 표시됩니다.",
      "로그인: 회원 아이디·비밀번호, 소셜(카카오·구글·애플), 또는 게스트로 시작할 수 있습니다.",
      "한 계정은 한 기기에만 로그인됩니다. 다른 기기에서 이미 로그인 중이면 안내 메시지가 표시됩니다.",
      "다른 앱을 보다가 돌아올 때(백그라운드 복귀)는 로그인 화면 없이 마지막 화면을 이어갑니다.",
    ],
  },
  {
    title: "홈 화면",
    items: [
      "가로 화면 기준으로 왼쪽·오른쪽 두 영역으로 나뉩니다.",
      "왼쪽: 빠몽이 캐릭터(탭 가능)와 「예측게임 하러가기」 버튼 — 둘 다 예측 게임으로 이동합니다.",
      "오른쪽: 인사말과 메뉴 — 「야구 예측 게임이란?」, 「사용설명서」, 「공지사항」, 「문의하기」, 「게시판」, 「빠몽이 쇼핑센터」 등",
      "「야구 예측 게임이란?」은 왼쪽 패널에서, 「사용설명서」는 이 안내 창에서 열립니다.",
      "공지·문의·게시판은 각각 해당 화면으로 이동합니다.",
      "홈 화면에는 하단 메뉴가 없습니다.",
    ],
  },
  {
    title: "예측 화면 진입",
    items: [
      "홈 왼쪽의 빠몽이 또는 「예측게임 하러가기」로 예측 화면(/prediction)에 들어갑니다.",
      "경기 시작 5분 전 이전(또는 타석 참여 가능 시간이 아닐 때)에는 「경기 선택」 모달이 열립니다. 경기 선택 후 사이드 배팅이 가능하면 「오늘의 경기」 모달이 이어질 수 있습니다.",
      "모달에는 DB에 등록된 오늘 경기(최대 5경기)가 표시됩니다.",
      "경기가 시작되어 타석 예측이 가능한 시간대에는 모달이 자동으로 뜨지 않을 수 있습니다.",
      "상단 경기명(제 N경기)·경기장을 눌러 참여 가능한 경기·경기장을 바꿀 수 있습니다.",
    ],
  },
  {
    title: "예측 게임 (타석)",
    items: [
      "타석 예측은 경기 시작 5분 전부터 종료 전까지 가능합니다.",
      "예측이 열리면 아웃·1루·2루·3루·홈런 중 하나를 고릅니다. (실황 자동 또는 운영자 「예측 시작」)",
      "「1루」는 1루타·포볼·데드볼 등 1루 진루 결과를 포함합니다.",
      `배팅 포인트(${BET_AMOUNT_OPTIONS.join(", ")}P)를 선택한 뒤 확인하면 즉시 차감됩니다.`,
      "적중 시 선택금액 × 고정배당이 지급되고, 미적중 시 배팅분은 소멸합니다.",
      "화면 변화: 경기전(쿠어스 전경) → 대기(시네마틱 빠몽이, 초/말) → 예측 선택(3D 구장·베이스 버튼) → 결과 대기(시네마틱 투수) → 결과 큰 글씨(약 2.2초) → 적중 시 주루(필리스 실사).",
      "주루: 1루는 홈→1루, 2루는 홈→1→2, 3루는 홈→1→2→3, 홈런은 1·2·3루를 돌아 홈으로 옵니다. 중견으로는 가지 않습니다.",
      "선택 화면과 주루 화면의 베이스 위치는 다릅니다. 실패·투수교체·공수교대는 3D 구장을 유지합니다.",
      "타석 결과가 확정되면 적중/미적중 연출 후 다음 타석을 기다립니다. 축하 점프는 생략하고 바로 대기 또는 다음 예측입니다.",
      "투수 교체 등으로 진행 중이던 예측이 취소되면, 해당 배팅은 환불될 수 있습니다.",
      "경기 종료 시 약 10초 「경기종료」 안내가 표시된 뒤 홈으로 이동합니다.",
    ],
  },
  {
    title: "승리팀 · 최종 스코어",
    items: [
      "「오늘의 경기」 모달에서 경기마다 「우승팀 맞추기」「점수 맞추기」로 배팅합니다.",
      "버튼이 활성(클릭 가능)인 경기만 배팅할 수 있습니다.",
      "팀 표시는 「홈팀」「원정팀」만 사용합니다 (구단명은 표시하지 않음).",
      `배팅 금액: ${SIDE_BET_AMOUNT_OPTIONS.join(", ")}P`,
      `승리팀 맞추기: ${WINNER_ODDS}배 (100P → ${100 * WINNER_ODDS}P)`,
      `최종 스코어 정확히: ${EXACT_SCORE_ODDS}배 (100P → ${100 * EXACT_SCORE_ODDS}P)`,
      "1회 시작 시 자동 마감 — 이후 신규·변경 불가 (마감된 경기는 버튼 비활성)",
      "경기 종료 후 실황 최종 스코어로 자동 정산 · 모달에 적중/미적중/환불 표시",
      "경기 취소·무승부 시 해당 배팅은 환불",
    ],
  },
  {
    title: "배당표 (타석)",
    items: Object.entries(PREDICTION_ODDS).map(
      ([k, v]) => `${k}: ${v}배 (예: 100P 적중 → ${Math.floor(100 * v)}P)`,
    ),
  },
  {
    title: "광고·보상",
    items: [
      "공수교대·투수교체 때 리워드 동영상 광고가 나올 수 있습니다. 예측 게임 중 하단 배너 광고는 없습니다.",
      "앱: 광고 화면에 남은 초가 보이고, 80초가 끝나면 예측 화면으로 돌아갑니다. 웹·앱 모두 약 5초 후 왼쪽 위 「×」로 끌 수 있으나 보상은 없습니다.",
      `운영자가 광고를 중지하거나 약 ${AD_PLAY_SECONDS}초가 지나면 ${AD_REWARD_POINTS}P가 지급됩니다. 다음 타석 예측은 운영자가 「예측 시작」을 눌러야 열립니다.`,
      "「예측 시작」으로 광고가 중지되거나, 5초 만에 「×」로 끄면 보상은 없습니다.",
    ],
  },
  {
    title: "예측 화면 메뉴",
    items: [
      "왼쪽 세로 메뉴: 「홈」, 「내이야기」, 「쇼핑센터」, 「내정보」",
      "내이야기: 승리현황, 친구 초대, 출석 체크, 나의 콘텐츠, 사회공헌 참여현황",
      "내정보: 회원정보, 추가 참여, Q&A, 서비스 이용약관, 탈퇴하기",
      "「쇼핑센터」: 빠몽이 쇼핑센터로 이동합니다.",
    ],
  },
  {
    title: "헤더·기타",
    items: [
      "가운데 로고: 홈으로 이동",
      "홈 우측 상단: 로그아웃",
      "화면 하단에는 사이드 배팅(우승팀·점수) 요약이 표시될 수 있습니다.",
      "예측 화면 좌상단은 경기 진행 위젯입니다(이닝·점수는 다음 스포츠, 주자·볼카운트는 네이버). 공지사항은 설정에서만 봅니다.",
    ],
  },
  {
    title: "연습 팁",
    items: [
      "게임 소개는 홈의 「야구 예측 게임이란?」에서 확인하세요.",
      "「게임 시뮬레이션」에서 예측 화면·내이야기·내정보 안내와 사이드·타석·정산 흐름을 연습하세요. 왼쪽 단계 탭으로 건너뛸 수 있습니다.",
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
