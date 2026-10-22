# Checked tooling glob adapter

This private package replaces the vulnerable `fast-glob → micromatch → braces`
chain with the project's existing, pinned `tinyglobby`. It supports the actual
installed Next lint caller (`globSync` with `onlyDirectories`) and Vite dynamic
import caller (`sync` with `cwd`), plus the corresponding callable async export.
Both CommonJS and ESM consumers are exercised by `npm run check:glob-tooling`.

This is a bounded adapter for these checked callers. It is not a complete
implementation of fast-glob's stream/stat/task API. Unreviewed options, mixed
absolute/relative patterns, padded/stepped ranges and excessive nesting are
rejected. Directory expansion is disabled to retain fast-glob behavior; absolute
input preserves absolute output unless explicitly overridden.

The root `file:` dependency and `$fast-glob` override install the same code for
both consumers, including fresh CI/Docker installs. The Docker dependency stage
must copy this directory before `npm ci`. Keep the security audit enabled and
rerun the consumer checks, lint and both relevant builds when updating these
tooling consumers. No security finding is ignored or waived.
