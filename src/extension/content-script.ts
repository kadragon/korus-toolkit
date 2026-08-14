/**
 * Content-script entry point. KORUS integration starts only after an observed
 * page-state contract is available.
 */
export function startContentScript(): void {
  // Intentionally empty: the installable scaffold must not mutate KORUS pages.
}

startContentScript();
