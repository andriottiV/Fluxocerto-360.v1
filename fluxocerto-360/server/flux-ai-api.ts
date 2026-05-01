import { Router } from "express";
import { z } from "zod";

type FluxAiSeverity = "safe" | "attention" | "risk";

type FluxAiAnswer = {
  answer: string;
  severity: FluxAiSeverity;
  suggestedAction: string;
};

const MAX_CONTEXT_CHARS = 6000;
const MAX_MESSAGE_CHARS = 1000;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.2";

const requestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_CHARS),
  context: z.record(z.string(), z.unknown()).default({}),
});

const aiAnswerSchema = z.object({
  answer: z.string().min(1).max(700),
  severity: z.enum(["safe", "attention", "risk"]),
  suggestedAction: z.string().min(1).max(240),
});

const privateKeys = new Set([
  "id",
  "ownerId",
  "userId",
  "email",
  "phone",
  "telefone",
  "name",
  "nome",
  "fullName",
  "displayName",
  "clientName",
  "customerName",
  "businessName",
  "avatar",
  "cpf",
  "cnpj",
]);

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 240);
  }
  return "";
}

function buildFallback(context: Record<string, unknown>): FluxAiAnswer {
  return {
    answer: "Flux está no modo local agora. Ainda consigo te orientar com seus dados.",
    severity: "attention",
    suggestedAction:
      firstString(context.action, context.acaoSugerida, context.suggestedAction) ||
      "Registre seus dados reais para melhorar a análise.",
  };
}

function sanitizeContext(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 300);

  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => sanitizeContext(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !privateKeys.has(key))
        .map(([key, item]) => [key, sanitizeContext(item, depth + 1)])
        .filter(([, item]) => item !== undefined)
    );
  }

  return undefined;
}

function stringifyLimitedContext(context: Record<string, unknown>) {
  const sanitized = sanitizeContext(context) ?? {};
  const text = JSON.stringify(sanitized);
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  return text.slice(0, MAX_CONTEXT_CHARS);
}

function buildPrompt(contextJson: string, message: string) {
  return [
    "CONTEXTO:",
    contextJson,
    "",
    "PERGUNTA:",
    message,
    "",
    'Responda apenas com JSON no formato {"answer":"resposta curta","severity":"safe | attention | risk","suggestedAction":"ação prática"}.',
  ].join("\n");
}

function extractOutputText(payload: unknown) {
  const data = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof data.output_text === "string") return data.output_text;

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

async function callOpenAi(params: { apiKey: string; message: string; contextJson: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content:
              "Você é o Flux, consultor financeiro sênior do app FluxoCerto 360.\n\n" +
              "Você responde perguntas sobre dinheiro pessoal, dinheiro do negócio, contas futuras, metas, reservas, lucro, custos, precificação, fluxo de caixa e planejamento financeiro.\n\n" +
              "REGRAS:\n" +
              "- Responda em português do Brasil.\n" +
              "- Seja humano, direto e prático.\n" +
              "- Máximo 5 linhas.\n" +
              "- Use apenas os dados fornecidos no contexto e os números informados pelo usuário.\n" +
              "- Nunca invente números.\n" +
              "- Se faltar dado, peça só o dado que falta.\n" +
              "- Não seja genérico.\n" +
              "- Não diga 'você está no caminho certo' se a pergunta pediu cálculo específico.\n" +
              "- Nunca trate meta mensal como dinheiro disponível.\n" +
              "- Nunca diga que o usuário tem dinheiro se entradas reais forem 0.\n" +
              "- Sempre termine com uma ação clara.\n" +
              "- Não use linguagem técnica.\n" +
              "- Não dê aula longa.\n" +
              "- Não fale como robô.\n\n" +
              "ESTILO:\n" +
              "Fale como um sócio experiente: direto, cuidadoso, firme e sem enrolar.",
          },
          {
            role: "user",
            content: buildPrompt(params.contextJson, params.message),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "flux_ai_response",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                answer: { type: "string" },
                severity: { type: "string", enum: ["safe", "attention", "risk"] },
                suggestedAction: { type: "string" },
              },
              required: ["answer", "severity", "suggestedAction"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    const parsedJson = JSON.parse(outputText);
    return aiAnswerSchema.parse(parsedJson);
  } finally {
    clearTimeout(timeout);
  }
}

export function createFluxAiRouter() {
  const router = Router();

  router.post("/flux-ai", async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        answer: "Não consegui ler sua pergunta agora.",
        severity: "attention",
        suggestedAction: "Tente enviar a pergunta novamente.",
      } satisfies FluxAiAnswer);
    }

    const { message, context } = parsed.data;
    const fallback = buildFallback(context);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.json(fallback);
    }

    try {
      const contextJson = stringifyLimitedContext(context);
      const output = await callOpenAi({ apiKey, message, contextJson });
      return res.json(output);
    } catch {
      return res.json(fallback);
    }
  });

  return router;
}
