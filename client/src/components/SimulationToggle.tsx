import { useSimulation } from "@/contexts/SimulationContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FlaskConical } from "lucide-react";

export function SimulationToggle() {
  const { state, toggleSimulationMode } = useSimulation();

  return (
    <div className="flex items-center gap-2" data-testid="toggle-simulation-mode">
      <FlaskConical className={`w-4 h-4 ${state.isSimulationMode ? "text-amber-500" : "text-muted-foreground"}`} />
      <Label htmlFor="simulation-mode" className="text-sm font-medium cursor-pointer">
        Mode Simulasi
      </Label>
      <Switch
        id="simulation-mode"
        checked={state.isSimulationMode}
        onCheckedChange={toggleSimulationMode}
        data-testid="switch-simulation"
      />
    </div>
  );
}
