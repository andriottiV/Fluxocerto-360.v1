import { expect, test, type Page } from "@playwright/test";

function buildStoredUser(params: { id: string; name: string; email: string; role: "admin" | "user"; completed?: boolean }) {
  const now = new Date(Date.now() - 60_000).toISOString();
  return {
    id: params.id,
    name: params.name,
    email: params.email,
    role: params.role,
    status: "active",
    createdAt: now,
    lastLoginAt: now,
    passwordHash: "qa",
    passwordSalt: "qa",
    passwordVersion: "mvp-local-v1",
    phone: "",
    businessName: `${params.name} Negocio`,
    businessType: "Servicos",
    onboardingCompleted: params.completed ?? false,
  };
}

async function seedUsers(page: Page, sessionUserId: string) {
  await page.addInitScript((activeUserId) => {
    const admin = {
      id: "admin-registry",
      name: "Admin Registry",
      email: "andriottidev@gmail.com",
      role: "admin",
      status: "active",
      createdAt: "2026-05-04T12:00:00.000Z",
      lastLoginAt: "2026-05-04T12:00:00.000Z",
      passwordHash: "qa",
      passwordSalt: "qa",
      passwordVersion: "mvp-local-v1",
      onboardingCompleted: true,
    };
    const user = {
      id: "user-registry",
      name: "Usuario Registry",
      email: "usuario-registry@fluxocerto.test",
      role: "user",
      status: "active",
      createdAt: "2026-05-04T12:01:00.000Z",
      lastLoginAt: "2026-05-04T12:01:00.000Z",
      passwordHash: "qa",
      passwordSalt: "qa",
      passwordVersion: "mvp-local-v1",
      onboardingCompleted: true,
    };

    window.localStorage.clear();
    window.localStorage.setItem("fc360:auth:users:v2", JSON.stringify([admin, user]));
    window.localStorage.setItem("fc360:auth:session:v1", JSON.stringify({ userId: activeUserId }));
    window.localStorage.setItem("fc360:onboarding:admin-registry", "true");
    window.localStorage.setItem("fc360:onboarding:user-registry", "true");
  }, sessionUserId);
}

test("admin ve usuario registrado e lastSeenAt atualiza ao abrir o app", async ({ page }) => {
  await seedUsers(page, "user-registry");
  await page.goto("/dashboard");

  const firstSeen = await page.evaluate(() => {
    const registry = JSON.parse(window.localStorage.getItem("users_global_registry") || "[]");
    return registry.find((item: { id: string; lastSeenAt?: string }) => item.id === "user-registry")?.lastSeenAt;
  });
  expect(firstSeen).toBeTruthy();

  await page.reload();
  await expect
    .poll(async () =>
      page.evaluate((previous) => {
        const registry = JSON.parse(window.localStorage.getItem("users_global_registry") || "[]");
        const user = registry.find((item: { id: string }) => item.id === "user-registry");
        return Boolean(user?.lastSeenAt && user.lastSeenAt !== previous);
      }, firstSeen)
    )
    .toBe(true);

  await seedUsers(page, "admin-registry");
  await page.goto("/administracao");
  await expect(page.getByText("Usuario Registry")).toBeVisible();
  await expect(page.getByText("usuario-registry@fluxocerto.test")).toBeVisible();
  await expect(page.getByText(/Completo|Pendente/).first()).toBeVisible();
});

test("usuario comum nao acessa administracao", async ({ page }) => {
  await seedUsers(page, "user-registry");
  await page.goto("/administracao");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Administração")).toBeHidden();
});
