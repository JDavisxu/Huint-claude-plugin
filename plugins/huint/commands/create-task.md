---
description: Create a Huint exact-GPS photo task (resolves the location first)
argument-hint: [place or address] — what to photograph
---

Create a Huint photo task for: $ARGUMENTS

Follow the Huint flow strictly:

1. Resolve the place with `resolve_location` (or `reverse_geocode` if given
   coordinates). Do not invent the location fields.
2. Sanity-check the resolved place before trusting it —
   `location_resolution_confidence` is emitted as `1` for any accepted
   provider result, not a measure of whether it's the *right* result. Compare
   `friendly_location_name` / `formatted_address` against the specific place
   requested, and if coordinates were given, check the resolved `lat`/`lng`
   isn't drifted and `formatted_address` has a real street line. If it looks
   wrong, use the known-good address or raw coordinates instead of the
   resolver payload, and say so when summarizing back to me.
3. Summarize the proposed task back to me and **wait for my confirmation** of
   the location, bounty, photo count, deadline, and instructions — `create_task`
   debits operator escrow up front.
4. On confirmation, call `create_task` with the resolver payload passed through
   as `location` verbatim and a stable `agent_task_id`.
5. Report the returned `task_id`, pricing, and whether it was an idempotent
   replay.

If anything is ambiguous (which location, how much bounty), ask before creating.
