import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";

const PRECONNECT_ID = "ppamong-mall-image-cdn-preconnect";

/** R2/CDN origin에 preconnect — 이미지 로딩 지연 완화 */
export default function MallImagePreconnect() {
  const { data } = useQuery({
    queryKey: ["/api/mall/config"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/mall/config"));
      if (!res.ok) return { imageCdnOrigin: null as string | null };
      return res.json() as Promise<{ imageCdnOrigin: string | null }>;
    },
    staleTime: 24 * 60 * 60_000,
  });

  useEffect(() => {
    const origin = data?.imageCdnOrigin?.trim();
    if (!origin) return;

    let link = document.getElementById(PRECONNECT_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = PRECONNECT_ID;
      link.rel = "preconnect";
      document.head.appendChild(link);
    }
    if (link.href !== origin) {
      link.href = origin;
    }
  }, [data?.imageCdnOrigin]);

  return null;
}
