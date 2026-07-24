/**
 * ============================================================
 * IDX COMPANY PROFILE v1.0
 * ============================================================
 * server/engine/idxCompanyProfile.ts
 *
 * Factual board/ownership data straight from IDX's official
 * company profile endpoint (GetCompanyProfilesDetail). This is
 * the FREE, ground-truth layer that powers the Management tab:
 * directors, commissioners, audit committee, shareholders (incl.
 * per-director insider ownership), corporate secretary.
 *
 * AI research (managementResearch.ts) is a separate qualitative
 * layer scored ON TOP of these real names.
 */
import { idxFetchJSON } from './idxClient';

export interface BoardMember {
  name: string;
  position: string;
  affiliated?: boolean;   // directors: Afiliasi
  independent?: boolean;  // commissioners: Independen
}

export interface Shareholder {
  name: string;
  category: string;       // e.g. "More than 5%", "Direksi", "Komisaris", "Saham Treasury"
  shares: number | null;
  percent: number | null;
  controller: boolean;
}

export interface IDXCompanyProfile {
  symbol: string;
  secretary: { name: string; email: string | null; phone: string | null } | null;
  directors: BoardMember[];
  commissioners: BoardMember[];
  auditCommittee: BoardMember[];
  shareholders: Shareholder[];
  fetchedAt: string;
}

const cache = new Map<string, { at: number; data: IDXCompanyProfile }>();
const TTL_MS = 24 * 60 * 60 * 1000; // board/ownership changes rarely — cache 24h

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Fetch the official IDX company profile. Returns null on failure. */
export async function fetchIDXCompanyProfile(
  symbol: string
): Promise<IDXCompanyProfile | null> {
  const sym = symbol.trim().toUpperCase();

  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const url = `https://www.idx.co.id/primary/ListedCompany/GetCompanyProfilesDetail?KodeEmiten=${sym}&language=id`;
  const raw = await idxFetchJSON(url);
  if (!raw) return null;

  const sek = Array.isArray(raw.Sekretaris) ? raw.Sekretaris[0] : null;

  const profile: IDXCompanyProfile = {
    symbol: sym,
    secretary: sek
      ? { name: sek.Nama ?? '', email: sek.Email ?? null, phone: sek.Telepon ?? null }
      : null,
    directors: (raw.Direktur ?? []).map((d: any) => ({
      name: d.Nama ?? '',
      position: d.Jabatan ?? '',
      affiliated: Boolean(d.Afiliasi),
    })),
    commissioners: (raw.Komisaris ?? []).map((k: any) => ({
      name: k.Nama ?? '',
      position: k.Jabatan ?? '',
      independent: Boolean(k.Independen),
    })),
    auditCommittee: (raw.KomiteAudit ?? []).map((a: any) => ({
      name: a.Nama ?? '',
      position: a.Jabatan ?? '',
    })),
    shareholders: (raw.PemegangSaham ?? []).map((s: any) => ({
      name: s.Nama ?? '',
      category: s.Kategori ?? '',
      shares: num(s.Jumlah),
      percent: num(s.Persentase),
      controller: Boolean(s.Pengendali),
    })),
    fetchedAt: new Date().toISOString(),
  };

  cache.set(sym, { at: Date.now(), data: profile });
  return profile;
}
