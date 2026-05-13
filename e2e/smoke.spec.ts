import { expect, test } from "@playwright/test";

test("home page renders for guests", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Prode Mundial 2026/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ingresar/i })).toBeVisible();
});

test("login page renders Google CTA", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
});

test("predict routes redirect guests to login", async ({ page }) => {
  const response = await page.goto("/predict/groups");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login/);
});

// Skipped placeholder: the full autosave flow requires Google OAuth and seeded
// data. Re-enable once a test session can be minted (Phase 2).
test.skip("autosave persists a prediction across reload", () => {});
