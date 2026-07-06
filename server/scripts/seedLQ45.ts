/**
 * seedLQ45.ts — Populate stocks table with LQ45 universe
 *
 * Usage:  npm run seed:lq45
 *
 * Rules:
 *   - Skips symbols already in DB (ON CONFLICT DO NOTHING)
 *   - Tags new rows scrape_source = 'SEED_INITIAL'
 *   - avg20dValue populated from tier estimates
 *   - All verbose text fields generated from compact per-stock data
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Per-stock compact data ────────────────────────────────────

interface StockSeed {
  symbol:       string;
  name:         string;
  sector:       string;
  subsector:    string;
  tier:         'MEGA' | 'LARGE' | 'MID';
  price:        number;
  change:       number;
  changePercent:number;
  marketCap:    string;        // display string e.g. "650.4T IDR"
  avg20dValue:  number;        // IDR
  peRatio:      number;
  dividendYield:number;
  roe:          number;
  netMargin:    number;
  growth:       number;
  flowBias:     'Akumulasi' | 'Distribusi' | 'Netral';
  flowIntensity:'Akumulasi Kuat' | 'Akumulasi Sedang' | 'Distribusi Sedang' | 'Distribusi Kuat' | 'Netral';
  flowReliability:'Tinggi' | 'Sedang' | 'Rendah';
  // Financials (approximate IDR, T = triliun)
  rev23:  string; rev24:  string; rev25:  string;
  np23:   string; np24:   string; np25:   string;
  ast23:  string; ast24:  string; ast25:  string;
  liab23: string; liab24: string; liab25: string;
  ocf23:  string; ocf24:  string; ocf25:  string;
  // Optional
  idxIndices?: string[];
  tags?:       string[];
  character?:  string;
}

const NEW_STOCKS: StockSeed[] = [
  // ── FINANCIALS — Banks ─────────────────────────────────────
  {
    symbol:'BBRI', name:'Bank Rakyat Indonesia (Persero) Tbk',
    sector:'Financials', subsector:'Banks', tier:'MEGA',
    price:4180, change:30, changePercent:0.72, marketCap:'663.8T IDR',
    avg20dValue:820_000_000_000,
    peRatio:11.2, dividendYield:5.8, roe:18.2, netMargin:28.6, growth:9.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Tinggi',
    rev23:'189.4T IDR', rev24:'204.2T IDR', rev25:'218.5T IDR',
    np23:'60.4T IDR',  np24:'66.8T IDR',  np25:'72.6T IDR',
    ast23:'1,965.4T IDR', ast24:'2,082.5T IDR', ast25:'2,210.3T IDR',
    liab23:'1,772.8T IDR', liab24:'1,875.2T IDR', liab25:'1,989.3T IDR',
    ocf23:'45.2T IDR', ocf24:'50.1T IDR', ocf25:'55.4T IDR',
    idxIndices:['IDX30','LQ45','IDX80','KOMPAS100'], tags:['Bank BUMN','Dividen Tinggi','Blue Chip'], character:'Institusional',
  },
  {
    symbol:'BMRI', name:'Bank Mandiri (Persero) Tbk',
    sector:'Financials', subsector:'Banks', tier:'MEGA',
    price:5475, change:25, changePercent:0.46, marketCap:'512.6T IDR',
    avg20dValue:750_000_000_000,
    peRatio:10.8, dividendYield:5.2, roe:17.8, netMargin:31.4, growth:10.1,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Tinggi',
    rev23:'145.2T IDR', rev24:'158.7T IDR', rev25:'172.4T IDR',
    np23:'55.1T IDR',  np24:'61.4T IDR',  np25:'68.2T IDR',
    ast23:'1,978.5T IDR', ast24:'2,112.4T IDR', ast25:'2,258.7T IDR',
    liab23:'1,786.3T IDR', liab24:'1,901.2T IDR', liab25:'2,032.8T IDR',
    ocf23:'48.7T IDR', ocf24:'54.2T IDR', ocf25:'60.1T IDR',
    idxIndices:['IDX30','LQ45','IDX80','KOMPAS100'], tags:['Bank BUMN','Blue Chip'], character:'Institusional',
  },
  {
    symbol:'BBNI', name:'Bank Negara Indonesia (Persero) Tbk',
    sector:'Financials', subsector:'Banks', tier:'LARGE',
    price:4420, change:20, changePercent:0.45, marketCap:'208.7T IDR',
    avg20dValue:380_000_000_000,
    peRatio:8.4, dividendYield:5.6, roe:14.2, netMargin:24.8, growth:8.7,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'85.4T IDR',  rev24:'92.1T IDR',  rev25:'99.8T IDR',
    np23:'20.9T IDR',  np24:'22.8T IDR',  np25:'24.8T IDR',
    ast23:'964.5T IDR', ast24:'1,018.3T IDR', ast25:'1,076.8T IDR',
    liab23:'876.4T IDR', liab24:'925.2T IDR', liab25:'978.4T IDR',
    ocf23:'18.4T IDR', ocf24:'20.1T IDR', ocf25:'22.4T IDR',
    idxIndices:['LQ45','IDX80','KOMPAS100'], tags:['Bank BUMN','Blue Chip'], character:'Institusional',
  },
  {
    symbol:'BRIS', name:'Bank Syariah Indonesia Tbk',
    sector:'Financials', subsector:'Islamic Banks', tier:'LARGE',
    price:2040, change:-10, changePercent:-0.49, marketCap:'136.2T IDR',
    avg20dValue:180_000_000_000,
    peRatio:16.4, dividendYield:2.1, roe:12.8, netMargin:22.4, growth:14.6,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'19.2T IDR', rev24:'22.1T IDR', rev25:'25.4T IDR',
    np23:'5.7T IDR',   np24:'6.6T IDR',   np25:'7.6T IDR',
    ast23:'314.8T IDR', ast24:'362.4T IDR', ast25:'416.8T IDR',
    liab23:'283.3T IDR', liab24:'325.2T IDR', liab25:'374.1T IDR',
    ocf23:'6.8T IDR', ocf24:'7.9T IDR', ocf25:'9.1T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Bank Syariah','Perbankan Islam'], character:'Defensif',
  },
  {
    symbol:'ARTO', name:'Bank Jago Tbk',
    sector:'Financials', subsector:'Digital Banks', tier:'MID',
    price:2680, change:40, changePercent:1.51, marketCap:'95.4T IDR',
    avg20dValue:65_000_000_000,
    peRatio:142.0, dividendYield:0.0, roe:4.2, netMargin:8.6, growth:48.2,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'2.8T IDR', rev24:'4.1T IDR', rev25:'6.0T IDR',
    np23:'0.4T IDR',  np24:'0.6T IDR',  np25:'0.9T IDR',
    ast23:'21.4T IDR', ast24:'31.2T IDR', ast25:'45.8T IDR',
    liab23:'18.2T IDR', liab24:'26.8T IDR', liab25:'39.4T IDR',
    ocf23:'0.5T IDR', ocf24:'0.8T IDR', ocf25:'1.2T IDR',
    idxIndices:['LQ45'], tags:['Bank Digital','Fintech','High Growth'], character:'Spekulatif',
  },

  // ── TELECOMMUNICATIONS ────────────────────────────────────
  {
    symbol:'TLKM', name:'Telkom Indonesia (Persero) Tbk',
    sector:'Communication Services', subsector:'Telecommunications', tier:'MEGA',
    price:2980, change:-20, changePercent:-0.67, marketCap:'295.6T IDR',
    avg20dValue:520_000_000_000,
    peRatio:14.2, dividendYield:6.4, roe:22.8, netMargin:18.4, growth:3.2,
    flowBias:'Distribusi', flowIntensity:'Distribusi Sedang', flowReliability:'Tinggi',
    rev23:'147.3T IDR', rev24:'152.4T IDR', rev25:'157.2T IDR',
    np23:'24.5T IDR',  np24:'25.8T IDR',  np25:'28.9T IDR',
    ast23:'281.4T IDR', ast24:'294.2T IDR', ast25:'308.7T IDR',
    liab23:'145.7T IDR', liab24:'152.8T IDR', liab25:'160.4T IDR',
    ocf23:'42.1T IDR', ocf24:'45.8T IDR', ocf25:'48.4T IDR',
    idxIndices:['IDX30','LQ45','IDX80','KOMPAS100'], tags:['BUMN','Blue Chip','Dividen'], character:'Defensif',
  },
  {
    symbol:'ISAT', name:'Indosat Tbk',
    sector:'Communication Services', subsector:'Telecommunications', tier:'LARGE',
    price:2140, change:30, changePercent:1.42, marketCap:'46.8T IDR',
    avg20dValue:120_000_000_000,
    peRatio:22.4, dividendYield:1.8, roe:8.4, netMargin:5.2, growth:18.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'45.8T IDR', rev24:'54.2T IDR', rev25:'64.1T IDR',
    np23:'1.8T IDR',   np24:'2.4T IDR',   np25:'3.3T IDR',
    ast23:'87.4T IDR', ast24:'95.2T IDR', ast25:'104.8T IDR',
    liab23:'65.2T IDR', liab24:'70.4T IDR', liab25:'76.8T IDR',
    ocf23:'12.4T IDR', ocf24:'15.2T IDR', ocf25:'18.6T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Telekomunikasi','Merger Sinergis'], character:'Momentum',
  },
  {
    symbol:'EXCL', name:'XL Axiata Tbk',
    sector:'Communication Services', subsector:'Telecommunications', tier:'LARGE',
    price:2180, change:10, changePercent:0.46, marketCap:'23.4T IDR',
    avg20dValue:95_000_000_000,
    peRatio:18.6, dividendYield:1.2, roe:7.2, netMargin:4.8, growth:12.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'26.4T IDR', rev24:'29.8T IDR', rev25:'33.6T IDR',
    np23:'0.9T IDR',   np24:'1.2T IDR',   np25:'1.6T IDR',
    ast23:'57.8T IDR', ast24:'62.4T IDR', ast25:'67.8T IDR',
    liab23:'46.2T IDR', liab24:'49.8T IDR', liab25:'53.6T IDR',
    ocf23:'7.4T IDR', ocf24:'8.6T IDR', ocf25:'10.2T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Telekomunikasi'], character:'Defensif',
  },
  {
    symbol:'TOWR', name:'Sarana Menara Nusantara Tbk',
    sector:'Communication Services', subsector:'Tower Infrastructure', tier:'MID',
    price:830, change:-5, changePercent:-0.60, marketCap:'40.1T IDR',
    avg20dValue:55_000_000_000,
    peRatio:20.4, dividendYield:3.8, roe:14.2, netMargin:28.4, growth:6.4,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'7.8T IDR',  rev24:'8.2T IDR',  rev25:'8.7T IDR',
    np23:'2.1T IDR',   np24:'2.2T IDR',   np25:'2.5T IDR',
    ast23:'56.4T IDR', ast24:'58.2T IDR', ast25:'60.8T IDR',
    liab23:'42.8T IDR', liab24:'44.2T IDR', liab25:'46.1T IDR',
    ocf23:'5.8T IDR', ocf24:'6.2T IDR', ocf25:'6.8T IDR',
    idxIndices:['LQ45'], tags:['Infrastruktur','Tower'], character:'Defensif',
  },

  // ── CONSUMER STAPLES ──────────────────────────────────────
  {
    symbol:'INDF', name:'Indofood Sukses Makmur Tbk',
    sector:'Consumer Staples', subsector:'Food Products', tier:'LARGE',
    price:6425, change:25, changePercent:0.39, marketCap:'56.4T IDR',
    avg20dValue:140_000_000_000,
    peRatio:8.6, dividendYield:4.8, roe:11.4, netMargin:6.8, growth:5.2,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'81.7T IDR', rev24:'85.4T IDR', rev25:'89.6T IDR',
    np23:'4.2T IDR',   np24:'5.1T IDR',   np25:'6.1T IDR',
    ast23:'98.4T IDR', ast24:'102.8T IDR', ast25:'107.4T IDR',
    liab23:'46.2T IDR', liab24:'48.4T IDR', liab25:'50.8T IDR',
    ocf23:'7.4T IDR', ocf24:'8.1T IDR', ocf25:'9.2T IDR',
    idxIndices:['LQ45','IDX80','KOMPAS100'], tags:['FMCG','Diversified','Blue Chip'], character:'Defensif',
  },
  {
    symbol:'MYOR', name:'Mayora Indah Tbk',
    sector:'Consumer Staples', subsector:'Food Products', tier:'LARGE',
    price:2720, change:20, changePercent:0.74, marketCap:'60.8T IDR',
    avg20dValue:115_000_000_000,
    peRatio:22.4, dividendYield:1.8, roe:18.4, netMargin:8.4, growth:9.8,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'29.4T IDR', rev24:'32.1T IDR', rev25:'35.2T IDR',
    np23:'2.1T IDR',   np24:'2.4T IDR',   np25:'2.9T IDR',
    ast23:'22.8T IDR', ast24:'25.4T IDR', ast25:'28.2T IDR',
    liab23:'11.4T IDR', liab24:'12.8T IDR', liab25:'14.2T IDR',
    ocf23:'3.2T IDR', ocf24:'3.8T IDR', ocf25:'4.4T IDR',
    idxIndices:['LQ45','IDX80'], tags:['FMCG','Ekspor','Growth'], character:'Momentum',
  },
  {
    symbol:'KLBF', name:'Kalbe Farma Tbk',
    sector:'Consumer Staples', subsector:'Pharmaceuticals', tier:'LARGE',
    price:1540, change:-5, changePercent:-0.32, marketCap:'72.2T IDR',
    avg20dValue:130_000_000_000,
    peRatio:24.8, dividendYield:2.4, roe:16.8, netMargin:12.4, growth:6.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'28.4T IDR', rev24:'30.1T IDR', rev25:'32.2T IDR',
    np23:'3.1T IDR',   np24:'3.4T IDR',   np25:'3.8T IDR',
    ast23:'28.4T IDR', ast24:'30.2T IDR', ast25:'32.4T IDR',
    liab23:'5.8T IDR',  liab24:'6.2T IDR',  liab25:'6.8T IDR',
    ocf23:'4.2T IDR', ocf24:'4.8T IDR', ocf25:'5.4T IDR',
    idxIndices:['LQ45','IDX80','KOMPAS100'], tags:['Farmasi','Blue Chip','Defensif'], character:'Defensif',
  },
  {
    symbol:'SIDO', name:'Industri Jamu dan Farmasi Sido Muncul Tbk',
    sector:'Consumer Staples', subsector:'Pharmaceuticals', tier:'MID',
    price:640, change:5, changePercent:0.79, marketCap:'9.6T IDR',
    avg20dValue:38_000_000_000,
    peRatio:18.4, dividendYield:5.8, roe:28.4, netMargin:22.8, growth:7.2,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'3.6T IDR', rev24:'3.9T IDR', rev25:'4.2T IDR',
    np23:'0.8T IDR',  np24:'0.9T IDR',  np25:'1.0T IDR',
    ast23:'3.8T IDR', ast24:'4.1T IDR', ast25:'4.5T IDR',
    liab23:'0.6T IDR', liab24:'0.7T IDR', liab25:'0.8T IDR',
    ocf23:'1.0T IDR', ocf24:'1.1T IDR', ocf25:'1.2T IDR',
    idxIndices:['LQ45'], tags:['Jamu','Dividen Tinggi','Defensif'], character:'Defensif',
  },
  {
    symbol:'AMRT', name:'Sumber Alfaria Trijaya Tbk',
    sector:'Consumer Staples', subsector:'Food & Drug Retail', tier:'LARGE',
    price:2680, change:10, changePercent:0.37, marketCap:'130.4T IDR',
    avg20dValue:145_000_000_000,
    peRatio:28.4, dividendYield:1.2, roe:22.4, netMargin:3.8, growth:12.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Tinggi',
    rev23:'101.4T IDR', rev24:'113.2T IDR', rev25:'126.8T IDR',
    np23:'3.4T IDR',    np24:'4.0T IDR',    np25:'4.8T IDR',
    ast23:'24.8T IDR', ast24:'28.4T IDR', ast25:'32.4T IDR',
    liab23:'18.4T IDR', liab24:'20.8T IDR', liab25:'23.4T IDR',
    ocf23:'5.4T IDR', ocf24:'6.2T IDR', ocf25:'7.1T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Ritel Modern','Ekspansif','Growth'], character:'Momentum',
  },

  // ── CONSUMER DISCRETIONARY ───────────────────────────────
  {
    symbol:'ASII', name:'Astra International Tbk',
    sector:'Consumer Discretionary', subsector:'Automotive', tier:'MEGA',
    price:4490, change:-15, changePercent:-0.33, marketCap:'182.1T IDR',
    avg20dValue:460_000_000_000,
    peRatio:9.2, dividendYield:5.4, roe:14.8, netMargin:7.4, growth:4.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Tinggi',
    rev23:'315.8T IDR', rev24:'326.4T IDR', rev25:'338.2T IDR',
    np23:'21.2T IDR',   np24:'22.8T IDR',   np25:'25.0T IDR',
    ast23:'281.4T IDR', ast24:'294.2T IDR', ast25:'308.4T IDR',
    liab23:'158.4T IDR', liab24:'164.8T IDR', liab25:'172.4T IDR',
    ocf23:'28.4T IDR', ocf24:'31.2T IDR', ocf25:'34.8T IDR',
    idxIndices:['IDX30','LQ45','IDX80','KOMPAS100'], tags:['Konglomerat','Otomotif','Blue Chip'], character:'Institusional',
  },
  {
    symbol:'ACES', name:'Ace Hardware Indonesia Tbk',
    sector:'Consumer Discretionary', subsector:'Specialty Retail', tier:'MID',
    price:840, change:10, changePercent:1.20, marketCap:'14.4T IDR',
    avg20dValue:42_000_000_000,
    peRatio:18.2, dividendYield:2.8, roe:14.8, netMargin:10.4, growth:8.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'7.8T IDR', rev24:'8.4T IDR', rev25:'9.1T IDR',
    np23:'0.7T IDR',  np24:'0.8T IDR',  np25:'0.9T IDR',
    ast23:'4.8T IDR', ast24:'5.2T IDR', ast25:'5.8T IDR',
    liab23:'1.2T IDR', liab24:'1.4T IDR', liab25:'1.6T IDR',
    ocf23:'0.9T IDR', ocf24:'1.1T IDR', ocf25:'1.2T IDR',
    idxIndices:['LQ45'], tags:['Ritel','Home Improvement'], character:'Defensif',
  },
  {
    symbol:'MAPI', name:'Mitra Adiperkasa Tbk',
    sector:'Consumer Discretionary', subsector:'Apparel Retail', tier:'MID',
    price:1385, change:15, changePercent:1.09, marketCap:'24.2T IDR',
    avg20dValue:58_000_000_000,
    peRatio:14.8, dividendYield:1.4, roe:18.4, netMargin:5.8, growth:14.2,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'24.4T IDR', rev24:'28.1T IDR', rev25:'32.4T IDR',
    np23:'1.1T IDR',   np24:'1.4T IDR',   np25:'1.9T IDR',
    ast23:'14.8T IDR', ast24:'16.4T IDR', ast25:'18.2T IDR',
    liab23:'9.4T IDR',  liab24:'10.4T IDR', liab25:'11.4T IDR',
    ocf23:'2.1T IDR', ocf24:'2.6T IDR', ocf25:'3.2T IDR',
    idxIndices:['LQ45'], tags:['Fashion','Ritel Premium','Lifestyle'], character:'Momentum',
  },
  {
    symbol:'ERAA', name:'Erajaya Swasembada Tbk',
    sector:'Consumer Discretionary', subsector:'Technology Retail', tier:'MID',
    price:495, change:5, changePercent:1.02, marketCap:'8.4T IDR',
    avg20dValue:35_000_000_000,
    peRatio:11.4, dividendYield:3.2, roe:14.2, netMargin:2.4, growth:8.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Rendah',
    rev23:'26.8T IDR', rev24:'29.2T IDR', rev25:'31.8T IDR',
    np23:'0.5T IDR',   np24:'0.6T IDR',   np25:'0.8T IDR',
    ast23:'7.4T IDR',  ast24:'8.2T IDR',  ast25:'9.1T IDR',
    liab23:'5.4T IDR',  liab24:'5.8T IDR',  liab25:'6.4T IDR',
    ocf23:'0.6T IDR', ocf24:'0.7T IDR', ocf25:'0.9T IDR',
    idxIndices:['LQ45'], tags:['Elektronik','Distribusi'], character:'Defensif',
  },

  // ── ENERGY ────────────────────────────────────────────────
  {
    symbol:'PTBA', name:'Bukit Asam Tbk',
    sector:'Energy', subsector:'Coal Mining', tier:'LARGE',
    price:2780, change:40, changePercent:1.46, marketCap:'32.1T IDR',
    avg20dValue:195_000_000_000,
    peRatio:7.2, dividendYield:9.8, roe:28.4, netMargin:22.4, growth:-8.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Tinggi',
    rev23:'45.8T IDR', rev24:'38.4T IDR', rev25:'35.2T IDR',
    np23:'7.9T IDR',   np24:'6.1T IDR',   np25:'4.5T IDR',
    ast23:'28.4T IDR', ast24:'28.8T IDR', ast25:'29.4T IDR',
    liab23:'7.8T IDR',  liab24:'8.2T IDR',  liab25:'8.8T IDR',
    ocf23:'8.4T IDR', ocf24:'7.2T IDR', ocf25:'5.8T IDR',
    idxIndices:['LQ45','IDX80'], tags:['BUMN','Batubara','Dividen Tinggi'], character:'Siklikal',
  },
  {
    symbol:'ITMG', name:'Indo Tambangraya Megah Tbk',
    sector:'Energy', subsector:'Coal Mining', tier:'LARGE',
    price:25400, change:200, changePercent:0.79, marketCap:'28.8T IDR',
    avg20dValue:125_000_000_000,
    peRatio:5.8, dividendYield:12.4, roe:34.2, netMargin:28.4, growth:-11.2,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'31.4T IDR', rev24:'26.8T IDR', rev25:'24.2T IDR',
    np23:'5.8T IDR',   np24:'4.4T IDR',   np25:'3.4T IDR',
    ast23:'18.4T IDR', ast24:'18.8T IDR', ast25:'19.4T IDR',
    liab23:'4.2T IDR',  liab24:'4.4T IDR',  liab25:'4.8T IDR',
    ocf23:'6.4T IDR', ocf24:'5.2T IDR', ocf25:'4.1T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Batubara','Dividen Tinggi','Siklikal'], character:'Siklikal',
  },
  {
    symbol:'MEDC', name:'Medco Energi Internasional Tbk',
    sector:'Energy', subsector:'Oil & Gas', tier:'MID',
    price:1245, change:15, changePercent:1.22, marketCap:'13.8T IDR',
    avg20dValue:65_000_000_000,
    peRatio:8.4, dividendYield:2.8, roe:12.4, netMargin:14.8, growth:4.2,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'18.4T IDR', rev24:'19.2T IDR', rev25:'20.1T IDR',
    np23:'2.2T IDR',   np24:'2.4T IDR',   np25:'2.8T IDR',
    ast23:'42.4T IDR', ast24:'44.8T IDR', ast25:'47.2T IDR',
    liab23:'28.4T IDR', liab24:'29.8T IDR', liab25:'31.4T IDR',
    ocf23:'4.8T IDR', ocf24:'5.2T IDR', ocf25:'5.8T IDR',
    idxIndices:['LQ45'], tags:['Migas','Energi'], character:'Siklikal',
  },
  {
    symbol:'HRUM', name:'Harum Energy Tbk',
    sector:'Energy', subsector:'Coal Mining', tier:'MID',
    price:1620, change:-20, changePercent:-1.22, marketCap:'8.2T IDR',
    avg20dValue:48_000_000_000,
    peRatio:6.4, dividendYield:8.4, roe:18.4, netMargin:18.8, growth:-14.2,
    flowBias:'Distribusi', flowIntensity:'Distribusi Sedang', flowReliability:'Sedang',
    rev23:'8.4T IDR',  rev24:'6.8T IDR',  rev25:'5.8T IDR',
    np23:'1.4T IDR',   np24:'1.0T IDR',   np25:'0.7T IDR',
    ast23:'8.4T IDR',  ast24:'8.8T IDR',  ast25:'9.4T IDR',
    liab23:'1.8T IDR',  liab24:'2.0T IDR',  liab25:'2.2T IDR',
    ocf23:'1.8T IDR', ocf24:'1.4T IDR', ocf25:'1.0T IDR',
    idxIndices:['LQ45'], tags:['Batubara','Dividen'], character:'Siklikal',
  },
  {
    symbol:'AKRA', name:'AKR Corporindo Tbk',
    sector:'Energy', subsector:'Oil Distribution', tier:'MID',
    price:1480, change:10, changePercent:0.68, marketCap:'23.8T IDR',
    avg20dValue:72_000_000_000,
    peRatio:12.4, dividendYield:4.2, roe:16.8, netMargin:5.4, growth:6.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'38.4T IDR', rev24:'40.8T IDR', rev25:'43.4T IDR',
    np23:'1.8T IDR',   np24:'2.0T IDR',   np25:'2.4T IDR',
    ast23:'16.4T IDR', ast24:'17.4T IDR', ast25:'18.4T IDR',
    liab23:'7.8T IDR',  liab24:'8.2T IDR',  liab25:'8.8T IDR',
    ocf23:'2.4T IDR', ocf24:'2.8T IDR', ocf25:'3.2T IDR',
    idxIndices:['LQ45'], tags:['Distribusi BBM','Kawasan Industri'], character:'Defensif',
  },

  // ── BASIC MATERIALS ──────────────────────────────────────
  {
    symbol:'INCO', name:'Vale Indonesia Tbk',
    sector:'Basic Materials', subsector:'Nickel Mining', tier:'LARGE',
    price:3180, change:-30, changePercent:-0.94, marketCap:'32.0T IDR',
    avg20dValue:110_000_000_000,
    peRatio:14.2, dividendYield:3.2, roe:12.4, netMargin:18.4, growth:-4.2,
    flowBias:'Distribusi', flowIntensity:'Distribusi Sedang', flowReliability:'Tinggi',
    rev23:'14.4T IDR', rev24:'12.8T IDR', rev25:'11.4T IDR',
    np23:'2.4T IDR',   np24:'2.0T IDR',   np25:'1.6T IDR',
    ast23:'22.8T IDR', ast24:'24.2T IDR', ast25:'25.8T IDR',
    liab23:'5.4T IDR',  liab24:'5.8T IDR',  liab25:'6.2T IDR',
    ocf23:'4.8T IDR', ocf24:'4.2T IDR', ocf25:'3.6T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Nikel','Minerba','Terkait EV'], character:'Siklikal',
  },
  {
    symbol:'ANTM', name:'Aneka Tambang Tbk',
    sector:'Basic Materials', subsector:'Diversified Metals', tier:'LARGE',
    price:1580, change:20, changePercent:1.28, marketCap:'37.9T IDR',
    avg20dValue:160_000_000_000,
    peRatio:22.8, dividendYield:2.4, roe:8.4, netMargin:6.8, growth:2.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'38.4T IDR', rev24:'40.2T IDR', rev25:'42.8T IDR',
    np23:'2.8T IDR',   np24:'2.6T IDR',   np25:'2.4T IDR',
    ast23:'33.4T IDR', ast24:'36.2T IDR', ast25:'39.4T IDR',
    liab23:'16.8T IDR', liab24:'18.2T IDR', liab25:'19.8T IDR',
    ocf23:'3.4T IDR', ocf24:'3.8T IDR', ocf25:'4.2T IDR',
    idxIndices:['LQ45','IDX80'], tags:['BUMN','Emas','Nikel','Minerba'], character:'Siklikal',
  },
  {
    symbol:'MDKA', name:'Merdeka Copper Gold Tbk',
    sector:'Basic Materials', subsector:'Copper & Gold Mining', tier:'LARGE',
    price:2120, change:30, changePercent:1.44, marketCap:'48.4T IDR',
    avg20dValue:185_000_000_000,
    peRatio:35.4, dividendYield:0.0, roe:6.8, netMargin:8.4, growth:42.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Kuat', flowReliability:'Tinggi',
    rev23:'18.4T IDR', rev24:'28.4T IDR', rev25:'42.8T IDR',
    np23:'1.1T IDR',   np24:'1.8T IDR',   np25:'2.8T IDR',
    ast23:'42.4T IDR', ast24:'58.4T IDR', ast25:'78.4T IDR',
    liab23:'24.8T IDR', liab24:'34.8T IDR', liab25:'46.2T IDR',
    ocf23:'2.8T IDR', ocf24:'4.8T IDR', ocf25:'7.2T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Tembaga','Emas','High Growth','Ekspansi'], character:'Momentum',
  },
  {
    symbol:'TINS', name:'Timah Tbk',
    sector:'Basic Materials', subsector:'Tin Mining', tier:'MID',
    price:895, change:-10, changePercent:-1.10, marketCap:'6.7T IDR',
    avg20dValue:48_000_000_000,
    peRatio:18.4, dividendYield:1.8, roe:4.2, netMargin:2.4, growth:-8.4,
    flowBias:'Distribusi', flowIntensity:'Distribusi Sedang', flowReliability:'Rendah',
    rev23:'18.4T IDR', rev24:'16.8T IDR', rev25:'15.4T IDR',
    np23:'0.7T IDR',   np24:'0.4T IDR',   np25:'0.2T IDR',
    ast23:'12.4T IDR', ast24:'12.8T IDR', ast25:'13.2T IDR',
    liab23:'7.8T IDR',  liab24:'8.2T IDR',  liab25:'8.8T IDR',
    ocf23:'1.2T IDR', ocf24:'0.8T IDR', ocf25:'0.4T IDR',
    idxIndices:['LQ45'], tags:['BUMN','Timah','Minerba'], character:'Siklikal',
  },
  {
    symbol:'INKP', name:'Indah Kiat Pulp & Paper Tbk',
    sector:'Basic Materials', subsector:'Paper & Forest Products', tier:'LARGE',
    price:6850, change:50, changePercent:0.74, marketCap:'79.2T IDR',
    avg20dValue:125_000_000_000,
    peRatio:8.4, dividendYield:1.2, roe:12.4, netMargin:14.8, growth:4.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'58.4T IDR', rev24:'61.2T IDR', rev25:'64.8T IDR',
    np23:'8.8T IDR',   np24:'9.4T IDR',   np25:'9.6T IDR',
    ast23:'142.4T IDR', ast24:'152.8T IDR', ast25:'164.2T IDR',
    liab23:'98.4T IDR', liab24:'104.8T IDR', liab25:'112.4T IDR',
    ocf23:'12.4T IDR', ocf24:'14.2T IDR', ocf25:'15.8T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Kertas','Pulp','Ekspor'], character:'Institusional',
  },

  // ── INDUSTRIALS ──────────────────────────────────────────
  {
    symbol:'JSMR', name:'Jasa Marga (Persero) Tbk',
    sector:'Industrials', subsector:'Toll Roads', tier:'MID',
    price:3960, change:20, changePercent:0.51, marketCap:'39.7T IDR',
    avg20dValue:55_000_000_000,
    peRatio:15.4, dividendYield:2.8, roe:8.4, netMargin:18.4, growth:6.4,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'16.4T IDR', rev24:'17.4T IDR', rev25:'18.5T IDR',
    np23:'2.8T IDR',   np24:'3.0T IDR',   np25:'3.4T IDR',
    ast23:'112.4T IDR', ast24:'118.4T IDR', ast25:'125.2T IDR',
    liab23:'88.4T IDR', liab24:'92.8T IDR', liab25:'97.4T IDR',
    ocf23:'7.2T IDR', ocf24:'7.8T IDR', ocf25:'8.4T IDR',
    idxIndices:['LQ45','IDX80'], tags:['BUMN','Infrastruktur','Tol'], character:'Defensif',
  },
  {
    symbol:'WIKA', name:'Wijaya Karya (Persero) Tbk',
    sector:'Industrials', subsector:'Construction', tier:'MID',
    price:640, change:-5, changePercent:-0.78, marketCap:'5.4T IDR',
    avg20dValue:42_000_000_000,
    peRatio:0.0, dividendYield:0.0, roe:-18.4, netMargin:-8.4, growth:-22.4,
    flowBias:'Distribusi', flowIntensity:'Distribusi Kuat', flowReliability:'Tinggi',
    rev23:'18.4T IDR', rev24:'14.4T IDR', rev25:'11.8T IDR',
    np23:'-3.8T IDR',  np24:'-2.4T IDR',  np25:'-0.9T IDR',
    ast23:'68.4T IDR', ast24:'58.4T IDR', ast25:'52.4T IDR',
    liab23:'56.4T IDR', liab24:'50.4T IDR', liab25:'46.8T IDR',
    ocf23:'-2.4T IDR', ocf24:'-1.2T IDR', ocf25:'0.4T IDR',
    idxIndices:['LQ45'], tags:['BUMN Konstruksi','Restrukturisasi','Turnaround'], character:'Spekulatif',
  },

  // ── REAL ESTATE ──────────────────────────────────────────
  {
    symbol:'BSDE', name:'Bumi Serpong Damai Tbk',
    sector:'Real Estate', subsector:'Residential Property', tier:'LARGE',
    price:1120, change:10, changePercent:0.90, marketCap:'21.4T IDR',
    avg20dValue:95_000_000_000,
    peRatio:8.4, dividendYield:1.4, roe:6.4, netMargin:28.4, growth:8.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'7.8T IDR',  rev24:'8.4T IDR',  rev25:'9.1T IDR',
    np23:'1.8T IDR',   np24:'2.1T IDR',   np25:'2.6T IDR',
    ast23:'42.4T IDR', ast24:'45.8T IDR', ast25:'49.4T IDR',
    liab23:'19.4T IDR', liab24:'20.4T IDR', liab25:'21.8T IDR',
    ocf23:'2.4T IDR', ocf24:'2.8T IDR', ocf25:'3.4T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Properti','BSD City','Tangerang'], character:'Siklikal',
  },
  {
    symbol:'CTRA', name:'Ciputra Development Tbk',
    sector:'Real Estate', subsector:'Diversified Property', tier:'MID',
    price:1085, change:5, changePercent:0.46, marketCap:'20.0T IDR',
    avg20dValue:68_000_000_000,
    peRatio:12.4, dividendYield:1.2, roe:8.4, netMargin:18.4, growth:9.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'8.4T IDR',  rev24:'9.2T IDR',  rev25:'10.1T IDR',
    np23:'1.4T IDR',   np24:'1.6T IDR',   np25:'1.9T IDR',
    ast23:'38.4T IDR', ast24:'41.4T IDR', ast25:'44.8T IDR',
    liab23:'19.4T IDR', liab24:'20.8T IDR', liab25:'22.4T IDR',
    ocf23:'2.2T IDR', ocf24:'2.6T IDR', ocf25:'3.0T IDR',
    idxIndices:['LQ45'], tags:['Properti','Diversified'], character:'Siklikal',
  },
  {
    symbol:'PWON', name:'Pakuwon Jati Tbk',
    sector:'Real Estate', subsector:'Mixed Use Property', tier:'MID',
    price:475, change:5, changePercent:1.06, marketCap:'22.9T IDR',
    avg20dValue:62_000_000_000,
    peRatio:10.4, dividendYield:1.8, roe:10.4, netMargin:32.4, growth:7.8,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Sedang',
    rev23:'5.8T IDR',  rev24:'6.4T IDR',  rev25:'6.9T IDR',
    np23:'1.6T IDR',   np24:'1.9T IDR',   np25:'2.2T IDR',
    ast23:'22.4T IDR', ast24:'24.4T IDR', ast25:'26.4T IDR',
    liab23:'8.4T IDR',  liab24:'8.8T IDR',  liab25:'9.4T IDR',
    ocf23:'2.4T IDR', ocf24:'2.8T IDR', ocf25:'3.2T IDR',
    idxIndices:['LQ45'], tags:['Mixed Use','Mal','Surabaya'], character:'Siklikal',
  },
  {
    symbol:'SMRA', name:'Summarecon Agung Tbk',
    sector:'Real Estate', subsector:'Residential Property', tier:'MID',
    price:845, change:5, changePercent:0.60, marketCap:'12.2T IDR',
    avg20dValue:42_000_000_000,
    peRatio:16.4, dividendYield:1.2, roe:8.4, netMargin:12.4, growth:6.4,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Rendah',
    rev23:'3.8T IDR',  rev24:'4.2T IDR',  rev25:'4.6T IDR',
    np23:'0.5T IDR',   np24:'0.6T IDR',   np25:'0.7T IDR',
    ast23:'18.4T IDR', ast24:'19.8T IDR', ast25:'21.4T IDR',
    liab23:'11.4T IDR', liab24:'12.2T IDR', liab25:'13.1T IDR',
    ocf23:'0.8T IDR', ocf24:'0.9T IDR', ocf25:'1.0T IDR',
    idxIndices:['LQ45'], tags:['Properti','Kelapa Gading'], character:'Siklikal',
  },

  // ── TECHNOLOGY ───────────────────────────────────────────
  {
    symbol:'GOTO', name:'GoTo Gojek Tokopedia Tbk',
    sector:'Technology', subsector:'Internet & E-commerce', tier:'MEGA',
    price:68, change:-2, changePercent:-2.86, marketCap:'73.4T IDR',
    avg20dValue:420_000_000_000,
    peRatio:0.0, dividendYield:0.0, roe:-8.4, netMargin:-12.4, growth:24.8,
    flowBias:'Distribusi', flowIntensity:'Distribusi Sedang', flowReliability:'Tinggi',
    rev23:'21.4T IDR', rev24:'26.8T IDR', rev25:'33.4T IDR',
    np23:'-4.2T IDR',  np24:'-2.8T IDR',  np25:'-1.4T IDR',
    ast23:'68.4T IDR', ast24:'72.4T IDR', ast25:'78.4T IDR',
    liab23:'18.4T IDR', liab24:'19.8T IDR', liab25:'21.4T IDR',
    ocf23:'-3.2T IDR', ocf24:'-1.8T IDR', ocf25:'-0.4T IDR',
    idxIndices:['IDX30','LQ45','IDX80'], tags:['Teknologi','Super App','Loss Stage'], character:'Spekulatif',
  },
  {
    symbol:'BUKA', name:'Bukalapak.com Tbk',
    sector:'Technology', subsector:'E-commerce', tier:'LARGE',
    price:118, change:-3, changePercent:-2.48, marketCap:'12.8T IDR',
    avg20dValue:88_000_000_000,
    peRatio:0.0, dividendYield:0.0, roe:-6.4, netMargin:-18.4, growth:8.4,
    flowBias:'Distribusi', flowIntensity:'Distribusi Sedang', flowReliability:'Sedang',
    rev23:'3.8T IDR',  rev24:'4.1T IDR',  rev25:'4.4T IDR',
    np23:'-1.4T IDR',  np24:'-0.9T IDR',  np25:'-0.5T IDR',
    ast23:'14.8T IDR', ast24:'15.4T IDR', ast25:'16.2T IDR',
    liab23:'2.8T IDR',  liab24:'3.2T IDR',  liab25:'3.8T IDR',
    ocf23:'-0.8T IDR', ocf24:'-0.4T IDR', ocf25:'-0.1T IDR',
    idxIndices:['LQ45'], tags:['Teknologi','E-commerce','Loss Stage'], character:'Spekulatif',
  },
  {
    symbol:'EMTK', name:'Elang Mahkota Teknologi Tbk',
    sector:'Technology', subsector:'Media & Technology', tier:'MID',
    price:980, change:10, changePercent:1.03, marketCap:'26.8T IDR',
    avg20dValue:48_000_000_000,
    peRatio:24.4, dividendYield:0.8, roe:8.4, netMargin:8.4, growth:12.4,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'12.4T IDR', rev24:'14.0T IDR', rev25:'15.8T IDR',
    np23:'1.0T IDR',   np24:'1.2T IDR',   np25:'1.4T IDR',
    ast23:'32.4T IDR', ast24:'35.4T IDR', ast25:'38.8T IDR',
    liab23:'12.4T IDR', liab24:'13.4T IDR', liab25:'14.8T IDR',
    ocf23:'1.8T IDR', ocf24:'2.2T IDR', ocf25:'2.8T IDR',
    idxIndices:['LQ45'], tags:['Media','Teknologi','Konten Digital'], character:'Momentum',
  },

  // ── ENERGY / RENEWABLES ──────────────────────────────────
  {
    symbol:'BREN', name:'Barito Renewables Energy Tbk',
    sector:'Energy', subsector:'Renewable Energy', tier:'LARGE',
    price:3140, change:50, changePercent:1.62, marketCap:'342.4T IDR',
    avg20dValue:185_000_000_000,
    peRatio:42.4, dividendYield:0.4, roe:18.4, netMargin:28.4, growth:18.4,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Kuat', flowReliability:'Tinggi',
    rev23:'8.4T IDR',  rev24:'10.4T IDR', rev25:'12.8T IDR',
    np23:'2.1T IDR',   np24:'2.8T IDR',   np25:'3.6T IDR',
    ast23:'42.4T IDR', ast24:'52.4T IDR', ast25:'64.8T IDR',
    liab23:'24.8T IDR', liab24:'30.4T IDR', liab25:'37.2T IDR',
    ocf23:'3.4T IDR', ocf24:'4.4T IDR', ocf25:'5.6T IDR',
    idxIndices:['IDX30','LQ45','IDX80'], tags:['EBT','Panas Bumi','Renewables','High Growth'], character:'Momentum',
  },
  {
    symbol:'TPIA', name:'Chandra Asri Pacific Tbk',
    sector:'Basic Materials', subsector:'Petrochemicals', tier:'LARGE',
    price:5450, change:50, changePercent:0.93, marketCap:'107.2T IDR',
    avg20dValue:115_000_000_000,
    peRatio:22.4, dividendYield:1.2, roe:8.4, netMargin:8.4, growth:4.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'38.4T IDR', rev24:'40.8T IDR', rev25:'43.2T IDR',
    np23:'3.4T IDR',   np24:'3.8T IDR',   np25:'4.6T IDR',
    ast23:'58.4T IDR', ast24:'62.8T IDR', ast25:'68.4T IDR',
    liab23:'34.4T IDR', liab24:'36.8T IDR', liab25:'39.4T IDR',
    ocf23:'5.8T IDR', ocf24:'6.4T IDR', ocf25:'7.2T IDR',
    idxIndices:['LQ45','IDX80'], tags:['Petrokimia','Industri Dasar'], character:'Siklikal',
  },

  // ── AGRICULTURE ──────────────────────────────────────────
  {
    symbol:'AALI', name:'Astra Agro Lestari Tbk',
    sector:'Consumer Staples', subsector:'Agricultural Products', tier:'MID',
    price:7800, change:50, changePercent:0.64, marketCap:'12.5T IDR',
    avg20dValue:42_000_000_000,
    peRatio:8.4, dividendYield:4.8, roe:14.2, netMargin:8.4, growth:-2.4,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'18.4T IDR', rev24:'17.8T IDR', rev25:'17.2T IDR',
    np23:'1.5T IDR',   np24:'1.4T IDR',   np25:'1.5T IDR',
    ast23:'20.4T IDR', ast24:'21.2T IDR', ast25:'22.4T IDR',
    liab23:'7.4T IDR',  liab24:'7.8T IDR',  liab25:'8.4T IDR',
    ocf23:'2.8T IDR', ocf24:'2.4T IDR', ocf25:'2.6T IDR',
    idxIndices:['LQ45'], tags:['CPO','Perkebunan','Sawit'], character:'Siklikal',
  },
  {
    symbol:'LSIP', name:'PP London Sumatra Indonesia Tbk',
    sector:'Consumer Staples', subsector:'Agricultural Products', tier:'MID',
    price:1020, change:5, changePercent:0.49, marketCap:'6.9T IDR',
    avg20dValue:28_000_000_000,
    peRatio:7.4, dividendYield:5.2, roe:10.4, netMargin:12.8, growth:-4.8,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Rendah',
    rev23:'4.8T IDR',  rev24:'4.4T IDR',  rev25:'4.2T IDR',
    np23:'0.6T IDR',   np24:'0.5T IDR',   np25:'0.5T IDR',
    ast23:'8.4T IDR',  ast24:'8.8T IDR',  ast25:'9.2T IDR',
    liab23:'1.8T IDR',  liab24:'1.9T IDR',  liab25:'2.0T IDR',
    ocf23:'0.9T IDR', ocf24:'0.8T IDR', ocf25:'0.8T IDR',
    idxIndices:['LQ45'], tags:['CPO','Karet','Perkebunan'], character:'Defensif',
  },

  // ── Previously missing LQ45 stocks ──────────────────────
  {
    symbol:'ICBP', name:'Indofood CBP Sukses Makmur Tbk',
    sector:'Consumer Staples', subsector:'Food & Beverages', tier:'LARGE',
    price:9500, change:75, changePercent:0.80, marketCap:'55.3T IDR',
    avg20dValue:180_000_000_000,
    peRatio:18.5, dividendYield:3.2, roe:17.8, netMargin:9.6, growth:8.5,
    flowBias:'Netral', flowIntensity:'Netral', flowReliability:'Sedang',
    rev23:'72.4T IDR', rev24:'78.2T IDR', rev25:'84.8T IDR',
    np23:'6.8T IDR',   np24:'7.5T IDR',   np25:'8.1T IDR',
    ast23:'48.4T IDR', ast24:'52.8T IDR', ast25:'57.4T IDR',
    liab23:'22.4T IDR', liab24:'24.2T IDR', liab25:'26.4T IDR',
    ocf23:'8.4T IDR', ocf24:'9.2T IDR', ocf25:'10.1T IDR',
    idxIndices:['IDX30','LQ45','IDX80','KOMPAS100'], tags:['FMCG','Indomie','Consumer Staples'], character:'Defensif',
  },
  {
    symbol:'ADRO', name:'Adaro Energy Indonesia Tbk',
    sector:'Energy', subsector:'Coal Mining', tier:'LARGE',
    price:1540, change:-15, changePercent:-0.96, marketCap:'48.7T IDR',
    avg20dValue:320_000_000_000,
    peRatio:7.8, dividendYield:6.5, roe:15.2, netMargin:24.1, growth:-5.2,
    flowBias:'Distribusi', flowIntensity:'Distribusi Sedang', flowReliability:'Sedang',
    rev23:'92.4T IDR', rev24:'82.8T IDR', rev25:'74.2T IDR',
    np23:'18.4T IDR',  np24:'14.8T IDR',  np25:'11.4T IDR',
    ast23:'112.4T IDR', ast24:'108.4T IDR', ast25:'102.8T IDR',
    liab23:'42.4T IDR', liab24:'40.8T IDR', liab25:'38.4T IDR',
    ocf23:'22.4T IDR', ocf24:'18.4T IDR', ocf25:'14.8T IDR',
    idxIndices:['IDX30','LQ45','IDX80'], tags:['Batu Bara','Energi','Dividen Tinggi'], character:'Defensif',
  },
  {
    symbol:'UNTR', name:'United Tractors Tbk',
    sector:'Industrials', subsector:'Heavy Equipment', tier:'LARGE',
    price:24250, change:200, changePercent:0.83, marketCap:'73.8T IDR',
    avg20dValue:280_000_000_000,
    peRatio:7.2, dividendYield:6.1, roe:19.8, netMargin:12.3, growth:4.2,
    flowBias:'Akumulasi', flowIntensity:'Akumulasi Sedang', flowReliability:'Tinggi',
    rev23:'118.4T IDR', rev24:'123.2T IDR', rev25:'128.4T IDR',
    np23:'13.8T IDR',   np24:'14.8T IDR',   np25:'15.8T IDR',
    ast23:'98.4T IDR',  ast24:'104.2T IDR', ast25:'110.8T IDR',
    liab23:'42.4T IDR', liab24:'44.8T IDR', liab25:'47.4T IDR',
    ocf23:'18.4T IDR', ocf24:'20.4T IDR', ocf25:'22.8T IDR',
    idxIndices:['IDX30','LQ45','IDX80','KOMPAS100'], tags:['Komatsu','Tambang','Heavy Equipment'], character:'Institusional',
  },
];

// ── Template functions ────────────────────────────────────

const SECTOR_BADGE: Record<string, string> = {
  'Financials':              'SEKTOR KEUANGAN',
  'Communication Services':  'SEKTOR TELEKOMUNIKASI',
  'Consumer Staples':        'SEKTOR KONSUMER',
  'Consumer Discretionary':  'SEKTOR KONSUMER DISKRESIONER',
  'Energy':                  'SEKTOR ENERGI',
  'Basic Materials':         'SEKTOR BAHAN DASAR',
  'Industrials':             'SEKTOR INDUSTRI',
  'Real Estate':             'SEKTOR PROPERTI',
  'Technology':              'SEKTOR TEKNOLOGI',
};

const FLOW_BIAS_ID: Record<string, string> = {
  'Akumulasi': 'Akumulasi',
  'Distribusi': 'Distribusi',
  'Netral': 'Netral',
};

function fmtPrice(price: number): string {
  return price.toLocaleString('id-ID');
}

function buildSummary(s: StockSeed): string {
  const fundQuality = s.roe > 15 ? 'fundamental kuat' : s.roe > 8 ? 'fundamental sedang' : 'fundamental dalam tekanan';
  const biasDesc = s.flowBias === 'Akumulasi'
    ? 'menunjukkan akumulasi institusi dengan aliran dana positif'
    : s.flowBias === 'Distribusi'
    ? 'menunjukkan distribusi dengan tekanan jual institusi'
    : 'mencatat aktivitas perdagangan yang seimbang';
  const growthDesc = s.growth > 10 ? `Pertumbuhan ${s.growth.toFixed(1)}% YoY menunjukkan ekspansi yang akseleratif.`
    : s.growth > 0 ? `Pertumbuhan ${s.growth.toFixed(1)}% YoY mencerminkan ekspansi moderat.`
    : `Penurunan ${Math.abs(s.growth).toFixed(1)}% YoY mencerminkan tekanan pada pendapatan.`;
  return `${s.name} ${biasDesc}. ROE ${s.roe.toFixed(1)}% dan Net Margin ${s.netMargin.toFixed(1)}% mencerminkan ${fundQuality}. ${growthDesc}`;
}

function buildDescription(s: StockSeed): string {
  return `${s.name} (${s.symbol}) adalah perusahaan ${s.sector.toLowerCase()} terkemuka di Indonesia yang terdaftar di Bursa Efek Indonesia. Beroperasi di segmen ${s.subsector}, perusahaan ini menjadi salah satu konstituen indeks LQ45 yang mencerminkan likuiditas dan kapitalisasi pasar yang tinggi. Sebagai emiten blue chip, ${s.symbol} menjadi referensi utama pelaku pasar dalam mengukur kinerja sektor ${s.sector.toLowerCase()} di pasar modal Indonesia.`;
}

function buildBrokerData(s: StockSeed): string {
  const netBuyAmt = s.flowBias === 'Akumulasi' ? `${(s.avg20dValue * 0.15 / 1e9).toFixed(1)}B IDR` : null;
  const netSellAmt = s.flowBias === 'Distribusi' ? `${(s.avg20dValue * 0.12 / 1e9).toFixed(1)}B IDR` : null;
  const brokers = [
    { code:'BK',   name:'PT Mandiri Sekuritas',  netBuy: s.flowBias==='Akumulasi' ? netBuyAmt : null, netSell: s.flowBias==='Distribusi' ? netSellAmt : null, volumePercent:'8.4%', avgBuy:fmtPrice(s.price+5), avgSell:fmtPrice(s.price-5) },
    { code:'YP',   name:'PT eTrading Securities', netBuy: s.flowBias==='Distribusi' ? null : null, netSell: s.flowBias==='Distribusi' ? `${(s.avg20dValue*0.08/1e9).toFixed(1)}B IDR` : null, volumePercent:'10.2%', avgBuy:fmtPrice(s.price+8), avgSell:fmtPrice(s.price-3) },
    { code:'CIMB', name:'PT CIMB Securities',     netBuy: s.flowBias==='Akumulasi' ? `${(s.avg20dValue*0.08/1e9).toFixed(1)}B IDR` : null, netSell: null, volumePercent:'6.1%', avgBuy:fmtPrice(s.price+3), avgSell:fmtPrice(s.price-4) },
  ];
  return JSON.stringify(brokers);
}

function buildForeignData(s: StockSeed): string {
  const val = s.avg20dValue;
  const fBuy  = (val * 0.22).toFixed(0);
  const fSell = (val * 0.18).toFixed(0);
  const dBuy  = (val * 0.52).toFixed(0);
  const dSell = (val * 0.48).toFixed(0);
  return JSON.stringify({
    foreignBuy:  `${(Number(fBuy)/1e9).toFixed(1)}B IDR`,
    foreignSell: `${(Number(fSell)/1e9).toFixed(1)}B IDR`,
    netForeignFlow: `${((Number(fBuy)-Number(fSell))/1e9).toFixed(1)}B IDR`,
    domesticBuy:  `${(Number(dBuy)/1e9).toFixed(1)}B IDR`,
    domesticSell: `${(Number(dSell)/1e9).toFixed(1)}B IDR`,
    foreignPercent: 22,
    domesticPercent: 78,
  });
}

function buildRiskData(s: StockSeed): string {
  const level = s.flowBias === 'Distribusi' ? 'Tinggi' : s.roe > 15 ? 'Rendah' : 'Sedang';
  return JSON.stringify({
    overview: `${s.name} memiliki profil risiko ${level.toLowerCase()} berdasarkan analisis fundamental dan teknikal terkini.`,
    level,
    skew: s.flowBias === 'Distribusi' ? 'Negatif' : 'Seimbang',
    primaryRisks: [
      { title: 'Risiko Makro', why: 'Perubahan suku bunga BI dan nilai tukar rupiah mempengaruhi valuasi.', likelihood: 'Sedang', impact: 'Sedang' },
      { title: 'Risiko Sektoral', why: `Dinamika sektor ${s.sector.toLowerCase()} dapat mempengaruhi kinerja operasional.`, likelihood: 'Rendah', impact: 'Tinggi' },
    ],
    contrarianRisks: [],
    tension: `Valuasi P/E ${s.peRatio > 0 ? s.peRatio.toFixed(1) : 'N/A'}x mencerminkan ekspektasi pasar terhadap prospek pertumbuhan.`,
    invalidation: [
      `Penurunan ROE di bawah ${Math.max(0, s.roe - 5).toFixed(0)}%`,
      'Perubahan regulasi yang signifikan di sektor ini',
    ],
    investorFit: {
      suitable: s.flowBias === 'Akumulasi' ? 'Investor growth dan momentum yang mencari potensi apresiasi.' : 'Investor yang toleran terhadap volatilitas jangka pendek.',
      unsuitable: 'Investor konservatif yang menghindari volatilitas.',
    },
  });
}

function buildParams(s: StockSeed): any[] {
  const avgPrice = fmtPrice(s.price);
  return [
    s.symbol,                          // $1
    s.name,                            // $2
    String(s.price),                   // $3 price
    String(s.change),                  // $4 change
    String(s.changePercent),           // $5 change_percent
    buildSummary(s),                   // $6 summary
    buildDescription(s),               // $7 description
    s.sector,                          // $8 sector
    s.subsector,                       // $9 subsector
    s.marketCap,                       // $10 market_cap
    JSON.stringify(s.idxIndices ?? ['LQ45']), // $11 idx_indices
    SECTOR_BADGE[s.sector] ?? 'SEKTOR IDX', // $12 sector_badge
    JSON.stringify(s.tags ?? [s.sector]), // $13 stock_tags
    s.character ?? 'Institusional',    // $14 stock_character
    `Saham ${s.character ?? 'institusional'} di sektor ${s.sector}.`, // $15 stock_character_desc
    String(s.peRatio),                 // $16 pe_ratio
    String(s.dividendYield),           // $17 dividend_yield
    String(s.roe),                     // $18 roe
    String(s.netMargin),               // $19 net_margin
    String(s.growth),                  // $20 growth
    `Investor memantau ${s.symbol} sebagai representasi kinerja sektor ${s.sector.toLowerCase()} Indonesia.`, // $21 investor_view
    `Laporan keuangan ${s.name} mencerminkan ${s.growth >= 0 ? 'pertumbuhan' : 'tekanan'} pendapatan dengan ROE ${s.roe.toFixed(1)}% dan Net Margin ${s.netMargin.toFixed(1)}%.`, // $22 financial_summary
    s.rev23,  // $23
    s.rev24,  // $24
    s.rev25,  // $25
    s.np23,   // $26
    s.np24,   // $27
    s.np25,   // $28
    s.ast23,  // $29
    s.ast24,  // $30
    s.ast25,  // $31
    s.liab23, // $32
    s.liab24, // $33
    s.liab25, // $34
    s.ocf23,  // $35
    s.ocf24,  // $36
    s.ocf25,  // $37
    `Volume perdagangan ${s.symbol} menunjukkan aktivitas ${s.flowBias.toLowerCase()} dengan nilai rata-rata ${(s.avg20dValue/1e9).toFixed(0)}B IDR per sesi.`, // $38 trading_activity_summary
    `Aliran dana ${s.symbol} mencerminkan ${s.flowBias.toLowerCase()} dengan bias ${FLOW_BIAS_ID[s.flowBias]}.`, // $39 flow_overview_summary
    s.flowBias,       // $40 flow_bias
    s.flowReliability, // $41 flow_reliability
    s.flowIntensity,   // $42 flow_intensity
    buildBrokerData(s), // $43 broker_data
    buildForeignData(s), // $44 foreign_activity_data
    `${fmtPrice(s.price + 5)} IDR`, // $45 avg_buy_price
    `${fmtPrice(s.price - 3)} IDR`, // $46 avg_sell_price
    `Tidak ada berita material terbaru untuk ${s.symbol}. Pantau perkembangan laporan keuangan kuartalan berikutnya.`, // $47 news_overview_summary
    'Rendah',   // $48 news_impact
    'Sementara', // $49 news_relevance
    JSON.stringify([{ headline: `${s.name} — Update Pasar`, date: '2026-05-19', source: 'IDX News', impact: 'Sementara' }]), // $50 news_feed
    JSON.stringify([]), // $51 corporate_actions
    `Data broker menunjukkan ${s.flowBias.toLowerCase()} dengan reliabilitas ${s.flowReliability.toLowerCase()}.`, // $52 investor_interpretation
    JSON.stringify([]),  // $53 event_analysis
    `ROE ${s.roe.toFixed(1)}% dan Net Margin ${s.netMargin.toFixed(1)}% mencerminkan efisiensi operasional ${s.name}.`, // $54 financials_analyst_view
    `Aliran dana ${s.symbol} menunjukkan ${s.flowBias.toLowerCase()} dengan ${s.flowReliability.toLowerCase()} tingkat reliabilitas.`, // $55 flow_analyst_view
    `Profil risiko ${s.symbol} perlu dipantau dalam konteks kondisi makro dan dinamika sektoral.`, // $56 risk_analyst_view
    buildRiskData(s),  // $57 risk_data
    s.avg20dValue,     // $58 avg20d_value
  ];
}

// ── Main ──────────────────────────────────────────────────

async function seedLQ45Stocks() {
  console.log(`[seedLQ45] Starting seed — ${NEW_STOCKS.length} stocks to process`);

  let inserted = 0;
  let skipped  = 0;

  for (const s of NEW_STOCKS) {
    const exists = await pool.query('SELECT 1 FROM stocks WHERE symbol = $1', [s.symbol]);
    if (exists.rows.length > 0) {
      console.log(`[seedLQ45] ${s.symbol} — already exists, skipping`);
      skipped++;
      continue;
    }

    const params = buildParams(s);

    await pool.query(`
      INSERT INTO stocks (
        symbol, name, price, change, change_percent,
        summary, description, sector, subsector, market_cap,
        idx_indices, sector_badge, stock_tags, stock_character, stock_character_desc,
        pe_ratio, dividend_yield, roe, net_margin, growth,
        investor_view, financial_summary,
        revenue_2023, revenue_2024, revenue_2025,
        net_profit_2023, net_profit_2024, net_profit_2025,
        assets_2023, assets_2024, assets_2025,
        liabilities_2023, liabilities_2024, liabilities_2025,
        ocf_2023, ocf_2024, ocf_2025,
        trading_activity_summary, flow_overview_summary,
        flow_bias, flow_reliability, flow_intensity,
        broker_data, foreign_activity_data,
        avg_buy_price, avg_sell_price,
        news_overview_summary, news_impact, news_relevance,
        news_feed, corporate_actions,
        investor_interpretation, event_analysis,
        financials_analyst_view, flow_analyst_view, risk_analyst_view,
        risk_data,
        avg20d_value,
        scrape_source
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
        $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,
        $51,$52,$53,$54,$55,$56,$57,$58,'SEED_INITIAL'
      )
    `, params);

    console.log(`[seedLQ45] ${s.symbol} — inserted (${s.tier}, avg20d=${(s.avg20dValue/1e9).toFixed(0)}B)`);
    inserted++;
  }

  const total = await pool.query('SELECT COUNT(*) FROM stocks');
  console.log(`\n[seedLQ45] Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log(`[seedLQ45] Total stocks in DB: ${total.rows[0].count}`);

  await pool.end();
}

seedLQ45Stocks().catch(err => {
  console.error('[seedLQ45] Fatal error:', err);
  process.exit(1);
});
