import { useQuery } from "@tanstack/react-query";
import { Sankey, ResponsiveContainer, Tooltip, Rectangle } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch } from "lucide-react";

interface BrokerLeg {
  broker: string;
  type: "FOREIGN" | "LOCAL" | "GOVERNMENT";
  value: number;
}

interface BandarData {
  symbol: string;
  date: string;
  topBuyers: BrokerLeg[];
  topSellers: BrokerLeg[];
}

const CATEGORY_LABEL: Record<BrokerLeg["type"], string> = {
  LOCAL: "Domestik",
  GOVERNMENT: "BUMN",
  FOREIGN: "Asing",
};
const CATEGORY_COLOR: Record<BrokerLeg["type"], string> = {
  LOCAL: "#8b5cf6",      // purple — matches Stockbit's Domestic
  GOVERNMENT: "#14b8a6", // teal — matches Stockbit's BUMN
  FOREIGN: "#ef4444",    // red — matches Stockbit's Foreign
};

function fmtB(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  return n.toLocaleString("id-ID");
}

/**
 * Builds an honest Sankey graph: individual brokers fan into their category
 * (Domestic/BUMN/Foreign), categories fan into a single total node. This
 * uses only real per-broker net values (same source as BandarmologyPanel —
 * Stockbit broker summary). It deliberately does NOT draw a line from a
 * specific buyer broker to a specific seller broker — Stockbit's API gives
 * net value per broker, not which buy order matched which sell order, so
 * a bilateral buyer→seller link would be fabricated. Two independent
 * fan-in/fan-out trees (buy side, sell side) avoid that entirely.
 */
function buildSide(legs: BrokerLeg[], direction: "buy" | "sell", limit = 6) {
  const top = [...legs].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, limit);
  const categoriesPresent = Array.from(new Set(top.map((l) => l.type)));
  const totalNodeName = direction === "buy" ? "Total Beli" : "Total Jual";

  const nodes: { name: string }[] = [];
  const nodeIndex = new Map<string, number>();
  const addNode = (name: string) => {
    if (!nodeIndex.has(name)) {
      nodeIndex.set(name, nodes.length);
      nodes.push({ name });
    }
    return nodeIndex.get(name)!;
  };

  const links: { source: number; target: number; value: number }[] = [];
  const totalIdx = addNode(totalNodeName);
  const categoryTotals = new Map<string, number>();

  for (const leg of top) {
    const brokerIdx = addNode(leg.broker);
    const catIdx = addNode(CATEGORY_LABEL[leg.type]);
    const value = Math.max(Math.abs(leg.value), 1);
    if (direction === "buy") {
      links.push({ source: brokerIdx, target: catIdx, value });
    } else {
      links.push({ source: catIdx, target: brokerIdx, value });
    }
    categoryTotals.set(leg.type, (categoryTotals.get(leg.type) ?? 0) + value);
  }
  for (const cat of categoriesPresent) {
    const catIdx = nodeIndex.get(CATEGORY_LABEL[cat])!;
    const value = categoryTotals.get(cat) ?? 0;
    if (direction === "buy") {
      links.push({ source: catIdx, target: totalIdx, value });
    } else {
      links.push({ source: totalIdx, target: catIdx, value });
    }
  }

  return { data: { nodes, links }, top };
}

function SideSankey({ legs, direction }: { legs: BrokerLeg[]; direction: "buy" | "sell" }) {
  if (legs.length === 0) {
    return <div className="flex items-center justify-center h-full text-xs text-text-4">Tidak ada data</div>;
  }
  const { data, top } = buildSide(legs, direction);
  const colorByNode = (name: string): string => {
    const leg = top.find((l) => l.broker === name);
    if (leg) return CATEGORY_COLOR[leg.type];
    if (name === "Domestik") return CATEGORY_COLOR.LOCAL;
    if (name === "BUMN") return CATEGORY_COLOR.GOVERNMENT;
    if (name === "Asing") return CATEGORY_COLOR.FOREIGN;
    return "#64748b"; // Total node
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <Sankey
        data={data}
        nodePadding={22}
        nodeWidth={10}
        linkCurvature={0.55}
        margin={{ top: 8, bottom: 8, left: direction === "buy" ? 4 : 60, right: direction === "buy" ? 60 : 4 }}
        node={(props: any) => {
          const { x, y, width, height, payload } = props;
          const color = colorByNode(payload.name);
          const isTotal = payload.name.startsWith("Total");
          const labelOnRight = direction === "buy" ? true : false;
          return (
            <g>
              <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={isTotal ? 0.9 : 0.85} />
              <text
                x={labelOnRight ? x + width + 6 : x - 6}
                y={y + height / 2}
                textAnchor={labelOnRight ? "start" : "end"}
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--text-1)"
              >
                {payload.name}
              </text>
            </g>
          );
        }}
        link={{ stroke: "#64748b", strokeOpacity: 0.25 }}
      >
        <Tooltip formatter={(value: number) => fmtB(value)} />
      </Sankey>
    </ResponsiveContainer>
  );
}

/**
 * "Distribusi Broker" panel — Stockbit-style buyer/seller broker breakdown,
 * built with real per-broker net values (same data as BandarmologyPanel).
 * No bilateral buyer→seller link is drawn (that data doesn't exist anywhere —
 * Stockbit's broker summary API gives net value per broker, not matched
 * trades) — instead each side fans real brokers into their real category
 * (Domestic/BUMN/Foreign) totals.
 */
export function BrokerDistributionPanel({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery<BandarData | null>({
    queryKey: ["/api/bandarmology", symbol, "distribution"],
    queryFn: async () => {
      const res = await fetch(`/api/bandarmology/${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="p-5 border-border/50 bg-card">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-80 w-full" />
      </Card>
    );
  }

  if (!data || (data.topBuyers.length === 0 && data.topSellers.length === 0)) {
    return null;
  }

  return (
    <Card className="p-5 border-border/50 bg-card">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-signal" /> Distribusi Broker
        </h3>
        <span className="text-xs text-text-4">{data.date}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <p className="text-xs font-semibold text-text-3 uppercase tracking-wide">Buyer</p>
        <p className="text-xs font-semibold text-text-3 uppercase tracking-wide text-right">Seller</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SideSankey legs={data.topBuyers} direction="buy" />
        <SideSankey legs={data.topSellers} direction="sell" />
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-text-4">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: CATEGORY_COLOR.LOCAL }} /> Domestik</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: CATEGORY_COLOR.GOVERNMENT }} /> BUMN</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: CATEGORY_COLOR.FOREIGN }} /> Asing</span>
      </div>
      <p className="text-[11px] text-text-4 mt-2 leading-relaxed">
        Sumber: Stockbit (broker summary real). Setiap broker terhubung ke total kategorinya sendiri — bukan garis buyer↔seller spesifik, karena data pencocokan order per-transaksi tidak tersedia dari sumber manapun.
      </p>
    </Card>
  );
}
