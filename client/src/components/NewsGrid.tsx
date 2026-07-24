import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl: string;
}

/**
 * Real market-news grid with images (RSS, no AI). Pass symbol/company to sort
 * ticker-relevant articles first. Used in the Berita tab and /berita page.
 */
export function NewsGrid({
  symbol,
  company,
  limit = 12,
  title = "Berita Pasar Terkini",
}: {
  symbol?: string;
  company?: string;
  limit?: number;
  title?: string;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (symbol) qs.set("symbol", symbol);
    if (company) qs.set("company", company);
    fetch(`/api/news/feed?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.articles)) setArticles(d.articles); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, company]);

  return (
    <div>
      {title && (
        <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
          <Newspaper className="w-4 h-4 text-signal" /> {title}
        </h3>
      )}
      {loading && articles.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border/50 bg-card">
              <Skeleton className="h-40 w-full" />
              <div className="p-4">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-4 w-full mb-1.5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.slice(0, limit).map((n, i) => (
            <a
              key={i}
              href={n.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-lg border border-border/50 bg-card overflow-hidden hover:border-signal/50 transition-colors"
            >
              {n.imageUrl ? (
                <div className="h-40 w-full overflow-hidden bg-surface-2">
                  <img
                    src={n.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                  />
                </div>
              ) : null}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-signal">{n.source}</span>
                  <span className="text-xs text-text-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : ""}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug mb-1.5 line-clamp-2">{n.title}</p>
                <p className="text-xs text-text-3 leading-relaxed line-clamp-2">{n.summary}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Card className="p-6 border-border/50 bg-card text-center">
          <p className="text-sm text-text-3">Belum ada berita pasar tersedia.</p>
        </Card>
      )}
    </div>
  );
}
