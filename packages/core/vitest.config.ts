import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // These are integration tests against one real, shared Postgres instance, and several
    // services touch global (non-entity-scoped) tables - ticket_field_definitions,
    // notification_templates, and the sweep functions (runSlaEscalationSweep,
    // runRecurringTicketsSweep) scan the whole DB rather than a single entity. Running test
    // files in parallel worker threads would let one file's temporary global mutations (e.g. a
    // required custom field defined for ticketType "incident") bleed into another file's
    // assertions. Sequential file execution trades some wall-clock time for correctness here.
    fileParallelism: false,
  },
});
