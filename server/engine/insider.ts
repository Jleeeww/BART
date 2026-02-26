export function getInsiderDirection(insiderData: any): "BUY" | "SELL" | "NEUTRAL" | "NO_DATA" {
  if (!insiderData) return "NO_DATA";

  const tx = insiderData.transactions || [];

  let buy = 0;
  let sell = 0;

  tx.forEach((t: any) => {
    const shares = parseInt(String(t.shares).replace(/\D/g, "")) || 0;

    if (t.type === "BUY" || t.type === "Beli")
      buy += shares;

    if (t.type === "SELL" || t.type === "Jual")
      sell += shares;
  });

  if (buy > sell * 1.2) return "BUY";
  if (sell > buy * 1.2) return "SELL";
  return "NEUTRAL";
}
