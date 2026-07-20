import type { MallCartItem } from "./mallTypes";

const CART_KEY = "ppamong_mall_cart";

export function readMallCart(): MallCartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MallCartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeMallCart(items: MallCartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToMallCart(item: Omit<MallCartItem, "quantity">, quantity = 1): MallCartItem[] {
  const cart = readMallCart();
  const existing = cart.find((c) => c.productId === item.productId);
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + quantity);
  } else {
    cart.push({ ...item, quantity });
  }
  writeMallCart(cart);
  return cart;
}

export function updateMallCartQuantity(productId: number, quantity: number): MallCartItem[] {
  const cart = readMallCart();
  if (quantity <= 0) {
    return removeFromMallCart(productId);
  }
  const next = cart.map((c) =>
    c.productId === productId ? { ...c, quantity: Math.min(99, quantity) } : c,
  );
  writeMallCart(next);
  return next;
}

export function removeFromMallCart(productId: number): MallCartItem[] {
  const next = readMallCart().filter((c) => c.productId !== productId);
  writeMallCart(next);
  return next;
}

export function clearMallCart(): void {
  localStorage.removeItem(CART_KEY);
}

export function mallCartTotal(items: MallCartItem[]): number {
  return items.reduce((sum, item) => sum + item.priceAmount * item.quantity, 0);
}

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function discountRate(price: number, original?: number): number | null {
  if (!original || original <= price) return null;
  return Math.round(((original - price) / original) * 100);
}
