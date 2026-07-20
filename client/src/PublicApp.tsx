/** @deprecated PublicApp → MallApp. 하위 호환용 리다이렉트 */
import { useEffect } from "react";
import { MALL_BASE_PATH } from "@shared/mallConfig";

export default function PublicApp() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/" || path === "/shop") {
      window.location.replace(MALL_BASE_PATH);
      return;
    }
    if (path.startsWith("/shop/")) {
      window.location.replace(path);
    }
  }, []);

  return null;
}
