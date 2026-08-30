import { expect, test } from "@playwright/test";

test("blank sessions open directly into a searchable project catalogue", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start a scientific task" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(23);
  await expect(page.getByRole("navigation", { name: "Workbench view" })).toHaveCount(0);
  const dimensions = await page.locator(".preview-shell").evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
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
  await dialog.getByRole("tab", { name: "Reproduce" }).click();
  const primaryColor = await dialog.getByRole("button", { name: "Prepare run" }).evaluate((element) => getComputedStyle(element).color);
  expect(primaryColor).toBe("rgb(255, 255, 255)");
  await dialog.getByRole("button", { name: "Prepare run" }).click();
  await expect(page.getByLabel("Prepared DSH prompt")).toContainText("PD-L1 nanobody design showcase");
  await expect(page.getByLabel("Prepared DSH prompt")).not.toContainText("rosalind_showcase_import");
});

test("keyboard navigation, Escape, and dark theme remain usable", async ({ page }) => {
  await page.goto("/?theme=dark");
  await page.getByRole("heading", { name: "Start a scientific task" }).focus();
  await page.getByPlaceholder("Search a scientific question or method").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const overview = dialog.getByRole("tab", { name: "Overview" });
  const evidence = dialog.getByRole("tab", { name: "Evidence" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(evidence).toBeFocused();
  await expect(evidence).toHaveAttribute("aria-selected", "true");
  await dialog.locator(".rr-button--primary").focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close project details" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(".rr-button--primary")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("CSS 200 percent zoom keeps catalogue controls usable", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe("2");
  await page.getByPlaceholder("Search a scientific question or method").fill("nanobody");
  await expect(page.getByRole("button", { name: "Open PD-L1 nanobody design showcase" })).toBeVisible();
  await page.getByRole("button", { name: "Open PD-L1 nanobody design showcase" }).click();
  await expect(page.getByRole("dialog", { name: "PD-L1 nanobody design showcase" })).toBeVisible();
});

test("direct project catalogue stays within the narrow viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-narrow", "The narrow check is captured at 720 × 900.");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start a scientific task" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
