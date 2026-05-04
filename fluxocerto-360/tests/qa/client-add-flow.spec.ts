import { expect, test, type Page } from "@playwright/test";

const USER_ID = "qa-client-user";

async function seedLoggedUser(page: Page) {
  await page.addInitScript((userId) => {
    const now = new Date().toISOString();
    const user = {
      id: userId,
      name: "QA Cliente",
      email: "qa-cliente@fluxocerto.test",
      role: "tester",
      status: "active",
      createdAt: now,
      lastLoginAt: now,
      businessName: "QA Negocio",
      businessType: "Servicos",
      passwordHash: "qa",
      passwordSalt: "qa",
      passwordVersion: "mvp-local-v1",
    };

    window.localStorage.clear();
    window.localStorage.setItem("fc360:auth:users:v2", JSON.stringify([user]));
    window.localStorage.setItem("fc360:auth:session:v1", JSON.stringify({ userId }));
    window.localStorage.setItem(`fc360:onboarding:${userId}`, "true");
    window.localStorage.setItem(`fc360:data:${userId}`, JSON.stringify({ clients: [] }));
  }, USER_ID);
}

test("botao + Cliente abre modal, cancela e salva cliente", async ({ page }) => {
  await seedLoggedUser(page);
  await page.goto("/clientes");

  await expect(page.getByRole("heading", { name: "Clientes & Vendas" })).toBeVisible();
  await page.getByRole("button", { name: /\+ Cliente/ }).click();
  await expect(page.getByRole("dialog", { name: "Salvar cliente" })).toBeVisible();

  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("dialog", { name: "Salvar cliente" })).toBeHidden();

  await page.getByRole("button", { name: /\+ Cliente/ }).click();
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByText("Informe o nome do cliente para salvar.")).toBeVisible();

  await page.getByLabel("Nome do cliente").fill("Cliente QA");
  await page.getByLabel("Telefone").fill("(11) 99999-0000");
  await page.getByLabel("Status / funil").selectOption("novo");
  await page.getByLabel("Observação").fill("Veio por indicação");
  await page.getByRole("button", { name: "Salvar cliente" }).click();

  await expect(page.getByText("Cliente QA").first()).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Salvar cliente" })).toBeHidden();

  await expect
    .poll(async () =>
      page.evaluate((userId) => {
        const data = JSON.parse(window.localStorage.getItem(`fc360:data:${userId}`) || "{}");
        return data.clients?.[0]?.name;
      }, USER_ID)
    )
    .toBe("Cliente QA");
});

test("modal de cliente fica responsivo no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLoggedUser(page);
  await page.goto("/clientes");

  await page.getByRole("button", { name: /\+ Cliente/ }).click();
  await expect(page.getByRole("dialog", { name: "Salvar cliente" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
