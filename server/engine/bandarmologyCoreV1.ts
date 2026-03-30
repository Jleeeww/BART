// ═══════════════════════════════════════════════════════════
// BANDARMOLOGY INTELLIGENCE CORE v1.1
// Permanent Intelligence Engine — Single Source of Truth
// ═══════════════════════════════════════════════════════════
//
// This file consolidates ALL bandarmology intelligence logic
// into a single deterministic engine.
//
// RULES:
// - No randomness (Math.random() forbidden)
// - Same input → same output (deterministic)
// - All explanations in Bahasa Indonesia
// - No buy/sell recommendations or price targets
// - Neutral analytical tone throughout
//
// ENGINE VERSION: 1.1.0
//
// v1.1.0 ADDITIONS:
// - Model 6: Flow Normalization (negative range fix B-1)
// - Model 7: Broker Rotation
// - Model 8: Stealth Accumulation (slope fix B-2)
// - Model 9: Fake Breakout Risk
// - Model 10: Regime Probabilities
// - Fix B-3: Pipeline order correction
// ═══════════════════════════════════════════════════════════

import { parseBrokerIDR } from "./parseBrokerIDR";
import { parseForeignData } from "./foreignParser";
import { calculateBrokerStabilityScore } from "./brokerStability";
import { calculateFlowQualityScore } from "./flowQuality";
import { getInsiderDirection } from "./insider";
import { detectTapeControl } from "./tapeControl";
import { detectAccumulationPhase } from "./phaseDetection";
import {
  computeGorenganFromStock as _computeGorenganFromStock,
  GorenganResult as _GorenganResult
} from './gorenganDetector';

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS (v1.1)
// ═══════════════════════════════════════════════════════════

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildLevelLabel(score: number): string {
  if (score >= 80) return "Sangat Kuat";
  if (score >= 60) return "Kuat";
  if (score >= 40) return "Sedang";
  if (score >= 20) return "Lemah";
  return "Sangat Lemah";
}

function parseBrokers(brokerData: any[]): Array<{ code: string; net: number }> {
  return brokerData.map((b: any) => ({
    code: b.code || "",
    net: parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell)
  }));
}

// ═══════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════

export interface ScoreWithExplanation {
  score: number;
  level: string;
  components: Array<{ name: string; value: number }>;
  explanation: string;
  isReliable: boolean;
  reliabilityNote: string | null;
}

export interface BandarmologyInput {
  // Flow signals
  flowBias: string;
  flowIntensity: string;
  flowReliability: string;
  netForeignBuyIdr: number;
  netDomesticBuyIdr: number;
  buyAvg: number;
  sellAvg: number;
  lastPrice: number;

  // Broker data (parsed array)
  brokerData: any[];

  // Foreign activity (parsed)
  foreignActivityData: string;

  // Price context
  changePercent: number;
  growth: number;

  // Insider data
  insiderData: any;

  // Stock character
  stockCharacter?: string | null;

  // Event context
  eventType?: string;

  // v1.1 — Extended fields (optional, graceful degradation if missing)
  flow?: {
    netForeignFlow: number;
    netDomesticFlow: number;
  };
  volume?: {
    todayVolume: number;
    avg20dVolume: number;
    avg20dValue: number;
  };
  price?: {
    close: number;
    prevClose: number;
    high: number;
    low: number;
  };
  priceHistory?: number[];
  brokers?: any[];
}

export interface GorenganResult {
  isGorengan: boolean;
  triggeredLayers: number[];
  layerDetails: string[];
  riskOverride: string | null;
}

export interface BrokerInsight {
  brokerCode: string;
  inferredRole: string;
  confidenceLevel: string;
  roleShiftFlag: boolean;
  explanation: string;
}

export interface BandarmologyResult {
  engineVersion: string;

  // ─── FLOW QUALITY ───
  flowQualityScore: number;
  flowQualityInterpretation: string;

  // ─── EARLY DISTRIBUTION ───
  earlyDistributionFlag: boolean;
  earlyDistributionExplanation: string;

  // ─── BROKER CONTROL ───
  brokerControlScore: {
    score: number;
    level: string;
    interpretation: string;
  };

  // ─── BROKER STABILITY ───
  brokerStabilityScore: {
    score: number;
    level: string;
    interpretation: string;
  };

  // ─── TAPE CONTROL ───
  tapeControlFlag: boolean;
  tapeControlExplanation: string;

  // ─── BROKER INSIGHTS ───
  brokerInsights: BrokerInsight[];

  // ─── MARKET MODE (A/D Engine) ───
  marketMode: string;
  marketModeExplanation: string;

  // ─── CONVICTION PHASE ───
  convictionPhase: string;
  convictionExplanation: string;

  // ─── SMART MONEY INTENT ───
  smartMoneyIntent: {
    primaryIntent: string;
    secondaryIntent?: string;
    confidence: "Rendah" | "Sedang" | "Tinggi";
    explanation: string;
  };

  // ─── PHASE DETECTION ───
  currentPhaseLabel: string;
  bandarHeatmap: Array<{ broker: string; net: number }>;
  phaseTimeline: Array<{ phase: string; confidence: string }>;
  bandarPhaseInterpretation: string;

  // ─── TRAP DETECTION ───
  trapDetection: {
    type: string;
    detected: boolean;
    confidence: string;
    title: string;
    explanation: string;
  };

  // ─── DECISION ENGINE (Part A) ───
  decisionEngine: {
    status: string;
    subBadge: string;
    reasons: string[];
    primaryRisk: string;
    investorFit: string;
  };

  // ─── CONTROL QUALITY (Part B) ───
  controlQualityScore: {
    score: number;
    level: string;
    interpretation: string;
  };

  // ─── INSIDER-BANDAR ALIGNMENT ───
  insiderBandarAlignment: {
    status: string;
    interpretation: string;
  };

  // ─── SIMPLIFIED RISK (Part C) ───
  simplifiedRisk: {
    level: string;
    explanation: string;
    failureTriggers: string[];
  };

  // ─── SMART MONEY READINESS SCORE ───
  smartMoneyReadinessScore: {
    score: number;
    statusLabel: string;
    shortExplanation: string;
    gradingExplanation: string;
    hasInconsistency: boolean;
    inconsistencyNote: string;
    components: Array<{ name: string; weight: string; condition: string }>;
  };

  // ─── GORENGAN DETECTION ───
  gorenganResult: GorenganResult;

  // ─── v1.1 NEW MODELS ───
  flowNormalized: ScoreWithExplanation;
  brokerRotation: ScoreWithExplanation;
  stealthAccumulation: ScoreWithExplanation;
  fakeBreakoutRisk: ScoreWithExplanation;
  regimeProbabilities: {
    strongAccumulation: number;
    distribution: number;
    sideways: number;
  };
}

// ═══════════════════════════════════════════════════════════
// GORENGAN DETECTOR (4-Layer Safety Engine)
// ═══════════════════════════════════════════════════════════

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

  // LAYER 1 — PRICE & VOLUME ANOMALY
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

  // LAYER 2 — BROKER FLOW FRAGMENTATION
  const layer2Triggered =
    input.top3BrokerNetBuyPercent < 35 ||
    input.hasBrokerFragmentation ||
    input.retailProxyDominates;

  if (layer2Triggered) {
    triggeredLayers.push(2);
    const details: string[] = [];
    if (input.top3BrokerNetBuyPercent < 35) details.push(`Top 3 broker hanya ${input.top3BrokerNetBuyPercent.toFixed(0)}% net buy`);
    if (input.hasBrokerFragmentation) details.push("Fragmentasi broker tinggi");
    if (input.retailProxyDominates) details.push("Broker proxy ritel mendominasi");
    layerDetails.push(`Layer 2 (Fragmentasi Broker): ${details.join(", ")}`);
  }

  // LAYER 3 — RETAIL DOMINANCE
  const layer3Triggered =
    input.smallLotDominates ||
    input.foreignFlowAbsent ||
    !input.hasAccumulationLadder;

  if (layer3Triggered) {
    triggeredLayers.push(3);
    const details: string[] = [];
    if (input.smallLotDominates) details.push("Transaksi lot kecil mendominasi");
    if (input.foreignFlowAbsent) details.push("Aliran asing absen");
    if (!input.hasAccumulationLadder) details.push("Tidak ada pola akumulasi bertahap");
    layerDetails.push(`Layer 3 (Dominasi Ritel): ${details.join(", ")}`);
  }

  // LAYER 4 — STRUCTURAL FAILURE
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

  // FINAL DECISION: GORENGAN if ≥2 layers triggered
  const isGorengan = triggeredLayers.length >= 2;

  return {
    isGorengan,
    triggeredLayers,
    layerDetails,
    riskOverride: isGorengan ? "GOR" : null
  };
}

