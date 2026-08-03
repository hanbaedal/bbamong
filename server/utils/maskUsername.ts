export function maskUsername(username: string): string {
  const trimmed = username.trim();
  if (trimmed.length <= 1) return "*";
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  if (trimmed.length === 3) return `${trimmed[0]}*${trimmed[2]}`;
  const head = 2;
  const tail = 1;
  const maskedLength = Math.max(1, trimmed.length - head - tail);
  return `${trimmed.slice(0, head)}${"*".repeat(maskedLength)}${trimmed.slice(-tail)}`;
}
