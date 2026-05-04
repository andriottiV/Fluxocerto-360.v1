import { expect, test, type Page } from "@playwright/test";

type StoredPot = {
  id: string;
  type: "pessoal" | "negocio" | "reserva";
  balance: number;
  percentage?: number;
};

type StoredTransaction = {
  type: "entrada" | "saida";
  grossAmount?: number;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  paymentMethod?: string;
  potId?: string;
  description?: string;
};

type StoredData = {
  userId: string;
  onboardingCompleted: string | null;
  onboardingData: Record<string, any>;
  appData: {
    pots?: StoredPot[];
    transactions?: StoredTransaction[];
  };
};

function approx(actual: number, expected: number, tolerance = 0.05) {
  return Math.abs(actual - expected) <= tolerance;
}

async function clearBrowserState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function readStoredData(page: Page): Promise<StoredData> {
  return page.evaluate(() => {
    const session = JSON.parse(window.localStorage.getItem("fc360:auth:session:v1") || "{}");
    const userId = session.userId || "";
    return {
      userId,
      onboardingCompleted: window.localStorage.getItem(`fc360:onboarding:${userId}`),
      onboardingData: JSON.parse(window.localStorage.getItem(`fc360:onboarding:data:${userId}`) || "{}"),
      appData: JSON.parse(window.localStorage.getItem(`fc360:data:${userId}`) || "{}"),
    };
  });
}

async function registerNewUser(page: Page) {
  const email = `qa-new-onboarding-${Date.now()}@fluxocerto.test`;
  await clearBrowserState(page);
  await page.getByRole("button", { name: /começar agora/i }).first().click();
  await page.getByRole("button", { name: /^criar conta$/i }).last().click();
  await page.getByPlaceholder("Seu nome").fill("QA Novo Onboarding");
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.locator('input[type="password"]').fill("QaFluxo360!");
  await page.getByRole("button", { name: /^criar conta$/i }).click();
  await expect(page.getByRole("heading", { name: /relação com o dinheiro/i })).toBeVisible({ timeout: 15_000 });
}

async function completeNewOnboarding(page: Page) {
  await page.getByRole("button", { name: /O dinheiro entra, mas some/i }).click();
  await page.getByRole("button", { name: /Continuar/i }).click();

  await expect(page.getByRole("heading", { name: /olhando sua vida no geral/i })).toBeVisible();
  await page.getByRole("button", { name: /Meu dinheiro vive apertado/i }).click();
  await page.getByRole("button", { name: /Continuar/i }).click();

  await expect(page.getByRole("heading", { name: /viver sem aperto/i })).toBeVisible();
  await page.getByPlaceholder("R$ 0,00").fill("1000000");
  await expect(page.getByText(/R\$\s*33\.333,33|R\$\s*33\.333,34/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Quase$/i }).click();
  await page.getByRole("button", { name: /Continuar/i }).click();

  await expect(page.getByRole("heading", { name: /dinheiro agora tem direção/i })).toBeVisible();
  await expect(page.getByText(/Antes de dividir o dinheiro/i)).toBeVisible();
  await page.getByRole("button", { name: /Começar a organizar meu dinheiro/i }).click();
  await expect(page.getByText(/Aqui est/i).first()).toBeVisible({ timeout: 15_000 });
}

async function seedOldUserWithoutNewFields(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    const now = new Date().toISOString();
    const userId = "old-user-no-new-fields";
    const user = {
      id: userId,
      name: "Usuário Antigo",
      email: "old-user@fluxocerto.test",
      passwordHash: "unused",
      passwordSalt: "unused",
      passwordVersion: "mvp-local-v1",
      role: "tester",
      status: "active",
      createdAt: now,
      lastLoginAt: now,
      phone: "",
      businessName: "Negócio Antigo",
      businessType: "Servicos",
    };
    window.localStorage.setItem("fc360:auth:users:v2", JSON.stringify([user]));
    window.localStorage.setItem("fc360:auth:session:v1", JSON.stringify({ userId }));
    window.localStorage.setItem(`fc360:onboarding:${userId}`, "false");
    window.localStorage.setItem(
      `fc360:onboarding:data:${userId}`,
      JSON.stringify({
        step: 2,
        flag_separacao: true,
        focus: null,
        porcentagens: { negocio: 50, pessoal: 30, reserva: 20 },
        metaMensal: 10000,
      })
    );
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: /olhando sua vida no geral/i })).toBeVisible({ timeout: 15_000 });
}

async function waitForStoredTransactions(page: Page, count: number) {
  await page.waitForFunction(
    (expectedCount) => {
      const session = JSON.parse(window.localStorage.getItem("fc360:auth:session:v1") || "{}");
      const data = JSON.parse(window.localStorage.getItem(`fc360:data:${session.userId}`) || "{}");
      return Array.isArray(data.transactions) && data.transactions.length >= expectedCount;
    },
    count,
    { timeout: 10_000 }
  );
}

async function openFastAction(page: Page, label: RegExp) {
  await page.locator(".fd-fab").click();
  await page.getByRole("button", { name: label }).click();
  await expect(page.locator(".fd-modal-card")).toBeVisible();
}