// ═══════════════════════════════════════════════════════════
// GORENGAN DETECTION FROM STOCK DATA
// Wrapper that transforms stock fields into detection input
// ═══════════════════════════════════════════════════════════

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
}): GorenganResult {
  return _computeGorenganFromStock(stock);
}

// ═══════════════════════════════════════════════════════════
// BROKER CONTROL SCORE
// Measures concentration of net accumulation among top brokers
// ═══════════════════════════════════════════════════════════

function computeBrokerControlScore(brokers: any[]): { score: number; level: string; interpretation: string } {
  const positive = brokers
    .map(b => {
      const buyVal = b.netBuy ? parseFloat(b.netBuy.replace(/[^\d.]/g, "")) : 0;
      const sellVal = b.netSell ? parseFloat(b.netSell.replace(/[^\d.]/g, "")) : 0;
      return { ...b, net: buyVal - sellVal };
    })
    .filter(b => b.net > 0);

  if (positive.length === 0) {
    return {
      score: 0,
      level: "Tidak Ada",
      interpretation: "Tidak terdeteksi akumulasi dari broker."
    };
  }

  positive.sort((a, b) => b.net - a.net);

  const top3 = positive.slice(0, 3).reduce((sum, b) => sum + b.net, 0);
  const total = positive.reduce((sum, b) => sum + b.net, 0);

  const brokerScore = Math.round((top3 / total) * 100);

  let level = "Konsentrasi Rendah";
  let interpretation =
    "Akumulasi tersebar di banyak broker, menunjukkan partisipasi institusi yang lebih luas dan struktur tren yang lebih sehat.";

  if (brokerScore >= 70) {
    level = "Konsentrasi Tinggi";
    interpretation =
      "Sedikit broker menguasai sebagian besar akumulasi. Ini meningkatkan probabilitas kelanjutan tren tapi juga risiko volatilitas jika mereka berbalik arah.";
  } else if (brokerScore >= 40) {
    level = "Konsentrasi Sedang";
    interpretation =
      "Akumulasi cukup terkonsentrasi. Pergerakan harga didukung institusi tapi masih bergantung pada perilaku broker utama.";
  }

  return { score: brokerScore, level, interpretation };
}

// ═══════════════════════════════════════════════════════════
// BROKER CLASSIFICATION ENGINE
// Classifies each broker into behavioral roles
// ═══════════════════════════════════════════════════════════

function classifyBrokers(brokerData: any[], tapeControlFlag: boolean): BrokerInsight[] {
  return brokerData.map((b: any) => {
    let role = "Market Maker";
    let confidence = "Sedang";
    const volPct = parseFloat((b.volumePercent || "0").replace("%", ""));

    if (b.netBuy && !b.netSell && volPct >= 8) {
      role = "Akumulator";
      confidence = "Tinggi";
    } else if (b.netSell && !b.netBuy && volPct >= 8) {
      role = "Distributor";
      confidence = "Tinggi";
    } else if (b.netBuy && !b.netSell) {
      role = "Akumulator";
    } else if (b.netSell && !b.netBuy) {
      role = "Distributor";
    } else if (volPct < 5) {
      role = "Proxy Ritel";
      confidence = "Rendah";
    } else if (b.netBuy && b.netSell) {
      role = "Market Maker";
    }

    // Operator detection: high volume with tape control signals
    if (tapeControlFlag && volPct >= 10 && (role === "Akumulator" || role === "Distributor")) {
      role = "Operator";
      confidence = "Tinggi";
    }

    const roleDescriptions: Record<string, string> = {
      "Akumulator": "pembelian bersih konsisten dengan niat membangun posisi",
      "Distributor": "penjualan bersih dengan pola pengurangan inventori",
      "Market Maker": "aliran dua arah menyediakan likuiditas tanpa bias arah",
      "Proxy Ritel": "aktivitas ritel terfragmentasi dengan karakteristik institusional terbatas",
      "Operator": "aktivitas terkoordinasi menunjukkan manajemen inventori atau stabilisasi harga"
    };

    return {
      brokerCode: b.code,
      inferredRole: role,
      confidenceLevel: confidence,
      roleShiftFlag: false,
      explanation: `${b.code} menunjukkan ${roleDescriptions[role] || "perilaku tidak terklasifikasi"}.`
    };
  });
}

// ═══════════════════════════════════════════════════════════
// MARKET MODE ENGINE (A/D Mode)
// Determines accumulation/distribution regime
// ═══════════════════════════════════════════════════════════

function computeMarketMode(
  score: number,
  earlyDistributionFlag: boolean,
  tapeControlFlag: boolean,
  flowBias: string
): { mode: string; explanation: string } {
  let mode = "Akumulasi Aktif";
  if (earlyDistributionFlag && score < 40) mode = "Vakum Pasca-Distribusi";
  else if (earlyDistributionFlag) mode = "Distribusi Saat Menguat";
  else if (tapeControlFlag && score > 60) mode = "Akumulasi Tersembunyi";
  else if (score > 80) mode = "Akumulasi Aktif";
  else if (score < 40 && flowBias === "Distribution") mode = "Distribusi Pasif";
  else if (score < 30) mode = "Vakum Pasca-Distribusi";

  const explanations: Record<string, string> = {
    "Akumulasi Tersembunyi": "Pelaku dominan tampak membangun posisi secara diam-diam dengan dukungan harga mekanis. Kualitas aliran mulai terbentuk namun belum tercermin dalam penemuan harga organik.",
    "Akumulasi Aktif": "Aktivitas institusi tersinkronisasi mendorong apresiasi harga organik. Kualitas aliran tinggi dengan partisipasi yang luas.",
    "Distribusi Saat Menguat": "Meski harga naik, struktur aliran internal menunjukkan rotasi institusional sedang berlangsung. Penguatan headline mungkin menyembunyikan distribusi yang mendasari.",
    "Distribusi Pasif": "Penjualan institusi terjadi tanpa penekanan harga agresif. Likuiditas diserap secara bertahap, mengurangi volatilitas langsung namun membangun risiko penurunan.",
    "Vakum Pasca-Distribusi": "Fase distribusi sebelumnya telah selesai. Pasar mencari level harga baru dengan dukungan institusional terbatas. Likuiditas mungkin tipis."
  };

  return { mode, explanation: explanations[mode] || "" };
}

// ═══════════════════════════════════════════════════════════
// CONVICTION TIMELINE ENGINE
// Lifecycle phases: Positioning → Confirmation → Crowding → Distribution → Reset
// ═══════════════════════════════════════════════════════════

