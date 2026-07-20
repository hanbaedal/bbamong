/** 스마트폰에서 전화 앱을 여는 tel: URL */
export function phoneTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, "");
  return `tel:${normalized || phone.trim()}`;
}

export function buildMailtoHref(
  email: string,
  options?: { subject?: string; body?: string },
): string {
  const params = new URLSearchParams();
  if (options?.subject) params.set("subject", options.subject);
  if (options?.body) params.set("body", options.body);
  const query = params.toString();
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}
