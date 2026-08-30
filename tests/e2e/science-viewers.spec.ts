import { expect, test } from "@playwright/test";

const fixtures = [
  { kind: "sequence", selector: "sequence", evidence: "P01116" },
  { kind: "ngs", selector: "ngs", evidence: "Quantification processes finished" },
  { kind: "structure", selector: "structure", evidence: "Local coordinate render confirmed · 4 returned coordinates" },
  { kind: "slide", selector: "slide", evidence: "46,000 × 32,893 px" },
] as const;

for (const fixture of fixtures) {
  test(`${fixture.kind} scientific result is responsive and visually stable`, async ({ page }) => {
    await page.goto(`/?science=${fixture.kind}`);
    const viewer = page.locator(`[data-science-viewer="${fixture.selector}"]`);
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText(fixture.evidence);
    const dimensions = await page.locator(".science-preview-shell").evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    await expect(page).toHaveScreenshot(`science-${fixture.kind}-light.png`, { fullPage: true, animations: "disabled" });
  });
}

test("viewer tabs support roving keyboard focus", async ({ page }) => {
  await page.goto("/?science=sequence");
  const alignment = page.getByRole("tab", { name: "Alignment" });
  await alignment.focus();
  await page.keyboard.press("ArrowRight");
  const metrics = page.getByRole("tab", { name: "Metrics" });
  await expect(metrics).toBeFocused();
  await expect(metrics).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Per-column metric track").locator("i")).toHaveCount(9);
});

test("structure canvas redraws after the workspace width changes", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/?science=structure");
  const canvas = page.getByRole("application", { name: /Local molecular coordinate view/ });
  await expect(canvas).toBeVisible();
  const dimensions = () => canvas.evaluate((element) => {
    const surface = element as HTMLCanvasElement;
    return { backingWidth: surface.width, clientWidth: surface.clientWidth, ratio: window.devicePixelRatio || 1 };
  });
  await expect.poll(async () => {
    const value = await dimensions();
    return value.backingWidth === Math.round(value.clientWidth * value.ratio);
  }).toBe(true);
  const narrow = await dimensions();

  await page.setViewportSize({ width: 1180, height: 900 });
  await expect.poll(async () => {
    const value = await dimensions();
    return value.clientWidth > narrow.clientWidth && value.backingWidth === Math.round(value.clientWidth * value.ratio);
  }).toBe(true);
});

test("slide source controls preserve state and explain read-only layer visibility", async ({ page }) => {
  await page.goto("/?science=slide");
  const source = page.getByLabel("Slide source extent and returned regions");
  await source.focus();
  await page.keyboard.press("+");
  await expect(page.locator(".sv-slide-position")).toContainText("120%");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".sv-slide-position")).not.toContainText("x 0");
  await page.getByLabel("Reset slide view").click();
  await expect(page.locator(".sv-slide-position")).toHaveText("100% · x 0 · y 0");
  await expect(page.getByText("46,000 × 32,893 px")).toBeVisible();
  await expect(page.getByText("CMU-1-JP2K-33005.svs")).toBeVisible();
  await page.getByRole("tab", { name: "Layers" }).click();
  const layer = page.getByRole("checkbox", { name: "segmentation visibility (read-only)" });
  await expect(layer).toBeDisabled();
  await expect(layer).toBeChecked();
  await expect(page.getByRole("note")).toHaveText("Layer visibility is read-only in this recorded result. Change visibility in the connected slide viewer.");
  await page.getByRole("tab", { name: "Slide" }).click();
  await expect(page.locator(".sv-slide-position")).toHaveText("100% · x 0 · y 0");
  await expect(page.getByText("46,000 × 32,893 px")).toBeVisible();
});

test("dark structure result and narrow slide result retain their scientific state", async ({ page }, testInfo) => {
  if (testInfo.project.name === "chromium-1440") {
    await page.goto("/?science=structure&theme=dark");
    await expect(page.getByLabel("Molecular scene state")).toContainText("Local coordinate render confirmed · 4 returned coordinates");
    await expect(page).toHaveScreenshot("science-structure-dark.png", { fullPage: true, animations: "disabled" });
    return;
  }
  if (testInfo.project.name === "chromium-narrow") {
    await page.goto("/?science=slide");
    await page.getByRole("tab", { name: "Spatial" }).click();
    await expect(page.getByText("18,078")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