function computeConvictionPhase(
  score: number,
  earlyDistributionFlag: boolean,
  marketMode: string
): { phase: string; explanation: string } {
  let phase = "Penempatan";
  if (earlyDistributionFlag || marketMode.includes("Distribusi")) {
    phase = "Distribusi";
  } else if (score > 80 || marketMode === "Akumulasi Tersembunyi") {
    phase = "Kepadatan";
  } else if (score > 60) {
    phase = "Konfirmasi";
  } else if (score < 30) {
    phase = "Reset";
  }

  const explanations: Record<string, string> = {
    "Penempatan": "Posisi awal institusional terdeteksi. Kualitas aliran masih dini; tesis tetap spekulatif hingga partisipasi tersinkronisasi dikonfirmasi dari pelaku domestik dan asing.",
    "Konfirmasi": "Narasi yang berlaku mendapat validasi struktural. Akumulasi tersinkronisasi dan respons harga positif menunjukkan keyakinan institusional meningkat untuk jangka menengah.",
    "Kepadatan": "Konsensus institusional telah mencapai level tinggi. Meski aliran teknis tetap berkualitas, asimetri perdagangan bergeser karena posisi semakin terkonsentrasi.",
    "Distribusi": "Kualitas aliran internal memburuk. Akumulasi yang diamati tampak semakin didorong oleh partisipasi siklus akhir, sementara pemimpin institusional menunjukkan tanda rotasi struktural.",
    "Reset": "Siklus sebelumnya telah selesai. Pelaku pasar saat ini mencari katalis struktural baru dan level institusional yang segar."
  };

  return { phase, explanation: explanations[phase] || "" };
}

// ═══════════════════════════════════════════════════════════
// SMART MONEY INTENT ENGINE
// Analyzes combined signals to infer institutional objectives
// ═══════════════════════════════════════════════════════════

function computeSmartMoneyIntent(
  brokerInsights: BrokerInsight[],
  score: number,
  earlyDistributionFlag: boolean,
  tapeControlFlag: boolean,
  marketMode: string,
  convictionPhase: string
): { primaryIntent: string; secondaryIntent?: string; confidence: "Rendah" | "Sedang" | "Tinggi"; explanation: string } {
  const accumulatorCount = brokerInsights.filter(b => b.inferredRole === "Akumulator").length;
  const distributorCount = brokerInsights.filter(b => b.inferredRole === "Distributor").length;
  const operatorCount = brokerInsights.filter(b => b.inferredRole === "Operator").length;
  const brokerRoleMix = accumulatorCount > distributorCount ? "Dominan Akumulator" :
    distributorCount > accumulatorCount ? "Dominan Distributor" : "Seimbang";

  const flowQualityTrend = score > 70 ? "membaik" : score > 50 ? "stabil" : "melemah";

  let primaryIntent = "Pembangunan Inventori";
  let secondaryIntent: string | undefined = undefined;
  let intentConfidence: "Rendah" | "Sedang" | "Tinggi" = "Sedang";
  let intentExplanation = "";

  if (earlyDistributionFlag || marketMode === "Distribusi Saat Menguat") {
    primaryIntent = "Keluar Inventori";
    intentConfidence = earlyDistributionFlag ? "Tinggi" : "Sedang";
    if (flowQualityTrend === "melemah") intentConfidence = "Tinggi";
    intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan mengurangi eksposur sambil menjaga perilaku harga yang teratur. Kombinasi kualitas aliran internal yang memburuk dan aksi harga headline yang tangguh konsisten dengan pola rotasi institusional.";
  } else if (tapeControlFlag && score < 50 && brokerRoleMix === "Seimbang") {
    primaryIntent = "Pemanenan Likuiditas";
    intentConfidence = flowQualityTrend === "stabil" ? "Sedang" : "Rendah";
    intentExplanation = "Struktur mikro pasar menunjukkan churn tinggi dengan kemajuan arah bersih terbatas. Aktivitas broker tinggi tanpa bias akumulasi atau distribusi mungkin mengindikasikan penempatan taktis di sekitar level teknis kunci.";
  } else if (tapeControlFlag && score > 50) {
    primaryIntent = "Operasi Dukungan Harga";
    intentConfidence = operatorCount > 0 ? "Tinggi" : "Sedang";
    secondaryIntent = "Pembangunan Inventori";
    intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan secara aktif mengelola stabilitas harga di zona support. Perilaku tape mekanis dikombinasikan dengan kualitas aliran moderat menunjukkan posisi defensif daripada akumulasi agresif.";
  } else if (marketMode === "Akumulasi Tersembunyi" && convictionPhase === "Penempatan") {
    primaryIntent = "Pembangunan Inventori";
    intentConfidence = flowQualityTrend === "membaik" ? "Tinggi" : "Sedang";
    intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan membangun posisi secara diam-diam dengan pergeseran harga minimal. Pola akumulasi volatilitas rendah dan eksekusi terkendali konsisten dengan penempatan institusional tahap awal.";
  } else if (marketMode === "Akumulasi Aktif" && (convictionPhase === "Konfirmasi" || convictionPhase === "Kepadatan")) {
    primaryIntent = "Persiapan Mark-Up";
    intentConfidence = (score > 70 && flowQualityTrend === "membaik") ? "Tinggi" : "Sedang";
    secondaryIntent = "Pembangunan Inventori";
    intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan bertransisi dari akumulasi diam-diam ke pembangunan posisi yang lebih terlihat. Aliran bersih yang meluas dan kualitas aliran yang membaik mengindikasikan repositioning struktural menjelang katalis yang diantisipasi.";
  } else if (marketMode === "Distribusi Pasif" || marketMode === "Vakum Pasca-Distribusi") {
    primaryIntent = "Keluar Inventori";
    intentConfidence = flowQualityTrend === "melemah" ? "Tinggi" : "Sedang";
    intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan sebagian besar telah menyelesaikan siklus rotasi mereka. Berkurangnya sponsorship institusional dan kualitas aliran yang menurun mengindikasikan pencarian keseimbangan valuasi baru.";
  } else if (brokerRoleMix === "Dominan Akumulator" && score > 60) {
    primaryIntent = "Pembangunan Inventori";
    intentConfidence = flowQualityTrend === "membaik" ? "Tinggi" : "Sedang";
    intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan membangun posisi melalui absorpsi yang stabil. Aktivitas broker yang condong akumulator dan kualitas aliran moderat mendukung tesis penempatan institusional yang konstruktif.";
  } else {
    primaryIntent = "Pembangunan Inventori";
    intentConfidence = "Rendah";
    intentExplanation = "Pola aliran saat ini tidak menunjukkan intensi arah yang jelas. Pelaku pasar tampak menunggu katalis tambahan sebelum berkomitmen pada penempatan berkelanjutan. Pantau perubahan kualitas aliran atau komposisi peran broker.";
  }

  return { primaryIntent, secondaryIntent, confidence: intentConfidence, explanation: intentExplanation };
}

// ═══════════════════════════════════════════════════════════
// TRAP DETECTION ENGINE
// Bull Trap / Bear Trap detection from phase + flow signals
// ═══════════════════════════════════════════════════════════

