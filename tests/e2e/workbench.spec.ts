import { expect, test } from "@playwright/test";

test("catalogue is complete, responsive, and visually stable", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rosalind scientific workbench" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(23);
  const dimensions = await page.locator(".preview-shell").evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect(page).toHaveScreenshot(`catalogue-${testInfo.project.name}.png`, { fullPage: true, animations: "disabled" });
});

test("search, detail evidence, use mode, and composer import work", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Search a scientific question or method").fill("nanobody");
  await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(1);
  await page.getByRole("button", { name: "Open PD-L1 nanobody design showcase" }).click();
  const dialog = page.getByRole("dialog", { name: "PD-L1 nanobody design showcase" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Evidence" }).click();
  await expect(dialog.getByText("Indexed artifacts")).toBeVisible();
  if (test.info().project.name === "chromium-1440") {
    await expect(page).toHaveScreenshot("detail-pdl1-light.png", { animations: "disabled" });
  }
  await dialog.getByRole("button", { name: /Reproduce/ }).click();
  const primaryColor = await dialog.getByRole("button", { name: /Add to conversation/ }).evaluate((element) => getComputedStyle(element).color);
  expect(primaryColor).toBe("rgb(255, 255, 255)");
  await dialog.getByRole("button", { name: /Add to conversation/ }).click();
  await expect(page.getByLabel("Prepared DSH prompt")).toContainText("rosalind-molecular-design");
  await expect(page.getByLabel("Prepared DSH prompt")).toContainText("reproduce");
});

test("keyboard navigation, Escape, dark theme, and 200 percent zoom remain usable", async ({ page }) => {
  await page.goto("/?theme=dark");
  await page.getByPlaceholder("Search a scientific question or method").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  if (test.info().project.name === "chromium-1440") {
    await expect(page).toHaveScreenshot("catalogue-dark.png", { fullPage: true, animations: "disabled" });
  }
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Playwright viewport is unavailable");
  await page.setViewportSize({ width: Math.floor(viewport.width / 2), height: Math.floor(viewport.height / 2) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
