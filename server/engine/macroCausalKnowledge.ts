/**
 * ============================================================
 * MACRO CAUSAL KNOWLEDGE BASE v1.0
 * ============================================================
 * server/engine/macroCausalKnowledge.ts
 *
 * Deterministic domain knowledge: macro events and their
 * downstream effects on IDX sectors/stocks.
 * NOT fetched from anywhere — purely hardcoded expertise.
 *
 * Used by newsAnalyzer.ts to inject specific IDX mechanics
 * into Claude's prompt BEFORE it generates its analysis,
 * so Claude has institutional-quality context even for
 * macro events it hasn't seen before.
 * ============================================================
 */

// ── Types ────────────────────────────────────────────────────

export interface HistoricalEffect {
  direction:  'POSITIF' | 'NEGATIF' | 'MIXED';
  magnitude:  'KUAT' | 'SEDANG' | 'LEMAH';
  lagSessions: number; // typical lag in trading sessions before full effect
  historicalExample?: string;
}

export interface MacroCausalEvent {
  eventType:         string;         // unique identifier
  trigger:           string;         // what causes this event
  mechanism:         string;         // full causal chain (detail for Claude context)
  affectedSectors:   string[];       // IDX sector names
  affectedStockTypes: string[];      // types of stocks most exposed
  historicalEffect:  HistoricalEffect;
  overrideStrength:  'HARD' | 'SOFT';
  keywords:          string[];       // lowercase keywords for matching article text
}

// ── Knowledge base ────────────────────────────────────────────

