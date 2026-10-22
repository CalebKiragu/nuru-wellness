import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://localhost:3100";
const AMANI = "http://amani.localhost:3100";

test.describe.configure({ mode: "serial" });

async function signInAsOwner(page: Page, label: RegExp) {
  await page.goto(`${AMANI}/login`);
  await page.getByRole("button", { name: label }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

test("a public booking appears immediately in the dashboard", async ({ page }) => {
  await page.goto(`${AMANI}/book/deep-tissue-reset`);
  await expect(page.getByRole("heading", { name: "Choose your time." })).toBeVisible();
  await expect(page.getByText("Checking the diary…")).toBeHidden({ timeout: 25_000 });

  const times = page.locator("fieldset").filter({ hasText: "Available times" }).getByRole("button");
  const dates = page.getByRole("group", { name: "Choose a date" }).getByRole("button");
  let found = (await times.count()) > 0;

  for (let index = 0; index < (await dates.count()) && !found; index += 1) {
    if (!(await dates.nth(index).isEnabled())) continue;
    await dates.nth(index).click();
    await page.waitForTimeout(700);
    found = (await times.count()) > 0;
  }
  expect(found).toBe(true);

  await times.first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Full name").fill("E2E Booking Client");
  await page.getByLabel("Email").fill(`e2e-booking-${Date.now()}@example.com`);
  await page.getByLabel("Phone").fill("+254700123456");
  await page.getByLabel(/I have read and accept/).check();
  await page.getByRole("button", { name: /Review booking/ }).click();
  await expect(page.getByRole("heading", { name: "One last look." })).toBeVisible();
  await page.getByRole("button", { name: /Confirm appointment/ }).click();

  await expect(page).toHaveURL(/\/booking\/AMA-/, { timeout: 20_000 });
  const reference = (await page.getByText(/^[A-Z]{3}-[A-Z2-9]{6}$/).first().innerText()).trim();
  await expect(page.getByText("Booking confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("Simulated · not sent")).toBeVisible();

  await signInAsOwner(page, /Amani Bodywork · Owner/);
  await page.goto(`${AMANI}/dashboard/bookings?q=${encodeURIComponent(reference)}`);
  await expect(page.getByText("E2E Booking Client").first()).toBeVisible();
  await expect(page.getByText(reference).first()).toBeVisible();
});

test("a seeded AI approval is reviewed and executed as simulated", async ({ page }) => {
  await signInAsOwner(page, /Amani Bodywork · Owner/);
  await page.goto(`${AMANI}/dashboard/assistant`);
  await expect(page.getByRole("heading", { name: "Nuru assistant" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Awaiting your approval" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Approve & process send/ }).first().click();
  await expect(page.getByText(/simulated/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Awaiting your approval" })).toBeHidden();

  await page.goto(`${AMANI}/dashboard/marketing`);
  await expect(page.getByText("Make room this week").first()).toBeVisible();
  await expect(page.getByText(/simulated/i).first()).toBeVisible();
});

test("storefront edits publish and roll back without losing history", async ({ page }) => {
  await signInAsOwner(page, /Amani Bodywork · Owner/);
  await page.goto(`${AMANI}/dashboard/storefront`);
  await expect(page.getByRole("heading", { name: "Storefront" })).toBeVisible();

  await page.getByRole("button", { name: "Content" }).click();
  const headline = page.getByLabel("Headline");
  await expect(headline).toBeVisible();
  await headline.fill(`An E2E headline ${Date.now()}`);

  await page.getByRole("button", { name: "Preview & publish" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Publish live/ }).click();
  await expect(page.getByText(/Published as version/)).toBeVisible({ timeout: 20_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore" }).last().click();
  await expect(page.getByText(/Restored version 1 as a new publication/)).toBeVisible({ timeout: 20_000 });

  await page.goto(`${AMANI}/`);
  await expect(page.getByRole("heading", { name: "A quieter way to come back to yourself." })).toBeVisible();
});

test("demo tenants switch as separate branded storefronts", async ({ browser }) => {
  const amaniContext = await browser.newContext();
  const amaniPage = await amaniContext.newPage();
  await amaniPage.goto(ORIGIN);
  const amaniCard = amaniPage.locator("article").filter({ hasText: "Amani Bodywork" }).first();
  await amaniCard.getByRole("button", { name: /View storefront/ }).click();
  await expect(amaniPage.getByRole("heading", { name: "A quieter way to come back to yourself." })).toBeVisible();
  await expect(amaniPage.getByText("Amani Bodywork").first()).toBeVisible();
  await amaniContext.close();

  const bahariContext = await browser.newContext();
  const bahariPage = await bahariContext.newPage();
  await bahariPage.goto(ORIGIN);
  const bahariCard = bahariPage.locator("article").filter({ hasText: "Bahari House" }).first();
  await bahariCard.getByRole("button", { name: /View storefront/ }).click();
  await expect(bahariPage.getByRole("heading", { name: "Where the coast slows you down." })).toBeVisible();
  await expect(bahariPage.getByText("A quieter way to come back to yourself.")).toHaveCount(0);
  await bahariContext.close();
});

test("every dashboard page and the platform admin render for an owner", async ({ page, browser }) => {
  await signInAsOwner(page, /Amani Bodywork · Owner/);

  const routes = [
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/bookings",
    "/dashboard/customers",
    "/dashboard/services",
    "/dashboard/services/new",
    "/dashboard/staff",
    "/dashboard/storefront",
    "/dashboard/assistant",
    "/dashboard/marketing",
    "/dashboard/settings",
  ];

  for (const route of routes) {
    const response = await page.goto(`${AMANI}${route}`);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1").first(), route).toBeVisible();
    await expect(page.locator("body"), route).not.toContainText("Application error");
  }

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${ORIGIN}/login`);
  await adminPage.getByRole("button", { name: /Nuru platform admin/ }).click();
  await expect(adminPage).toHaveURL(/\/admin/, { timeout: 20_000 });
  await expect(adminPage.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  await expect(adminPage.getByText("Amani Bodywork").first()).toBeVisible();
  await expect(adminPage.getByText("Bahari House").first()).toBeVisible();
  await adminContext.close();
});
