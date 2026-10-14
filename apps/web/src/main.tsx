import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/main.css";
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Timeline rendering failed", error);
  }
  render() {
    return this.state.failed ? (
      <div className="state" role="alert">
        <h1>Something went wrong</h1>
        <p>The timeline could not render. Your saved data is safe.</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