function computeTrapDetection(
  currentPhaseLabel: string,
  flowBias: string
): { type: string; detected: boolean; confidence: string; title: string; explanation: string } {
  const bullTrapConditions =
    (currentPhaseLabel === "Distribution" || currentPhaseLabel === "Active Distribution") &&
    flowBias === "Distribusi";

  const bearTrapConditions =
    (currentPhaseLabel === "Stealth Accumulation" || currentPhaseLabel === "Active Accumulation") &&
    flowBias === "Akumulasi";

  if (bullTrapConditions) {
    return {
      type: "bull_trap",
      detected: true,
      confidence: currentPhaseLabel === "Active Distribution" ? "Tinggi" : "Sedang",
      title: "Potensi Bull Trap Terdeteksi",
      explanation: "Kenaikan harga saat ini terjadi bersamaan dengan peningkatan distribusi oleh broker besar. Stabilitas akumulasi menurun, menunjukkan bahwa kenaikan kemungkinan dimanfaatkan sebagai likuiditas keluar bagi pelaku besar. Pergerakan harga naik dapat menjadi jebakan bagi investor yang masuk terlambat."
    };
  }

  if (bearTrapConditions) {
    return {
      type: "bear_trap",
      detected: true,
      confidence: currentPhaseLabel === "Active Accumulation" ? "Tinggi" : "Sedang",
      title: "Potensi Bear Trap Terdeteksi",
      explanation: "Penurunan harga terjadi di tengah peningkatan akumulasi oleh broker institusi. Hal ini sering terjadi saat pelaku besar menekan harga sementara untuk mengumpulkan saham sebelum fase kenaikan berikutnya. Tekanan jual mungkin bersifat sementara dan taktis."
    };
  }

  return {
    type: "none",
    detected: false,
    confidence: "Rendah",
    title: "Tidak Ada Jebakan Signifikan Terdeteksi",
    explanation: "Saat ini tidak terdeteksi pola jebakan pasar yang signifikan. Perilaku aliran dana dan fase pasar menunjukkan pergerakan yang konsisten dengan fundamental."
  };
}

// ═══════════════════════════════════════════════════════════
// DECISION ENGINE (Part A)
// Determines stock status, sub-badge, reasons, and investor fit
// ═══════════════════════════════════════════════════════════

function computeDecisionEngine(
  score: number,
  earlyDistributionFlag: boolean,
  marketMode: string,
  brokerStabilityLevel: string
): { status: string; subBadge: string; reasons: string[]; primaryRisk: string; investorFit: string } {
  if (earlyDistributionFlag || marketMode.includes("Distribusi")) {
    return {
      status: "Perlu Waspada",
      subBadge: "Distribusi Awal",
      reasons: [
        "Aliran dana institusi menunjukkan tanda-tanda rotasi",
        "Stabilitas kendali bandar mulai menurun",
        "Struktur harga internal melemah"
      ],
      primaryRisk: "Tekanan jual institusional dapat meningkat jika rezim distribusi berlanjut.",
      investorFit: "Investor dengan toleransi risiko tinggi yang memahami dinamika rotasi institusional."
    };
  }

  if (score < 40 || marketMode === "Vakum Pasca-Distribusi") {
    return {
      status: "Hindari Sementara",
      subBadge: "Spekulatif",
      reasons: [
        "Dukungan institusi sangat terbatas",
        "Likuiditas pasar tipis",
        "Tidak ada katalis struktural yang jelas"
      ],
      primaryRisk: "Volatilitas tinggi tanpa dasar institusional yang kuat.",
      investorFit: "Tidak direkomendasikan untuk sebagian besar profil investor saat ini."
    };
  }

  if (score > 70 && brokerStabilityLevel === "Tinggi") {
    return {
      status: "Layak Dikoleksi Bertahap",
      subBadge: "Akumulasi Sehat",
      reasons: [
        "Aliran dana institusi konsisten dan tersinkronisasi",
        "Struktur harga terkontrol oleh pelaku dominan",
        "Risiko distribusi masih terbatas"
      ],
      primaryRisk: "Tesis dapat gagal jika terjadi pergeseran rezim ke distribusi secara mendadak.",
      investorFit: "Investor defensif hingga menengah yang mencari stabilitas dengan potensi apresiasi bertahap."
    };
  }

  if (score > 50 && brokerStabilityLevel === "Sedang") {
    return {
      status: "Layak Dikoleksi Bertahap",
      subBadge: "Akumulasi Rapuh",
      reasons: [
        "Akumulasi institusi terdeteksi namun belum sepenuhnya stabil",
        "Kendali bandar masih dalam tahap pembentukan",
        "Fundamental mendukung meski aliran dana fluktuatif"
      ],
      primaryRisk: "Kepemimpinan akumulasi yang berputar dapat menghambat momentum kenaikan.",
      investorFit: "Investor menengah yang bersedia menunggu konfirmasi lebih lanjut."
    };
  }

  return {
    status: "Perlu Waspada",
    subBadge: "Spekulatif",
    reasons: [
      "Konsensus institusi belum terbentuk",
      "Perilaku aliran dana masih terfragmentasi",
      "Memerlukan katalis tambahan untuk konfirmasi"
    ],
    primaryRisk: "Volatilitas dapat meningkat tanpa arah yang jelas.",
    investorFit: "Investor agresif dengan horizon waktu pendek dan toleransi volatilitas tinggi."
  };
}

// ═══════════════════════════════════════════════════════════
// CONTROL QUALITY SCORE (Part B)
// Merges flow quality, reliability, and broker stability
// ═══════════════════════════════════════════════════════════

function computeControlQualityScore(
  flowQualityVal: number,
  flowReliability: string,
  brokerStabilityVal: number
): { score: number; level: string; interpretation: string } {
  const reliability = flowReliability === "Tinggi" ? 90 :
    flowReliability === "Sedang" ? 60 : 30;

  const combined = Math.round(flowQualityVal * 0.4 + reliability * 0.3 + brokerStabilityVal * 0.3);

  let level = "Rendah";
  let interpretation = "";

  if (combined >= 70) {
    level = "Tinggi";
    interpretation = "Kendali bandar sangat kuat dengan aliran dana berkualitas tinggi dan konsistensi institusi yang terjaga.";
  } else if (combined >= 50) {
    level = "Sedang";
    interpretation = "Kendali bandar cukup terstruktur namun memerlukan pemantauan berkelanjutan terhadap perubahan perilaku institusi.";
  } else {
    level = "Rendah";
    interpretation = "Kendali bandar lemah atau terfragmentasi. Pergerakan harga mungkin tidak didukung fondasi institusional yang kuat.";
  }

  return { score: combined, level, interpretation };
}

// ═══════════════════════════════════════════════════════════
// INSIDER-BANDAR ALIGNMENT
// ═══════════════════════════════════════════════════════════

function computeInsiderAlignment(
  flowBias: string,
  insiderData: any,
  score: number
): { status: string; interpretation: string } {
  const flowDirection = flowBias === "Akumulasi" ? "BUY" : "SELL";

  let insiderParsed: any = null;
  if (insiderData) {
    try {
      insiderParsed = typeof insiderData === "string"
        ? JSON.parse(insiderData)
        : insiderData;
    } catch {}
  }
  const insiderDir = getInsiderDirection(insiderParsed);

  if (insiderDir === "NO_DATA") {
    return {
      status: "Netral",
      interpretation: "Data transaksi insider tidak tersedia. Tidak dapat menilai keselarasan dengan perilaku bandar."
    };
  }

  if (flowDirection === insiderDir && score > 60) {
    return {
      status: "Selaras",
      interpretation: "Aktivitas insider sejalan dengan perilaku bandar. Manajemen menunjukkan keyakinan yang konsisten dengan akumulasi institusi, memperkuat validitas tesis fundamental."
    };
  }

  if (flowDirection !== insiderDir && insiderDir !== "NEUTRAL") {
    return {
      status: "Bertentangan",
      interpretation: "Aktivitas insider berlawanan dengan arah aliran institusi. Divergensi ini memerlukan perhatian khusus karena insider mungkin memiliki informasi yang belum tercermin di pasar."
    };
  }

  return {
    status: "Netral",
    interpretation: "Aktivitas insider tidak memberikan sinyal arah yang jelas relatif terhadap perilaku bandar. Pantau perkembangan transaksi insider untuk konfirmasi lebih lanjut."
  };
}

// ═══════════════════════════════════════════════════════════
// SIMPLIFIED RISK (Part C)
// ═══════════════════════════════════════════════════════════

