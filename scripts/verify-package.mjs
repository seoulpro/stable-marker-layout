import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "stable-marker-layout-package-"),
);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout.trim();
};

const runNpm = (args, cwd = root) => {
  const npmExecutable = process.env.npm_execpath;
  return npmExecutable
    ? run(process.execPath, [npmExecutable, ...args], { cwd })
    : run(process.platform === "win32" ? "npm.cmd" : "npm", args, {
        cwd,
      });
};

try {
  const packOutput = runNpm([
    "pack",
    "--json",
    "--pack-destination",
    temporaryDirectory,
  ]);
  const packResult = JSON.parse(packOutput)[0];
  const packageFiles = packResult.files.map((entry) => entry.path);
  const requiredFiles = [
    "package.json",
    "src/index.js",
    "src/index.d.ts",
    "README.md",
    "LICENSE",
  ];

  for (const requiredFile of requiredFiles) {
    if (!packageFiles.includes(requiredFile)) {
      throw new Error(`packed artifact is missing ${requiredFile}`);
    }
  }

  const forbiddenPattern =
    /(^|\/)(?:test|types-test|examples|scripts|node_modules)(?:\/|$)/;
  const forbiddenFile = packageFiles.find((file) =>
    forbiddenPattern.test(file),
  );
  if (forbiddenFile) {
    throw new Error(`packed artifact contains forbidden file ${forbiddenFile}`);
  }

  const tarball = join(temporaryDirectory, packResult.filename);
  const consumer = join(temporaryDirectory, "consumer");
  await writeFile(
    join(temporaryDirectory, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await writeFile(
    join(temporaryDirectory, "smoke.mjs"),
    `
      import {
        createMarkerLayout,
        createPointVariants,
        layoutMarkers,
      } from "stable-marker-layout";

      const variants = createPointVariants({
        marker: { width: 10, height: 10 },
      });
      if (variants[0]?.key !== "marker-only") {
        throw new Error("variant export failed");
      }

      const result = layoutMarkers({
        viewport: { width: 100, height: 100 },
        markers: [{ id: "a", x: 50, y: 50, width: 10, height: 10 }],
      });
      if (result.visible[0]?.id !== "a") {
        throw new Error("layout export failed");
      }

      const session = createMarkerLayout();
      if (session.update({
        viewport: { width: 100, height: 100 },
        markers: [{ id: "b", x: 50, y: 50, width: 10, height: 10 }],
      }).visible[0]?.id !== "b") {
        throw new Error("session export failed");
      }
    `,
  );

  await writeFile(
    join(temporaryDirectory, ".npmrc"),
    "audit=false\nfund=false\n",
  );
  await mkdir(consumer, { recursive: true });
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  runNpm(["install", "--ignore-scripts", tarball], consumer);
  const smokeSource = await readFile(
    join(temporaryDirectory, "smoke.mjs"),
    "utf8",
  );
  run(process.execPath, ["--input-type=module", "--eval", smokeSource], {
    cwd: consumer,
  });
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
