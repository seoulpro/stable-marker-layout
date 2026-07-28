import { performance } from "node:perf_hooks";
import process from "node:process";

import { layoutMarkers } from "../src/index.js";

const parsePositiveIntegers = (value, fallback) => {
  if (!value) return fallback;
  const parsed = value
    .split(",")
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
  if (parsed.length === 0) {
    throw new TypeError("sizes must contain positive integers");
  }
  return parsed;
};

const optionValue = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(
    prefix.length,
  );
};

const sizes = parsePositiveIntegers(
  optionValue("sizes"),
  [1_000, 10_000, 50_000],
);
const runs = Number(optionValue("runs") ?? 9);
const warmupRuns = Number(optionValue("warmup") ?? 2);
const json = process.argv.includes("--json");

if (!Number.isInteger(runs) || runs < 1) {
  throw new TypeError("runs must be a positive integer");
}
if (!Number.isInteger(warmupRuns) || warmupRuns < 0) {
  throw new TypeError("warmup must be a non-negative integer");
}

const buildFrame = (count) => {
  const columns = Math.ceil(Math.sqrt(count));
  const spacing = 18;
  const markers = Array.from({ length: count }, (_, index) => ({
    id: `case-${String(index).padStart(6, "0")}`,
    x: 24 + (index % columns) * spacing + ((index * 17) % 3),
    y:
      24 +
      Math.floor(index / columns) * spacing +
      ((index * 29) % 3),
    marker: {
      width: 12 + (index % 3),
      height: 16 + (index % 5),
      anchor: "bottom",
    },
    ...(index % 4 === 0
      ? {
          label: {
            width: 38 + (index % 7) * 4,
            height: 14,
            gap: 2,
          },
        }
      : {}),
    priority: index % 11,
    pinned: index % 997 === 0,
  }));
  const rows = Math.ceil(count / columns);
  return {
    viewport: {
      width: 48 + columns * spacing,
      height: 48 + rows * spacing,
    },
    pressure: 0.72,
    epoch: "benchmark",
    markers,
  };
};

const percentile = (values, fraction) =>
  values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];

const results = [];
for (const size of sizes) {
  const frame = buildFrame(size);
  for (let index = 0; index < warmupRuns; index += 1) {
    layoutMarkers(frame);
  }

  const samples = [];
  let lastResult;
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now();
    lastResult = layoutMarkers(frame);
    samples.push(performance.now() - startedAt);
  }
  samples.sort((a, b) => a - b);
  results.push({
    markers: size,
    runs,
    medianMs: Number(percentile(samples, 0.5).toFixed(3)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(3)),
    minMs: Number(samples[0].toFixed(3)),
    maxMs: Number(samples.at(-1).toFixed(3)),
    visible: lastResult.visible.length,
    hidden: lastResult.hidden.length,
  });
}

const output = {
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  results,
};

if (json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.table(results);
}
