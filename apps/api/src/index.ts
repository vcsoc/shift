import { openDatabase } from "./db";
import { seed } from "./seed";
import { createServer } from "./server";
const host = process.env.HOST || "127.0.0.1";
if (!["127.0.0.1", "localhost", "::1"].includes(host))
  throw new Error(
    "Public binding is disabled: configure authentication before exposing admin writes.",
  );
const db = openDatabase();
seed(db);
const app = createServer(db);
await app.listen({ port: Number(process.env.PORT || 3001), host });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    db.close();
    process.exit(0);
  });
