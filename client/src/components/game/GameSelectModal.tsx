export interface GameSelectModalItem {
  id: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface GameSelectModalProps {
  open: boolean;
  title: string;
  items: GameSelectModalItem[];
  selectedId?: string | null;
  emptyMessage?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function GameSelectModal({
  open,
  title,
  items,
  selectedId,
  emptyMessage = "선택할 항목이 없습니다.",
  onSelect,
  onClose,
}: GameSelectModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      data-testid="game-select-modal"
    >
      <div
        className="w-[min(360px,92vw)] max-h-[min(420px,80dvh)] flex flex-col bg-[#1E1E1E] border border-[#444] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#333]">
          <h3 className="text-white text-lg font-bold text-center">{title}</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {items.length === 0 ? (
            <p className="text-[#AAA] text-sm text-center py-6">{emptyMessage}</p>
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
