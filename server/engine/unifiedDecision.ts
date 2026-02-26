import { calculateBrokerStabilityScore } from "./brokerStability";
import { calculateFlowQualityScore } from "./flowQuality";
import { getInsiderDirection } from "./insider";
import { parseForeignData } from "./foreignParser";

export interface StockDecisionInput {
  netFlow: "high" | "medium" | "low";
  brokerStability: "high" | "medium" | "low";
  flowQuality: "high" | "medium" | "low";
  priceTrend: "up" | "sideways" | "down";
  volatility: "low" | "medium" | "high";
  insider: "buy" | "neutral" | "sell";
  isGorengan: boolean;
}

export interface StockDecisionResult {
  readiness: number;
  action: "BUY" | "WATCHLIST" | "AVOID";
  bucket: "Siap Dipantau" | "Watchlist Prioritas" | "Hindari Dulu";
  actionState: "AKUMULASI_BERTAHAP" | "WATCHLIST_PRIORITAS" | "HINDARI_DULU";
  color: "green" | "yellow" | "red";
  shortSummary: string;
  whyAction: string[];
  mainRisk: string;
  failureTrigger: string;
  marketRegime: string;
}

export function getStockDecision(input: StockDecisionInput): StockDecisionResult {
  let readiness = 0;

  if (input.netFlow === "high") readiness += 25;
  else if (input.netFlow === "medium") readiness += 12;

  if (input.brokerStability === "high") readiness += 20;
  else if (input.brokerStability === "medium") readiness += 10;

  if (input.flowQuality === "high") readiness += 20;
  else if (input.flowQuality === "medium") readiness += 10;

  if (input.priceTrend === "up") readiness += 20;
  else if (input.priceTrend === "sideways") readiness += 5;

  if (input.volatility === "low") readiness += 10;
  else if (input.volatility === "medium") readiness += 5;

  if (input.insider === "buy") readiness += 5;
  else if (input.insider === "sell") readiness -= 5;

  readiness = Math.max(0, Math.min(100, readiness));

  if (input.isGorengan) {
    readiness = Math.min(readiness, 59);
    return {
      readiness,
      action: "AVOID",
      bucket: "Hindari Dulu",
      actionState: "HINDARI_DULU",
      color: "red",
      shortSummary: "Aktivitas spekulatif ritel terdeteksi. Risiko manipulasi tinggi.",
      whyAction: [
        "Pola gorengan terdeteksi pada saham ini",
        "Fragmentasi broker tinggi tanpa dominasi institusi",
        "Risiko manipulasi harga sangat tinggi"
      ],
      mainRisk: "Potensi penurunan tajam setelah fase spekulasi berakhir.",
      failureTrigger: "Jika muncul akumulasi institusional yang terukur dan konsisten.",
      marketRegime: "Spekulatif"
    };
  }

  if (readiness >= 80 && input.priceTrend !== "up") {
    return {
      readiness,
      action: "WATCHLIST",
      bucket: "Watchlist Prioritas",
      actionState: "WATCHLIST_PRIORITAS",
      color: "yellow",
      shortSummary: "Struktur siap, namun belum ada momentum. Saham sedang dipersiapkan, belum waktunya masuk.",
      whyAction: [
        "Skor kesiapan struktural tinggi menunjukkan fondasi kuat",
        "Momentum harga belum konfirmasi arah naik",
        "Menunggu konfirmasi tren sebelum entry"
      ],
      mainRisk: "Kesempatan dapat hilang jika terlalu lama menunggu konfirmasi.",
      failureTrigger: "Jika struktur melemah sebelum momentum muncul.",
      marketRegime: "Akumulasi Bertahap"
    };
  }

  if (readiness >= 80) {
    return {
      readiness,
      action: "BUY",
      bucket: "Siap Dipantau",
      actionState: "AKUMULASI_BERTAHAP",
      color: "green",
      shortSummary: "Saham boleh dibeli sekarang secara bertahap dan disiplin. Struktur dan momentum selaras.",
      whyAction: [
        "Skor kesiapan struktural tinggi dengan konfirmasi institusional",
        "Tren harga positif mendukung entry",
        "Struktur dan momentum selaras untuk akumulasi"
      ],
      mainRisk: "Koreksi jangka pendek tetap mungkin meski struktur positif.",
      failureTrigger: "Jika distribusi muncul atau struktur melemah signifikan.",
      marketRegime: "Akumulasi Aktif"
    };
  }

  if (readiness >= 60) {
    return {
      readiness,
      action: "WATCHLIST",
      bucket: "Watchlist Prioritas",
      actionState: "WATCHLIST_PRIORITAS",
      color: "yellow",
      shortSummary: "Saham menarik, tetapi belum boleh dibeli. Struktur sedang dipersiapkan pelaku besar.",
      whyAction: [
        "Skor kesiapan struktural menunjukkan persiapan institusional",
        "Struktur sedang dipersiapkan oleh pelaku besar",
        "Menunggu konfirmasi entry yang lebih jelas"
      ],
      mainRisk: "Kesempatan dapat hilang jika terlalu lama menunggu.",
      failureTrigger: "Jika struktur melemah atau rezim bergeser ke distribusi.",
      marketRegime: "Akumulasi Awal"
    };
  }

  return {
    readiness,
    action: "AVOID",
    bucket: "Hindari Dulu",
    actionState: "HINDARI_DULU",
    color: "red",
    shortSummary: "Risiko lebih besar daripada potensi. Hindari entry baru pada kondisi saat ini.",
    whyAction: [
      "Skor kesiapan struktural rendah",
      "Tidak ada dominasi institusi yang mendukung",
      "Risiko penurunan lebih tinggi daripada potensi kenaikan"
    ],
    mainRisk: "Potensi penurunan harga signifikan jika kondisi memburuk.",
    failureTrigger: "Jika muncul sinyal akumulasi baru dan struktur membaik.",
    marketRegime: input.priceTrend === "down" ? "Distribusi Aktif" : "Netral"
  };
}

