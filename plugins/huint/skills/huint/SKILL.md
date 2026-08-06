---
name: huint
description: Use when the user asks Claude to work with Huint photo tasks — verify the Huint MCP connection, resolve a real-world place, create exact-GPS photo tasks, inspect operator-scoped task status, or review tasker photo submissions.
---

# Huint

Huint sends real people to an exact GPS coordinate to photograph something, then
verifies GPS proximity (and optionally an AI vision gate) before releasing a
bounty. This plugin wires Claude to the hosted MCP server at
`https://mcp.huint.io/mcp`; Claude handles Supabase OAuth through the MCP client.

`get_capabilities` is Huint's live domain reference (spec version, schemas,
rejection codes, cancellation rules, the `agent_playbook`) — not an MCP
discovery requirement. Claude already gets tool names and schemas from MCP. Call
`get_capabilities` at the start of a Huint workflow when the contract is not
already in context, or when you need policy details. Do not guess field names
from memory.

## Startup

1. Call `get_connection_status` when the user asks whether Huint is connected,
   after re-auth, or before a workflow that depends on live credentials. Expect
   `ok: true` and an active operator.
2. Call `get_capabilities` once at the start of a workflow when the contract is
   not in context.

## Creating a task

1. Resolve the place first with `resolve_location` (free text) or
   `reverse_geocode` (lat/lng).
2. Do not treat `location_resolution_confidence` as a match-quality score —
   Huint emits `1` for any accepted provider result, including a plausible
   but wrong building or a reverse-geocode that drifted onto the wrong block.
   A resolver payload's confidence field does not tell you it found the right
   place, only that the provider returned *a* place. Before using the result,
   sanity-check it yourself:
   - Free-text query: does `friendly_location_name` / `formatted_address`
     match the specific place you asked for (same street address, same
     store), not just the same brand or neighborhood?
   - Known coordinates: does the resolved `lat`/`lng` land close to the input
     pin, and does `formatted_address` include a street line? A multi-hundred-
     meter drift or a zip-level-only address is a bad resolution even at
     confidence 1.
   - When in doubt, call `quote_task` first — it resolves the pin server-side
     and returns `resolved_location` for you to review before any money moves.
   If the resolved place doesn't match what you know to be true, don't pass it
   through — use the known-good address/place name or raw `lat`/`lng`
   directly as `location` instead of the resolver payload.
3. Pass the sanity-checked resolver payload to `create_task` as `location`
   **verbatim** — do not rewrite `friendly_location_name`, `formatted_address`,
   or `google_place_id`. The create schema requires fields only the resolvers
   produce, so this ordering is enforced when you do use the resolver output.
4. Choose a stable `agent_task_id` and reuse it on retries — Huint returns the
   existing task instead of charging twice.
5. `create_task` debits operator escrow up front. Confirm the material details
   with the operator before calling it: location, bounty, deadline, photo count,
   and instructions.

## Reviewing submissions

1. Poll `list_pending_reviews({ all_agents: true })` for a lightweight queue.
2. Use `get_task_submissions` for metadata, verification flags, and signed URLs.
3. Use `get_submission_image` / `get_submission_images` when you need to see the
   photos before deciding.
4. Accept only when the photos satisfy the task. Reject only with one of the
   judgment codes from `get_capabilities`; do not reject for GPS, timestamp,
   device, or photo-count issues — upload already enforces those.

## Money & safety

These tools move real money or lifecycle state — always confirm with the
operator before calling, and never auto-run them:

- `create_task`, `cancel_task`, `accept_submission`, `reject_submission`.

Image tools (`get_submission_image`, `get_submission_images`) expose private
tasker media — surface them deliberately, not by default.

Read-only tools are safe to run when the user has asked you to inspect Huint
work: `get_connection_status`, `get_capabilities`, `resolve_location`,
`reverse_geocode`, `get_task_status`, `list_my_tasks`, `list_pending_reviews`,
`get_task_submissions`, `get_task_result`.

## Errors

Failures return `{ error_code, message, retriable, request_id }`. Surface
`error_code` and `request_id` to the operator. Do not retry validation failures
(e.g. `missing_resolved_location`, `invalid_*`). For `task_not_found`, retry
with `all_agents: true` only if the operator intends cross-agent access.

## Auth

OAuth is the normal path — no API key needed. If Huint disconnects, re-run
`/mcp` → Authenticate in Claude Code (or reconnect the connector in Claude
Desktop / claude.ai), then call `get_connection_status`. Don't ask the user to
paste a Supabase JWT or Huint API key unless they explicitly want a direct
server integration.
