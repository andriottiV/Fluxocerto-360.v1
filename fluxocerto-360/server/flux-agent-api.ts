import { Router } from "express";
import { z } from "zod";
import { runFluxAiProvider } from "./flux-ai-provider";

const requestSchema = z.object({
  userId: z.string().min(1).optional(),
  userMessage: z.string().min(1),
  conversationState: z.any(),
  userFinancialContext: z.any(),
});

export function createFluxAgentRouter() {
  const router = Router();

  router.post("/flux-agent", async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? "Payload inválido",
      });
    }

    try {
      const output = await runFluxAiProvider(parsed.data);
      return res.json({
        success: true,
        message: output.message,
        responseText: output.responseText,
        riskLevel: output.riskLevel,
        suggestedActions: output.suggestedActions,
        updatedConversationState: output.updatedConversationState,
        pendingAction: output.pendingAction,
        source: output.source,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Falha ao processar Flux Agent",
      });
    }
  });

  return router;
}