function computeSimplifiedRisk(
  score: number,
  earlyDistributionFlag: boolean,
  marketMode: string,
  brokerStabilityLevel: string
): { level: string; explanation: string; failureTriggers: string[] } {
  if (earlyDistributionFlag || marketMode.includes("Distribusi")) {
    return {
      level: "Tinggi",
      explanation: "Struktur aliran dana internal menunjukkan rotasi institusional sedang berlangsung. Meski harga mungkin masih bertahan, fondasi akumulasi mulai melemah dan risiko koreksi meningkat jika distribusi berlanjut.",
      failureTriggers: [
        "Distribusi mendadak oleh broker dominan",
        "Pergeseran rezim ke Vakum Pasca-Distribusi",
        "Hilangnya stabilitas kendali bandar"
      ]
    };
  }

  if (score < 40) {
    return {
      level: "Tinggi",
      explanation: "Dukungan institusional sangat terbatas pada level saat ini. Tanpa sponsor institusi yang jelas, pergerakan harga rentan terhadap volatilitas acak dan tekanan jual ritel.",
      failureTriggers: [
        "Tidak ada pemulihan aliran institusi dalam 5-10 hari",
        "Penembusan level support teknis kunci",
        "Pergeseran sentimen makro negatif"
      ]
    };
  }

  if (score > 70 && brokerStabilityLevel === "Tinggi") {
    return {
      level: "Rendah",
      explanation: "Profil risiko terkendali dengan dukungan institusi yang kuat dan konsisten. Struktur akumulasi sehat mengurangi probabilitas koreksi signifikan dalam jangka pendek.",
      failureTriggers: [
        "Pergeseran mendadak rezim pasar ke distribusi",
        "Keluar masif dari broker dominan",
        "Kejutan negatif fundamental yang signifikan"
      ]
    };
  }

  return {
    level: "Sedang",
    explanation: "Risiko dalam batas wajar dengan dukungan institusi moderat. Pergerakan harga didukung fondasi yang cukup namun memerlukan validasi berkelanjutan dari aliran dana.",
    failureTriggers: [
      "Penurunan stabilitas broker di bawah 40%",
      "Akumulasi berubah menjadi distribusi",
      "Kehilangan momentum aliran positif"
    ]
  };
}

// ═══════════════════════════════════════════════════════════
// SMART MONEY READINESS SCORE (Core Intelligence)
// Answers: "Seberapa siap saham ini untuk masuk fase kenaikan?"
// ═══════════════════════════════════════════════════════════

function computeSmartMoneyReadinessScore(
  marketMode: string,
  controlQualityScore: { score: number; level: string },
  brokerStabilityLevel: string,
  flowBias: string,
  flowReliability: string,
  simplifiedRisk: { level: string },
  insiderAlignment: { status: string },
  earlyDistributionFlag: boolean
): {
  score: number;
  statusLabel: string;
  shortExplanation: string;
  gradingExplanation: string;
  hasInconsistency: boolean;
  inconsistencyNote: string;
  components: Array<{ name: string; weight: string; condition: string }>;
} {
  // 1) MARKET REGIME (30%)
  let regimeScore = 0;
  let regimeCondition = "";
  switch (marketMode) {
    case "Akumulasi Tersembunyi":
      regimeScore = 24;
      regimeCondition = "Akumulasi Tersembunyi";
      break;
    case "Akumulasi Aktif":
      regimeScore = 28;
      regimeCondition = "Akumulasi Aktif";
      break;
    case "Distribusi Saat Menguat":
      regimeScore = 12;
      regimeCondition = "Distribusi Awal";
      break;
    case "Distribusi Pasif":
      regimeScore = 7;
      regimeCondition = "Distribusi Pasif";
      break;
    case "Vakum Pasca-Distribusi":
      regimeScore = 3;
      regimeCondition = "Pasca-Distribusi";
      break;
    default:
      regimeScore = 15;
      regimeCondition = "Transisi";
  }

  // 2) KUALITAS KENDALI BANDAR (25%)
  let controlScore = 0;
  let controlCondition = "";
  const combinedControl = controlQualityScore.score;
  if (combinedControl >= 70 && brokerStabilityLevel === "Tinggi") {
    controlScore = 23;
    controlCondition = "Kuat & Stabil";
  } else if (combinedControl >= 50 && brokerStabilityLevel !== "Rendah") {
    controlScore = 16;
    controlCondition = "Ada, Tapi Rapuh";
  } else if (combinedControl >= 30) {
    controlScore = 8;
    controlCondition = "Terfragmentasi";
  } else {
    controlScore = 2;
    controlCondition = "Distribusi Dominan";
  }

  // 3) ABSORPTION vs PRESSURE (20%)
  let absorptionScore = 0;
  let absorptionCondition = "";
  if (flowBias === "Akumulasi" && flowReliability === "Tinggi") {
    absorptionScore = 18;
    absorptionCondition = "Konsisten";
  } else if (flowBias === "Akumulasi") {
    absorptionScore = 12;
    absorptionCondition = "Parsial";
  } else {
    absorptionScore = 4;
    absorptionCondition = "Tekanan Jual";
  }

  // 4) DISTRIBUTION RISK (15%) - PENALTY
  let riskScore = 0;
  let riskCondition = "";
  if (simplifiedRisk.level === "Rendah") {
    riskScore = 13;
    riskCondition = "Rendah";
  } else if (simplifiedRisk.level === "Sedang") {
    riskScore = 8;
    riskCondition = "Sedang";
  } else {
    riskScore = 3;
    riskCondition = "Tinggi";
  }

  // 5) INSIDER ALIGNMENT (10%)
  let insiderScore = 0;
  let insiderCondition = "";
  if (insiderAlignment.status === "Selaras") {
    insiderScore = 9;
    insiderCondition = "Selaras";
  } else if (insiderAlignment.status === "Netral") {
    insiderScore = 5;
    insiderCondition = "Netral";
  } else {
    insiderScore = 2;
    insiderCondition = "Bertentangan";
  }

  const totalScore = regimeScore + controlScore + absorptionScore + riskScore + insiderScore;

  // Check for inconsistencies
  let hasInconsistency = false;
  if (marketMode.includes("Akumulasi") && simplifiedRisk.level === "Tinggi") {
    hasInconsistency = true;
  }
  if (marketMode.includes("Akumulasi") && insiderAlignment.status === "Bertentangan") {
    hasInconsistency = true;
  }
  if (controlQualityScore.level === "Tinggi" && earlyDistributionFlag) {
    hasInconsistency = true;
  }

  let inconsistencyNote = "";
  if (hasInconsistency) {
    inconsistencyNote = "Beberapa sinyal belum sepenuhnya selaras.";
  }

  const adjustedScore = hasInconsistency ? Math.max(0, totalScore - 7) : totalScore;

  let statusLabel = "";
  let shortExplanation = "";

  if (adjustedScore >= 75) {
    statusLabel = "Struktur Mendukung Kesiapan Kenaikan";
    shortExplanation = "Indikasi struktural menunjukkan probabilitas lebih tinggi untuk potensi fase kenaikan. Ini bukan sinyal waktu masuk, melainkan penilaian kesiapan berdasarkan perilaku institusi.";
  } else if (adjustedScore >= 55) {
    statusLabel = "Struktur Membaik, Perlu Konfirmasi";
    shortExplanation = "Struktur aliran dana mendukung, namun fase kampanye belum sepenuhnya matang. Perlu validasi lanjutan dari perilaku institusi.";
  } else if (adjustedScore >= 35) {
    statusLabel = "Belum Siap, Risiko Masih Tinggi";
    shortExplanation = "Fondasi institusional belum cukup kuat. Diperlukan perbaikan struktural sebelum kondisi mendukung potensi kenaikan.";
  } else {
    statusLabel = "Struktur Tidak Mendukung";
    shortExplanation = "Kondisi struktural saat ini tidak mengindikasikan kesiapan untuk fase kenaikan. Fokus pada pemantauan perubahan rezim pasar.";
  }

  if (hasInconsistency) {
    shortExplanation += " " + inconsistencyNote;
  }

  const gradingExplanation = "Skor ini merupakan indikator kesiapan struktural, bukan sinyal beli atau prediksi pergerakan harga. Perhitungan mencakup kombinasi fase pasar, kualitas kendali bandar, kemampuan pasar menyerap tekanan jual, tingkat risiko distribusi, serta keselarasan perilaku insider. Gunakan sebagai salah satu pertimbangan dalam analisis menyeluruh, bukan sebagai satu-satunya dasar keputusan investasi.";

  return {
    score: adjustedScore,
    statusLabel,
    shortExplanation,
    gradingExplanation,
    hasInconsistency,
    inconsistencyNote,
    components: [
      { name: "Rezim Pasar", weight: "30%", condition: regimeCondition },
      { name: "Kendali Bandar", weight: "25%", condition: controlCondition },
      { name: "Absorpsi", weight: "20%", condition: absorptionCondition },
      { name: "Risiko Distribusi", weight: "15%", condition: riskCondition },
      { name: "Insider", weight: "10%", condition: insiderCondition }
    ]
  };
}

