import { test, expect, Page } from "@playwright/test";
import { START, END, time } from "../../packages/shared/src/model";
async function seek(page: Page, date: string) {
  await page.getByRole("slider", { name: "Seek year" }).evaluate(
    (el, value) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    String(time(date)),
  );
}
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});
test("loads at 1900, fills all target viewports and produces actual screenshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId("current-year")).toHaveText("1900");
    const box = await page.locator(".graph").boundingBox();
    expect(box?.width).toBe(width);
    expect(box?.height).toBe(height);
    await page.screenshot({
      path: `docs/screenshots/timeline-${width}x${height}.png`,
    });
  }
  expect(errors).toEqual([]);
});
test("scroll, reverse scroll, seek and synchronized next scroll", async ({
  page,
}) => {
  await page.mouse.wheel(0, 5000);
  await expect(page.getByTestId("current-year")).not.toHaveText("1900");
  const forward = Number(await page.getByTestId("current-year").innerText());
  await page.mouse.wheel(0, -2500);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("current-year").innerText()),
    )
    .toBeLessThan(forward);
  await seek(page, "2050-01-01");
  await expect(page.getByTestId("current-year")).toHaveText("2050");
  await page.mouse.wheel(0, 100);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("current-year").innerText()),
    )
    .toBeGreaterThan(2050);
  await seek(page, "1920-01-01");
  await expect(page.getByTestId("current-year")).toHaveText("1920");
});
test("play pause previous next and stop at 2100", async ({ page }) => {
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await expect(page.getByTestId("current-year")).toHaveText("1901");
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await expect(page.getByTestId("current-year")).toHaveText("1903");
  await page
    .getByRole("button", { name: "Previous event", exact: true })
    .click();
  await expect(page.getByTestId("current-year")).toHaveText("1901");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await seek(page, "2099-12-01");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("current-year")).toHaveText("2100");
});
test("markers never appear before reached; overlay is transparent and sourced", async ({
  page,
}) => {
  await seek(page, "2017-06-11");
  await expect(
    page.getByRole("button", {
      name: "Attention Is All You Need submitted",
      exact: true,
    }),
  ).toHaveCount(0);
  await seek(page, "2017-06-12");
  await expect(
    page.getByRole("button", {
      name: "Attention Is All You Need submitted",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".event-detail h2")).toHaveText(
    "Attention Is All You Need submitted",
  );
  await expect(page.locator(".sources a")).toHaveAttribute(
    "href",
    "https://arxiv.org/abs/1706.03762",
  );
  const style = await page.locator(".event-overlay").evaluate((e) => ({
    background: getComputedStyle(e).backgroundColor,
    border: getComputedStyle(e).borderWidth,
  }));
  expect(style).toEqual({ background: "rgba(0, 0, 0, 0)", border: "0px" });
});
test("scenario toggle changes future geometry but not historical anchors; seek survives theme/resize", async ({
  page,
  request,
}) => {
  const a = await (
    await request.get("/api/v1/timeline?scenario=baseline")
  ).json();
  const b = await (
    await request.get("/api/v1/timeline?scenario=accelerated")
  ).json();
  expect(a.points.filter((p: any) => !p.scenario_id)).toEqual(
    b.points.filter((p: any) => !p.scenario_id),
  );
  await seek(page, "2027-07-01");
  const path = await page.getByTestId("technology-path").getAttribute("d");
  await page.getByRole("button", { name: "Accelerated", exact: true }).click();
  await expect(page).toHaveURL(/scenario=accelerated/);
  await expect(page.locator(".event-detail h2")).toContainText(
    "bounded digital workflows",
  );
  expect(await page.getByTestId("technology-path").getAttribute("d")).not.toBe(
    path,
  );
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("current-year")).toHaveText("2027");
  await page.screenshot({
    path: "docs/screenshots/accelerated-mobile-light.png",
  });
  await page.getByRole("button", { name: "Baseline", exact: true }).click();
  await seek(page, "2033-07-01");
  await expect(page.locator(".event-detail h2")).toContainText(
    "bounded digital workflows",
  );
});
test("event form saves, marker refreshes and survives reload; archive/restore/delete", async ({
  page,
}) => {
  const title = "Browser milestone " + Date.now();
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Title *", { exact: true }).fill(title);
  await page
    .getByLabel("Kind", { exact: true })
    .selectOption("approximate_history");
  await page
    .getByLabel("Summary *", { exact: true })
    .fill("Browser-persisted research note, approximate history.");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.locator(".notice")).toContainText("Saved successfully");
  await page.getByRole("button", { name: "Close management" }).click();
  await seek(page, "2000-12-01");
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toBeVisible();
  await page.reload();
  await seek(page, "2000-12-01");
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page.getByRole("textbox", { name: "Search records" }).fill(title);
  const record = page
    .locator(".record-list article")
    .filter({ hasText: title });
  await record.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(record).toContainText("archived");
  await record.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(record).toContainText("published");
  page.once("dialog", (d) => d.accept());
  await record.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(record).toContainText("deleted");
  await record.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(record).toContainText("published");
});
test("curve editor previews and persists geometry changes", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page.getByRole("button", { name: "Advanced anchors" }).click();
  await page.getByRole("button", { name: "Add point", exact: true }).click();
  await page.getByLabel("Point date").fill("2041-02-03");
  await page.getByLabel("Technology index (0–100)").fill("61");
  await page
    .getByLabel("Rationale *")
    .fill("Browser test editable illustrative anchor.");
  await expect(page.getByLabel("Unsaved curve preview")).toBeVisible();
  await page.getByRole("button", { name: "Save curve point" }).click();
  await expect(page.locator(".notice")).toContainText("Saved successfully");
  await expect(page.locator(".record-list")).toContainText("2041-02-03");
  await page.reload();
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page.getByRole("button", { name: "Advanced anchors" }).click();
  await expect(page.locator(".record-list")).toContainText("2041-02-03");
  await page.locator(".record-title").filter({ hasText: "2041-02-03" }).click();
  await page.getByLabel("Technology index (0–100)").fill("66");
  await page.getByRole("button", { name: "Save curve point" }).click();
  await expect(page.locator(".notice")).toContainText("Saved successfully");
  await page.reload();
  const saved = await (
    await page.request.get("/api/v1/curve-points?scenario=baseline")
  ).json();
  expect(
    saved.find((p: any) => p.point_date === "2041-02-03").technology_index,
  ).toBe(66);
});
test("keyboard, reduced motion and no hardcoded crossover", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("body").click({ position: { x: 10, y: 400 } });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("current-year")).toHaveText("1901");
  await page.keyboard.press("End");
  await expect(page.getByTestId("current-year")).toHaveText("2100");
  await expect(
    page.getByText("Illustrative index crossover", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("current-year")).toHaveText("1900");
});
test("malformed API displays retry instead of blank page", async ({ page }) => {
  await page.route("**/api/v1/timeline*", (route) =>
    route.fulfill({ json: { events: [], points: [] } }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Timeline unavailable");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await page.unroute("**/api/v1/timeline*");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("technology-path")).toBeVisible();
});
