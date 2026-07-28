import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart } from "lucide-react";

interface FinancialQuarter {
  label: string;
  endDate: string;
  totalRevenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  incomeBeforeTax: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  stockholdersEquity: number | null;
  totalDebt: number | null;
  cashAndCashEquivalents: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
}

interface FinancialsResponse {
  symbol: string;
  quarters: FinancialQuarter[];
}

const SECTIONS: { title: string; rows: { key: keyof FinancialQuarter; label: string }[] }[] = [
  {
    title: "Laporan Laba Rugi",
    rows: [
      { key: "totalRevenue", label: "Total Revenue" },
      { key: "costOfRevenue", label: "Cost of Revenue" },
      { key: "grossProfit", label: "Gross Profit" },
      { key: "operatingIncome", label: "Operating Income" },
      { key: "incomeBeforeTax", label: "Income Before Tax" },
      { key: "netIncome", label: "Net Income" },
    ],
  },
  {
    title: "Neraca",
    rows: [
      { key: "totalAssets", label: "Total Assets" },
      { key: "stockholdersEquity", label: "Stockholders' Equity" },
      { key: "totalDebt", label: "Total Debt" },
      { key: "cashAndCashEquivalents", label: "Cash & Equivalents" },
    ],
  },
  {
    title: "Arus Kas",
    rows: [
      { key: "operatingCashFlow", label: "Operating Cash Flow" },
      { key: "freeCashFlow", label: "Free Cash Flow" },
    ],
  },
];

function fmt(n: number | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${abs.toLocaleString("id-ID")}`;
}

/**
 * Quarterly income statement / balance sheet / cash flow grid — sourced from
 * Yahoo Finance (fundamentalsTimeSeries), no Stockbit/IDX equivalent at this
 * granularity. Some rows (COGS/Gross Profit/Operating Income) are
 * legitimately blank for financial-sector issuers (banks don't report COGS).
 */
export function FinancialStatementsPanel({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery<FinancialsResponse | null>({
    queryKey: ["/api/financials", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/financials/${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="p-5 border-border/50 bg-card">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (!data || data.quarters.length === 0) {
    return (
      <Card className="p-5 border-border/50 bg-card">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-2">
          <FileBarChart className="w-4 h-4 text-signal" /> Laporan Keuangan
        </h3>
        <p className="text-sm text-muted-foreground">Data laporan keuangan kuartalan belum tersedia untuk {symbol}.</p>
      </Card>
    );
  }

  const quarters = data.quarters.slice(0, 5);

  return (
    <Card className="p-5 border-border/50 bg-card overflow-x-auto">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
        <FileBarChart className="w-4 h-4 text-signal" /> Laporan Keuangan Kuartalan (Yahoo Finance)
      </h3>
      {SECTIONS.map((section, si) => (
        <div key={section.title} className={si > 0 ? "mt-5" : ""}>
          <p className="text-xs font-semibold text-text-3 uppercase tracking-wide mb-2">{section.title}</p>
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 pr-3 font-medium text-text-3">Rincian</th>
                {quarters.map((q) => (
                  <th key={q.endDate} className="text-right py-2 px-3 font-medium text-text-3 whitespace-nowrap">
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.key} className="border-b border-border/20 last:border-0">
                  <td className="py-2 pr-3 text-text-2">{row.label}</td>
                  {quarters.map((q) => (
                    <td key={q.endDate} className="text-right py-2 px-3 text-foreground whitespace-nowrap">
                      {fmt(q[row.key] as number | null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-text-4 mt-4">
        Angka dalam Rupiah. Baris kosong (—) berarti tidak dilaporkan untuk sektor emiten ini (mis. bank tidak melaporkan COGS).
      </p>
    </Card>
  );
}
