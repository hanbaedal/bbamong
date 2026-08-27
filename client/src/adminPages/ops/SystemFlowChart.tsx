import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FLOW_CROSS_LINKS, FLOW_SWIMLANES } from "@shared/systemManualsDetail";

export function downloadElementHtml(elementId: string, fileName: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-skip-download]").forEach((n) => n.remove());
  clone.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) img.setAttribute("src", new URL(src, window.location.origin).href);
  });
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${fileName.replace(/\.html$/, "")}</title>
  <style>
    body { font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; max-width: 960px; margin: 32px auto; padding: 0 20px; color: #1a1a1a; }
    h2, h3 { color: #111; }
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { border: 1px solid #dbe4f0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #eef4ff; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    .flow-col { border: 1px solid #e5e5e5; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
    ol { padding-left: 1.2rem; }
  </style>
</head>
<body>
${clone.innerHTML}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SectionDownloadButton({
  elementId,
  fileName,
  testId,
}: {
  elementId: string;
  fileName: string;
  testId: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      data-skip-download
      data-testid={testId}
      onClick={() => downloadElementHtml(elementId, fileName)}
    >
      <Download className="mr-1.5 h-4 w-4" />
      이 장 HTML 다운로드
    </Button>
  );
}

export default function SystemFlowChart() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-4" data-testid="system-flow-swimlanes">
        {FLOW_SWIMLANES.map((lane) => (
          <div
            key={lane.id}
            className="flow-col rounded-xl border bg-white p-4 shadow-sm"
            style={{ borderTopWidth: 4, borderTopColor: lane.color }}
          >
            <p className="text-sm font-bold" style={{ color: lane.color }}>
              {lane.title}
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-[#333]">
              {lane.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <svg
        viewBox="0 0 960 340"
        className="w-full overflow-visible rounded-xl border border-[#E0E7F5] bg-[#F7FAFF]"
        role="img"
        aria-label="관리자 실황 ON에서 운영자 타석, 사용자 예측, 쇼핑몰이 갈라지는 흐름"
        data-testid="system-flow-svg"
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#1A6DFF" />
          </marker>
        </defs>
        <text x="120" y="22" textAnchor="middle" fill="#1A6DFF" fontSize="12" fontWeight="700">
          관리자
        </text>
        <text x="360" y="22" textAnchor="middle" fill="#C05621" fontSize="12" fontWeight="700">
          운영자
        </text>
        <text x="600" y="22" textAnchor="middle" fill="#00897B" fontSize="12" fontWeight="700">
          사용자
        </text>
        <text x="840" y="22" textAnchor="middle" fill="#6D28D9" fontSize="12" fontWeight="700">
          쇼핑몰
        </text>

        <rect x="20" y="36" width="200" height="44" rx="10" fill="#1A6DFF" />
        <text x="120" y="63" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          경기 등록 · 선발명단
        </text>
        <rect x="20" y="92" width="200" height="44" rx="10" fill="#1558D6" />
        <text x="120" y="119" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          실황 ON (1경기)
        </text>

        <line x1="220" y1="114" x2="300" y2="114" stroke="#1A6DFF" strokeWidth="2" markerEnd="url(#arrow)" />

        <rect x="260" y="36" width="200" height="44" rx="10" fill="#C05621" />
        <text x="360" y="63" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          하이브리드 타석
        </text>
        <rect x="260" y="92" width="200" height="44" rx="10" fill="#9A3412" />
        <text x="360" y="119" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          예측 8초 · 결과 확정
        </text>
        <rect x="260" y="148" width="200" height="44" rx="10" fill="#FFF4E8" stroke="#C05621" />
        <text x="360" y="175" textAnchor="middle" fill="#C05621" fontSize="13" fontWeight="700">
          공수·투수 → 광고 80초
        </text>

        <line x1="460" y1="114" x2="540" y2="114" stroke="#1A6DFF" strokeWidth="2" markerEnd="url(#arrow)" />

        <rect x="500" y="36" width="200" height="44" rx="10" fill="#00897B" />
        <text x="600" y="63" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          실황 ON 경기 선택
        </text>
        <rect x="500" y="92" width="200" height="44" rx="10" fill="#047857" />
        <text x="600" y="119" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          대기 → 3D 선택 → 주루
        </text>
        <rect x="500" y="148" width="200" height="44" rx="10" fill="#ECFDF5" stroke="#047857" />
        <text x="600" y="175" textAnchor="middle" fill="#047857" fontSize="13" fontWeight="700">
          포인트 정산 · 사이드벳
        </text>

        <line x1="700" y1="58" x2="780" y2="58" stroke="#6D28D9" strokeWidth="2" markerEnd="url(#arrow)" />

        <rect x="740" y="36" width="200" height="44" rx="10" fill="#6D28D9" />
        <text x="840" y="63" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          정회원 현금 주문
        </text>
        <rect x="740" y="92" width="200" height="44" rx="10" fill="#5B21B6" />
        <text x="840" y="119" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
          관리자 재고 · 발송
        </text>

        <rect x="20" y="220" width="920" height="96" rx="12" fill="white" stroke="#DCE8FF" />
        <text x="480" y="250" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="700">
          Express :5000  ·  MongoDB ppamong  ·  Redis 세션  ·  /ws/match
        </text>
        <text x="480" y="274" textAnchor="middle" fill="#64748B" fontSize="12">
          점수·이닝·로고 = 다음 스포츠    주자·B-S·OUT·타자·구종 = 네이버    API-SPORTS 키 없음
        </text>
        <text x="480" y="298" textAnchor="middle" fill="#64748B" fontSize="12">
          게임 포인트 ≠ 몰 결제. 실황 ON인 경기만 회원이 고릅니다.
        </text>
      </svg>

      <ul className="space-y-1 text-sm text-[#555]">
        {FLOW_CROSS_LINKS.map((line) => (
          <li key={line}>· {line}</li>
        ))}
      </ul>
    </div>
  );
}