async function addIncomeViaUi(page: Page) {
  await openFastAction(page, /Adicionar entrada/i);
  const modal = page.locator(".fd-modal-card");
  await modal.locator('.fd-income-flow .fd-flow-panel-muted input[type="number"]').fill("100");
  await modal.locator("label").filter({ hasText: "Forma de pagamento" }).locator("select").selectOption("credito");
  await modal.locator("label").filter({ hasText: /Descrição|Descricao/ }).locator("input").fill("Entrada real futura QA");
  await modal.locator("label").filter({ hasText: "Categoria" }).locator("input").fill("servico");
  await modal.getByRole("button", { name: /Confirmar extra manual/i }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  await waitForStoredTransactions(page, 1);
}

async function addExpenseViaUi(page: Page) {
  await openFastAction(page, /Adicionar saida|Adicionar saída/i);
  const modal = page.locator(".fd-modal-card");
  await modal.locator('.fd-expense-flow input[type="number"]').fill("10");
  await modal.locator("label").filter({ hasText: /Descrição|Descricao/ }).locator("input").fill("Saída real QA");
  await modal.locator("label").filter({ hasText: "Pote de origem" }).locator("select").selectOption({ index: 0 });
  await modal.getByRole("button", { name: /Confirmar saida|Confirmar saída/i }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });
  await waitForStoredTransactions(page, 2);
}

test("novo onboarding personaliza dashboard e consultor sem misturar meta com saldo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerNewUser(page);
  await completeNewOnboarding(page);

  const stored = await readStoredData(page);
  const onboarding = stored.onboardingData;
  const pots = stored.appData.pots ?? [];
  const transactions = stored.appData.transactions ?? [];

  expect(onboarding.financialPain).toBe("money_disappears");
  expect(onboarding.financialStructure).toBe("apertado");
  expect(onboarding.goalConfidence).toBe("almost");
  expect(onboarding.metaMensal).toBeCloseTo(10000, 1);
  expect(onboarding.personalMonthlyGoal).toBeCloseTo(10000, 1);
  expect(onboarding.estimatedGrossMonthlyRevenue).toBeCloseTo(33333.33, 1);
  expect(onboarding.weeklyRevenueTarget).toBeCloseTo(7698.23, 1);
  expect(onboarding.dailyRevenueTarget).toBeCloseTo(1515.15, 1);
  expect(stored.onboardingCompleted).toBe("true");

  expect(onboarding.porcentagens).toEqual({ negocio: 55, pessoal: 30, reserva: 15 });
  expect(onboarding.porcentagens.negocio + onboarding.porcentagens.pessoal + onboarding.porcentagens.reserva).toBe(100);
  expect(transactions).toHaveLength(0);
  expect(pots.every((pot) => approx(Number(pot.balance || 0), 0, 0.001))).toBe(true);

  await expect(page.getByText("Sua meta diária inteligente")).toBeVisible();
  await expect(page.getByText("Meta mensal de faturamento bruto")).toBeVisible();
  await expect(page.getByText(/Essa é a média diária estimada/i)).toBeVisible();

  await page.goto("/consultor");
  await expect(page.getByText("Seu primeiro passo é entender para onde o dinheiro está indo.")).toBeVisible();
  await expect(page.getByText(/R\$\s*1\.515,15 de faturamento bruto/i)).toBeVisible();

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/dashboard");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);
});

test("usuário antigo recebe fallback e entrada real futura respeita taxa, divisão líquida e saída por pote", async ({ page }) => {
  await seedOldUserWithoutNewFields(page);

  await page.getByRole("button", { name: /Continuar/i }).click();
  await expect(page.getByRole("heading", { name: /viver sem aperto/i })).toBeVisible();
  await expect(page.getByText(/R\$\s*33\.333,33|R\$\s*33\.333,34/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Sim$/i }).click();
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /Começar a organizar meu dinheiro/i }).click();
  await expect(page.getByText(/Aqui est/i).first()).toBeVisible({ timeout: 15_000 });

  let stored = await readStoredData(page);
  expect(stored.onboardingCompleted).toBe("true");
  expect(stored.onboardingData.financialPain).toBeUndefined();
  expect(stored.onboardingData.financialStructure).toBe("apertado");
  expect(stored.onboardingData.porcentagens).toEqual({ negocio: 55, pessoal: 30, reserva: 15 });
  expect((stored.appData.transactions ?? [])).toHaveLength(0);
  expect((stored.appData.pots ?? []).every((pot) => approx(Number(pot.balance || 0), 0, 0.001))).toBe(true);

  await addIncomeViaUi(page);
  stored = await readStoredData(page);
  const income = (stored.appData.transactions ?? []).find((tx) => tx.type === "entrada");
  const potsAfterIncome = stored.appData.pots ?? [];
  const totalAfterIncome = potsAfterIncome.reduce((sum, pot) => sum + Number(pot.balance || 0), 0);

  expect(income?.grossAmount).toBeCloseTo(100, 2);
  expect(income?.feeAmount).toBeCloseTo(3.49, 2);
  expect(income?.netAmount).toBeCloseTo(96.51, 2);
  expect(totalAfterIncome).toBeCloseTo(96.51, 1);
  expect(potsAfterIncome.find((pot) => pot.type === "negocio")?.balance).toBeCloseTo(53.08, 1);
  expect(potsAfterIncome.find((pot) => pot.type === "pessoal")?.balance).toBeCloseTo(28.95, 1);
  expect(potsAfterIncome.find((pot) => pot.type === "reserva")?.balance).toBeCloseTo(14.48, 1);

  const beforeExpense = new Map(potsAfterIncome.map((pot) => [pot.id, pot.balance]));
  await addExpenseViaUi(page);
  stored = await readStoredData(page);
  const potsAfterExpense = stored.appData.pots ?? [];
  const changed = potsAfterExpense.filter((pot) => !approx(Number(pot.balance), Number(beforeExpense.get(pot.id)), 0.001));
  expect(changed).toHaveLength(1);
  expect(changed[0].type).toBe("pessoal");
  expect(Number(beforeExpense.get(changed[0].id)) - changed[0].balance).toBeCloseTo(10, 1);
});
