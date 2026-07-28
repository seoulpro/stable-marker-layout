# Security policy

`stable-marker-layout` is an in-memory geometry algorithm. It does not read
files, open network connections, render markup, or execute input as code.

## Reporting a vulnerability

Use the repository's private vulnerability reporting on GitHub (**Security →
Report a vulnerability**). If that is unavailable, open a public issue asking
for a private channel, but do not include reproducing data or sensitive
details in that issue.

Include the affected version, the smallest synthetic input that demonstrates
the problem, the options used, the impact, and a proposed limit or mitigation
when possible.

## Scope

Security-relevant reports include crafted input that causes unbounded resource
use, process failure outside documented validation, state mutation that affects
later calls, or inconsistent validation between one-shot and stateful APIs.

Ordinary placement-quality disagreements are correctness or design issues, not
security issues.

The package validates finite geometry and numeric options, but it does not
impose a universal marker-count or box-size limit. Applications accepting
untrusted input should bound marker counts, boxes per variant, coordinate
ranges, and maximum box extent before calling the engine.
