# Vendored source: omkarcloud/google-maps-scraper

- Upstream: https://github.com/omkarcloud/google-maps-scraper
- License: MIT (preserved as-is under `vendor/LICENSE` — do not remove)
- Pinned commit: TODO — fill in once vendored (`git submodule` or a source
  snapshot copied into `vendor/`, not a live `pip install` from `main`)
- Pinned date: TODO
- Local modifications: none. Any Jamot-specific behavior lives in
  `../index.ts` (this wrapper), never patched into the vendored source
  directly — that keeps upstream updates a clean re-vendor instead of a merge.

## Re-vendoring

1. Check out the new commit from upstream.
2. Diff it against the currently vendored copy to confirm nothing beyond
   version bumps changed in ways that affect the wrapper's assumptions
   (CLI flags, output schema, exit codes).
3. Update the pinned commit and date above.
4. Re-run the pilot (see the worker README, "Pilot") before treating the new
   pin as production-ready.
