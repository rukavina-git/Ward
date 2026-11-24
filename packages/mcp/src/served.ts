/**
 * The IDs whose full text Ward served the agent in this server process
 * (get_check now; the skeleton later). write_report uses it to set each
 * agent answer's depth in code (ADR 0013). One process per agent
 * session; a restart forgets, which marks answers "title only": the
 * safe side.
 */
const served = new Set<string>();

export function markServed(id: string): void {
  served.add(id);
}

export function servedIds(): ReadonlySet<string> {
  return served;
}

/** For tests. */
export function resetServed(): void {
  served.clear();
}
