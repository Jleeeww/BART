import type { Express } from "express";
import Anthropic from "@anthropic-ai/sdk";

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export function registerManagementRoutes(app: Express): void {
  app.get('/api/management/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const { getCachedManagementResult } = await import('../engine/managementScorer');
      const result = getCachedManagementResult(symbol);
      if (!result) {
        return res.status(404).json({
          error:   'No management research found for this symbol',
          symbol,
          hint:    'Trigger research via POST /api/management/:symbol/research',
        });
      }
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/management/:symbol/research', async (req, res) => {
    try {
      if (!anthropicClient) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
      }

      const authHeader = req.headers.authorization;
      const token      = process.env.MANAGEMENT_TOKEN;
      if (!token || authHeader !== `Bearer ${token}`) {
        return res.status(401).json({ error: 'Unauthorized — MANAGEMENT_TOKEN required' });
      }

      const symbol      = req.params.symbol.toUpperCase();
      const { members, companyName } = req.body as {
        members:     Array<{ name: string; title: string }>;
        companyName?: string;
      };

      if (!Array.isArray(members) || members.length === 0) {
        return res.status(400).json({
          error: 'Body must include: { members: [{ name, title }], companyName?: string }',
        });
      }
      if (members.length > 10) {
        return res.status(400).json({
          error: 'Maximum 10 BOD members per request to control API costs',
          received: members.length,
        });
      }

      const { researchManagement }       = await import('../engine/managementResearch');
      const { scoreManagement, cacheManagementResult } = await import('../engine/managementScorer');

      const profiles = await researchManagement(
        members,
        symbol,
        companyName ?? symbol,
        anthropicClient
      );

      const result = scoreManagement(profiles, symbol);
      cacheManagementResult(symbol, result);

      res.status(200).json({
        ...result,
        profilesResearched: profiles.length,
        profilesRequested:  members.length,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
