# Contributing to stable-marker-layout

Issues and focused pull requests are welcome. Please open an issue before a
breaking API change, a new placement heuristic, or a change to default density
policy so the determinism and compatibility effects can be discussed first.
Small correctness fixes can go directly to a pull request.

## Development

The package requires Node.js 20.19 or newer.

```sh
npm ci
npm run check
```

The full gate checks syntax, TypeScript declarations, behavioral tests,
package metadata, and a clean packed-tarball installation.

Performance-sensitive changes should also run `npm run benchmark` and report
median and p95 changes for the synthetic 1,000, 10,000, and 50,000 marker
cases. Do not treat one machine's absolute timing as a compatibility promise.

## Tests

Use synthetic screen coordinates and generic IDs. Do not add identifiable map
data, private service URLs, real user data, local paths, or environment files.

Changes should preserve these invariants:

- equivalent input produces identical output;
- marker and obstacle input order does not affect output;
- every input marker is visible or has one explicit hidden reason;
- regular visible boxes do not collide;
- external obstacles take precedence over markers;
- pinned markers bypass marker collisions and density, but not obstacles;
- failed collision candidates do not consume cell capacity;
- previous choices remain preferred until an epoch or reset boundary;
- input and previous state are not mutated;
- state remains JSON serializable and structured-clone compatible.

Add the smallest regression fixture that demonstrates a bug. Include boundary
cases when a change affects box edges, pressure stops, cell boundaries,
padding, custom anchors, or projection.

## Scope

The core stays independent of rendering frameworks, map SDKs, coordinate
systems, text measurement, networking, and product-specific data. Optional
integration features should preserve that boundary.

Contributions are made under the [MIT license](./LICENSE). See
[SECURITY.md](./SECURITY.md) for private vulnerability reporting.
