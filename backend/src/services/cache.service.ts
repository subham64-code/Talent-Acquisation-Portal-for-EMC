import { invalidatePattern } from "../lib/cache";

/**
 * Centralised cache invalidation helpers.
 * Every write path calls these so the dashboard, databank and career pages
 * always reflect the latest database state.
 */
export const cache = {
  /** Called whenever a vacancy is created, edited, published or closed. */
  async openingsChanged() {
    await Promise.all([
      invalidatePattern("emc:openings:*"),
      // Covers both career openings and the cached department dropdown, which
      // would otherwise stay stale until its full TTL after a department change.
      invalidatePattern("emc:career:*"),
      invalidatePattern("emc:dashboard:*"),
      invalidatePattern("emc:applications:*"),
    ]);
  },

  /** Called whenever an application is created or changes stage. */
  async applicationsChanged() {
    await Promise.all([
      invalidatePattern("emc:applications:*"),
      invalidatePattern("emc:dashboard:*"),
      invalidatePattern("emc:databank:*"),
      invalidatePattern("emc:career:openings:*"),
      invalidatePattern("emc:openings:*"),
    ]);
  },

  /** Called whenever employees/candidates change. */
  async peopleChanged() {
    await Promise.all([
      invalidatePattern("emc:databank:*"),
      invalidatePattern("emc:dashboard:*"),
      invalidatePattern("emc:employees:*"),
      invalidatePattern("emc:candidates:*"),
    ]);
  },

  /** Called when offers or documents move. */
  async offersChanged() {
    await Promise.all([
      invalidatePattern("emc:dashboard:*"),
      invalidatePattern("emc:offers:*"),
      invalidatePattern("emc:documents:*"),
      invalidatePattern("emc:applications:*"),
    ]);
  },

};
