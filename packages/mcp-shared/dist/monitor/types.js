// interlinked-tdd: exempt -- type-only declarations, no runtime surface
/**
 * Monitoring primitive — core types.
 *
 * A monitor = saved query + schedule + diff + materiality + delivery. These
 * types are deliberately serializable: a subscription is persisted in SQLite,
 * so the per-source LOGIC (how to build the query, how to classify a change)
 * lives in a {@link SourceModule} keyed by id — never in the stored row.
 *
 * Row identity is a per-table BUSINESS KEY chosen here, NEVER the staging
 * engine's synthetic auto-increment PK (which is insertion-order and not stable
 * across re-fetches). See docs/design/monitoring-primitive.md §2.2.
 */
export {};
//# sourceMappingURL=types.js.map