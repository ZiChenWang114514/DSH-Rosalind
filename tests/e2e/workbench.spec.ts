import { expect, test } from "@playwright/test";

test("blank sessions open directly into a research project workspace", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rosalind research workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New research task" })).toBeVisible();
  await expect(page.locator(".rr-card")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Workbench view" })).toHaveCount(0);
  const dimensions = await page.locator(".preview-shell").evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  if (testInfo.project.name === "chromium-1280") await page.screenshot({ path: testInfo.outputPath("science-workspace-1280.png"), fullPage: true });
});

test("module detail, reviewed record, reproduction mode, and composer import work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New research task" }).click();
  await page.getByRole("tab", { name: /Rosalind Workbench/ }).click();
  const record = page.getByText("PD-L1 nanobody design showcase").locator("xpath=ancestor::article[1]");
  await record.getByRole("button", { name: "Reproduce" }).click();
  const detail = page.getByRole("region", { name: "PD-L1 nanobody design showcase" });
  await expect(detail).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await detail.getByRole("tab", { name: "Evidence" }).click();
  await expect(detail.getByText("Indexed artifacts")).toBeVisible();
  await detail.getByRole("tab", { name: "Reproduce" }).click();
  const primaryColor = await detail.getByRole("button", { name: "Prepare run" }).evaluate((element) => getComputedStyle(element).color);
  expect(primaryColor).toBe("rgb(255, 255, 255)");
  await detail.getByRole("button", { name: "Prepare run" }).click();
  await expect(page.getByLabel("Prepared DSH prompt")).toContainText("PD-L1 nanobody design showcase");
  await expect(page.getByLabel("Prepared DSH prompt")).not.toContainText("rosalind_showcase_import");
});

test("keyboard navigation, Escape, and dark theme remain usable", async ({ page }) => {
  await page.goto("/?theme=dark");
  await page.getByRole("button", { name: "New research task" }).click();
  const firstModule = page.getByRole("tab", { name: /Life Sciences Literature/ });
  await firstModule.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Life Sciences Databases/ })).toBeFocused();
  await page.getByRole("tab", { name: /Rosalind Workbench/ }).click();
  const record = page.getByText("PD-L1 nanobody design showcase").locator("xpath=ancestor::article[1]");
  await record.getByRole("button", { name: "Inspect" }).click();
  const detail = page.getByRole("region", { name: "PD-L1 nanobody design showcase" });
  await expect(detail).toBeVisible();
  const overview = detail.getByRole("tab", { name: "Overview" });
  const evidence = detail.getByRole("tab", { name: "Evidence" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(evidence).toBeFocused();
  await expect(evidence).toHaveAttribute("aria-selected", "true");
  await detail.focus();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
});

test("CSS 200 percent zoom keeps catalogue controls usable", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe("2");
  await page.getByRole("button", { name: "New research task" }).click();
  await page.getByRole("tab", { name: /Rosalind Workbench/ }).click();
  const record = page.getByText("PD-L1 nanobody design showcase").locator("xpath=ancestor::article[1]");
  await expect(record.getByRole("button", { name: "Inspect" })).toBeVisible();
  await record.getByRole("button", { name: "Inspect" }).click();
  await expect(page.getByRole("region", { name: "PD-L1 nanobody design showcase" })).toBeVisible();
  const overflow = await page.locator(".preview-content").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("direct project catalogue stays within the narrow viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-narrow", "The narrow check is captured at 720 × 900.");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rosalind research workspace" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the 491 pixel DSH conversation width keeps Science readable", async ({ page }, testInfo) => {
  await page.goto("/?layout=dsh-narrow&view=science");
  const content = page.locator(".preview-content");
  await expect(content).toBeVisible();
  expect(await content.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(492);
  await expect(page.getByRole("heading", { name: "Rosalind Science" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(7);
  const overflow = await content.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (testInfo.project.name === "chromium-1280") {
    await page.getByRole("tab").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("science-workspace-dsh-491.png"), fullPage: true });
  }
});
