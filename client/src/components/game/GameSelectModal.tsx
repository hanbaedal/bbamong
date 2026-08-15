export interface GameSelectModalItem {
  id: string;
  label: string;
  sublabel?: string;
  /** 테이블 레이아웃 오른쪽 칸. 없으면 sublabel을 사용 */
  detail?: string;
  disabled?: boolean;
}

interface GameSelectModalProps {
  open: boolean;
  title: string;
  items: GameSelectModalItem[];
  selectedId?: string | null;
  emptyMessage?: string;
  /** table: 5행 2열 (경기 선택). list: 카드 목록 (경기장 선택) */
  layout?: "list" | "table";
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * 전체 화면 오버레이로 뒤 UI 클릭을 차단한다.
 * (좌측 메뉴·공지 배지·하단 바 등 z-index보다 위에 둔다)
 */
export default function GameSelectModal({
  open,
  title,
  items,
  selectedId,
  emptyMessage = "선택할 항목이 없습니다.",
  layout = "list",
  onSelect,
  onClose,
}: GameSelectModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="game-select-modal"
    >
      <div
        className={`${
          layout === "table" ? "w-[min(560px,94vw)]" : "w-[min(360px,92vw)]"
        } max-h-[min(420px,80dvh)] flex flex-col bg-[#1E1E1E] border border-[#444] rounded-xl shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#333]">
          <h3 className="text-white text-lg font-bold text-center">{title}</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {items.length === 0 ? (
            <p className="text-[#AAA] text-sm text-center py-6">{emptyMessage}</p>
          ) : layout === "table" ? (
            <table className="w-full border-collapse text-sm" data-testid="game-select-table">
              <tbody>
                {items.map((item) => {
                  const selected = selectedId === item.id;
                  const disabled = item.disabled === true;
                  const detail = item.detail ?? item.sublabel ?? "";
                  return (
                    <tr key={item.id}>
                      <td className="p-0 border border-[#444] w-[5.75rem] align-middle">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!disabled) onSelect(item.id);
                          }}
                          data-testid={`game-select-item-${item.id}`}
                          className={`w-full h-full min-h-[44px] px-2 py-2 text-center font-bold whitespace-nowrap ${
                            disabled
                              ? "cursor-not-allowed bg-[#222] text-white/45"
                              : selected
                                ? "bg-[#CCF501]/20 text-[#CCF501]"
                                : "bg-[#2A2A2A] text-white hover:bg-[#333]"
                          }`}
                        >
                          {item.label}
                        </button>
                      </td>
                      <td className="p-0 border border-[#444] align-middle">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!disabled) onSelect(item.id);
                          }}
                          className={`w-full h-full min-h-[44px] px-2.5 py-2 text-left leading-snug ${
                            disabled
                              ? "cursor-not-allowed bg-[#222] text-white/45"
                              : selected
                                ? "bg-[#CCF501]/20 text-white"
                                : "bg-[#2A2A2A] text-[#DDD] hover:bg-[#333]"
                          }`}
                        >
                          {detail}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const selected = selectedId === item.id;
                const disabled = item.disabled === true;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!disabled) onSelect(item.id);
                      }}
                      data-testid={`game-select-item-${item.id}`}
                      className={`w-full text-left rounded-lg px-4 py-3 transition-colors ${
                        disabled
                          ? "cursor-not-allowed border border-[#333] bg-[#222] text-white/45"
                          : selected
                            ? "bg-[#CCF501]/20 border border-[#CCF501] text-white"
                            : "bg-[#2A2A2A] border border-[#444] text-white hover:bg-[#333]"
                      }`}
                    >
                      <span className="block text-sm font-bold">{item.label}</span>
                      {item.sublabel && (
                        <span className="block text-xs text-[#AAA] mt-0.5">{item.sublabel}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-[#333]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-lg bg-[#474747] text-white font-medium"
            data-testid="game-select-modal-close"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
