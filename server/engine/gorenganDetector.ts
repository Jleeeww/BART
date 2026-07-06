import { parseBrokerIDR } from './parseBrokerIDR';
import { parseForeignData } from './foreignParser';
import { detectTapeControl } from './tapeControl';
import { LQ45_UNIVERSE } from './lq45Universe';

/** Parse "52T IDR" → trillions in IDR (returns raw IDR value). */
function parseMarketCapIDR(cap: string | null | undefined): number {
  if (!cap) return 0;
  const m = cap.match(/([\d,.]+)\s*T/i);
  if (!m) return 0;
  return parseFloat(m[1].replace(/,/g, '')) * 1e12;
}

export interface GorenganResult {
  isGorengan: boolean;
  triggeredLayers: number[];
  layerDetails: string[];
  riskOverride: string | null;
}

interface GorenganDetectionInput {
  priceChangePercent5d: number;
  hasIntradaySpikes: boolean;
  volumeRatio: number;
  top3BrokerNetBuyPercent: number;
  hasBrokerFragmentation: boolean;
  retailProxyDominates: boolean;
  smallLotDominates: boolean;
  foreignFlowAbsent: boolean;
  hasAccumulationLadder: boolean;
  marketRegime: string;
  hasTapeControl: boolean;
  hasAbsorptionFailure: boolean;
  hasPostSpikeDistribution: boolean;
}

function detectGorengan(input: GorenganDetectionInput): GorenganResult {
  const triggeredLayers: number[] = [];
  const layerDetails: string[] = [];

  const layer1Triggered =
    input.priceChangePercent5d > 25 ||
    input.hasIntradaySpikes ||
    input.volumeRatio > 3;

  if (layer1Triggered) {
    triggeredLayers.push(1);
    const details: string[] = [];
    if (input.priceChangePercent5d > 25) details.push(`Kenaikan harga ${input.priceChangePercent5d.toFixed(1)}% dalam 5 hari`);
    if (input.hasIntradaySpikes) details.push("Lonjakan intraday ≥10% terdeteksi");
    if (input.volumeRatio > 3) details.push(`Volume ${input.volumeRatio.toFixed(1)}× rata-rata 20 hari`);
    layerDetails.push(`Layer 1 (Anomali Harga & Volume): ${details.join(", ")}`);
  }

  // Threshold raised: require top-3 share < 20% (not < 35%) to reduce false
  // positives on stocks with few legitimate institutional brokers.
  const layer2Triggered =
    input.top3BrokerNetBuyPercent < 20 ||
    input.hasBrokerFragmentation ||
    input.retailProxyDominates;

  if (layer2Triggered) {
    triggeredLayers.push(2);
    const details: string[] = [];
    if (input.top3BrokerNetBuyPercent < 20) details.push(`Top 3 broker hanya ${input.top3BrokerNetBuyPercent.toFixed(0)}% net buy`);
    if (input.hasBrokerFragmentation) details.push("Fragmentasi broker tinggi");
    if (input.retailProxyDominates) details.push("Broker proxy ritel mendominasi");
    layerDetails.push(`Layer 2 (Fragmentasi Broker): ${details.join(", ")}`);
  }

  // Layer 3 now requires BOTH foreignFlowAbsent AND absence of accumulation
  // (not just one) to reduce triggering on blue-chips with neutral flow.
  const layer3Triggered =
    input.smallLotDominates ||
    (input.foreignFlowAbsent && !input.hasAccumulationLadder);

  if (layer3Triggered) {
    triggeredLayers.push(3);
    const details: string[] = [];
    if (input.smallLotDominates) details.push("Transaksi lot kecil mendominasi");
    if (input.foreignFlowAbsent && !input.hasAccumulationLadder) details.push("Aliran asing absen + tidak ada pola akumulasi bertahap");
    layerDetails.push(`Layer 3 (Dominasi Ritel): ${details.join(", ")}`);
  }

  const isAccumulationRegime = input.marketRegime.includes("Akumulasi") ||
    input.marketRegime === "Stealth Accumulation" ||
    input.marketRegime === "Active Accumulation";

  const layer4Triggered =
    !isAccumulationRegime ||
    !input.hasTapeControl ||
    input.hasAbsorptionFailure ||
    input.hasPostSpikeDistribution;

  if (layer4Triggered) {
    triggeredLayers.push(4);
    const details: string[] = [];
    if (!isAccumulationRegime) details.push("Rezim pasar bukan akumulasi");
    if (!input.hasTapeControl) details.push("Tidak ada kendali tape");
    if (input.hasAbsorptionFailure) details.push("Absorpsi gagal (harga naik tapi tekanan jual kuat)");
    if (input.hasPostSpikeDistribution) details.push("Distribusi pasca-lonjakan terdeteksi");
    layerDetails.push(`Layer 4 (Kegagalan Struktural): ${details.join(", ")}`);
  }

  // Gorengan verdict: requires an active gorengan signal (Layer 1 price/volume anomaly
  // OR Layer 2 broker fragmentation) PLUS at least one corroborating layer.
  // Stocks that only trigger Layers 3+4 (weak flow) are NOT gorengan.
  const hasActiveSignal = triggeredLayers.includes(1) || triggeredLayers.includes(2);
  const isGorengan = triggeredLayers.length >= 2 && hasActiveSignal;

  return {
    isGorengan,
    triggeredLayers,
    layerDetails,
    riskOverride: isGorengan ? "GOR" : null
  };
}

