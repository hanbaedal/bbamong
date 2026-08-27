import {
  Activity,
  BookOpen,
  Clapperboard,
  Database,
  GitBranch,
  ListChecks,
  Megaphone,
  Radio,
  Store,
  Timer,
  Wrench,
} from "lucide-react";
import sceneBefore from "@assets/game/scene-before.jpg";
import sceneWaitHome from "@assets/game/scene-wait-home.jpg";
import sceneWaitAway from "@assets/game/scene-wait-away.jpg";
import fieldStadium from "@assets/game/game-stadium-field.jpg";
import scenePitchHome from "@assets/game/scene-pitch-home.jpg";
import scenePitchAway from "@assets/game/scene-pitch-away.jpg";
import sceneRunning from "@assets/game/scene-running.jpg";
import {
  ADMIN_DAILY_CHECKLIST,
  ADMIN_MENU_MAP,
  AD_RULE_ROWS,
  AT_BAT_GUARDS,
  AT_BAT_MACHINE_STEPS,
  BET_AMOUNT_FACT,
  LIVE_SOURCE_TABLE,
  MALL_POLICY_BULLETS,
  MATCH_STATUS_RULES,
  OPERATOR_EXCEPTION_STEPS,
  PREDICTION_ODDS_TABLE,
  PREDICTION_SCREEN_FLOW,
  PREDICTION_SCREEN_FLOW_NOTES,
  ROLE_SUMMARIES,
  SYSTEM_OPS_HANDBOOK_UPDATED,
  TIMING_FACTS,
  type HandbookTable,
} from "@shared/systemOpsHandbook";
import {
  LIVE_SCOREBOARD_FIELDS,
  MONGO_CATALOG_UPDATED,
  MONGO_CLUSTER,
  MONGO_COLLECTIONS,
} from "@shared/mongoCatalog";
import {
  MANUAL_DETAIL_UPDATED,
  OPERATOR_RULES,
  OPERATOR_TECH_STACK,
  OPERATOR_USER_STEPS,
  USER_TECH_STACK,
  USER_USER_EXTRA,
  USER_USER_STEPS,
} from "@shared/systemManualsDetail";
import SystemFlowChart, { SectionDownloadButton } from "./SystemFlowChart";

