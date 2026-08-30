import { expect, test } from "@playwright/test";

test("clean DSH profile loads the installed Rosalind bundle", async ({ page }) => {
  test.skip(!process.env.DSH_PROFILE_URL, "Requires a running clean DSH Web profile.");
  await page.goto("/");
  const testingNotice = page.getByRole("dialog", { name: "Internal Testing Notice" });
  const launcherHeading = page.getByRole("heading", { name: "Rosalind research workspace" });
  const noticeAppeared = await testingNotice.waitFor({ state: "visible", timeout: 1_500 }).then(() => true, () => false);
  if (noticeAppeared) {
    await testingNotice.getByRole("button", { name: "Continue" }).click({ timeout: 5_000 }).catch(() => undefined);
    await expect(testingNotice).toBeHidden({ timeout: 5_000 });
  }
  await expect(page.getByRole("button", { name: /New Session/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".drr-sidebar-browser")).toHaveCount(0);
  await expect(launcherHeading).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".rr-root--hero .rr-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New research task" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workbench view" })).toHaveCount(0);
  const launcherDimensions = await page.locator(".rr-root--hero").evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(launcherDimensions.scrollWidth).toBeLessThanOrEqual(launcherDimensions.clientWidth + 1);
  if (test.info().project.name === "chromium-1280") {
    await expect(page).toHaveScreenshot("clean-dsh-rosalind-portal.png", { animations: "disabled" });
  }
  await page.getByRole("button", { name: "New research task" }).click();
  await page.getByRole("tab", { name: /Rosalind Workbench/ }).click();
  await expect(page.getByText("PD-L1 nanobody design showcase")).toBeVisible();
  await page.getByText("PD-L1 nanobody design showcase").locator("xpath=ancestor::article[1]").getByRole("button", { name: "Inspect" }).click();
  await expect(page.getByRole("region", { name: "PD-L1 nanobody design showcase" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "PD-L1 nanobody design showcase" })).toHaveCount(0);
});
