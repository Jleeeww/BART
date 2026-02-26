export function classifyNewsBehavior(news: any[]): any[] {
  if (!news) return [];

  return news.map(n => {
    const text = (
      (n.title || n.headline || "") +
      " " +
      (n.summary || n.aiExplanation || "")
    ).toLowerCase();

    const affects =
      text.includes("rights issue") ||
      text.includes("right issue") ||
      text.includes("dividen") ||
      text.includes("akuisisi") ||
      text.includes("merger") ||
      text.includes("buyback") ||
      text.includes("laba") ||
      text.includes("earnings") ||
      text.includes("restrukturisasi");

    return {
      ...n,
      affectsBehavior: affects
    };
  });
}
