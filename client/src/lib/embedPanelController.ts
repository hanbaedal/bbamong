/** 인라인 embed 패널 — iframe 없이 같은 React 트리에서 서브페이지 표시 */

export type EmbedPanelHandlers = {
  rootPath: string;
  getLocation: () => string;
  setLocation: (path: string) => void;
  onClose: () => void;
  onAppNavigate?: (path: string) => void;
};

let activePanel: EmbedPanelHandlers | null = null;

export function registerEmbedPanel(handlers: EmbedPanelHandlers): () => void {
  activePanel = handlers;
  return () => {
    if (activePanel === handlers) activePanel = null;
  };
}

export function isInlinePanelEmbedMode(): boolean {
  return activePanel !== null;
}

export function isNestedEmbedPath(rootHref: string, currentPath: string): boolean {
  const root = rootHref.split("?")[0];
  const current = currentPath.split("?")[0];
  if (current === root) return false;
  if (current.startsWith(`${root}/`)) return true;
  if (root === "/customer-center" && current.startsWith("/inquiry")) return true;
  if (root === "/verify-identity" && current === "/profile") return true;
  return false;
}

export function requestInlinePanelBack(): boolean {
  if (!activePanel) return false;

  const current = activePanel.getLocation();
  const root = activePanel.rootPath;

  if (isNestedEmbedPath(root, current)) {
    activePanel.setLocation(root.split("?")[0]);
    return true;
  }

  activePanel.onClose();
  return true;
}

export function requestInlinePanelClose(): boolean {
  if (!activePanel) return false;
  activePanel.onClose();
  return true;
}

export function requestInlinePanelAppNavigate(path: string): boolean {
  if (!activePanel) return false;
  activePanel.onClose();
  activePanel.onAppNavigate?.(path);
  return true;
}
