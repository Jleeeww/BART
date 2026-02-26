export function detectAccumulationPhase(payload: any): string {
  const bias = payload.flowBias;
  const intensity = payload.flowIntensity;
  const reliability = payload.flowReliability;

  if (bias === "Akumulasi" && intensity === "Akumulasi Besar")
    return "Active Accumulation";

  if (bias === "Akumulasi" && reliability === "Tinggi")
    return "Stealth Accumulation";

  if (bias === "Akumulasi")
    return "Early Accumulation";

  if (bias === "Distribusi" && intensity === "Distribusi Besar")
    return "Active Distribution";

  if (bias === "Distribusi")
    return "Distribution";

  return "Sideways";
}
