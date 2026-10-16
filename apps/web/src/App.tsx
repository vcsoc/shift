import { useCallback, useEffect, useRef, useState } from "react";
import { Graph } from "./components/Graph";
import { ForecastScenarios } from "./components/ForecastScenarios";
import { AGE_AI_AS_OF } from "../../../packages/shared/src/age-ai-data";
import { Admin } from "./features/Admin";
import { fetchTimeline } from "./lib/api";
import {
  END,
  START,
  Event,
  Scenario,
  Timeline,
  time,
  eventDate,
  dateLabel,
  scenarioSchema,
  SCENARIO_LABELS,
} from "../../../packages/shared/src/model";
export function App() {
  const [scenario, setScenario] = useState<Scenario>(
    scenarioSchema.safeParse(
      new URLSearchParams(location.search).get("scenario"),
    ).data || "baseline",
  );
  const [military, setMilitary] = useState(
    new URLSearchParams(location.search).get("military") === "1",
  );
  const [speedNotice, setSpeedNotice] = useState("");
  useEffect(() => {
    if (!speedNotice) return;
    const timer = setTimeout(() => setSpeedNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [speedNotice]);
  const [active, setActive] = useState(START),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(10),
    [theme, setTheme] = useState(localStorage.getItem("shift-theme") || "dark");
  const [data, setData] = useState<Timeline | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [admin, setAdmin] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const activeRef = useRef(active),
    version = useRef(0),
    syncedScroll = useRef<number | null>(null);
  const reload = useCallback(async () => {
    const v = ++version.current;
    setLoading(true);
    setError("");
    try {
      const d = await fetchTimeline(scenario, military);
      if (v === version.current) setData(d);
    } catch (e) {
      if (v === version.current) setError((e as Error).message);
    } finally {
      if (v === version.current) setLoading(false);
    }
  }, [scenario, military]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("shift-theme", theme);
  }, [theme]);
  const seek = useCallback((t: number, preserveSelection = false) => {
    const next = Math.max(START, Math.min(END, t));
    activeRef.current = next;
    setActive(next);
    if (!preserveSelection) setSelected(null);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: ((next - START) / (END - START)) * max,
      behavior: "instant",
    });
    syncedScroll.current = window.scrollY;
  }, []);
  useEffect(() => {
    const scroll = () => {
      if (
        syncedScroll.current !== null &&
        Math.abs(window.scrollY - syncedScroll.current) < 0.01
      )
        return;
      syncedScroll.current = null;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const t = START + (window.scrollY / max) * (END - START);
      activeRef.current = t;
      setActive(t);
      setSelected(null);
    };
    const resize = () => {
      seek(activeRef.current, true);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", resize);
    const interrupt = () => setPlaying(false);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
    };
  }, [seek]);
  useEffect(() => {
    if (!playing || admin) return;
    let id: number, previous: number | undefined;
    const frame = (now: number) => {
      if (previous !== undefined)
        seek(
          activeRef.current +
            ((now - previous) * speed * 365.2425 * 86400000) / 1000,
        );
      previous = now;
      if (activeRef.current >= END) {
        setPlaying(false);
        return;
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, seek, admin]);
  const visibleData =
    data && data.scenario === scenario
      ? {
          ...data,
          events: data.events.filter((e) => military || !e.is_military),
        }
      : null;
  const dated = (visibleData?.events || [])
    .map((e) => ({ e, d: eventDate(e, scenario) }))
    .filter((v): v is { e: Event; d: string } => v.d !== null)
    .sort(
      (a, b) => a.d.localeCompare(b.d) || a.e.title.localeCompare(b.e.title),
    );
  const reached = dated.filter((v) => time(v.d) <= active);
  const latest = reached.at(-1);
  const event = reached.find((v) => v.e.id === selected)?.e || latest?.e;
  const coincident = event
    ? reached.filter((v) => v.d === eventDate(event, scenario))
    : [];
  const jump = useCallback(
    (direction: number) => {
      setPlaying(false);
      const dates = Array.from(new Set(dated.map((v) => time(v.d))));
      const next =
        direction > 0
          ? dates.find((t) => t > activeRef.current + 86400000 / 2)
          : dates.reverse().find((t) => t < activeRef.current - 86400000 / 2);
      if (next !== undefined) seek(next);
    },
    [dated, seek],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        admin ||
        (e.target as HTMLElement).matches("input,textarea,select,button,a")
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        jump(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        jump(-1);
      }
      if (e.key === "Home") {
        e.preventDefault();
        seek(START);
      }
      if (e.key === "End") {
        e.preventDefault();
        seek(END);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [admin, jump, seek]);
  const changeScenario = (s: Scenario) => {
    setScenario(s);
    setSelected(null);
    const url = new URL(location.href);
    url.searchParams.set("scenario", s);
    history.replaceState({}, "", url);
  };
  return (
    <>
      <main className="stage" inert={admin}>
        {visibleData && !error && (
          <Graph
            data={visibleData}
            active={active}
            seek={(t) => {
              setPlaying(false);
              seek(t);
            }}
            choose={(e) => setSelected(e.id)}
          />
        )}
        <header className="brand">
          <h1>
            THE <span>SHIFT</span>
            <i>↗</i>
          </h1>
          <p>
            {scenario === "age-of-ai"
              ? "AGE OF AI · 1900—2100 · FIT: 2023—2026"
              : "HUMANITY × TECHNOLOGY · 1900—2100"}
          </p>
          <div className="legend">
            <span className="orange">
              {scenario === "age-of-ai"
                ? "Technology · recent AI forecast"
                : "Technology integration"}
            </span>
            <span className="cyan">
              {scenario === "age-of-ai"
                ? "Human effort · assumed"
                : "Human operational effort"}
            </span>
          </div>
        </header>
        <section
          className={`event-overlay${scenario === "age-of-ai" ? " age-ai-overlay" : ""}`}
          aria-label="Current milestone"
        >
          {event ? (
            <div className="event-detail">
              <div className="eyebrow">
                {event.kind === "future_forecast"
                  ? "ILLUSTRATIVE FORECAST · " +
                    SCENARIO_LABELS[scenario].toUpperCase()
                  : event.kind.replaceAll("_", " ").toUpperCase()}{" "}
                · {dateLabel(event, scenario)}
              </div>
              <h2>{event.title}</h2>
              <div className="category">
                {data?.categories.find((c) => c.id === event.category_id)?.name}
              </div>
              <p>
                {event.kind === "future_forecast"
                  ? event.forecasts?.[scenario].description
                  : event.summary}
              </p>
              {event.kind === "future_forecast" && (
                <p className="uncertainty">
                  Editable assumption · {event.forecasts?.[scenario].confidence}{" "}
                  confidence. {event.forecasts?.[scenario].rationale}
                </p>
              )}
              {event.kind === "future_forecast" && (
                <details className="forecast-assumptions">
                  <summary>Assumptions & limits</summary>
                  <p>{event.forecasts?.[scenario].assumptions}</p>
                </details>
              )}
              <div className="sources">
                {event.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.publisher} ↗
                  </a>
                ))}
              </div>
              {coincident.length > 1 && (
                <label>
                  Same-date milestones
                  <select
                    aria-label="Same-date milestones"
                    value={event.id}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {coincident.map((v) => (
                      <option key={v.e.id} value={v.e.id}>
                        {v.e.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ) : (
            <p className="intro">
              {scenario === "age-of-ai"
                ? "Recent AI progress."
                : "A century of invention."}
              <br />
              {scenario === "age-of-ai"
                ? "A conditional future."
                : "A century of possibilities."}
              <br />
              <span>Scroll to move through time ↓</span>
            </p>
          )}
          <div className="year" data-testid="current-year">
            {new Date(active).getUTCFullYear()}
          </div>
        </section>
        <aside className="disclaimer">
          Two illustrative indices, not empirical measurements.
          <br />A crossing does not mean humans are unnecessary.
          {scenario === "age-of-ai" && (
            <span className="scenario-warning">
              Full history shown; forecast fit uses only 2023–{AGE_AI_AS_OF}.
              Future effort decline is assumed, not observed. Human
              responsibility remains.
              <br />
              Hover or focus Age of AI for methodology.
            </span>
          )}
          {scenario === "exponential" && (
            <span className="scenario-warning">
              Exponential: speculative continuation of a task-horizon trend, not
              a universal law.
              <br />
              Human-role end dates assume institutional change and may never
              occur.{" "}
              <a
                href="https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Evidence ↗
              </a>
            </span>
          )}
        </aside>
        {loading && !visibleData && (
          <div className="state" role="status">
            Loading timeline…
          </div>
        )}
        {error && (
          <div className="state" role="alert">
            <h2>Timeline unavailable</h2>
            <p>{error}</p>
            <button onClick={() => void reload()}>Retry</button>
          </div>
        )}
        <nav className="transport" aria-label="Timeline controls">
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              if (activeRef.current >= END) seek(START);
              setPlaying((p) => !p);
            }}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          <button aria-label="Previous event" onClick={() => jump(-1)}>
            ←
          </button>
          <button aria-label="Next event" onClick={() => jump(1)}>
            →
          </button>
          <label className="seek">
            <span className="sr-only">Seek year</span>
            <input
              aria-label="Seek year"
              type="range"
              min={START}
              max={END}
              step={86400000}
              value={active}
              onChange={(e) => {
                setPlaying(false);
                seek(Number(e.target.value));
              }}
            />
          </label>
          <output>{new Date(active).getUTCFullYear()}</output>
          <label
            className="speed"
            title="Playback speed: years advanced per real second while playing. Does not move time while paused."
          >
            <span className="speed-caption">Speed</span>
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => {
                const value = Number(e.target.value);
                setSpeed(value);
                setSpeedNotice(
                  `Playback speed: ${value} years per second. ${playing ? "Playing at the new speed." : "Paused — press Play to advance time."}`,
                );
              }}
            >
              {[2, 10, 25, 100].map((s) => (
                <option key={s} value={s}>
                  {s} yr/s
                </option>
              ))}
            </select>
          </label>
          <ForecastScenarios scenario={scenario} onChange={changeScenario} />
          <button
            className="military-toggle"
            aria-label="Include military events"
            aria-pressed={military}
            aria-describedby="military-tooltip"
            title={`Military events ${military ? "on" : "off"}`}
            onClick={() => {
              const value = !military;
              setMilitary(value);
              setSelected(null);
              const url = new URL(location.href);
              url.searchParams.set("military", value ? "1" : "0");
              history.replaceState({}, "", url);
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z" />
              <path d="M8 8l8 8m0-8-8 8" />
            </svg>
            <span
              id="military-tooltip"
              className="control-tooltip"
              role="tooltip"
            >
              Military events:{" "}
              {military ? "On — click to hide" : "Off — click to include"}{" "}
              military history and forecasts.
            </span>
          </button>
          <button
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setAdmin(true);
            }}
            aria-label="Manage timeline"
          >
            ⚙
          </button>
        </nav>
        {speedNotice && (
          <div className="playback-notice" role="status">
            {speedNotice}
          </div>
        )}
      </main>
      <div className="scroll-track" aria-hidden="true" />
      {admin && data && (
        <Admin
          scenario={scenario}
          categories={data.categories}
          onClose={() => setAdmin(false)}
          onRefresh={reload}
        />
      )}
    </>
  );
}
