import { expect, test } from "@playwright/test";

test("clean DSH profile loads the installed Rosalind bundle", async ({ page }) => {
  test.skip(!process.env.DSH_PROFILE_URL, "Requires a running clean DSH Web profile.");
  await page.goto("/");
  const testingNotice = page.getByRole("dialog", { name: "Internal Testing Notice" });
  const noticeAppeared = await testingNotice.waitFor({ state: "visible", timeout: 1_500 }).then(() => true, () => false);
  if (noticeAppeared) {
    await testingNotice.getByRole("button", { name: "Continue" }).click({ timeout: 5_000 }).catch(() => undefined);
    await expect(testingNotice).toBeHidden({ timeout: 5_000 });
  }
  await expect(page.getByRole("button", { name: /New Session/i }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".drr-sidebar-browser")).toHaveCount(0);
  const scienceTab = page.getByRole("tab", { name: "科学" });
  await expect(scienceTab).toBeVisible({ timeout: 30_000 });
  const tabList = scienceTab.locator("xpath=..");
  const [tabBox, tabListBox] = await Promise.all([scienceTab.boundingBox(), tabList.boundingBox()]);
  expect(tabBox).not.toBeNull();
  expect(tabListBox).not.toBeNull();
  expect(tabBox!.y).toBeGreaterThanOrEqual(tabListBox!.y);
  expect(tabBox!.y + tabBox!.height).toBeLessThanOrEqual(tabListBox!.y + tabListBox!.height);
  await scienceTab.click();
  await expect(scienceTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "科学" })).toBeVisible();
  const scienceToggle = page.getByRole("button", { name: /启用.*科学模式/ });
  await expect(scienceToggle).toBeVisible();
  await scienceToggle.click();
  await expect(page.getByRole("button", { name: /停用.*科学模式|恢复原主题与会话/ })).toBeVisible();
  await page.getByRole("tab", { name: /会话|Sessions/ }).click();
  await scienceTab.click();
  await expect(page.getByRole("button", { name: /停用.*科学模式|恢复原主题与会话/ })).toBeVisible();
  if (test.info().project.name !== "chromium-narrow") {
    const sciencePanel = page.getByRole("tabpanel", { name: "科学" });
    for (const name of [
      "Life Sciences Literature",
      "Life Sciences Databases",
      "Biological Sequence Viewer",
      "NGS Analysis Workbench",
      "Molecular Structure Viewer",
      "Slide Viewer",
      "Rosalind Workbench",
    ]) await expect(sciencePanel.getByText(name, { exact: true })).toBeVisible();
  }
  if (test.info().project.name === "chromium-1280") {
    await expect(page).toHaveScreenshot("clean-dsh-rosalind-portal.png", { animations: "disabled" });
  }
});
