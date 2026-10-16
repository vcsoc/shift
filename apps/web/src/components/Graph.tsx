import { useEffect, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line, curveLinear } from "d3-shape";
import {
  CUTOFF,
  END,
  START,
  Timeline,
  Event,
  time,
  eventDate,
  indices,
  crossover,
} from "../../../../packages/shared/src/model";
export function Graph({
  data,
  active,
  seek,
  choose,
}: {
  data: Timeline;
  active: number;
  seek: (t: number) => void;
  choose: (e: Event) => void;
}) {
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  useEffect(() => {
    const f = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const { w, h } = size,
    left = w < 600 ? 32 : 54,
    right = 24,
    top = 72,
    bottom = h - (w < 600 ? 150 : 115);
  const x = scaleLinear()
      .domain([START, END])
      .range([left, w - right]),
    y = scaleLinear().domain([0, 100]).range([bottom, top]);
  const pts = [...data.points].sort((a, b) =>
    a.point_date.localeCompare(b.point_date),
  );
  const values = pts.map((p) => [
    time(p.point_date),
    p.technology_index,
    p.human_effort_index,
  ]);
  const make = (col: number) =>
    line<number[]>()
      .x((p) => x(p[0]))
      .y((p) => y(p[col]))
      .curve(curveLinear)(values) || "";
  const cross = crossover(pts);
  const groups = new Map<string, Event[]>();
  for (const e of data.events) {
    const d = eventDate(e, data.scenario);
    if (d && time(d) <= active) {
      groups.set(d, [...(groups.get(d) || []), e]);
    }
  }
  const clipWidth = Math.max(1, x(active) - left);
  return (
    <svg
      className="graph"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-label="Conceptual technology and human effort indices from 1900 to 2100"
      role="img"
    >
      <defs>
        <clipPath id="reached">
          <rect
            x={left}
            y={top - 10}
            width={clipWidth}
            height={bottom - top + 20}
          />
        </clipPath>
      </defs>
      <rect
        x={x(time(CUTOFF))}
        y={top}
        width={w - right - x(time(CUTOFF))}
        height={bottom - top}
        fill="var(--forecast)"
      />
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line className="grid" x1={left} x2={w - right} y1={y(v)} y2={y(v)} />
          <text className="axis" x={left - 9} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {[1900, 1925, 1950, 1975, 2000, 2026, 2050, 2075, 2100]
        .filter((v, i) => w > 600 || i % 2 === 0)
        .map((v) => (
          <g key={v}>
            <line
              className="grid vertical"
              x1={x(time(v + "-01-01"))}
              x2={x(time(v + "-01-01"))}
              y1={top}
              y2={bottom}
            />
            <text
              className="axis"
              x={x(time(v + "-01-01"))}
              y={bottom + 24}
              textAnchor="middle"
            >
              {v}
            </text>
          </g>
        ))}
      <text
        className="axis index-label"
        x={16}
        y={(top + bottom) / 2}
        textAnchor="middle"
        transform={`rotate(-90 16 ${(top + bottom) / 2})`}
      >
        CONCEPTUAL INDEX · NOT MEASURED DATA
      </text>
      <line
        className="boundary"
        x1={x(time(CUTOFF))}
        x2={x(time(CUTOFF))}
        y1={top}
        y2={bottom}
      />
      <text
        className="forecast-label"
        x={Math.min(w - 180, x(time(CUTOFF)) + 10)}
        y={bottom - 12}
      >
        ILLUSTRATIVE FORECASTS →
      </text>
      <g clipPath="url(#reached)">
        <path
          data-testid="technology-path"
          d={make(1)}
          className="curve technology"
        />
        <path data-testid="human-path" d={make(2)} className="curve human" />
      </g>
      {[1, 2].map((col) => (
        <circle
          key={col}
          cx={x(active)}
          cy={y(indices(pts, active)[col - 1])}
          r="4"
          fill={col === 1 ? "var(--orange)" : "var(--cyan)"}
        />
      ))}
      <line
        className="cursor"
        x1={x(active)}
        x2={x(active)}
        y1={top}
        y2={bottom}
      />
      {[...groups].map(([d, es]) => {
        const xx = x(time(d)),
          yy = y(indices(pts, time(d))[0]);
        return (
          <g
            className="marker"
            key={d}
            role="button"
            tabIndex={0}
            aria-label={`${es.length > 1 ? es.length + " events: " : ""}${es.map((e) => e.title).join("; ")}`}
            onClick={() => {
              seek(time(d));
              choose(es[0]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                seek(time(d));
                choose(es[0]);
              }
            }}
          >
            <title>{es.map((e) => e.title).join(" / ")}</title>
            <circle cx={xx} cy={yy} r="14" fill="transparent" />
            <circle
              cx={xx}
              cy={yy}
              r={es.length > 1 ? 6 : 4}
              fill={
                es[0].kind === "future_forecast" ? "var(--orange)" : "var(--fg)"
              }
              stroke="var(--bg)"
              strokeWidth="2"
            />
            {es.length > 1 && (
              <text className="axis" x={xx} y={yy - 12} textAnchor="middle">
                {es.length}
              </text>
            )}
          </g>
        );
      })}
      {cross !== null && active >= cross && (
        <g>
          <circle
            cx={x(cross)}
            cy={y(indices(pts, cross)[0])}
            r="9"
            className="cross"
          />
          <text
            className="axis"
            x={Math.min(w - 200, x(cross) + 14)}
            y={y(indices(pts, cross)[0]) + 25}
          >
            Illustrative index crossover
          </text>
        </g>
      )}
    </svg>
  );
}
