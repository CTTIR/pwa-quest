# Field-use maintenance review — 2026-11-04

Baseline: public main `101eefb6f5e31fdafefec59becace55cd5aea0c4`.
The original clean checkout was preserved; implementation uses an isolated worktree.

## Purpose and acceptance criteria

This is a small offline questionnaire demonstration, not a validated scientific
instrument or a multi-user research database. A dependable release must preserve
participant answers through ordinary navigation and offline reload, refuse
incompatible saved data without silently discarding it, report storage failures,
produce interoperable exports, and only report clearing after durable deletion.
No server upload, authentication system, or speculative platform rewrite is needed.

## Findings and roadmap

1. **Essential data-integrity repairs.** Baseline probes reproduced acceptance of
   eight invalid answer shapes, invalid stored indices/scenarios, an old queued
   save restoring a cleared participant, early transaction-success reporting, and
   swallowed deletion errors. Repair validation, session compatibility and the
   ordering/commit boundary together; validate with deterministic transaction and
   delayed-save regression tests.
2. **Dependable field use.** Show persistent errors and explicit retry/recovery;
   retain in-memory responses on failure. Validate offline completion, resume,
   all downloads and clearing in a production-browser test. Keep typed archival
   JSON available beyond QR capacity. Refuse invalid XML rather than losing data;
   neutralize spreadsheet formula prefixes in CSV with the change documented.
3. **Maintainability and distribution.** Add meaningful test CI and migrate the
   unsupported vulnerable build toolchain. Check the production subpath build,
   dependency audit and documentation against actual behavior.
4. **Outside this increment.** Multi-tab editing, encrypted storage, server sync,
   multi-QR protocols, native-device camera/share qualification and scientific
   validation require separate designs or domain evidence. One tab per device is
   the supported operating procedure. A repository-wide license remains an owner
   decision; no redistribution grant is invented.

## Dependency assessment

The initial npm audit reported 24 findings, including nine high-severity findings.
The Vite 8 / PWA 2 toolchain and compatible lockfile updates remove all high and
critical findings. The production dependency audit reports zero findings.
Ten low/moderate findings remain in Workbox build dependencies (deepmerge,
minimatch/glob and their dependents). They process the trusted local build tree,
not participant data in the browser. Avoid forced downgrade or unverified major
transitive overrides; recheck on upstream releases. This is a bounded exposure
assessment, not a claim of absence of vulnerabilities.

Migration references: [Vite migration](https://vite.dev/guide/migration),
[Vite PWA guide](https://vite-pwa-org.netlify.app/guide/).

## Verification

Clean `npm ci` on Node 24 succeeds. The final local run passes 41 unit tests,
the TypeScript/production subpath build, three Chromium browser journeys and
actionlint. The browser journeys exercise offline completion/resume, all five
file downloads, a failed download followed by retry, incompatible saved data,
failed clearing without data loss, successful durable clearing and camera-denial
fallback. The 390-pixel export view was visually inspected with no horizontal
overflow. Production dependency audit: zero findings. The service worker caches
20 assets, including the lazy scanner, QR and XLSX chunks.

The first browser harness run failed because preview used a different base path
from the build; matching its environment fixed the actual 404, without changing
the app or suppressing an error. An earlier mid-edit build was not a qualified
candidate. These logs are retained with the final successful evidence under
`.repository-audits/cttir-public-20261030/evidence/pwa-quest`.

Hosted checks and Pages publication are pending at this source checkpoint.
Physical-camera scanning, native file sharing, full accessibility conformance,
concurrent tabs and power-loss durability have not been qualified. The license
choice remains necessary before a general open-source distribution claim.
