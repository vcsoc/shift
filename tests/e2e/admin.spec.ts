import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await page.getByRole("button", { name: "Manage timeline" }).click();
});
test("data tools export, dry-run import, backup and restore with explicit confirmation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Data & backups" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("the-shift-export.json");
  await page.getByRole("button", { name: "Create backup" }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
  await expect(
    page.getByRole("button", { name: "Restore backup" }),
  ).toBeEnabled();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restore backup" }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
  const data = await page.request.get("/api/v1/export");
  await page
    .getByRole("textbox", { name: "Import JSON", exact: true })
    .fill(JSON.stringify(await data.json()));
  await page.getByRole("button", { name: "Dry-run preview" }).click();
  await expect(page.locator(".data-tools pre")).toContainText("conflicts");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Commit replacement" }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
});
test("missing sources and unsaved edits show useful warnings", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page
    .getByLabel("Title *", { exact: true })
    .fill("Invalid verified milestone");
  await page
    .getByLabel("Summary *", { exact: true })
    .fill("Must have sources.");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Verified observations require at least one source",
  );
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Close management" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Close management" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("forecast dates are independently editable and not forecast is retained", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Search records" })
    .fill("Routine human oversight");
  await page.locator(".record-title").click();
  const baseline = page
    .locator("fieldset")
    .filter({ has: page.locator("legend").filter({ hasText: "BASELINE" }) });
  const accelerated = page
    .locator("fieldset")
    .filter({ has: page.locator("legend").filter({ hasText: "ACCELERATED" }) });
  await page.getByRole("tab", { name: "Baseline", exact: true }).click();
  await expect(baseline.getByLabel("Estimated start")).toHaveValue(
    "2033-06-30",
  );
  await baseline.getByLabel("Estimated start").fill("2034-06-30");
  await page.getByRole("tab", { name: "Accelerated", exact: true }).click();
  await expect(accelerated.getByLabel("Estimated start")).toHaveValue(
    "2027-06-30",
  );
  await accelerated.getByLabel("Not forecast").check();
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
  await page.locator(".record-title").click();
  await page.getByRole("tab", { name: "Baseline", exact: true }).click();
  await expect(baseline.getByLabel("Estimated start")).toHaveValue(
    "2034-06-30",
  );
  await baseline.getByLabel("Estimated start").fill("2033-06-30");
  await page.getByRole("tab", { name: "Accelerated", exact: true }).click();
  await expect(accelerated.getByLabel("Not forecast")).toBeChecked();
  await accelerated.getByLabel("Not forecast").uncheck();
  await accelerated.getByLabel("Estimated start").fill("2027-06-30");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
});