const MACRO_CAUSAL_EVENTS: MacroCausalEvent[] = [
  {
    eventType: 'SOVEREIGN_DOWNGRADE_FITCH',
    trigger: 'Fitch Ratings menurunkan peringkat kredit Indonesia dari BBB ke BB+ atau lebih rendah',
    mechanism:
      'Dana asing dengan mandat investment-grade (IG) terpaksa menjual posisi Indonesia secara mekanis. ' +
      'Saham dengan kepemilikan asing >30% (misalnya BBCA, TLKM, UNVR) mengalami tekanan jual paksa. ' +
      'Efek contagion: investor domestik ikut panik → volume jual meningkat tajam hari H dan H+1. ' +
      'Biaya pinjaman korporat naik karena sovereign ceiling → margin perbankan tertekan. ' +
      'Historis: downgrade S&P 2011 memicu IHSG turun ~8% dalam 2 sesi.',
    affectedSectors:   ['Financials', 'Consumer Staples', 'Industrials', 'Telecommunication'],
    affectedStockTypes: ['Blue Chip', 'MSCI Constituent', 'LQ45', 'High Foreign Ownership'],
    historicalEffect: {
      direction:   'NEGATIF',
      magnitude:   'KUAT',
      lagSessions: 0,
      historicalExample: 'S&P downgrade 2011: IHSG -8% dalam 2 sesi; BBCA -6%, TLKM -9%',
    },
    overrideStrength: 'HARD',
    keywords: [
      'fitch', 'downgrade', 'investment grade', 'peringkat', 'kredit indonesia',
      'bb+', 'bbb-', 'rating', 'sovereign', 'junk bond',
    ],
  },

  {
    eventType: 'MSCI_REBALANCING',
    trigger: 'MSCI Quarterly Rebalancing — penambahan atau penghapusan saham IDX dari indeks MSCI',
    mechanism:
      'ETF pasif yang melacak MSCI Emerging Markets wajib membeli/menjual saham terdampak secara mekanis pada tanggal efektif. ' +
      'Saham yang dikeluarkan (deleted) mengalami tekanan jual besar di hari efektif (biasanya 1-2 minggu setelah pengumuman). ' +
      'Saham yang ditambahkan (added) mengalami pembelian mekanis besar. ' +
      'Volume pada hari efektif bisa 5-10x volume normal → harga bergerak jauh dari fundamental. ' +
      'Setelah rebalancing selesai: saham deleted sering rebound karena overselling, saham added sering koreksi karena overbought.',
    affectedSectors:   ['Financials', 'Consumer Staples', 'Energy', 'Telecommunication'],
    affectedStockTypes: ['MSCI Constituent', 'LQ45', 'IDX30', 'High Foreign Ownership'],
    historicalEffect: {
      direction:   'MIXED',
      magnitude:   'KUAT',
      lagSessions: 14,
      historicalExample: 'MSCI Nov 2023: saham deleted jual -15% sebelum efektif, rebound +8% minggu berikutnya',
    },
    overrideStrength: 'HARD',
    keywords: [
      'msci', 'rebalancing', 'rebalance', 'indeks msci', 'msci emerging',
      'etf pasif', 'quarterly review', 'msci review', 'reconstitution',
      'msci february', 'msci may', 'msci august', 'msci november',
    ],
  },

  {
    eventType: 'BI_RATE_HIKE_EMERGENCY',
    trigger: 'Bank Indonesia menaikkan suku bunga acuan secara darurat (di luar jadwal RDG normal) atau kenaikan ≥75bps',
    mechanism:
      'Kenaikan darurat sinyal utama: tekanan depresiasi IDR berat atau capital outflow masif. ' +
      'Perusahaan leveraged tinggi (properti, infrastruktur, multifinance) langsung terdampak: biaya utang naik, margin terkompresi. ' +
      'Sektor properti: permintaan KPR turun karena cicilan naik → volume kontrak baru berkurang. ' +
      'Perbankan: NIM (Net Interest Margin) jangka pendek tertekan karena biaya dana naik lebih cepat dari repricing aset. ' +
      'Rupiah menguat jangka pendek → importir diuntungkan, eksportir (tambang, CPO) tertekan kurs.',
    affectedSectors:   ['Real Estate', 'Financials', 'Consumer Discretionary', 'Industrials'],
    affectedStockTypes: ['High Leverage', 'Property Developer', 'Multifinance', 'Bank BUKU 3-4'],
    historicalEffect: {
      direction:   'NEGATIF',
      magnitude:   'KUAT',
      lagSessions: 1,
      historicalExample: 'BI rate hike darurat Okt 2018: IHSG -3.5% hari H; sektor properti -7% dalam seminggu',
    },
    overrideStrength: 'HARD',
    keywords: [
      'bi rate', 'suku bunga acuan', 'bank indonesia naik', 'rate hike',
      'kenaikan darurat', 'emergency rate', 'rdg luar biasa', 'bunga acuan naik',
      'rupiah jatuh', 'capital outflow', 'dana asing keluar',
    ],
  },

  {
    eventType: 'BI_RATE_CUT',
    trigger: 'Bank Indonesia menurunkan suku bunga acuan (normal atau stimulus)',
    mechanism:
      'Penurunan BI Rate mengurangi biaya modal → menguntungkan perusahaan dengan utang besar (properti, infrastruktur). ' +
      'Perbankan: NIM jangka pendek tertekan awalnya (biaya dana turun tapi aset belum di-reprice), namun volume kredit naik. ' +
      'Sektor properti: cicilan KPR turun → affordability meningkat → volume kontrak baru naik. ' +
      'Dana investor berpindah dari deposito/obligasi ke ekuitas (search for yield). ' +
      'Biasanya positif untuk IHSG secara broad, terutama saham growth dan high-PE.',
    affectedSectors:   ['Real Estate', 'Financials', 'Consumer Discretionary', 'Industrials'],
    affectedStockTypes: ['Property Developer', 'Bank', 'Growth Stock', 'High PE'],
    historicalEffect: {
      direction:   'POSITIF',
      magnitude:   'SEDANG',
      lagSessions: 3,
      historicalExample: 'BI rate cut Jul 2019: IHSG +2.8% dalam seminggu; BSDE +9%, CTRA +7%',
    },
    overrideStrength: 'SOFT',
    keywords: [
      'bi rate turun', 'pemangkasan suku bunga', 'rate cut', 'bunga acuan turun',
      'penurunan bi rate', 'stimulus moneter', 'pelonggaran moneter',
      'bank indonesia pangkas', 'dovish', 'accommodative',
    ],
  },

  {
    eventType: 'FOREIGN_OWNERSHIP_LIMIT_CHANGE',
    trigger: 'OJK atau pemerintah mengubah batas kepemilikan asing (foreign ownership limit / FOL) pada sektor tertentu',
    mechanism:
      'Penurunan FOL (misalnya dari 49% ke 30%): dana asing yang sudah melebihi batas baru WAJIB menjual sebagian posisi. ' +
      'Tekanan jual bersifat mekanis dan tidak tergantung fundamental saham → mispricing sementara. ' +
      'Saham di sektor terdampak (biasanya perbankan, telekomunikasi, media) mengalami gap down pembukaan hari pengumuman. ' +
      'Kenaikan FOL (misalnya dari 40% ke 67%): membuka demand baru dari dana asing yang sebelumnya tercegah → positif. ' +
      'Dampak lebih besar pada saham dengan free-float tinggi dan kepemilikan asing mendekati batas lama.',
    affectedSectors:   ['Financials', 'Telecommunication', 'Media', 'Consumer Staples'],
    affectedStockTypes: ['High Foreign Ownership', 'Bank BUKU 3-4', 'Blue Chip', 'LQ45'],
    historicalEffect: {
      direction:   'MIXED',
      magnitude:   'KUAT',
      lagSessions: 0,
      historicalExample: 'Regulasi FOL Bank 2018: BBRI dan BBNI jual paksa asing hari pengumuman, turun 4-6%',
    },
    overrideStrength: 'HARD',
    keywords: [
      'kepemilikan asing', 'foreign ownership', 'fol', 'batas kepemilikan',
      'ojk atur', 'perubahan regulasi kepemilikan', 'asing dilarang',
      'porsi asing', 'divestasi asing', 'kepemilikan saham asing',
    ],
  },

  {
    eventType: 'COMMODITY_EXPORT_BAN',
    trigger: 'Pemerintah Indonesia memberlakukan larangan atau pembatasan ekspor komoditas (CPO, nikel, batu bara, dll)',
    mechanism:
      'Larangan ekspor langsung memotong pendapatan produsen komoditas terdampak. ' +
      'Efek CPO (historis 2022): AALI, LSIP, SIMP kehilangan 100% revenue ekspor sementara → saham turun 15-25% dalam 3 hari. ' +
      'Efek nikel (2020): produsen nickel ore (INCO, MDKA) terpukul → margin turun meski harga nikel global naik. ' +
      'Sektor downstream (refinery, smelter) bisa DIUNTUNGKAN karena pasokan lokal meningkat → harga bahan baku turun. ' +
      'Durasi ban tidak pasti → uncertainty premium ditambahkan ke risk discount.',
    affectedSectors:   ['Energy', 'Materials', 'Consumer Staples'],
    affectedStockTypes: ['CPO Producer', 'Mining Company', 'Coal Producer', 'Nickel Producer'],
    historicalEffect: {
      direction:   'NEGATIF',
      magnitude:   'KUAT',
      lagSessions: 1,
      historicalExample: 'Larangan ekspor CPO Apr 2022: AALI -18% dalam 3 hari; LSIP -22%; pasar saham CPO global melonjak',
    },
    overrideStrength: 'HARD',
    keywords: [
      'larangan ekspor', 'export ban', 'stop ekspor', 'batasi ekspor',
      'cpo ban', 'nikel ban', 'batu bara ekspor', 'mineral mentah',
      'hilirisasi', 'ekspor dilarang', 'pembatasan ekspor', 'ekspor mineral',
    ],
  },

  {
    eventType: 'ELECTION_RESULT_MARKET_FRIENDLY',
    trigger: 'Hasil pemilu presiden/DPR Indonesia dinilai pasar sebagai market-friendly (pro-investasi, kontinuitas kebijakan)',
    mechanism:
      'Hasil pemilu yang sesuai ekspektasi pasar (kandidat pro-bisnis menang atau status quo berlanjut) ' +
      'menghilangkan risk premium ketidakpastian politik yang selama ini dipriced-in. ' +
      'IHSG biasanya rally 2-4% hari pengumuman hasil. ' +
      'Sektor yang paling diuntungkan: infrastruktur (proyek berlanjut), perbankan (risk appetite naik), ' +
      'consumer discretionary (kepercayaan konsumen naik). ' +
      'Saham BUMN yang terhubung dengan program pemerintah (WSKT, WIKA, PTPP) biasanya outperform.',
    affectedSectors:   ['Industrials', 'Financials', 'Consumer Discretionary', 'Real Estate'],
    affectedStockTypes: ['BUMN', 'Infrastructure', 'Bank Pemerintah', 'Consumer Growth'],
    historicalEffect: {
      direction:   'POSITIF',
      magnitude:   'SEDANG',
      lagSessions: 2,
      historicalExample: 'Pemilu Feb 2024 (Prabowo menang): IHSG +2.1% hari berikutnya; saham infrastruktur BUMN +5-8%',
    },
    overrideStrength: 'SOFT',
    keywords: [
      'pemilu', 'pilpres', 'hasil pemilu', 'kpu', 'capres menang',
      'quick count', 'real count', 'pemerintah baru', 'kabinet',
      'pro investasi', 'market friendly', 'presiden terpilih',
    ],
  },

  {
    eventType: 'IDR_CRISIS',
    trigger: 'USD/IDR melampaui 16.500 atau melemah >3% dalam 5 hari perdagangan',
    mechanism:
      'Rupiah lemah ekstrem memicu capital flight → investor asing menjual saham dan obligasi IDR secara bersamaan. ' +
      'Double pressure: nilai portofolio asing turun dalam USD terms → tekanan jual semakin besar. ' +
      'Perusahaan dengan utang USD tanpa hedging (banyak di sektor properti, industri) mengalami lonjakan beban bunga. ' +
      'Biaya impor naik → inflasi → tekanan daya beli konsumen → consumer staples/discretionary tertekan. ' +
      'BI kemungkinan melakukan intervensi (jual USD, naik suku bunga) → volatilitas pasar uang memperburuk sentiment. ' +
      'Threshold historis: 16.000 = warning zone; 16.500 = crisis threshold; 17.000+ = 1998/2018 level.',
    affectedSectors:   ['Financials', 'Consumer Staples', 'Real Estate', 'Industrials'],
    affectedStockTypes: ['High USD Debt', 'Importer', 'Property Developer', 'Blue Chip'],
    historicalEffect: {
      direction:   'NEGATIF',
      magnitude:   'KUAT',
      lagSessions: 0,
      historicalExample: 'IDR crisis Okt 2018 (15.200→15.700 dalam 2 minggu): IHSG -6%, saham properti -12%',
    },
    overrideStrength: 'HARD',
    keywords: [
      'rupiah melemah', 'idr jatuh', 'usd/idr', 'dolar naik', 'kurs rupiah',
      'rupiah anjlok', 'nilai tukar', 'capital flight', 'dana asing keluar',
      'rupiah 16', 'rupiah 17', 'depresiasi rupiah', 'tekanan kurs',
    ],
  },
];

