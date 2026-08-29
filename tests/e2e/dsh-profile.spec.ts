import { expect, test } from "@playwright/test";

test("clean DSH profile loads the installed Rosalind bundle", async ({ page }) => {
  test.skip(!process.env.DSH_PROFILE_URL, "Requires a running clean DSH Web profile.");
  await page.goto("/");
  const testingNotice = page.getByRole("dialog", { name: "Internal Testing Notice" });
  const workbenchHeading = page.getByRole("heading", { name: "Rosalind scientific workbench" });
  await expect(async () => {
    if (await testingNotice.isVisible()) {
      await testingNotice.getByRole("button", { name: "Continue" }).click({ force: true });
    }
    await expect(workbenchHeading).toBeVisible();
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Seven plugins" }).click();
  await expect(page.getByRole("tab")).toHaveCount(7);
  await expect(page.getByText("55", { exact: true })).toBeVisible();
  await expect(page.getByText("117", { exact: true })).toBeVisible();
});