// ═══════════════════════════════════════════════════════════
// MODEL 6: FLOW NORMALIZATION (v1.1)
// CRITICAL FIX B-1: Includes negative range for distribution
// ═══════════════════════════════════════════════════════════

function computeFlowNormalized(input: BandarmologyInput): ScoreWithExplanation {
  const flow = input.flow || { netForeignFlow: input.netForeignBuyIdr, netDomesticFlow: input.netDomesticBuyIdr };
  const totalNetFlow = flow.netForeignFlow + flow.netDomesticFlow;

  if (!input.volume || input.volume.avg20dValue <= 0) {
    return {
      score: 0,
      level: "Sangat Lemah",
      components: [],
      explanation: "Data nilai transaksi historis tidak tersedia",
      isReliable: false,
      reliabilityNote: "avg20dValue tidak tersedia"
    };
  }

  const ratio = totalNetFlow / input.volume.avg20dValue;

  const score = clamp100(((ratio + 0.5) / 2.0) * 100);

  return {
    score,
    level: buildLevelLabel(score),
    components: [],
    explanation: `Aliran bersih relatif terhadap rata-rata nilai transaksi menghasilkan rasio ${ratio.toFixed(2)}`,
    isReliable: true,
    reliabilityNote: null
  };
}

// ═══════════════════════════════════════════════════════════
// MODEL 7: BROKER ROTATION (v1.1)
// Stable until historical broker DB exists
// ═══════════════════════════════════════════════════════════

function computeBrokerRotation(input: BandarmologyInput): ScoreWithExplanation {
  const brokers = input.brokers || input.brokerData;

  if (!brokers || brokers.length < 5) {
    return {
      score: 50,
      level: "Sedang",
      components: [],
      explanation: "Data broker historis tidak cukup",
      isReliable: false,
      reliabilityNote: "Broker history <2 sessions"
    };
  }

  parseBrokers(brokers)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 5)
    .map(b => b.code);

  return {
    score: 50,
    level: "Sedang",
    components: [],
    explanation: "Model rotasi broker membutuhkan data multi-hari",
    isReliable: false,
    reliabilityNote: "Broker history belum tersedia"
  };
}

// ═══════════════════════════════════════════════════════════
// MODEL 8: STEALTH ACCUMULATION (v1.1)
// CRITICAL FIX B-2: Slight negative slopes allowed
// ═══════════════════════════════════════════════════════════

function computeStealthAccumulation(
  input: BandarmologyInput,
  flowNormalizedScore: number
): ScoreWithExplanation {
  if (!input.priceHistory || input.priceHistory.length < 5) {
    return {
      score: 50,
      level: "Sedang",
      components: [],
      explanation: "Data harga historis tidak cukup",
      isReliable: false,
      reliabilityNote: "priceHistory <5"
    };
  }

  const prices = input.priceHistory;
  const n = prices.length;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  let slopeScore: number;
  if (slope < -0.005) slopeScore = 20;
  else if (slope < -0.001) slopeScore = 55;
  else if (slope < 0.000) slopeScore = 65;
  else if (slope < 0.002) slopeScore = 70;
  else if (slope < 0.005) slopeScore = 80;
  else if (slope < 0.010) slopeScore = 60;
  else slopeScore = 35;

  const vol = input.volume || { todayVolume: 0, avg20dVolume: 1, avg20dValue: 0 };
  const volumeRatio = vol.todayVolume / Math.max(vol.avg20dVolume, 1);

  let volumeScore: number;
  if (volumeRatio < 0.7) volumeScore = 30;
  else if (volumeRatio < 1.3) volumeScore = 90;
  else if (volumeRatio < 2) volumeScore = 60;
  else volumeScore = 30;

  const score = clamp100(
    flowNormalizedScore * 0.40 +
    slopeScore * 0.30 +
    volumeScore * 0.30
  );

  return {
    score,
    level: buildLevelLabel(score),
    components: [],
    explanation: "Deteksi akumulasi stealth berdasarkan tren harga dan aliran",
    isReliable: true,
    reliabilityNote: null
  };
}

// ═══════════════════════════════════════════════════════════
// MODEL 9: FAKE BREAKOUT RISK (v1.1)
// ═══════════════════════════════════════════════════════════

function computeFakeBreakoutRisk(
  input: BandarmologyInput,
  flowNormalized: number,
  brokerDominance: number
): ScoreWithExplanation {
  const p = input.price || {
    close: input.lastPrice || 0,
    prevClose: input.lastPrice || 1,
    high: input.lastPrice || 0,
    low: input.lastPrice || 0
  };

  const priceChangePct = ((p.close - p.prevClose) / Math.max(p.prevClose, 1)) * 100;

  let priceScore: number;
  if (priceChangePct < 1) priceScore = 10;
  else if (priceChangePct < 3) priceScore = 40;
  else if (priceChangePct < 6) priceScore = 70;
  else priceScore = 90;

  const weakFlow = 100 - flowNormalized;
  const weakDominance = 100 - brokerDominance;

  const range = (p.high - p.low) / Math.max(p.close, 1);

  let volScore: number;
  if (range < 0.01) volScore = 10;
  else if (range < 0.02) volScore = 30;
  else if (range < 0.04) volScore = 70;
  else volScore = 90;

  const score = clamp100(
    priceScore * 0.35 +
    weakFlow * 0.30 +
    weakDominance * 0.20 +
    volScore * 0.15
  );

  return {
    score,
    level: buildLevelLabel(score),
    components: [],
    explanation: "Risiko breakout palsu berdasarkan harga dan dukungan institusi",
    isReliable: true,
    reliabilityNote: null
  };
}

// ═══════════════════════════════════════════════════════════
// MODEL 10: REGIME PROBABILITIES (v1.1)
// ═══════════════════════════════════════════════════════════

function computeRegimeProbabilities(
  accumulation: number,
  absorption: number,
  dominance: number,
  risk: number
): { strongAccumulation: number; distribution: number; sideways: number } {
  const strongRaw = accumulation * 0.4 + absorption * 0.3 + dominance * 0.3;
  const distRaw = risk * 0.6 + (100 - accumulation) * 0.4;
  const sideRaw = 100 - Math.abs(accumulation - 50) * 2;

  const total = strongRaw + distRaw + sideRaw;

  if (total <= 0) {
    return { strongAccumulation: 33, distribution: 33, sideways: 34 };
  }

  return {
    strongAccumulation: clamp100(strongRaw / total * 100),
    distribution: clamp100(distRaw / total * 100),
    sideways: clamp100(sideRaw / total * 100)
  };
}

