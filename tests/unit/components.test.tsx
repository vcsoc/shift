// @vitest-environment jsdom
import React from "react";
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Graph } from "../../apps/web/src/components/Graph";
import { START, Timeline, time } from "../../packages/shared/src/model";
afterEach(cleanup);
const data: Timeline = {
  scenario: "baseline",
  cutoff: "2026-10-13",
  categories: [],
  events: [],
  points: [
    {
      id: "a",
      scenario_id: null,
      point_date: "1900-01-01",
      technology_index: 3,
      human_effort_index: 98,
      rationale: "Conceptual",
    },
    {
      id: "b",
      scenario_id: "baseline",
      point_date: "2100-12-31",
      technology_index: 99,
      human_effort_index: 30,
      rationale: "Conceptual",
    },
  ],
};
it("renders both paths, axes and a calculated crossover only when reached", () => {
  const { rerender } = render(
    <Graph data={data} active={START} seek={() => {}} choose={() => {}} />,
  );
  expect(screen.getByTestId("technology-path").getAttribute("d")).toBeTruthy();
  expect(screen.getByTestId("human-path").getAttribute("d")).toBeTruthy();
  expect(screen.queryByText("Illustrative index crossover")).toBeNull();
  rerender(
    <Graph
      data={data}
      active={time("2100-12-31")}
      seek={() => {}}
      choose={() => {}}
    />,
  );
  expect(screen.getByText("Illustrative index crossover")).toBeTruthy();
});
