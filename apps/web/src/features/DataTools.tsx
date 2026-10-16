import { useState } from "react";
import { Category } from "../../../../packages/shared/src/model";
import { Field } from "../components/Field";
import { api } from "../lib/api";
export type RunAction = (
  action: () => Promise<unknown>,
  refresh?: boolean,
) => Promise<boolean>;
export function DataTools({
  busy,
  backups,
  categories,
  run,
}: {
  busy: boolean;
  backups: string[];
  categories: Category[];
  run: RunAction;
}) {
  const [importText, setImportText] = useState(""),
    [preview, setPreview] = useState<unknown>(null),
    [backup, setBackup] = useState(""),
    [newCategory, setNewCategory] = useState(""),
    [creating, setCreating] = useState(false);
  return (
    <section className="data-tools">
      <h3>Export / import</h3>
      <p>
        Import is an atomic replacement. Duplicate IDs are reported in preview;
        commit explicitly replaces current records. Export first.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const data = await api("/export");
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "the-shift-export.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }, false)
        }
      >
        Export JSON
      </button>
      <label>
        Import JSON file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              setImportText(await file.text());
              setPreview(null);
            }
          }}
        />
      </label>
      <Field
        label="Import JSON"
        type="textarea"
        value={importText}
        onChange={(v) => {
          setImportText(v);
          setPreview(null);
        }}
      />
      <button
        disabled={busy}
        onClick={() =>
          void run(
            async () =>
              setPreview(
                await api("/import/preview", "POST", JSON.parse(importText)),
              ),
            false,
          )
        }
      >
        Dry-run preview
      </button>
      {preview !== null && (
        <>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
          <button
            disabled={busy}
            onClick={() => {
              if (confirm("Replace ALL current data with this import?"))
                void run(() =>
                  api("/import/commit", "POST", {
                    confirm: "REPLACE",
                    data: JSON.parse(importText),
                  }),
                );
            }}
          >
            Commit replacement
          </button>
        </>
      )}
      <h3>SQLite backups</h3>
      <p>
        Uses the SQLite backup API. Restore checks integrity and validates data
        before replacing records. Files are stored in your local data directory.
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setCreating(true);
          try {
            await run(async () => {
              const b = await api<{ name: string }>("/admin/backup", "POST");
              setBackup(b.name);
            });
          } finally {
            setCreating(false);
          }
        }}
      >
        {creating ? "Creating backup…" : "Create backup"}
      </button>
      <label>
        Available backups
        <select
          aria-label="Available backups"
          value={backup}
          onChange={(e) => setBackup(e.target.value)}
        >
          <option value="">Choose backup</option>
          {backups.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <button
        disabled={busy || !backup}
        onClick={() => {
          if (
            confirm(
              "Restore this backup and replace ALL current timeline data?",
            )
          )
            void run(() =>
              api("/admin/restore", "POST", {
                name: backup,
                confirm: "RESTORE",
              }),
            );
        }}
      >
        Restore backup
      </button>
      <h3>Managed categories</h3>
      <Field
        label="New category name"
        value={newCategory}
        onChange={setNewCategory}
      />
      <button
        disabled={busy || !newCategory.trim()}
        onClick={() =>
          void run(() =>
            api("/categories", "POST", { name: newCategory, parent_id: null }),
          )
        }
      >
        Add category
      </button>
      <p>{categories.map((c) => c.name).join(" · ")}</p>
    </section>
  );
}
