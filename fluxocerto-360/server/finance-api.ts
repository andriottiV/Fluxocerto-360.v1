import { Router, type Request, type Response } from "express";
import { z } from "zod";

type AccountTypeLink = "pf" | "pj";
type PotScope = "pessoal" | "negocio" | "reserva";
type TransactionKind = "entrada" | "saida";
type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito" | "transferencia";

type Pot = {
  id: string;
  name: string;
  scope: PotScope;
  balance: number;
  goal: number;
  createdAt: string;
  updatedAt: string;
};

type Transaction = {
  id: string;
  type: TransactionKind;
  description: string;
  amount: number;
  category: string;
  potId: string;
  accountTypeLink: AccountTypeLink;
  paymentMethod: PaymentMethod;
  createdAt: string;
};

type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  accountTypeLink: AccountTypeLink;
  dueDay: number;
  installments: number;
  isRecurring: boolean;
  category: string;
  createdAt: string;
  updatedAt: string;
};

const accountTypeSchema = z.enum(["pf", "pj"]);
const paymentMethodSchema = z.enum(["dinheiro", "pix", "debito", "credito", "transferencia"]);
const potScopeSchema = z.enum(["pessoal", "negocio", "reserva"]);

const transactionSchema = z.object({
  description: z.string().min(3),
  amount: z.coerce.number().positive(),
  category: z.string().min(2),
  potId: z.string().min(1),
  accountTypeLink: accountTypeSchema,
  paymentMethod: paymentMethodSchema.default("pix"),
});

const createPotSchema = z.object({
  name: z.string().min(2),
  scope: potScopeSchema,
  balance: z.coerce.number().min(0).default(0),
  goal: z.coerce.number().positive(),
});

const updatePotGoalSchema = z.object({
  goal: z.coerce.number().positive(),
});

const createFixedExpenseSchema = z.object({
  name: z.string().min(2),
  amount: z.coerce.number().positive(),
  accountTypeLink: accountTypeSchema,
  dueDay: z.coerce.number().int().min(1).max(31),
  installments: z.coerce.number().int().min(1).default(1),
  isRecurring: z.coerce.boolean().default(true),
  category: z.string().min(2),
});

const updateFixedExpenseSchema = createFixedExpenseSchema.partial();

type InMemoryDb = {
  pots: Pot[];
  transactions: Transaction[];
  fixedExpenses: FixedExpense[];
};

const now = () => new Date().toISOString();

const db: InMemoryDb = {
  pots: [
    { id: "pot-001", name: "Pessoal", scope: "pessoal", balance: 2500, goal: 5000, createdAt: now(), updatedAt: now() },
    { id: "pot-002", name: "Negocio", scope: "negocio", balance: 4500, goal: 10000, createdAt: now(), updatedAt: now() },
    { id: "pot-003", name: "Reserva", scope: "reserva", balance: 3200, goal: 8000, createdAt: now(), updatedAt: now() },
  ],
  transactions: [],
  fixedExpenses: [],
};

function jsonError(res: Response, status: number, message: string) {
  return res.status(status).json({ success: false, message });
}

function expectedPotScope(accountTypeLink: AccountTypeLink): PotScope {
  return accountTypeLink === "pf" ? "pessoal" : "negocio";
}

function sameDay(dateIso: string, target: Date): boolean {
  const a = new Date(dateIso);
  return (
    a.getFullYear() === target.getFullYear() &&
    a.getMonth() === target.getMonth() &&
    a.getDate() === target.getDate()
  );
}

function validatePotByRule(pot: Pot, accountTypeLink: AccountTypeLink): string | null {
  const expected = expectedPotScope(accountTypeLink);
  if (pot.scope !== expected) {
    return `Regra de negocio: ${accountTypeLink.toUpperCase()} so pode movimentar pote '${expected}'.`;
  }
  return null;
}

function postTransaction(type: TransactionKind, req: Request, res: Response) {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Payload invalido.");
  }

  const payload = parsed.data;
  const pot = db.pots.find((entry) => entry.id === payload.potId);
  if (!pot) {
    return jsonError(res, 404, "pot_id nao encontrado.");
  }

  const businessRuleError = validatePotByRule(pot, payload.accountTypeLink);
  if (businessRuleError) {
    return jsonError(res, 422, businessRuleError);
  }

  if (type === "saida" && pot.balance < payload.amount) {
    return jsonError(res, 422, "Saldo insuficiente no pote selecionado.");
  }

  const movement = type === "entrada" ? payload.amount : -payload.amount;
  pot.balance += movement;
  pot.updatedAt = now();

  const transaction: Transaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    description: payload.description,
    amount: payload.amount,
    category: payload.category,
    potId: payload.potId,
    accountTypeLink: payload.accountTypeLink,
    paymentMethod: payload.paymentMethod,
    createdAt: now(),
  };

  db.transactions.push(transaction);

  return res.status(201).json({
    success: true,
    data: transaction,
    potBalance: pot.balance,
  });
}

