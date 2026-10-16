import { test, expect, Page } from "@playwright/test";
import { START, time } from "../../packages/shared/src/model";
async function seek(page: Page, date: string) {
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
test("Age of AI retains pre-2023 history and persists as a fourth scenario", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?scenario=age-of-ai");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Age of AI", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider", { name: "Seek year" })).toHaveAttribute(
    "min",
    String(START),
  );
  await seek(page, "2000-01-01");
  await expect(page.getByTestId("current-year")).toHaveText("2000");
  for (const path of ["technology-path", "human-path"])
    expect(await page.getByTestId(path).getAttribute("d")).toMatch(/^M54,/);
  await expect(page.locator(".graph")).toHaveAccessibleName(
    /full history from 1900/,
  );
  await expect(page.locator(".disclaimer")).toContainText(
    "forecast fit uses only 2023",
  );
  await page.getByRole("button", { name: "Baseline", exact: true }).click();
  await expect(page.getByTestId("current-year")).toHaveText("2000");
  await page.getByRole("button", { name: "Age of AI", exact: true }).click();
  await expect(page).toHaveURL(/scenario=age-of-ai/);
  for (const [year, title] of [
    ["2027", "recent capability trend"],
    ["2028", "less routine execution"],
    ["2030", "adoption and reliability"],
    ["2035", "human responsibility remains"],
    ["2040", "long-run extrapolation"],
  ]) {
    await seek(page, `${year}-01-01`);
    const marker = page.getByRole("button", {
      name: new RegExp(`Age of AI:.*${title}`),
    });
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(page.locator(".event-detail")).toContainText(
      "Projection checkpoint",
    );
    await expect(page.locator(".sources a")).toHaveCount(3);
    await expect(page.locator(".uncertainty")).toContainText("124.8 days");
  }
  await page.mouse.click(10, 10);
  await page.screenshot({ path: "docs/screenshots/age-of-ai.png" });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Age of AI", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("all four methodology tooltips work by hover and keyboard, without changing time", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await seek(page, "2035-01-01");
  const methods = [
    ["Baseline", "slower-adoption"],
    ["Accelerated", "faster adoption"],
    ["Exponential", "seven-month"],
    ["Age of AI", "Log-linear regression"],
  ];
  for (const [name, method] of methods) {
    const button = page.getByRole("button", { name, exact: true });
    await button.hover();
    await expect(page.getByRole("tooltip")).toContainText(method);
    await expect(button).toHaveAccessibleDescription(new RegExp(method));
    await expect(page.getByTestId("current-year")).toHaveText("2035");
    await page.mouse.move(0, 0);
    await button.focus();
    await expect(page.getByRole("tooltip")).toContainText(method);
    await button.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }
});
test("Age of AI and touch tooltips fit a mobile viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3101/?scenario=age-of-ai");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  for (const name of ["Baseline", "Accelerated", "Exponential", "Age of AI"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.tap();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    const box = await tooltip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await page.locator(".brand h1").tap({ force: true });
  }
  await page.getByRole("button", { name: "Age of AI", exact: true }).tap();
  await page.screenshot({ path: "docs/screenshots/age-of-ai-mobile.png" });
  await context.close();
});
