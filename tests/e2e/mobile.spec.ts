import { test, expect } from "@playwright/test";
test("mobile touch swipe and touch controls work without runtime errors", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 90, y: 570 }],
  });
  for (let i = 1; i <= 6; i++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 90, y: 570 - i * 45 }],
    });
    await page.waitForTimeout(30);
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByTestId("current-year")).not.toHaveText("1900");
  await page.getByRole("button", { name: "Accelerated", exact: true }).tap();
  await expect(page).toHaveURL(/scenario=accelerated/);
  await page.getByRole("button", { name: "Toggle theme" }).tap();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Manage timeline" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close management" }).tap();
  expect(errors).toEqual([]);
  await context.close();
});
test("captures drawn baseline curve and local editor", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await page.locator("body").click({ position: { x: 10, y: 400 } });
  await page.keyboard.press("End");
  await expect(page.getByTestId("current-year")).toHaveText("2100");
  await page.screenshot({
    path: "docs/screenshots/baseline-complete-1920x1080.png",
  });
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page.getByRole("button", { name: "Advanced anchors" }).click();
  await page.getByRole("button", { name: "Add point", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/curve-editor-1920x1080.png",
  });
});
