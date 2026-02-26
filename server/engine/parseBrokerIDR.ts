export function parseBrokerIDR(v: any): number {
  if (!v) return 0;
  const s = String(v).toUpperCase();
  const num = parseFloat(s.replace(/[^\d.]/g, "")) || 0;
  if (s.includes("T")) return num * 1e12;
  if (s.includes("B")) return num * 1e9;
  if (s.includes("M")) return num * 1e6;
  return num;
}
