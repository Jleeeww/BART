import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ label, value, icon, subValue, trend }: MetricCardProps) {
  return (
    <Card className="p-5 flex flex-col justify-between border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20 group">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary/80 transition-colors">
          {label}
        </span>
        {icon && <div className="text-muted-foreground/50 group-hover:text-primary transition-colors">{icon}</div>}
      </div>
      
      <div>
        <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-muted-foreground mt-1 font-medium">
            {subValue}
          </div>
        )}
      </div>
    </Card>
  );
}
