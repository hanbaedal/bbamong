import {
  Activity,
  Clapperboard,
  ListChecks,
  Megaphone,
  Radio,
  Store,
  Timer,
} from "lucide-react";
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

const TOC = [
  { href: "#ops-summary", label: "운영 요약" },
  { href: "#ops-live", label: "실황 소스" },
  { href: "#ops-screen", label: "예측 화면" },
  { href: "#ops-atbat", label: "타석 머신" },
  { href: "#ops-ads", label: "광고·배당" },
  { href: "#ops-admin", label: "관리자 일일" },
  { href: "#ops-files", label: "설명서 파일" },
] as const;

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
        <div className="mt-4 rounded-xl border border-[#FFE8D6] bg-[#FFF8F2] p-4">
          <p className="text-sm font-semibold text-[#C05621]">운영자 예외 루프</p>
          <ul className="mt-2 space-y-1 text-sm text-[#555]">
            {OPERATOR_EXCEPTION_STEPS.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </div>
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
