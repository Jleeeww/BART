// app/api/ai/route.js
event: "Earnings",
drivers: [
yoyProfitGrowth != null ? `YoY profit growth ${yoyProfitGrowth}%` : null,
...(notes || [])
].filter(Boolean),
immediate: "Typically drives short-term sentiment and price adjustment proportional to surprise vs expectations.",
secondOrder: "Sustained impact depends on margin durability, asset quality, and funding costs.",
thesis: "Positive if growth is repeatable and margins are defended; contrarian risk if growth is cyclical or non-recurring."
};
}


function handleRights({ rightsRatio, issuePrice, spot, useOfProceeds }) {
const discount = issuePrice && spot ? ((spot - issuePrice) / spot) * 100 : null;
return {
event: "Rights Issue",
drivers: [
rightsRatio ? `Rights ratio ${rightsRatio}` : null,
discount != null ? `Issue discount ~${discount.toFixed(1)}%` : null,
useOfProceeds ? `Use of proceeds: ${useOfProceeds}` : null
].filter(Boolean),
immediate: "Short-term price pressure is common due to dilution mechanics and selling into ex-rights.",
secondOrder: "Medium-term outcome depends on whether proceeds fund growth vs balance-sheet repair.",
thesis: "Conditionally positive if capital is deployed into accretive growth; negative if dilution offsets returns."
};
}


function handleAcquisition({ dealSizePctAssets, funding }) {
return {
event: "Acquisition",
drivers: [
dealSizePctAssets != null ? `Deal size ~${dealSizePctAssets}% of assets` : null,
funding ? `Funding: ${funding}` : null
].filter(Boolean),
immediate: "Often limited near-term price impact unless size is material or execution risk is high.",
secondOrder: "Strategic benefits accrue over time; execution and integration are key risks.",
thesis: "Strategically positive if synergies exceed integration costs; contrarian risk if ROE dilution persists."
};
}


function handleDividend({ amount, payoutStability }) {
return {
event: "Dividend",
drivers: [
amount ? `Dividend amount ${amount}` : null,
payoutStability ? `Payout stability: ${payoutStability}` : null
].filter(Boolean),
immediate: "Supports defensive positioning and income-focused demand.",
secondOrder: "Signals capital discipline; cuts are a structural red flag.",
thesis: "Positive for income reliability provided capital buffers remain strong."
};
}


function buildEventAnalysis(input) {
const e = input.event_specifics || {};
if (e.event_type === "Earnings") return handleEarnings({ yoyProfitGrowth: input.fundamentals?.yoy_profit_growth_pct, notes: e.notes });
if (e.event_type === "Rights") return handleRights({ rightsRatio: e.rights_ratio, issuePrice: e.issue_price, spot: input.price_context?.last_price, useOfProceeds: e.use_of_proceeds });
if (e.event_type === "Acquisition") return handleAcquisition({ dealSizePctAssets: e.deal_size_pct_assets, funding: e.funding });
if (e.event_type === "Dividend") return handleDividend({ amount: e.amount, payoutStability: e.payout_stability });
return { event: "General", drivers: [], immediate: "", secondOrder: "", thesis: "" };
}


/* =========================
API HANDLER
========================= */
export async function POST(req) {
const input = await req.json();


const spot = input.price_context?.last_price;
const flow = scoreFlow({
netBuy: input.flow_signals?.net_foreign_buy_idr + (input.flow_signals?.net_domestic_buy_idr || 0),
netSell: input.flow_signals?.net_sell_idr || 0,
adv: input.price_context?.adv_idr || 0,
top3Pct: input.flow_signals?.top_3_broker_volume_pct || 0,
buyAvg: input.flow_signals?.buy_avg_price,
sellAvg: input.flow_signals?.sell_avg_price,
spot
});


const eventAnalysis = buildEventAnalysis(input);


const structuredForLLM = {
...input,
derived: { flow }
};


const response = await client.chat.completions.create({
model: "gpt-4o",
temperature: 0.2,
messages: [
{ role: "system", content: SYSTEM_PROMPT },
{ role: "user", content: JSON.stringify(structuredForLLM) }
]
});


return new Response(JSON.stringify({ analysis: response.choices[0].message.content, derived: flow, eventAnalysis }), {
headers: { "Content-Type": "application/json" }
});
}