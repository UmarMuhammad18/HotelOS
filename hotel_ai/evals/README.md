# LLM eval suite

Catches the kind of quality regression that unit tests can't see — wrong
department picked, repeat complaint not escalated, "smoke in bathroom"
treated as routine, Spanish reply that translates department names along
with the message.

## How it works

1. **Fixtures** live in `evals/fixtures/*.yaml`. Each fixture is a list of
   *cases*. A case has 1+ `events` (each with a guest message text) and a
   set of `expect:` assertions.
2. **Runner** (`evals/runner.py`) loads a fixture, builds a fresh
   `Orchestrator` + `GuestMemory` (per case), and feeds each event through
   `orch.build_plan(...)` against a real LLM.
3. **Scorer** (`evals/scoring.py`) turns the `expect:` block into one
   `CheckResult` per assertion. Unknown assertion keys produce a *failed*
   check rather than silently passing — so typos are loud.
4. **Entry point** (`scripts/run_evals.py`) writes a markdown + JSON report
   and exits non-zero if any case failed.

Real-LLM-only mode for now. Set `GROQ_API_KEY` (or whatever provider
`app/llm/client.py:build_llm()` selects) before running.

## Running

From `frontend/hotel_ai/`:

```bash
# All fixtures
python scripts/run_evals.py

# Just routing
python scripts/run_evals.py --fixture routing

# Just multilingual + safety
python scripts/run_evals.py --fixture multilingual --fixture safety
```

Reports land in `evals/report.md` and `evals/report.json` by default.

## Fixture schema

```yaml
cases:
  - id: short_unique_id
    description: One-line human-readable summary
    guest_language: en          # ISO-ish; defaults to 'en'
    vip: false                  # optional
    room_number: "412"          # optional
    events:
      - text: "guest message"
        expect:                 # per-event expectations (optional)
          agent_includes: [maintenance]
    expect:                     # case-level expectations apply to FINAL plan
      reply_locale: en
      emergency: false
```

### Supported assertions

| Key                  | Meaning                                                     |
|----------------------|-------------------------------------------------------------|
| `agent_includes`     | every listed dept appears in dispatched agents (derived from `plan.events[*].agent`) |
| `agent_excludes`     | none of the listed depts appear                             |
| `priority_at_most`   | `plan.priority` ≤ given (low<normal<high<urgent)            |
| `priority_at_least`  | `plan.priority` ≥ given                                     |
| `emergency`          | `plan.emergency` matches given bool (also true if `plan.priority` is `urgent`/`emergency`) |
| `reply_locale`       | `plan.guest_reply.locale` matches                           |
| `reply_in_language`  | `langdetect(reply.message)` == given (needs `langdetect`)   |
| `tool_called`        | a `MemoryUpdate` with the given `kind` was emitted          |
| `reply_contains`     | reply.message contains all substrings (case-insensitive)    |
| `reply_excludes`     | reply.message contains none of the substrings               |
| `intent`             | `plan.intent` matches                                       |
| `sentiment`          | `plan.sentiment` matches                                    |
| `min_actions`        | `len(plan.actions) >= n`                                    |
| `max_actions`        | `len(plan.actions) <= n`                                    |

## Adding a new case

1. Pick the most specific fixture (`routing`, `priority`, `multilingual`,
   `safety`) — or add a new fixture file if it's a new category.
2. Add a case with the smallest set of assertions that distinguishes
   "right" from "wrong". Over-specifying makes the suite brittle.
3. Run that fixture in isolation: `python scripts/run_evals.py --fixture <name>`.

## Cost note

Each event = 1 classification call + (for non-English) 1 translation call.
At ~25 cases × ~1.2 events × 1.5 calls ≈ **45 LLM calls** per full run.
On Groq's `llama-3.1-8b-instant` that's roughly free; on a paid model,
cap fixture growth or add a `--fixture` filter to PR-time runs.
