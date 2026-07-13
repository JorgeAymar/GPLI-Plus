# Graph Report - .  (2026-07-10)

## Corpus Check
- Corpus is ~1,536 words - fits in a single context window. You may not need a graph.

## Summary
- 38 nodes · 51 edges · 8 communities (6 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 114,168 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Clean-Room Scaffold & Late Phases|Clean-Room Scaffold & Late Phases]]
- [[_COMMUNITY_Asset Data Layer|Asset Data Layer]]
- [[_COMMUNITY_ITIL Helpdesk Engine|ITIL Helpdesk Engine]]
- [[_COMMUNITY_Core Roadmap Phases 1-4|Core Roadmap Phases 1-4]]
- [[_COMMUNITY_RBAC Concepts & UITesting Stack|RBAC Concepts & UI/Testing Stack]]
- [[_COMMUNITY_Authentication & Users|Authentication & Users]]
- [[_COMMUNITY_Administration & Data Pattern|Administration & Data Pattern]]
- [[_COMMUNITY_RBAC Tables & User Model|RBAC Tables & User Model]]

## God Nodes (most connected - your core abstractions)
1. `Administration Module` - 6 edges
2. `ITIL Tables` - 6 edges
3. `Assistance / Helpdesk Module` - 5 edges
4. `Asset Framework Tables` - 5 edges
5. `Entity (concept)` - 4 edges
6. `Profile (concept)` - 4 edges
7. `Asset Definition (framework)` - 4 edges
8. `Phase 0 — Scaffold` - 4 edges
9. `Assets Module` - 3 edges
10. `Setup Module` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Asset Definition (framework)` --semantically_similar_to--> `ITIL Tables`  [INFERRED] [semantically similar]
  architecture-plan.md → architecture-plan.md  _Bridges community 1 → community 2_
- `Phase 2 — Asset Management` --implements--> `Assets Module`  [EXTRACTED]
  architecture-plan.md → architecture-plan.md  _Bridges community 1 → community 3_
- `Phase 3 — Helpdesk/ITIL` --implements--> `Assistance / Helpdesk Module`  [EXTRACTED]
  architecture-plan.md → architecture-plan.md  _Bridges community 2 → community 3_
- `Administration Module` --references--> `Entity (concept)`  [EXTRACTED]
  architecture-plan.md → architecture-plan.md  _Bridges community 6 → community 4_
- `Administration Module` --references--> `User (concept)`  [EXTRACTED]
  architecture-plan.md → architecture-plan.md  _Bridges community 6 → community 7_

## Hyperedges (group relationships)
- **ITIL entity family sharing satellites (actors, timeline, tasks, costs, approvals)** — architecture_plan_ticket, architecture_plan_problem, architecture_plan_change, architecture_plan_itil_tables [EXTRACTED 1.00]
- **Phase 0 + Phase 1 immediate concrete increment** — architecture_plan_phase_0, architecture_plan_phase_1, architecture_plan_entities_table_group, architecture_plan_users_auth_table_group, architecture_plan_rbac_tables, architecture_plan_administration_module [EXTRACTED 1.00]
- **RBAC multi-entity/multi-profile permission system** — architecture_plan_profile_concept, architecture_plan_entity_concept, architecture_plan_rbac_tables, architecture_plan_administration_module [INFERRED 0.85]
- **Shared packages/core service layer stack decisions** — architecture_plan_drizzle_orm, architecture_plan_authjs, architecture_plan_server_actions_components, architecture_plan_pg_boss, architecture_plan_storage_adapter [INFERRED 0.75]
- **Cross-cutting mechanisms reused across asset/ITIL/storage subsystems** — architecture_plan_cross_cutting_tables, architecture_plan_asset_framework_tables, architecture_plan_itil_tables, architecture_plan_storage_adapter [INFERRED 0.80]

## Communities (8 total, 2 thin omitted)

### Community 0 - "Clean-Room Scaffold & Late Phases"
Cohesion: 0.22
Nodes (9): Clean-Room Reimplementation Approach, GLPI (source project), pnpm workspaces + Turborepo, On-Prem Docker Deployment, Phase 0 — Scaffold, Phase 5 — Tools, Phase 6 — Advanced/Parity, Setup Module (+1 more)

### Community 1 - "Asset Data Layer"
Cohesion: 0.33
Nodes (7): Asset Definition (framework), Asset Framework Tables, Assets Module, Cross-Cutting Tables, Drizzle ORM, Entities Table Group, Storage Adapter

### Community 2 - "ITIL Helpdesk Engine"
Cohesion: 0.53
Nodes (6): Assistance / Helpdesk Module, Change, ITIL Tables, pg-boss, Problem, Ticket

### Community 3 - "Core Roadmap Phases 1-4"
Cohesion: 0.4
Nodes (5): Management Module, Phase 1 — Foundation, Phase 2 — Asset Management, Phase 3 — Helpdesk/ITIL, Phase 4 — Management

### Community 4 - "RBAC Concepts & UI/Testing Stack"
Cohesion: 0.5
Nodes (4): Entity (concept), Profile (concept), Tailwind + shadcn/ui, Vitest / Playwright

### Community 5 - "Authentication & Users"
Cohesion: 0.67
Nodes (3): Auth.js v5, Group (concept), Users/Auth Table Group

## Knowledge Gaps
- **8 isolated node(s):** `Tools Module`, `Auth.js v5`, `Tailwind + shadcn/ui`, `Server Actions / Server Components`, `pg-boss` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Administration Module` connect `Administration & Data Pattern` to `Core Roadmap Phases 1-4`, `RBAC Concepts & UI/Testing Stack`, `Authentication & Users`, `RBAC Tables & User Model`?**
  _High betweenness centrality (0.320) - this node is a cross-community bridge._
- **Why does `Phase 1 — Foundation` connect `Core Roadmap Phases 1-4` to `Clean-Room Scaffold & Late Phases`, `Administration & Data Pattern`?**
  _High betweenness centrality (0.263) - this node is a cross-community bridge._
- **Why does `Phase 0 — Scaffold` connect `Clean-Room Scaffold & Late Phases` to `Core Roadmap Phases 1-4`?**
  _High betweenness centrality (0.258) - this node is a cross-community bridge._
- **What connects `Tools Module`, `Auth.js v5`, `Tailwind + shadcn/ui` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._