// ═══════════════════════════════════════════════════════════
// BUILD INPUT FROM RAW STOCK / PAYLOAD DATA
// Transforms raw API payload into BandarmologyInput
// ═══════════════════════════════════════════════════════════

export function buildBandarmologyInput(payload: any, stockData?: any): BandarmologyInput {
  let brokerArr: any[] = [];
  try {
    if (payload.broker_data) {
      brokerArr = Array.isArray(payload.broker_data) ? payload.broker_data : JSON.parse(payload.broker_data);
    } else if (stockData?.brokerData) {
      brokerArr = typeof stockData.brokerData === "string" ? JSON.parse(stockData.brokerData) : stockData.brokerData;
    }
  } catch { brokerArr = []; }

  const flowSignals = payload.flow_signals || {};
  const priceContext = payload.price_context || {};

  return {
    flowBias: flowSignals.flow_bias || stockData?.flowBias || "Netral",
    flowIntensity: flowSignals.flow_intensity || stockData?.flowIntensity || "",
    flowReliability: flowSignals.flow_reliability || stockData?.flowReliability || "Sedang",
    netForeignBuyIdr: flowSignals.net_foreign_buy_idr || 0,
    netDomesticBuyIdr: flowSignals.net_domestic_buy_idr || 0,
    buyAvg: flowSignals.buy_avg_price || 0,
    sellAvg: flowSignals.sell_avg_price || 0,
    lastPrice: priceContext.last_price || 0,
    brokerData: brokerArr,
    foreignActivityData: stockData?.foreignActivityData || "{}",
    changePercent: parseFloat(String(stockData?.changePercent || payload.changePercent || "0")),
    growth: parseFloat(String(stockData?.growth || "0")),
    insiderData: stockData?.insiderData || null,
    stockCharacter: stockData?.stockCharacter || null,
    eventType: payload.event_specifics?.event_type || ""
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPUTATION FUNCTION
// Single entry point for ALL bandarmology intelligence
// ═══════════════════════════════════════════════════════════

export function computeBandarmology(input: BandarmologyInput): BandarmologyResult {
  // ─── STEP 1: FLOW QUALITY SCORE ───
  let flowQuality = calculateFlowQualityScore({
    netForeignFlow: input.netForeignBuyIdr,
    netDomesticFlow: input.netDomesticBuyIdr,
    flowIntensity: input.flowIntensity,
    buyAvg: input.buyAvg,
    lastPrice: input.lastPrice,
    flowReliability: input.flowReliability,
    sellAvg: input.sellAvg
  });
  flowQuality = Math.max(0, Math.min(100, flowQuality));

  // ─── STEP 2: EARLY DISTRIBUTION DETECTION ───
  const distributionSignals: string[] = [];
  if (input.netForeignBuyIdr > 0 && input.lastPrice <= input.buyAvg * 1.01) {
    distributionSignals.push("Price structure weakening relative to net inflow.");
  }
  if (input.flowIntensity.includes("Moderate") && input.flowReliability !== "High") {
    distributionSignals.push("Institutional concentration rising with inconsistent execution quality.");
  }
  if (input.buyAvg && input.sellAvg >= input.buyAvg * 0.995) {
    distributionSignals.push("Distribution average gaining pricing power over accumulation.");
  }
  if (input.eventType === "Market Update") {
    distributionSignals.push("Narrative exhaustion detected; lack of new structural catalysts.");
  }

  const earlyDistributionFlag = distributionSignals.length >= 3;
  const earlyDistributionExplanation = earlyDistributionFlag
    ? `Analisis menunjukkan ${distributionSignals.length} sinyal distribusi mulai muncul. Meski aliran bersih masih positif, struktur harga internal dan kekuatan jual menunjukkan fase distribusi awal. Pelaku pasar perlu waspada terhadap potensi jebakan likuiditas karena smart money tampak melakukan rotasi di tengah penguatan harga.`
    : "Struktur aliran dana saat ini masih sehat dengan partisipasi institusi yang tersinkronisasi dan eksekusi yang efisien.";

  // ─── STEP 3: BROKER CONTROL SCORE ───
  const brokerControlScore = computeBrokerControlScore(input.brokerData);

  // ─── STEP 4: BROKER STABILITY SCORE ───
  const brokerStabilityScore = calculateBrokerStabilityScore(input.brokerData);

  // ─── STEP 5: TAPE CONTROL DETECTION ───
  const tapeControlSignals: string[] = [];
  if (input.lastPrice > input.buyAvg && input.flowIntensity === "Neutral") {
    tapeControlSignals.push("Mechanical price support observed during neutral organic flow.");
  }
  if (input.sellAvg >= input.buyAvg * 0.998) {
    tapeControlSignals.push("Tight execution corridor suggests inventory recycling between dominant participants.");
  }
  const tapeControlFlag = tapeControlSignals.length >= 2;
  const tapeControlExplanation = tapeControlFlag
    ? "Perilaku harga tampak didukung secara mekanis daripada organik. Kontrol tape menunjukkan fase konsolidasi inventori oleh pelaku dominan, kemungkinan untuk menstabilkan level harga saat ini."
    : "Aktivitas pasar tampak didorong oleh partisipasi institusi organik tanpa tanda-tanda signifikan pertahanan harga mekanis.";

  // ─── STEP 6: BROKER CLASSIFICATION ───
  const brokerInsights = classifyBrokers(input.brokerData, tapeControlFlag);

  // ─── STEP 7: MARKET MODE (A/D Engine) ───
  const { mode: marketMode, explanation: marketModeExplanation } =
    computeMarketMode(flowQuality, earlyDistributionFlag, tapeControlFlag, input.flowBias);

  // ─── STEP 8: CONVICTION PHASE ───
  const conviction = computeConvictionPhase(flowQuality, earlyDistributionFlag, marketMode);
  let convictionExplanation = conviction.explanation;

  // ─── STEP 9: SMART MONEY INTENT ───
  const smartMoneyIntent = computeSmartMoneyIntent(
    brokerInsights, flowQuality, earlyDistributionFlag, tapeControlFlag, marketMode, conviction.phase
  );

  // Modify conviction explanation based on intent
  if (smartMoneyIntent.primaryIntent === "Persiapan Mark-Up") {
    convictionExplanation += " Analisis intensi smart money memperkuat pandangan konstruktif, dengan karakteristik aliran menunjukkan persiapan aktif untuk potensi apresiasi harga.";
  } else if (smartMoneyIntent.primaryIntent === "Keluar Inventori" && (conviction.phase === "Kepadatan" || conviction.phase === "Distribusi")) {
    convictionExplanation += " Namun, analisis intensi smart money menunjukkan rotasi institusional mungkin sedang berlangsung meski level posisi tinggi. Keyakinan tahap akhir perlu diperlakukan dengan hati-hati.";
  } else if (smartMoneyIntent.primaryIntent === "Pemanenan Likuiditas") {
    convictionExplanation += " Pola churn tinggi menunjukkan aktivitas taktis yang mungkin tidak diterjemahkan menjadi keyakinan arah berkelanjutan.";
  }

  // ─── STEP 10: FLOW QUALITY INTERPRETATION ───
  let flowQualityInterpretation = "";
  if (flowQuality > 80) flowQualityInterpretation = "Keyakinan institusional luar biasa ditandai sinkronisasi tinggi antar tipe pelaku.";
  else if (flowQuality > 60) flowQualityInterpretation = "Pola akumulasi solid dengan reliabilitas moderat; memerlukan validasi katalis struktural berkelanjutan.";
  else if (flowQuality > 40) flowQualityInterpretation = "Dinamika aliran netral menunjukkan kurangnya konsensus institusional yang jelas pada level valuasi saat ini.";
  else if (flowQuality > 20) flowQualityInterpretation = "Bias distribusi mulai muncul; pelaku institusi tampak mengurangi eksposur selama volatilitas.";
  else flowQualityInterpretation = "Distribusi signifikan dari berbagai meja, menunjukkan penurunan keyakinan institusional secara luas.";

  // ─── STEP 11: PHASE DETECTION ───
  const currentPhaseLabel = detectAccumulationPhase({
    flowBias: input.flowBias,
    flowIntensity: input.flowIntensity,
    flowReliability: input.flowReliability
  });

  const bandarHeatmap = input.brokerData
    .slice(0, 5)
    .map((b: any) => ({
      broker: b.code,
      net: parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell)
    }));

  const phaseTimeline = [{
    phase: currentPhaseLabel,
    confidence: input.flowReliability
  }];

  const bandarPhaseInterpretation = `Fase saat ini terdeteksi sebagai "${currentPhaseLabel}" berdasarkan bias aliran (${input.flowBias}), intensitas (${input.flowIntensity}), dan reliabilitas (${input.flowReliability}). Interpretasi ini diturunkan secara deterministik dari sinyal pasar aktual.`;

  // ─── STEP 12: TRAP DETECTION ───
  const trapDetection = computeTrapDetection(currentPhaseLabel, input.flowBias);

  // ─── STEP 13: DECISION ENGINE (Part A) ───
  const decisionEngine = computeDecisionEngine(
    flowQuality, earlyDistributionFlag, marketMode, brokerStabilityScore.level
  );

  // ─── STEP 14: CONTROL QUALITY (Part B) ───
  const controlQualityScore = computeControlQualityScore(
    flowQuality, input.flowReliability, brokerStabilityScore.score
  );

  // ─── STEP 15: INSIDER-BANDAR ALIGNMENT ───
  const insiderBandarAlignment = computeInsiderAlignment(
    input.flowBias, input.insiderData, flowQuality
  );

  // ─── STEP 16: SIMPLIFIED RISK (Part C) ───
  const simplifiedRisk = computeSimplifiedRisk(
    flowQuality, earlyDistributionFlag, marketMode, brokerStabilityScore.level
  );

  // ─── STEP 17: SMART MONEY READINESS SCORE ───
  const smartMoneyReadinessScore = computeSmartMoneyReadinessScore(
    marketMode,
    controlQualityScore,
    brokerStabilityScore.level,
    input.flowBias,
    input.flowReliability,
    simplifiedRisk,
    insiderBandarAlignment,
    earlyDistributionFlag
  );

  // ─── STEP 18: GORENGAN DETECTION ───
  const foreignParsed = parseForeignData(input.foreignActivityData || "{}");
  const sortedBrokers = [...input.brokerData].sort((a, b) => {
    const aNet = parseBrokerIDR(a.netBuy) - parseBrokerIDR(a.netSell);
    const bNet = parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell);
    return bNet - aNet;
  });
  const totalNetBuy = input.brokerData.reduce((sum: number, b: any) => sum + Math.max(0, parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell)), 0);
  const top3NetBuy = sortedBrokers.slice(0, 3).reduce((sum, b) => sum + Math.max(0, parseBrokerIDR(b.netBuy) - parseBrokerIDR(b.netSell)), 0);
  const top3Percent = totalNetBuy > 0 ? (top3NetBuy / totalNetBuy) * 100 : 50;
  const hasBrokerFragmentation = input.brokerData.length > 10 && top3Percent < 40;
  const totalVolume = input.brokerData.reduce((s: number, b: any) => s + parseBrokerIDR(b.netBuy) + parseBrokerIDR(b.netSell), 0);
  const smallBrokerCount = totalVolume > 0
    ? input.brokerData.filter((b: any) => parseBrokerIDR(b.netBuy) + parseBrokerIDR(b.netSell) < totalVolume * 0.02).length
    : 0;
  const retailProxyDominates = input.brokerData.length > 0 && smallBrokerCount > input.brokerData.length * 0.5;
  const foreignFlowAbsent = Math.abs(foreignParsed.netForeignFlow) < Math.abs(foreignParsed.netDomesticFlow) * 0.1;
  const hasAccumulationLadder = input.flowReliability === "Tinggi" && input.flowBias === "Akumulasi" && !input.flowIntensity.includes("Distribusi");
  const priceChangePercent = Math.abs(input.changePercent);
  let gorenganRegime = "Transisi";
  if (input.flowBias === "Akumulasi") {
    gorenganRegime = input.flowIntensity.includes("Besar") ? "Active Accumulation" : "Akumulasi Awal";
  } else if (input.flowBias === "Distribusi") {
    gorenganRegime = "Distribution into Strength";
  }
  const avgBuyPrice = parseFloat(String(sortedBrokers[0]?.avgBuy || "0").replace(/[^\d.]/g, "")) || 0;
  const volumeRatio = 1.2;
  const hasTapeControlResult = detectTapeControl({
    high: avgBuyPrice * 1.002,
    low: avgBuyPrice * 0.998,
    lastPrice: avgBuyPrice,
    volumeRatio,
    netFlow: totalNetBuy,
    buyAvg: avgBuyPrice
  });

  const gorenganResult = detectGorengan({
    priceChangePercent5d: priceChangePercent,
    hasIntradaySpikes: priceChangePercent > 10,
    volumeRatio,
    top3BrokerNetBuyPercent: top3Percent,
    hasBrokerFragmentation,
    retailProxyDominates,
    smallLotDominates: input.brokerData.length > 15 && top3Percent < 25,
    foreignFlowAbsent,
    hasAccumulationLadder,
    marketRegime: gorenganRegime,
    hasTapeControl: hasTapeControlResult,
    hasAbsorptionFailure: input.flowBias === "Distribusi" && priceChangePercent > 0,
    hasPostSpikeDistribution: input.flowBias === "Distribusi" && priceChangePercent > 15
  });

  // ─── STEP 19: FLOW NORMALIZATION (v1.1 — Model 6, fix B-1) ───
  const flowNormalized = computeFlowNormalized(input);

  // ─── STEP 20: BROKER ROTATION (v1.1 — Model 7) ───
  const brokerRotation = computeBrokerRotation(input);

  // ─── STEP 21: STEALTH ACCUMULATION (v1.1 — Model 8, fix B-2) ───
  const stealthAccumulation = computeStealthAccumulation(input, flowNormalized.score);

  // ─── STEP 22: FAKE BREAKOUT RISK (v1.1 — Model 9) ───
  const fakeBreakoutRisk = computeFakeBreakoutRisk(
    input,
    flowNormalized.score,
    brokerControlScore.score
  );

  // ─── STEP 23: REGIME PROBABILITIES (v1.1 — Model 10) ───
  const regimeProbabilities = computeRegimeProbabilities(
    smartMoneyReadinessScore.score,
    flowQuality,
    brokerControlScore.score,
    simplifiedRisk.level === "Tinggi" ? 80 : simplifiedRisk.level === "Sedang" ? 50 : 20
  );

  // ─── RETURN COMPLETE RESULT ───
  return {
    engineVersion: "1.1.0",
    flowQualityScore: flowQuality,
    flowQualityInterpretation,
    earlyDistributionFlag,
    earlyDistributionExplanation,
    brokerControlScore,
    brokerStabilityScore,
    tapeControlFlag,
    tapeControlExplanation,
    brokerInsights,
    marketMode,
    marketModeExplanation,
    convictionPhase: conviction.phase,
    convictionExplanation,
    smartMoneyIntent,
    currentPhaseLabel,
    bandarHeatmap,
    phaseTimeline,
    bandarPhaseInterpretation,
    trapDetection,
    decisionEngine,
    controlQualityScore,
    insiderBandarAlignment,
    simplifiedRisk,
    smartMoneyReadinessScore,
    gorenganResult,
    flowNormalized,
    brokerRotation,
    stealthAccumulation,
    fakeBreakoutRisk,
    regimeProbabilities
  };
}
