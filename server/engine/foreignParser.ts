function parseIDR(v: any): number {
  if (!v) return 0;
  const s = String(v).replace(/[^\d.\-]/g, "");
  return parseFloat(s) || 0;
}

export function parseForeignData(json: string): {
  netForeignFlow: number;
  netDomesticFlow: number;
} {
  let d: any = {};
  try {
    d = JSON.parse(json || "{}");
  } catch {}

  const foreign =
    parseIDR(d.netForeignFlow) ||
    parseIDR(d.foreignNet) ||
    0;

  const domestic =
    parseIDR(d.netDomesticFlow) ||
    parseIDR(d.domesticNet) ||
    0;

  return {
    netForeignFlow: foreign,
    netDomesticFlow: domestic
  };
}
