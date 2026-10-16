import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dataDir = mkdtempSync(join(tmpdir(), "shift-e2e-"));
const vitePort = process.env.SHIFT_E2E_VITE_PORT || "5174";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  webServer: [
    {
      command: `npm run build && PORT=3101 DATA_DIR=${dataDir} npm start`,
      url: "http://127.0.0.1:3101/api/v1/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: `API_PROXY_TARGET=http://127.0.0.1:3101 npx vite --host 127.0.0.1 --port ${vitePort} --strictPort`,
      url: `http://127.0.0.1:${vitePort}`,
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