// ── Public API ────────────────────────────────────────────────

/**
 * Returns all MacroCausalEvents whose keywords appear in the article text.
 * Case-insensitive keyword matching against the full article text.
 */
export function getMatchingCausalEvents(newsText: string): MacroCausalEvent[] {
  const lower = newsText.toLowerCase();
  return MACRO_CAUSAL_EVENTS.filter((event) =>
    event.keywords.some((kw) => lower.includes(kw))
  );
}

/**
 * Builds a formatted context string to inject into Claude's analysis prompt.
 * Returns empty string if no events matched.
 */
export function buildMacroContext(events: MacroCausalEvent[]): string {
  if (events.length === 0) return '';

  const lines: string[] = [
    'KONTEKS MAKRO IDX (Pengetahuan Domain Institusional):',
    '',
  ];

  for (const event of events) {
    lines.push(`[${event.eventType}]`);
    lines.push(`Trigger: ${event.trigger}`);
    lines.push(`Mekanisme: ${event.mechanism}`);
    lines.push(`Sektor terdampak: ${event.affectedSectors.join(', ')}`);
    lines.push(`Dampak historis: ${event.historicalEffect.direction} ${event.historicalEffect.magnitude}, lag ~${event.historicalEffect.lagSessions} sesi`);
    if (event.historicalEffect.historicalExample) {
      lines.push(`Contoh historis: ${event.historicalEffect.historicalExample}`);
    }
    lines.push(`Override strength: ${event.overrideStrength}`);
    lines.push('');
  }

  lines.push(
    'Gunakan konteks di atas untuk menentukan macroOverride yang tepat dan ' +
    'mekanisme kausal yang akurat dalam analisis kamu.'
  );

  return lines.join('\n');
}

export { MACRO_CAUSAL_EVENTS };
