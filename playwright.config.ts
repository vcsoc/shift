import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dataDir = mkdtempSync(join(tmpdir(), "shift-e2e-"));
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
      command:
        "API_PROXY_TARGET=http://127.0.0.1:3101 npx vite --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
