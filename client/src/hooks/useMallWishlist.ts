import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, getFullUrl, getOrRefreshAccessToken } from "@/lib/queryClient";

const WISHLIST_IDS_KEY = ["/api/mall/wishlist/ids"] as const;

export function notifyMallWishlistChanged(): void {
  window.dispatchEvent(new Event("ppamong:mall-wishlist"));
}

export function useMallWishlist() {
  const { user, isGuest } = useUser();
  const queryClient = useQueryClient();
  const canWishlist = Boolean(user) && !isGuest;

  const { data } = useQuery({
    queryKey: WISHLIST_IDS_KEY,
    queryFn: async () => {
      const token = await getOrRefreshAccessToken();
      if (!token) return { productIds: [] as number[] };
      const res = await fetch(getFullUrl("/api/mall/wishlist/ids"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { productIds: [] as number[] };
      return res.json() as Promise<{ productIds: number[] }>;
    },
    enabled: canWishlist,
    staleTime: 30_000,
  });

  const productIds = data?.productIds ?? [];
  const wishlistSet = new Set(productIds);

  const toggleMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("POST", `/api/mall/wishlist/${productId}/toggle`);
      return res.json() as Promise<{ wishlisted: boolean; productIds: number[] }>;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(WISHLIST_IDS_KEY, { productIds: result.productIds });
      notifyMallWishlistChanged();
    },
  });

  const toggle = useCallback(
    async (productId: number) => {
      if (!canWishlist) {
        return { ok: false as const, reason: "login_required" as const };
      }
      const result = await toggleMutation.mutateAsync(productId);
      return { ok: true as const, wishlisted: result.wishlisted };
    },
    [canWishlist, toggleMutation],
  );

  return {
    canWishlist,
    productIds,
    isWishlisted: (productId: number) => wishlistSet.has(productId),
    toggle,
    toggling: toggleMutation.isPending,
  };
}