function HandbookTableView({ table, testId }: { table: HandbookTable; testId: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E0E7F5] bg-white">
      <table className="w-full min-w-[560px] text-left text-sm" data-testid={testId}>
        <thead className="bg-[#EEF4FF] text-[#334]">
          <tr>
            {table.headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={`${row[0]}-${i}`} className="border-t border-[#EEF2F8] align-top">
              {row.map((cell, ci) => (
                <td
                  key={`${i}-${ci}`}
                  className={`px-3 py-2 ${ci === 0 ? "font-medium text-[#1A1A1A]" : "text-[#444]"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SCENE_IMAGES = [
  { src: sceneBefore, label: "1 경기전 — 쿠어스 전경", step: 1 },
  { src: sceneWaitHome, label: "2 대기(말) — 흰 유니폼 시네마틱", step: 2 },
  { src: sceneWaitAway, label: "2 대기(초) — 청 유니폼 시네마틱", step: 2 },
  { src: fieldStadium, label: "3 예측 선택 — 3D 구장만", step: 3 },
  { src: scenePitchHome, label: "4·5 결과 대기·글씨 — 투수(말)", step: 4 },
  { src: scenePitchAway, label: "4·5 결과 대기·글씨 — 투수(초)", step: 4 },
  { src: sceneRunning, label: "6 주루(적중) — 필리스 실사", step: 6 },
] as const;

const TOC = [
  { href: "#ops-flow", label: "1. 전체 흐름도" },
  { href: "#ops-operator", label: "2. 운영자 설명서" },
  { href: "#ops-user", label: "3. 사용자 설명서" },
  { href: "#ops-db", label: "4. DB 구조" },
  { href: "#ops-summary", label: "운영 요약" },
  { href: "#ops-live", label: "실황 소스" },
  { href: "#ops-screen", label: "예측 화면" },
  { href: "#ops-atbat", label: "타석 머신" },
  { href: "#ops-ads", label: "광고·배당" },
  { href: "#ops-admin", label: "관리자 일일" },
  { href: "#ops-files", label: "설명서 파일" },
] as const;

function SectionHead({
  id,
  icon: Icon,
  title,
  kicker,
  downloadName,
}: {
  id: string;
  icon: typeof GitBranch;
  title: string;
  kicker?: string;
  downloadName: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Icon className="h-5 w-5 text-[#1A6DFF]" />
      <h2 className="text-lg font-semibold text-[#1A1A1A]">{title}</h2>
      {kicker ? (
        <span className="rounded bg-[#EEF4FF] px-2 py-0.5 text-[11px] font-medium text-[#1A6DFF]">
          {kicker}
        </span>
      ) : null}
      <span className="ml-auto">
        <SectionDownloadButton elementId={id} fileName={downloadName} testId={`download-${id}`} />
      </span>
    </div>
  );
}

export default function SystemManualsHandbook() {
  return (
    <div className="space-y-8" data-testid="system-manuals-handbook">
      <nav
        className="flex flex-wrap gap-2"
        aria-label="매뉴얼 목차"
        data-testid="system-manuals-toc"
      >
        {TOC.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-[#DCE8FF] bg-white px-3 py-1 text-xs font-medium text-[#1A6DFF] hover:bg-[#EEF4FF]"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <section id="ops-flow" className="scroll-mt-4" data-testid="section-ops-flow">
        <SectionHead
          id="ops-flow"
          icon={GitBranch}
          title="1. 전체 흐름도"
          kicker={MANUAL_DETAIL_UPDATED}
          downloadName="빠몽이_시스템_흐름.html"
        />
        <p className="mb-4 text-sm text-[#555]">
          관리자 · 운영자 · 사용자 · 쇼핑몰을 한 화면에서 봅니다. 예측 게임과 쇼핑몰은 같은 회원
          계정을 쓰지만 결제는 분리됩니다.
        </p>
        <SystemFlowChart />
      </section>

      <section
        id="ops-operator"
        className="scroll-mt-4 rounded-xl border border-[#FFE8D6] bg-[#FFFDFB] p-4 sm:p-5"
        data-testid="section-ops-operator"
      >
        <SectionHead
          id="ops-operator"
          icon={Wrench}
          title="2. 운영자 설명서"
          kicker="user + technical"
          downloadName="빠몽이_운영자_설명서.html"
        />

        <h3 className="mt-2 text-base font-semibold text-[#C05621]">2.1 사용 설명서 (규칙)</h3>
        <p className="mt-1 mb-3 text-sm text-[#555]">
          하이브리드만 사용합니다. 실황이 타석을 돌리고, 운영자 버튼이 먼저면 그게 우선입니다.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {OPERATOR_USER_STEPS.map((step) => (
            <div key={step.title} className="rounded-lg border border-[#F3D5B5] bg-white p-3">
              <p className="text-sm font-semibold text-[#1A1A1A]">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#444]">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#E0E7F5] bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[#FFF4E8] text-[#334]">
              <tr>
                <th className="px-3 py-2">규칙</th>
              </tr>
            </thead>
            <tbody>
              {OPERATOR_RULES.map((rule) => (
                <tr key={rule} className="border-t border-[#F3E6D8]">
                  <td className="px-3 py-2 text-[#444]">{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#888]">
          회원 화면은 아래 사용자 설명서와 같습니다. 운영자가 예측을 열면 3D 구장, 닫으면 투수
          시네마틱, 적중하면 주루 실사입니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCENE_IMAGES.filter((s) => s.step === 3 || s.step === 4 || s.step === 6).map((img) => (
            <figure key={img.label} className="overflow-hidden rounded-lg border bg-white">
              <img src={img.src} alt={img.label} className="h-28 w-full object-cover" />
              <figcaption className="px-2 py-1 text-[11px] text-[#555]">{img.label}</figcaption>
            </figure>
          ))}
        </div>

        <h3 className="mt-6 text-base font-semibold text-[#C05621]">2.2 기술 설명서</h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-[#E0E7F5] bg-white">
          <table className="w-full min-w-[560px] text-left text-sm" data-testid="operator-tech-table">
            <thead className="bg-[#EEF4FF]">
              <tr>
                <th className="px-3 py-2 w-32">항목</th>
                <th className="px-3 py-2">내용</th>
              </tr>
            </thead>
            <tbody>
              {OPERATOR_TECH_STACK.map((row) => (
                <tr key={row.label} className="border-t border-[#EEF2F8] align-top">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 text-[#444]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-[#555]">
          {OPERATOR_EXCEPTION_STEPS.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </section>

      <section
        id="ops-user"
        className="scroll-mt-4 rounded-xl border border-[#D1FAE5] bg-[#F7FFFB] p-4 sm:p-5"
        data-testid="section-ops-user"
      >
        <SectionHead
          id="ops-user"
          icon={BookOpen}
          title="3. 사용자 설명서"
          kicker="user + technical"
          downloadName="빠몽이_사용자_설명서.html"
        />

        <h3 className="mt-2 text-base font-semibold text-[#047857]">3.1 사용 설명서 (단계)</h3>
        <p className="mt-1 mb-3 text-sm text-[#555]">
          홈 「예측게임 하러가기」→ 실황 ON 경기 선택 → 사이드벳(선택) → 타석 7단계.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCENE_IMAGES.map((img) => (
            <figure key={img.label} className="overflow-hidden rounded-lg border bg-white">
              <img src={img.src} alt={img.label} className="h-32 w-full object-cover" />
              <figcaption className="px-2 py-1 text-[11px] leading-snug text-[#555]">{img.label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#ECFDF5]">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">단계</th>
                <th className="px-3 py-2">배경</th>
                <th className="px-3 py-2">하는 일</th>
              </tr>
            </thead>
            <tbody>
              {USER_USER_STEPS.map((step) => (
                <tr key={step.order} className="border-t border-[#E6F6EE] align-top">
                  <td className="px-3 py-2 font-semibold text-[#047857]">{step.order}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{step.phase}</div>
                    <div className="text-xs text-[#888]">{step.title}</div>
                  </td>
                  <td className="px-3 py-2 text-[#444]">{step.background}</td>
                  <td className="px-3 py-2 text-[#444]">{step.whatHappens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-[#555]">
          {USER_USER_EXTRA.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>

        <h3 className="mt-6 text-base font-semibold text-[#047857]">3.2 기술 설명서</h3>
        <div className="mt-2 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[560px] text-left text-sm" data-testid="user-tech-table">
            <thead className="bg-[#ECFDF5]">
              <tr>
                <th className="px-3 py-2 w-32">항목</th>
                <th className="px-3 py-2">내용</th>
              </tr>
            </thead>
            <tbody>
              {USER_TECH_STACK.map((row) => (
                <tr key={row.label} className="border-t border-[#E6F6EE] align-top">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 text-[#444]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="ops-db"
        className="scroll-mt-4 rounded-xl border border-[#CCFBF1] bg-[#F8FFFE] p-4 sm:p-5"
        data-testid="section-ops-db"
      >
        <SectionHead
          id="ops-db"
          icon={Database}
          title="4. 빠몽이 DB 구조 설명서"
          kicker={MONGO_CATALOG_UPDATED}
          downloadName="빠몽이_DB구조_설명서.html"
        />
        <div className="rounded-lg border border-[#99F6E4] bg-white p-4 text-sm text-[#333]">
          <p>
            <span className="font-semibold">클러스터</span> {MONGO_CLUSTER.cluster}
          </p>
          <p className="mt-1">
            <span className="font-semibold">데이터베이스 이름</span>{" "}
            <code className="rounded bg-[#F1F5F9] px-1">{MONGO_CLUSTER.database}</code> (환경변수{" "}
            <code>{MONGO_CLUSTER.envDbName}</code>, 연결 URI는 <code>{MONGO_CLUSTER.envUri}</code>)
          </p>
          <p className="mt-2 text-[#555]">{MONGO_CLUSTER.note}</p>
          <p className="mt-2 text-[#555]">{MONGO_CLUSTER.redisNote}</p>
        </div>

        <h3 className="mt-5 text-base font-semibold">
          4.1 컬렉션 목록 ({MONGO_COLLECTIONS.length}개)
        </h3>
        <div className="mt-2 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="mongo-collection-index">
            <thead className="bg-[#CCFBF1]">
              <tr>
                <th className="px-3 py-2">영역</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">collection</th>
                <th className="px-3 py-2">역할</th>
              </tr>
            </thead>
            <tbody>
              {MONGO_COLLECTIONS.map((col) => (
                <tr key={col.model} className="border-t border-[#E6FFFA] align-top">
                  <td className="px-3 py-2">{col.area}</td>
                  <td className="px-3 py-2 font-medium">{col.model}</td>
                  <td className="px-3 py-2 font-mono text-xs">{col.collection}</td>
                  <td className="px-3 py-2 text-[#444]">{col.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#888]">
          Stadium의 컬렉션 이름은 stadiums가 아니라 <code>stadia</code> 입니다.
        </p>

        <h3 className="mt-5 text-base font-semibold">4.2 필드별 역할</h3>
        <div className="mt-2 space-y-4">
          {MONGO_COLLECTIONS.map((col) => (
            <details
              key={`${col.model}-fields`}
              className="rounded-lg border border-[#99F6E4] bg-white open:shadow-sm"
              open={col.model === "Match" || col.model === "Prediction" || col.model === "User"}
            >
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                {col.model}{" "}
                <span className="font-mono text-xs font-normal text-[#64748B]">({col.collection})</span>
              </summary>
              <p className="px-3 text-xs text-[#666]">{col.role}</p>
              <div className="overflow-x-auto p-2">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-[#F0FDFA]">
                    <tr>
                      <th className="px-2 py-1">field</th>
                      <th className="px-2 py-1">type</th>
                      <th className="px-2 py-1">역할·내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.fields.map((f) => (
                      <tr key={f.name} className="border-t border-[#E6FFFA] align-top">
                        <td className="px-2 py-1 font-mono text-xs">{f.name}</td>
                        <td className="px-2 py-1 text-xs text-[#64748B]">{f.type}</td>
                        <td className="px-2 py-1 text-[#333]">
                          {f.role}
                          {f.values ? <span className="text-[#888]"> ({f.values})</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {col.indexes?.length ? (
                <p className="px-3 pb-2 text-xs text-[#555]">인덱스: {col.indexes.join(" · ")}</p>
              ) : null}
              {col.notes?.map((n) => (
                <p key={n} className="px-3 pb-2 text-xs text-[#B45309]">
                  {n}
                </p>
              ))}
            </details>
          ))}
        </div>

        <h3 className="mt-5 text-base font-semibold">4.3 liveScoreboard (Match Mixed)</h3>
        <div className="mt-2 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-[#CCFBF1]">
              <tr>
                <th className="px-3 py-2">field</th>
                <th className="px-3 py-2">type</th>
                <th className="px-3 py-2">역할</th>
              </tr>
            </thead>
            <tbody>
              {LIVE_SCOREBOARD_FIELDS.map((f) => (
                <tr key={f.name} className="border-t border-[#E6FFFA] align-top">
                  <td className="px-3 py-2 font-mono text-xs">{f.name}</td>
                  <td className="px-3 py-2 text-xs">{f.type}</td>
                  <td className="px-3 py-2 text-[#444]">{f.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="ops-summary" className="scroll-mt-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#1A6DFF]" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">운영 한눈에</h2>
          <span className="rounded bg-[#EEF4FF] px-2 py-0.5 text-[11px] font-medium text-[#1A6DFF]">
            {SYSTEM_OPS_HANDBOOK_UPDATED}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_SUMMARIES.map((item) => (
            <div
              key={item.role}
              className="rounded-xl border border-[#E5E5E5] bg-white p-4"
              data-testid={`handbook-role-${item.role}`}
            >
              <p className="text-sm font-semibold text-[#1A6DFF]">{item.role}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#444]">{item.summary}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E0E7F5] bg-white">
          <table className="w-full min-w-[480px] text-left text-sm" data-testid="handbook-timing">
            <thead className="bg-[#F7FAFF] text-[#334]">
              <tr>
                <th className="px-3 py-2 font-semibold w-[180px]">
                  <span className="inline-flex items-center gap-1.5">
                    <Timer className="h-4 w-4" />
                    타이밍
                  </span>
                </th>
                <th className="px-3 py-2 font-semibold">기본값</th>
              </tr>
            </thead>
            <tbody>
              {TIMING_FACTS.map((row) => (
                <tr key={row.label} className="border-t border-[#EEF2F8] align-top">
                  <td className="px-3 py-2 font-medium text-[#1A1A1A]">{row.label}</td>
                  <td className="px-3 py-2 text-[#444]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#888]">
          배팅 금액·배당: {BET_AMOUNT_FACT}. 값은 코드 기본값이며 env로 일부 조정될 수 있습니다.
        </p>
      </section>

      <section id="ops-live" className="scroll-mt-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-5 w-5 text-[#1A6DFF]" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">실황 소스 (다음 vs 네이버)</h2>
        </div>
        <p className="mb-3 text-sm text-[#555]">
          같은 필드(점수 vs 주자)를 두 소스에서 섞지 않습니다. 운영자 리스트의 「실황 ON/OFF」는
          다음·네이버 + 회원 게임 연동입니다.
        </p>
        <HandbookTableView table={LIVE_SOURCE_TABLE} testId="handbook-live-sources" />
        <ul className="mt-3 space-y-1 text-xs text-[#666]">
          {MATCH_STATUS_RULES.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </section>

      <section
        id="ops-screen"
        className="scroll-mt-4 rounded-xl border border-[#DCE8FF] bg-[#F7FAFF] p-4 sm:p-5"
        data-testid="prediction-screen-flow"
      >
        <div className="mb-3 flex items-center gap-2">
          <Clapperboard className="h-5 w-5 text-[#1A6DFF]" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">예측 게임 화면 변화</h2>
          <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-[#1A6DFF] border border-[#DCE8FF]">
            경기전 → 예측 성공
          </span>
        </div>
        <p className="mb-3 text-sm text-[#555]">
          회원 앱 <span className="font-mono">/prediction</span> 한 타석 흐름입니다. 선택 화면(3D
          구장)과 주루(실사)는 좌표가 다릅니다. 실패·투수교체·공수교대는 3D 구장을 유지합니다.
        </p>
        <div className="overflow-x-auto rounded-lg border border-[#E0E7F5] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#EEF4FF] text-[#334]">
              <tr>
                <th className="px-3 py-2 font-semibold w-10">#</th>
                <th className="px-3 py-2 font-semibold">단계</th>
                <th className="px-3 py-2 font-semibold">배경</th>
                <th className="px-3 py-2 font-semibold">화면에서 하는 일</th>
              </tr>
            </thead>
            <tbody>
              {PREDICTION_SCREEN_FLOW.map((step) => (
                <tr key={step.order} className="border-t border-[#EEF2F8] align-top">
                  <td className="px-3 py-2 text-[#1A6DFF] font-semibold">{step.order}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#1A1A1A]">{step.phase}</div>
                    <div className="text-xs text-[#888]">{step.title}</div>
                  </td>
                  <td className="px-3 py-2 text-[#444]">{step.background}</td>
                  <td className="px-3 py-2 text-[#444]">{step.whatHappens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-[#666]">
          {PREDICTION_SCREEN_FLOW_NOTES.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </section>

      <section id="ops-atbat" className="scroll-mt-4">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[#1A6DFF]" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">타석 상태머신 · 운영자 예외</h2>
        </div>
        <p className="mb-3 text-sm text-[#555]">
          대기 → 예측열림 → 예측닫힘 → 결과확정 → 다음타자/공수교대. 하이브리드만 씁니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AT_BAT_MACHINE_STEPS.map((step) => (
            <div key={step.label} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <p className="text-sm font-semibold text-[#1A1A1A]">{step.label}</p>
              <p className="mt-1 text-sm text-[#555]">{step.value}</p>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-[#555]">
          {AT_BAT_GUARDS.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </section>

      <section id="ops-ads" className="scroll-mt-4">
        <div className="mb-3 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-[#1A6DFF]" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">광고 · 타석 배당</h2>
        </div>
        <HandbookTableView table={AD_RULE_ROWS} testId="handbook-ad-rules" />
        <div className="mt-4">
          <HandbookTableView table={PREDICTION_ODDS_TABLE} testId="handbook-odds" />
        </div>
      </section>

      <section id="ops-admin" className="scroll-mt-4">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[#00897B]" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">관리자 일일 체크 · 메뉴</h2>
        </div>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[#444]">
          {ADMIN_DAILY_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_MENU_MAP.map((block) => (
            <div key={block.section} className="rounded-xl border border-[#E5E5E5] bg-white p-4">
              <p className="text-sm font-semibold text-[#1A1A1A]">{block.section}</p>
              <ul className="mt-2 space-y-0.5 text-sm text-[#555]">
                {block.items.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A]">
            <Store className="h-4 w-4" />
            쇼핑몰 정책 요약
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#555]">
            {MALL_POLICY_BULLETS.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