export function mapStockDataToInput(stockData: {
  flowBias?: string | null;
  flowIntensity?: string | null;
  flowReliability?: string | null;
  changePercent?: string | number | null;
  growth?: string | null;
  insiderData?: string | null;
  brokerData?: string | null;
  foreignActivityData?: string | null;
  stockCharacter?: string | null;
  isGorengan?: boolean;
}): StockDecisionInput {
  const flowBias = stockData.flowBias || "Netral";
  const flowIntensity = stockData.flowIntensity || "";
  const flowReliability = stockData.flowReliability || "Rendah";
  const changePercent = typeof stockData.changePercent === "number"
    ? stockData.changePercent
    : parseFloat(String(stockData.changePercent || "0"));
  const growth = parseFloat(stockData.growth || "0");

  let netFlow: "high" | "medium" | "low" = "low";
  if (flowBias === "Akumulasi") {
    if (flowIntensity.includes("Besar")) netFlow = "high";
    else if (flowIntensity.includes("Sedang")) netFlow = "medium";
    else netFlow = "medium";
  }

  let brokerArr: any[] = [];
  try {
    brokerArr = JSON.parse(stockData.brokerData || "[]");
  } catch {}
  const stabilityResult = calculateBrokerStabilityScore(brokerArr);
  let brokerStability: "high" | "medium" | "low" = "low";
  if (stabilityResult.level === "Tinggi") brokerStability = "high";
  else if (stabilityResult.level === "Sedang") brokerStability = "medium";

  const foreignParsed = parseForeignData(stockData.foreignActivityData || "{}");
  const fqScore = calculateFlowQualityScore({
    netForeignFlow: foreignParsed.netForeignFlow,
    netDomesticFlow: foreignParsed.netDomesticFlow,
    flowIntensity: flowIntensity,
    flowReliability: flowReliability,
    buyAvg: null,
    lastPrice: null,
    sellAvg: null,
  });
  let flowQuality: "high" | "medium" | "low" = "low";
  if (fqScore >= 65) flowQuality = "high";
  else if (fqScore >= 35) flowQuality = "medium";

  let priceTrend: "up" | "sideways" | "down" = "sideways";
  if (changePercent > 0.5) priceTrend = "up";
  else if (changePercent < -0.5) priceTrend = "down";
  if (growth > 10 && priceTrend === "sideways") priceTrend = "up";

  let volatility: "low" | "medium" | "high" = "medium";
  if (flowBias === "Distribusi" && flowIntensity.includes("Besar")) volatility = "high";
  else if (flowBias === "Akumulasi" && !flowIntensity.includes("Besar")) volatility = "low";
  else if (Math.abs(changePercent) > 5) volatility = "high";

  let insider: "buy" | "neutral" | "sell" = "neutral";
  if (stockData.insiderData) {
    try {
      const parsed = typeof stockData.insiderData === "string"
        ? JSON.parse(stockData.insiderData)
        : stockData.insiderData;
      const dir = getInsiderDirection(parsed);
      if (dir === "BUY") insider = "buy";
      else if (dir === "SELL") insider = "sell";
    } catch {}
  }

  return {
    netFlow,
    brokerStability,
    flowQuality,
    priceTrend,
    volatility,
    insider,
    isGorengan: stockData.isGorengan || false,
  };
}
