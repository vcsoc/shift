import { test, expect, Page } from "@playwright/test";
import { time, START, indices } from "../../packages/shared/src/model";
async function seek(page: Page, date: string) {
  await page
    .getByRole("slider", { name: "Seek year" })
    .evaluate((el, value) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, time(date));
}
test("year and description are bottom-right in the requested order, with a translucent grey year", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [
    [1366, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?scenario=baseline&military=1");
    await expect(page.getByTestId("technology-path")).toBeVisible();
    await seek(page, "2069-01-01");
    const year = await page.getByTestId("current-year").boundingBox(),
      detail = await page.locator(".event-detail").boundingBox(),
      transport = await page.locator(".transport").boundingBox();
    expect(year!.x).toBeGreaterThan(width * 0.45);
    expect(year!.y).toBeGreaterThan(height * 0.55);
    expect(detail!.y + detail!.height).toBeLessThanOrEqual(year!.y + 1);
    expect(year!.y + year!.height).toBeLessThan(transport!.y);
    const css = await page.getByTestId("current-year").evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      color: getComputedStyle(el).color,
      muted: getComputedStyle(document.documentElement)
        .getPropertyValue("--muted")
        .trim(),
    }));
    expect(Number(css.opacity)).toBeGreaterThan(0);
    expect(Number(css.opacity)).toBeLessThan(0.7);
    expect(css.color).toBe("rgb(134, 147, 163)");
    await page.screenshot({
      path: `docs/screenshots/annotations-overlay-${width}.png`,
    });
  }
  expect(errors).toEqual([]);
});
test("military is an accessible icon button with a hover/focus tooltip", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  const button = page.getByRole("button", { name: "Include military events" });
  await expect(button.locator("svg")).toBeVisible();
  await button.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Off — click to include",
  );
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tooltip")).toContainText("On — click to hide");
});
test("speed explains paused behavior and measurably changes playback", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  const slider = page.getByRole("slider", { name: "Seek year" });
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("2");
  await expect(
    page.getByRole("status").filter({ hasText: "Paused — press Play" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const slow = Number(await slider.inputValue()) - START;
  await seek(page, "1900-01-01");
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("25");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const fast = Number(await slider.inputValue()) - START;
  expect(slow).toBeGreaterThan(0);
  expect(fast).toBeGreaterThan(slow * 4);
});
test("SQLite backup works through the real Vite proxy, without permitting hostile origins", async ({
  page,
  request,
}) => {
  await page.goto("http://127.0.0.1:5174");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page.getByRole("button", { name: "Data & backups" }).click();
  await page
    .getByRole("button", { name: "Create backup", exact: true })
    .click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
  await expect(
    page.getByRole("button", { name: "Restore backup" }),
  ).toBeEnabled();
  expect(await page.getByLabel("Available backups").inputValue()).toMatch(
    /^backup-.*\.sqlite$/,
  );
  const forbidden = await request.post(
    "http://127.0.0.1:5174/api/v1/admin/backup",
    { headers: { "X-Shift-Admin": "local", Origin: "https://evil.example" } },
  );
  expect(forbidden.status()).toBe(403);
  await page.screenshot({
    path: "docs/screenshots/annotations-backup-vite.png",
  });
});
test("event titles show pencils and event edits move and persist the curve point", async ({
  page,
}) => {
  const title = "Event with curve " + Date.now();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await expect(
    page.getByRole("button", { name: "Events & curve points", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".record-title").first().locator(".pencil-icon"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Title *", { exact: true }).fill(title);
  await page
    .getByLabel("Kind", { exact: true })
    .selectOption("approximate_history");
  await page.getByLabel("Date precision", { exact: true }).selectOption("day");
  await page
    .getByLabel("Historical date (first day for month/year anchors)")
    .fill("1949-02-03");
  await page.getByLabel("Technology index (0–100)").fill("42");
  await page.getByLabel("Human effort index (0–100)").fill("80");
  await page
    .getByLabel("Summary *", { exact: true })
    .fill("This milestone and its control point are edited together.");
  await page.locator(".editor").evaluate((el) => el.scrollTo({ top: 0 }));
  await page.screenshot({
    path: "docs/screenshots/annotations-unified-event-editor.png",
  });
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
  let data = await (await page.request.get("/api/v1/timeline")).json();
  expect(indices(data.points, time("1949-02-03"))).toEqual([42, 80]);
  await page.getByRole("textbox", { name: "Search records" }).fill(title);
  await page.locator(".record-title").click();
  await page
    .getByLabel("Historical date (first day for month/year anchors)")
    .fill("1949-02-04");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
  await page.reload();
  data = await (await page.request.get("/api/v1/timeline")).json();
  expect(data.points.some((p: any) => p.point_date === "1949-02-03")).toBe(
    false,
  );
  expect(indices(data.points, time("1949-02-04"))).toEqual([42, 80]);
});
test("Details and scenario tabs retain unsaved values and save all scenario curves together", async ({
  page,
}) => {
  const title = "Tabbed curve event " + Date.now();
  await page.goto("/");
  await expect(page.getByTestId("technology-path")).toBeVisible();
  await page.getByRole("button", { name: "Manage timeline" }).click();
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Title *", { exact: true }).fill(title);
  await page
    .getByLabel("Kind", { exact: true })
    .selectOption("future_forecast");
  await page
    .getByLabel("Summary *", { exact: true })
    .fill("One record with three independent scenario points.");
  await expect(page.getByRole("tab")).toHaveText([
    "Details",
    "Baseline",
    "Accelerated",
    "Exponential",
  ]);
  for (const [name, date, technology, human] of [
    ["Baseline", "2038-04-07", "60", "70"],
    ["Accelerated", "2033-04-07", "80", "50"],
    ["Exponential", "2030-04-07", "95", "20"],
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByLabel("Summary *", { exact: true })).toHaveCount(0);
    await page.getByLabel("Not forecast").uncheck();
    await page.getByLabel("Estimated start", { exact: true }).fill(date);
    await page.getByLabel("Technology index (0–100)").fill(technology);
    await page.getByLabel("Human effort index (0–100)").fill(human);
    await page
      .getByLabel("Rationale *", { exact: true })
      .fill("Editable conceptual scenario values.");
  }
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.getByLabel("Title *", { exact: true })).toHaveValue(title);
  await expect(page.getByLabel("Summary *", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add source", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add relationship", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Baseline", exact: true }).click();
  await expect(page.getByLabel("Technology index (0–100)")).toHaveValue("60");
  await page.screenshot({
    path: "docs/screenshots/annotations-scenario-tab.png",
  });
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.locator(".notice")).toHaveText("Saved successfully.");
  for (const [scenario, date, expected] of [
    ["baseline", "2038-04-07", [60, 70]],
    ["accelerated", "2033-04-07", [80, 50]],
    ["exponential", "2030-04-07", [95, 20]],
  ] as const) {
    const data = await (
      await page.request.get("/api/v1/timeline?scenario=" + scenario)
    ).json();
    expect(indices(data.points, time(date))).toEqual(expected);
  }
});
