import { db } from '../db';
import { signalLifecycle } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export type SignalStatus = 'AKTIF' | 'DIRAGUKAN' | 'GUGUR';

export interface SignalLifecycleInput {
  symbol: string;
  currentScore: number;
  currentDate: string;
  currentRegime: string | null;
  currentCycle: string | null;
}

export interface SignalLifecycleOutput {
  symbol: string;
  status: SignalStatus;
  statusReason: string;
  scoreDrift: number | null;
  baselineScore: number | null;
  baselineDate: string | null;
  currentScore: number;
  firedAt: string | null;
  updatedAt: string;
}

function computeStatus(
  currentScore: number,
  baselineScore: number | null,
  currentCycle: string | null,
  currentRegime: string | null,
  previousStatus: SignalStatus,
  consecutiveDiragukan: number
): { status: SignalStatus; reason: string } {
  if (previousStatus === 'GUGUR') {
    return {
      status: 'GUGUR',
      reason: 'Sinyal telah gugur. Konfirmasi baru diperlukan untuk re-entry.',
    };
  }

  if (currentScore < 35) {
    return {
      status: 'GUGUR',
      reason: `Skor kesiapan ${currentScore} di bawah ambang minimum (35). Tesis gugur.`,
    };
  }

  if (currentCycle === 'WASPADAI_DISTRIBUSI') {
    return {
      status: 'GUGUR',
      reason: 'Posisi siklus bergeser ke fase distribusi. Tesis akumulasi gugur.',
    };
  }

  if (baselineScore !== null) {
    const drift = currentScore - baselineScore;

    if (drift <= -25) {
      return {
        status: 'GUGUR',
        reason: `Skor turun ${Math.abs(drift).toFixed(0)} poin dari baseline (${baselineScore}→${currentScore}). Tesis gugur.`,
      };
    }

    if (drift <= -15) {
      if (consecutiveDiragukan >= 1) {
        return {
          status: 'DIRAGUKAN',
          reason: `Skor turun ${Math.abs(drift).toFixed(0)} poin selama ${consecutiveDiragukan + 1} sesi berturut-turut. Pantau ketat.`,
        };
      } else {
        return {
          status: 'AKTIF',
          reason: `Skor turun ${Math.abs(drift).toFixed(0)} poin sesi ini. Pantau — konfirmasi diperlukan sesi berikutnya.`,
        };
      }
    }
  }

  if (currentRegime) {
    const regimeLower = currentRegime.toLowerCase();
    if (regimeLower.includes('distribusi') || regimeLower.includes('spekulatif') || regimeLower.includes('volatile')) {
      return {
        status: 'DIRAGUKAN',
        reason: `Rezim bergeser ke "${currentRegime}". Tesis akumulasi perlu dikonfirmasi ulang.`,
      };
    }
  }

  return {
    status: 'AKTIF',
    reason: 'Tesis akumulasi masih intact. Struktur institusional terjaga.',
  };
}

export async function updateSignalLifecycle(
  input: SignalLifecycleInput
): Promise<SignalLifecycleOutput> {
  const now = new Date().toISOString();
  const sym = input.symbol.toUpperCase();

  try {
    const existing = await db
      .select()
      .from(signalLifecycle)
      .where(eq(signalLifecycle.symbol, sym))
      .limit(1);

    const record = existing[0] ?? null;

    const baselineScore = record?.baselineScore ?? input.currentScore;
    const baselineDate  = record?.baselineDate  ?? input.currentDate;
    const firedAt       = record?.firedAt       ?? now;
    const previousStatus = (record?.status ?? 'AKTIF') as SignalStatus;

    const scoreDrift = input.currentScore - baselineScore;

    const prevConsecutive = record?.diragudanSessions ?? 0;
    const newConsecutive = (scoreDrift <= -15 && scoreDrift > -25)
      ? prevConsecutive + 1
      : 0;

    const { status, reason } = computeStatus(
      input.currentScore,
      baselineScore,
      input.currentCycle,
      input.currentRegime,
      previousStatus,
      newConsecutive
    );

    const output: SignalLifecycleOutput = {
      symbol:        sym,
      status,
      statusReason:  reason,
      scoreDrift:    Number(scoreDrift.toFixed(2)),
      baselineScore,
      baselineDate,
      currentScore:  input.currentScore,
      firedAt,
      updatedAt:     now,
    };

    await db
      .insert(signalLifecycle)
      .values({
        symbol:         sym,
        status,
        baselineScore,
        baselineDate,
        currentScore:   input.currentScore,
        currentDate:    input.currentDate,
        currentRegime:  input.currentRegime ?? null,
        currentCycle:   input.currentCycle  ?? null,
        scoreDrift:     output.scoreDrift,
        statusReason:   reason,
        diragudanSessions: newConsecutive,
        firedAt,
        updatedAt:      now,
      })
      .onConflictDoUpdate({
        target: [signalLifecycle.symbol],
        set: {
          status,
          currentScore:  input.currentScore,
          currentDate:   input.currentDate,
          currentRegime: input.currentRegime ?? null,
          currentCycle:  input.currentCycle  ?? null,
          scoreDrift:    output.scoreDrift,
          statusReason:  reason,
          diragudanSessions: newConsecutive,
          updatedAt:     now,
        },
      });

    return output;

  } catch (err) {
    console.error(`[signalLifecycle] Error for ${sym}:`, err);
    return {
      symbol:       sym,
      status:       'AKTIF',
      statusReason: 'Status tidak dapat diverifikasi.',
      scoreDrift:   null,
      baselineScore: null,
      baselineDate:  null,
      currentScore:  input.currentScore,
      firedAt:       null,
      updatedAt:     now,
    };
  }
}

export async function getSignalLifecycle(
  symbol: string
): Promise<SignalLifecycleOutput | null> {
  try {
    const records = await db
      .select()
      .from(signalLifecycle)
      .where(eq(signalLifecycle.symbol, symbol.toUpperCase()))
      .limit(1);

    if (!records[0]) return null;
    const r = records[0];

    return {
      symbol:        r.symbol,
      status:        (r.status ?? 'AKTIF') as SignalStatus,
      statusReason:  r.statusReason ?? '',
      scoreDrift:    r.scoreDrift ?? null,
      baselineScore: r.baselineScore ?? null,
      baselineDate:  r.baselineDate ?? null,
      currentScore:  r.currentScore ?? 0,
      firedAt:       r.firedAt ?? null,
      updatedAt:     r.updatedAt ?? '',
    };
  } catch (err) {
    console.error(`[signalLifecycle] getSignalLifecycle error for ${symbol}:`, err);
    return null;
  }
}

export async function getAllSignalLifecycles(): Promise<SignalLifecycleOutput[]> {
  try {
    const records = await db.select().from(signalLifecycle);
    return records.map(r => ({
      symbol:        r.symbol,
      status:        (r.status ?? 'AKTIF') as SignalStatus,
      statusReason:  r.statusReason ?? '',
      scoreDrift:    r.scoreDrift ?? null,
      baselineScore: r.baselineScore ?? null,
      baselineDate:  r.baselineDate ?? null,
      currentScore:  r.currentScore ?? 0,
      firedAt:       r.firedAt ?? null,
      updatedAt:     r.updatedAt ?? '',
    }));
  } catch (err) {
    console.error('[signalLifecycle] getAllSignalLifecycles error:', err);
    return [];
  }
}
