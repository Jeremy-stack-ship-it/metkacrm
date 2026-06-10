# AI Field Ops Agent — Spec
Created: 2026-05-29
Status: BACKLOG — do not build until Phase Engine + reporting are polished

---

## What it is
A chat panel inside the CRM powered by the Claude API. The AI has read access to Jeremy's lead data and can propose write actions (notes, callbacks, dispositions, sequence enrollment) that Jeremy confirms before they execute. No action fires without explicit approval.

## The one rule that makes it safe
**AI proposes → Jeremy approves → CRM executes.**
Every write action shows a confirmation card. Jeremy hits confirm or cancel. The AI never touches data autonomously.

---

## User Experience

### Where it lives
Floating chat panel — toggle button in the NavSidebar (e.g. 🤖 icon). Slides in from the right, overlays the current view. Closeable. Does not interrupt the dialer.

### What Jeremy can say to it
- "Who in my queue today hasn't been called?" → read, instant
- "Log a follow-up note on Lance Coleman — called, needs to think about it. Set callback Monday." → shows confirmation card, Jeremy approves
- "What's my dial count today?" → read, instant
- "Enroll all this week's no-shows in the cat2 sequence" → finds them, shows list, confirms before touching
- "Write me an objection handler for someone who says they can't afford it" → pure text, no CRM action
- "What phase is Susan Smith in and when's her next dial?" → read, instant

---

## Tool Definitions (what the AI can call)

### Read-only tools (no confirmation needed)
| Tool | Description | Data passed |
|------|-------------|-------------|
| `get_lead` | Look up a lead by name or phone | Searches leads array, returns full lead object |
| `get_today_stats` | Pull dial/contact/appointment counts for today | Reads activity log |
| `get_queue` | Return today's dial queue | Filtered leads due today |
| `get_lead_notes` | Pull note history for a specific lead | lead.notes array |
| `get_leads_by_filter` | Filter leads by disposition, stage, bucket, phase | Returns matching leads |
| `get_sequence_status` | Check sequence enrollment and step for a lead | seqTrack, seqStep, seqPaused, etc. |
| `get_uw_pipeline` | List leads in underwriting with days stuck | UW_ACTIVE_STAGES leads |

### Write tools (ALWAYS show confirmation card before executing)
| Tool | Description | Confirmation text |
|------|-------------|-------------------|
| `log_note` | Add a note to a lead | "Add note to [Name]: [text]" |
| `set_callback` | Set nextCallback datetime on a lead | "Set callback for [Name] → [date/time]" |
| `update_disposition` | Fire a disposition on a lead | "Set [Name] disposition → [dispId]" |
| `enroll_sequence` | Enroll lead(s) in an email sequence | "Enroll [N leads] in [track] sequence" |
| `pause_sequence` | Pause a lead's sequence | "Pause sequence for [Name]" |

### Never exposed
- `delete_lead` — never
- `bulk_disposition` — too dangerous without per-lead review
- Any Supabase direct access

---

## Architecture

### API call flow
```
User types message
  → Bundle context (current lead if open, today stats, recent notes)
  → POST to Claude API with:
      - System prompt (CRM context, who Jeremy is, tool definitions)
      - Conversation history
      - Tool schemas
  → Claude responds with text OR a tool_use block
  → If tool_use:
      - Read tools: execute immediately, pass result back to Claude
      - Write tools: show ConfirmationCard → await Jeremy's approval
          - Approved: execute CRM function, pass result back to Claude
          - Cancelled: pass "action cancelled by user" back to Claude
  → Claude continues conversation with result
```

### Key files to create
| File | Purpose |
|------|---------|
| `src/components/AgentPanel.jsx` | Chat UI — messages, input, confirmation cards |
| `src/lib/agentTools.js` | Tool definitions (schemas) + executor functions |
| `src/lib/agentClient.js` | Claude API call wrapper, conversation history management |
| `src/lib/agentContext.js` | Builds the system prompt + context bundle from current CRM state |

### Context bundle passed per message
```js
{
  today: { dials, contacts, appointments, appsThisWeek },
  currentLead: open ? { name, phone, bucket, phase, disposition, notes: last5, nextCallback } : null,
  queue: { total: todayCount, slot: activeSession?.id },
  agent: { name: "Jeremy Metka", npn: "21425108", states: [...], carriers: [...] }
}
```

### API key handling
`VITE_CLAUDE_API_KEY` in `.env.local` (gitignored). Acceptable for local-only tool — same exposure profile as Supabase anon key. If CRM ever deploys publicly, move to a Supabase Edge Function proxy.

### Model
`claude-haiku-4-5-20251001` for fast, cheap responses during dialing sessions.
Fallback to `claude-sonnet-4-6` for complex multi-step tool chains.

---

## System prompt (draft)
```
You are the AI Field Ops Agent for Jeremy Metka, Senior Household Protection Advisor at Ministry of Protection. 

You have access to Jeremy's CRM data and tools to help him during dialing sessions. Your job is to make him faster and more effective — answer questions about his leads, help him craft scripts and notes, and take actions on his behalf when asked.

RULES:
- Write actions (notes, callbacks, dispositions, enrollments) ALWAYS require Jeremy's confirmation before executing. Never act unilaterally.
- Read actions (querying leads, stats, notes) execute immediately — no confirmation needed.
- Use "Family" not "customer/client". Use "Household Protection Audit" not "quote/pitch". Use "Milestone Shelter" not "policy". Use "Senior Field Underwriter" not "agent".
- Keep responses short and tactical. Jeremy is in the middle of a dial session. No fluff.
- When proposing a write action, be specific: show exactly what will change.

Current session context:
[CONTEXT BUNDLE INJECTED HERE]
```

---

## Confirmation card UI
```
┌─────────────────────────────────────────┐
│ 📝 Proposed Action                      │
│                                         │
│ Log note on Lance Coleman:              │
│ "Called — needs to think about it."    │
│ + Set callback: Mon Jun 2, 9:00 AM     │
│                                         │
│  [✓ Confirm]        [✕ Cancel]         │
└─────────────────────────────────────────┘
```

---

## Build order (when this moves to active)
1. `agentClient.js` — API wrapper, conversation history, tool call/result loop
2. `agentTools.js` — tool schemas + read executors (no writes yet)
3. `AgentPanel.jsx` — chat UI, read-only first (no confirmations yet)
4. Wire read tools end-to-end, test with real lead queries
5. Add write tools + ConfirmationCard component
6. `agentContext.js` — context bundle builder
7. Wire into NavSidebar toggle
8. System prompt tuning

---

## Prerequisites before building
- [ ] Phase Engine polished (done as of v3.39)
- [ ] Reporting/dashboard accuracy verified
- [ ] Paused sequence tab built (small, unblocks sequence visibility)
- [ ] Claude API key obtained and added to .env.local

---

## Estimated effort
2-3 build sessions. Read-only version is 1 session. Full tool use with confirmation flow is 2 more.