export function createFinanceRouter() {
  const router = Router();

  router.get("/schema/proposal", (_req, res) => {
    return res.json({
      success: true,
      data: {
        analysis: [
          "Schema original era apenas de UI/estado local, sem entidades persistentes no backend.",
          "Refatoracao introduz separacao clara entre potes, transacoes e gastos fixos.",
          "Regras de integridade aplicadas no endpoint: PF->pessoal e PJ->negocio.",
          "Validacao de pot_id e account_type_link em todas as entradas/saidas.",
        ],
        tables: {
          pots: ["id", "name", "scope", "balance", "goal", "created_at", "updated_at"],
          transactions: ["id", "type", "description", "amount", "category", "pot_id", "account_type_link", "payment_method", "created_at"],
          fixed_expenses: [
            "id",
            "name",
            "amount",
            "account_type_link",
            "due_day",
            "installments",
            "is_recurring",
            "category",
            "created_at",
            "updated_at",
          ],
        },
      },
    });
  });

  router.get("/transactions", (_req, res) => {
    return res.json({ success: true, data: db.transactions });
  });

  router.post("/transactions/income", (req, res) => postTransaction("entrada", req, res));
  router.post("/transactions/expense", (req, res) => postTransaction("saida", req, res));

  router.get("/pots", (_req, res) => {
    return res.json({ success: true, data: db.pots });
  });

  router.post("/pots", (req, res) => {
    const parsed = createPotSchema.safeParse(req.body);
    if (!parsed.success) {
      return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Payload invalido.");
    }

    const created: Pot = {
      id: `pot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...parsed.data,
      createdAt: now(),
      updatedAt: now(),
    };

    db.pots.push(created);
    return res.status(201).json({ success: true, data: created });
  });

  router.patch("/pots/:id/goal", (req, res) => {
    const parsed = updatePotGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Payload invalido.");
    }

    const pot = db.pots.find((entry) => entry.id === req.params.id);
    if (!pot) {
      return jsonError(res, 404, "Pote nao encontrado.");
    }

    pot.goal = parsed.data.goal;
    pot.updatedAt = now();
    return res.json({ success: true, data: pot });
  });

  router.get("/pots/:id/balance", (req, res) => {
    const pot = db.pots.find((entry) => entry.id === req.params.id);
    if (!pot) {
      return jsonError(res, 404, "Pote nao encontrado.");
    }
    return res.json({ success: true, data: { potId: pot.id, balance: pot.balance } });
  });

  router.get("/fixed-expenses", (_req, res) => {
    return res.json({ success: true, data: db.fixedExpenses });
  });

  router.post("/fixed-expenses", (req, res) => {
    const parsed = createFixedExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Payload invalido.");
    }

    const created: FixedExpense = {
      id: `fix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...parsed.data,
      createdAt: now(),
      updatedAt: now(),
    };

    db.fixedExpenses.push(created);
    return res.status(201).json({ success: true, data: created });
  });

  router.put("/fixed-expenses/:id", (req, res) => {
    const parsed = updateFixedExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Payload invalido.");
    }

    const item = db.fixedExpenses.find((entry) => entry.id === req.params.id);
    if (!item) {
      return jsonError(res, 404, "Conta/gasto fixo nao encontrado.");
    }

    Object.assign(item, parsed.data, { updatedAt: now() });
    return res.json({ success: true, data: item });
  });

  router.delete("/fixed-expenses/:id", (req, res) => {
    const index = db.fixedExpenses.findIndex((entry) => entry.id === req.params.id);
    if (index < 0) {
      return jsonError(res, 404, "Conta/gasto fixo nao encontrado.");
    }
    const [removed] = db.fixedExpenses.splice(index, 1);
    return res.json({ success: true, data: removed });
  });

  router.get("/dashboard/summary", (_req, res) => {
    const today = new Date();
    const todayTransactions = db.transactions.filter((entry) => sameDay(entry.createdAt, today));
    const dayIncome = todayTransactions.filter((entry) => entry.type === "entrada").reduce((sum, entry) => sum + entry.amount, 0);
    const dayExpense = todayTransactions.filter((entry) => entry.type === "saida").reduce((sum, entry) => sum + entry.amount, 0);

    const pfPot = db.pots.find((entry) => entry.scope === "pessoal");
    const totalBalance = db.pots.reduce((sum, entry) => sum + entry.balance, 0);

    return res.json({
      success: true,
      data: {
        saldoPf: pfPot?.balance ?? 0,
        entradasDoDia: dayIncome,
        saidasDoDia: dayExpense,
        saldoTotal: totalBalance,
        potes: db.pots.map((entry) => ({
          id: entry.id,
          nome: entry.name,
          escopo: entry.scope,
          saldo: entry.balance,
          meta: entry.goal,
          percentualUso: entry.goal > 0 ? Math.min(100, Math.round((entry.balance / entry.goal) * 100)) : 0,
        })),
      },
    });
  });

  return router;
}
