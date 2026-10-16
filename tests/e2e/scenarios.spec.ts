import { test, expect } from "@playwright/test";
import { time } from "../../packages/shared/src/model";
async function seek(page: import("@playwright/test").Page, date: string) {
  await page
    .getByRole("slider", { name: "Seek year" })
    .evaluate((element, value) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(element, String(value));
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, time(date));
}
test("Exponential follows Accelerated, persists in URL, preserves date and exposes editable end-role hypotheses", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await seek(page, "2045-01-01");
  const prior = await page.getByTestId("technology-path").getAttribute("d");
  await expect(page.locator(".segmented button")).toHaveText([
    "Baseline",
    "Accelerated",
    "Exponential",
  ]);
  await page.getByRole("button", { name: "Exponential", exact: true }).click();
  await expect(page).toHaveURL(/scenario=exponential/);
  await expect(page.getByTestId("current-year")).toHaveText("2045");
  await expect
    .poll(() => page.getByTestId("technology-path").getAttribute("d"))
    .not.toBe(prior);
  await expect(page.locator(".event-detail h2")).toContainText(
    "All four human backstops",
  );
  await page.getByText("Assumptions & limits", { exact: true }).click();
  await expect(page.locator(".forecast-assumptions")).toContainText(
    "may never occur",
  );
  await expect(page.locator(".disclaimer")).toContainText(
    "not a universal law",
  );
  await page.screenshot({
    path: "docs/screenshots/exponential-human-backstops.png",
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Exponential", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page
    .getByRole("textbox", { name: "Search records" })
    .fill("Human accountability no longer");
  await page.locator(".record-title").click();
  await page.getByRole("tab", { name: "Exponential", exact: true }).click();
  await expect(
    page.locator("legend").filter({ hasText: "EXPONENTIAL" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("military toggle includes past and future markers, persists, and hides them again without moving date", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await seek(page, "2100-12-31");
  const toggle = page.getByRole("button", { name: "Include military events" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const past = page.getByRole("button", {
    name: /MQ-1 Predator enters service/,
  });
  const future = page.getByRole("button", {
    name: /AI-led noncombat military logistics planning/,
  });
  await expect(past).toHaveCount(0);
  await toggle.click();
  await expect(page).toHaveURL(/military=1/);
  await expect(past).toBeVisible();
  await expect(future).toBeVisible();
  await expect(page.getByTestId("current-year")).toHaveText("2100");
  await page.screenshot({ path: "docs/screenshots/military-included.png" });
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await seek(page, "2100-12-31");
  await toggle.click();
  await expect(past).toHaveCount(0);
  await expect(future).toHaveCount(0);
  await expect(page.getByTestId("current-year")).toHaveText("2100");
});
test("Exponential and military controls fit a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=exponential&military=1");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  for (const name of [
    "Baseline",
    "Accelerated",
    "Exponential",
    "Include military events",
    "Toggle theme",
    "Manage timeline",
  ]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
  await seek(page, "2045-01-01");
  await page.screenshot({ path: "docs/screenshots/exponential-mobile.png" });
});
