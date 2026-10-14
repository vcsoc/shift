import { useCallback, useEffect, useRef, useState } from "react";
import { Graph } from "./components/Graph";
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
} from "../../../packages/shared/src/model";
export function App() {
  const [scenario, setScenario] = useState<Scenario>(
    new URLSearchParams(location.search).get("scenario") === "accelerated"
      ? "accelerated"
      : "baseline",
  );
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
      const d = await fetchTimeline(scenario);
      if (v === version.current) setData(d);
    } catch (e) {
      if (v === version.current) setError((e as Error).message);
    } finally {
      if (v === version.current) setLoading(false);
    }
  }, [scenario]);
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
  const dated = (data?.events || [])
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
        {data && !error && (
          <Graph
            data={data}
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
          <p>HUMANITY × TECHNOLOGY · 1900—2100</p>
          <div className="legend">
            <span className="orange">Technology integration</span>
            <span className="cyan">Human operational effort</span>
          </div>
        </header>
        <section className="event-overlay" aria-label="Current milestone">
          <div className="year" data-testid="current-year">
            {new Date(active).getUTCFullYear()}
          </div>
          {event ? (
            <div className="event-detail">
              <div className="eyebrow">
                {event.kind === "future_forecast"
                  ? "ILLUSTRATIVE FORECAST · " + scenario.toUpperCase()
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
              A century of invention.
              <br />A century of possibilities.
              <br />
              <span>Scroll to move through time ↓</span>
            </p>
          )}
        </section>
        <aside className="disclaimer">
          Two illustrative indices, not empirical measurements.
          <br />A crossing does not mean humans are unnecessary.
        </aside>
        {loading && !data && (
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
          <label className="speed">
            <span className="sr-only">Playback speed</span>
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[2, 10, 25, 100].map((s) => (
                <option key={s} value={s}>
                  {s} yr/s
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" aria-label="Forecast scenario">
            {(["baseline", "accelerated"] as Scenario[]).map((s) => (
              <button
                key={s}
                aria-pressed={scenario === s}
                onClick={() => changeScenario(s)}
              >
                {s === "baseline" ? "Baseline" : "Accelerated"}
              </button>
            ))}
          </div>
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
