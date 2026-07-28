import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const runInChild = (source) =>
  spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: root,
    encoding: "utf8",
    timeout: 1_000,
  });

const assertRejectedWithoutTimeout = (result, pattern) => {
  assert.notEqual(result.error?.code, "ETIMEDOUT");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, pattern);
};

test("unsafe box-index grids fail without unbounded iteration", () => {
  const cases = [
    {
      source: `
        import { createBoxIndex } from "./src/geometry.js";
        const index = createBoxIndex({ cellSize: Number.MIN_VALUE });
        index.add({ left: 0, top: 0, right: 1, bottom: 1 }, "value");
      `,
      pattern: /safe integer range/,
    },
    {
      source: `
        import { createBoxIndex } from "./src/geometry.js";
        const index = createBoxIndex({ cellSize: 1 });
        index.add({
          left: 9007199254740992,
          top: 0,
          right: 9007199254740994,
          bottom: 1,
        }, "value");
      `,
      pattern: /safe integer range/,
    },
    {
      source: `
        import { layoutMarkers } from "./src/index.js";
        layoutMarkers({
          viewport: { width: 100, height: 100 },
          markers: [
            { id: "a", x: 50, y: 50, width: 10, height: 10 },
          ],
        }, {
          boxIndexCellSize: Number.MIN_VALUE,
        });
      `,
      pattern: /safe integer range/,
    },
  ];

  for (const entry of cases) {
    assertRejectedWithoutTimeout(runInChild(entry.source), entry.pattern);
  }
});
