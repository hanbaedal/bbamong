import { Gamepad2 } from "lucide-react";
import { navigateToHome } from "@/lib/appNavigation";

interface MallGameButtonProps {
  variant?: "header" | "primary";
  className?: string;
}

export default function MallGameButton({ variant = "header", className = "" }: MallGameButtonProps) {
  const base =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
      : "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-900 border border-neutral-200 rounded-md hover:bg-neutral-50";

  return (
    <button
      type="button"
      onClick={() => navigateToHome()}
      aria-label="게임으로 돌아가기"
      className={`${base} ${className}`.trim()}
    >
      <Gamepad2 className="w-4 h-4 shrink-0" />
      게임으로
    </button>
  );
}
