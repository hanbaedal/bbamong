import type { ComponentType } from "react";

/** 기존 전체 페이지를 우측 패널에 삽입 (헤더·하단바 숨김) */
export default function LandscapePaneContent({ component: Component }: { component: ComponentType }) {
  return (
    <div className="landscape-pane-content panel-embed h-full min-h-0 overflow-auto">
      <Component />
    </div>
  );
}