export function computeGorenganFromStock(stock: {
  changePercent: string;
  flowBias: string;
  flowIntensity: string;
  flowReliability: string;
  brokerData: string;
  foreignActivityData: string;
  stockCharacter?: string | null;
  todayValue?: number | null;
  avg20dValue?: number | null;
  symbol?: string | null;
  marketCap?: string | null;
}): GorenganResult {
  const sym = stock.symbol?.toUpperCase() ?? '';

  // LQ45 exemption — always checked first
  if (sym && LQ45_UNIVERSE.has(sym)) {
    return {
      isGorengan: false,
      triggeredLayers: [],
      layerDetails: ['Konstituen LQ45 — dikecualikan dari deteksi gorengan'],
      riskOverride: null,
    };
  }

  // Market cap floor: > Rp 5 Triliun → institutional stock, not gorengan
  const marketCapIDR = parseMarketCapIDR(stock.marketCap);
  if (marketCapIDR > 5e12) {
    return {
      isGorengan: false,
      triggeredLayers: [],
      layerDetails: ['Market cap > Rp 5T — dikecualikan dari deteksi gorengan'],
      riskOverride: null,
    };
  }

  let brokerData: any[] = [];
  try {
    brokerData = JSON.parse(stock.brokerData || "[]");
  } catch {
    brokerData = [];
  }

  const foreignParsed = parseForeignData(stock.foreignActivityData || "{}");

  const sortedBrokers = [...brokerData].sort((a, b) => {
    const aNet = parseBrokerIDR(a.netBuy) - parseBrokerIDR(a.netSell);
    const bNet = parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell);
    return bNet - aNet;
  });

  const totalNetBuy = brokerData.reduce((sum: number, b: any) => sum + Math.max(0, parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell)), 0);
  const top3NetBuy = sortedBrokers.slice(0, 3).reduce((sum: number, b: any) => sum + Math.max(0, parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell)), 0);
  const top3Percent = totalNetBuy > 0 ? (top3NetBuy / totalNetBuy) * 100 : 50;

  const hasBrokerFragmentation = brokerData.length > 10 && top3Percent < 40;

  const totalVolume = brokerData.reduce((s: number, b: any) =>
    s + parseBrokerIDR(b.netBuy) + parseBrokerIDR(b.netSell), 0);
  const smallBrokerCount = totalVolume > 0
    ? brokerData.filter((b: any) =>
        parseBrokerIDR(b.netBuy) + parseBrokerIDR(b.netSell) < totalVolume * 0.02
      ).length
    : 0;
  const retailProxyDominates = brokerData.length > 0 && smallBrokerCount > brokerData.length * 0.5;

  const foreignFlowAbsent = Math.abs(foreignParsed.netForeignFlow) < Math.abs(foreignParsed.netDomesticFlow) * 0.1;

  const hasAccumulationLadder = stock.flowReliability === "Tinggi" &&
    stock.flowBias === "Akumulasi" &&
    !stock.flowIntensity.includes("Distribusi");

  const priceChangePercent = Math.abs(parseFloat(stock.changePercent) || 0);

  let marketRegime = "Transisi";
  if (stock.flowBias === "Akumulasi") {
    marketRegime = stock.flowIntensity.includes("Besar") ? "Active Accumulation" : "Akumulasi Awal";
  } else if (stock.flowBias === "Distribusi") {
    marketRegime = "Distribution into Strength";
  }

  const avgBuyPrice = parseFloat(String(stock.brokerData ? sortedBrokers[0]?.avgBuy || "0" : "0").replace(/[^\d.]/g, "")) || 0;

  const todayVal = typeof stock.todayValue === 'number' ? stock.todayValue : null;
  const avg20Val = typeof stock.avg20dValue === 'number' ? stock.avg20dValue : null;
  const volumeRatio = (todayVal && avg20Val && avg20Val > 0)
    ? todayVal / avg20Val
    : 1.2;

  const effectiveVolumeRatio = (volumeRatio > 3 && top3Percent > 60)
    ? 2.5
    : volumeRatio;

  const hasTapeControlResult = avgBuyPrice > 0
    ? detectTapeControl({
        high:      avgBuyPrice * 1.002,
        low:       avgBuyPrice * 0.998,
        lastPrice: avgBuyPrice,
        volumeRatio,
        netFlow:   totalNetBuy,
        buyAvg:    avgBuyPrice
      })
    : true;

  return detectGorengan({
    priceChangePercent5d: priceChangePercent,
    hasIntradaySpikes: priceChangePercent > 10,
    volumeRatio: effectiveVolumeRatio,
    top3BrokerNetBuyPercent: top3Percent,
    hasBrokerFragmentation,
    retailProxyDominates,
    smallLotDominates: brokerData.length > 15 &&
      top3Percent < 25 &&
      foreignFlowAbsent,
    foreignFlowAbsent,
    hasAccumulationLadder,
    marketRegime,
    hasTapeControl: hasTapeControlResult,
    hasAbsorptionFailure: stock.flowBias === "Distribusi" && priceChangePercent > 0,
    hasPostSpikeDistribution: stock.flowBias === "Distribusi" && priceChangePercent > 15
  });
}
