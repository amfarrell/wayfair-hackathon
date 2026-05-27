# Moana — Wayfair Wayfinder

> Built at the [Beat The Clock Agent Hack](https://hack.subconscious.dev/) — Wayfair × Subconscious × Baseten × Cloudflare, May 26 2026.

A Wayfair delivery agent that proactively detects severe weather threats to a scheduled white-glove delivery, reaches out to the customer over chat in plain English, negotiates a new slot, and confirms with dispatch — all without anyone calling a 1-800 number.

**Track:** Supply Chain. **Scenario:** Andrew has a Birch Lane velvet sectional scheduled for tomorrow morning. Overnight, a torrential meatball forecast comes in. Moana the Wayfinder texts him, explains the risk in customer-benefit terms, offers clear-weather slots, and reschedules — visibly flipping the order status from "Scheduled" to "Rescheduled" in the demo.

## What's in here

| What | Where |
|---|---|
| Delivery agent prompt (Moana persona, tone rules, workflow) | `lib/agents/index.ts` |
| Tools: `get_my_delivery`, `check_weather_for_delivery`, `find_clear_delivery_slots` (with `preferredDays` filter), `confirm_reschedule` | `lib/tools/index.ts` |
| Chat UI — Wayfair-branded, iMessage-style bubbles, typing indicator, status card with reschedule animation | `components/chat-app.tsx` |
| Subconscious provider | `lib/subconscious.ts` |
| Streaming agent API | `app/api/chat/route.ts` |

Stack: Next.js 16 + React 19 + Vercel AI SDK (`ToolLoopAgent`) + Subconscious (`tim-qwen3.6-27b`) + react-markdown + Tailwind 4.

## Quick start

```bash
pnpm install
echo "SUBCONSCIOUS_API_KEY=sky_..." > .env.local   # get one at https://www.subconscious.dev/platform
pnpm dev
```

Open http://localhost:3000, click **Run overnight delivery check**, and play Andrew. Try:
- *"Yikes! What are my options?"* → numbered slot list
- *"Got any Monday slots?"* → day-filtered slots
- *"Why would meatballs damage a sofa?"* → conversational explanation
- *"Thursday at 10am works"* → confirms, status card flips to coral "Rescheduled"

## Links

- [Beat The Clock Agent Hack](https://hack.subconscious.dev/) — event page
- [Subconscious Platform](https://www.subconscious.dev/platform) — API keys
- [Subconscious Docs](https://docs.subconscious.dev)
- [Vercel AI SDK — Agents](https://ai-sdk.dev/docs/agents/overview)
