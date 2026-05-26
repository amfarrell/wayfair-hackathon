"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const DISPATCH_TRIGGER =
  "[DISPATCH] Severe weather alert just came in for tomorrow morning. " +
  "Check Andrew's scheduled delivery and reach out to him proactively if there's a risk to his order.";

const INITIAL_ORDER = {
  orderId: "WF-2407",
  item: "Birch Lane Heritage Velvet Sectional",
  scheduledDate: "Wed, May 27",
  scheduledWindow: "10:00 AM – 12:00 PM",
  status: "scheduled" as "scheduled" | "rescheduled",
};

type OrderSnapshot = typeof INITIAL_ORDER;

// ───── helpers ─────

function isDispatchTrigger(msg: UIMessage) {
  if (msg.role !== "user") return false;
  const first = msg.parts.find((p) => p.type === "text");
  return !!first && "text" in first && first.text.startsWith("[DISPATCH]");
}

function readToolPart(
  part: UIMessage["parts"][number],
): { name: string; state: string; output?: unknown } | null {
  if (!part.type.startsWith("tool-")) return null;
  const anyPart = part as unknown as {
    type: string;
    state?: string;
    output?: unknown;
  };
  return {
    name: part.type.replace("tool-", ""),
    state: anyPart.state ?? "unknown",
    output: anyPart.output,
  };
}

function deriveOrder(messages: UIMessage[]): OrderSnapshot {
  let order: OrderSnapshot = { ...INITIAL_ORDER };
  for (const msg of messages) {
    for (const part of msg.parts) {
      const tool = readToolPart(part);
      if (
        tool?.name === "confirmReschedule" &&
        tool.state === "output-available" &&
        tool.output &&
        typeof tool.output === "object" &&
        "order" in (tool.output as Record<string, unknown>)
      ) {
        const o = (tool.output as { order: Record<string, string> }).order;
        order = {
          orderId: o.orderId ?? order.orderId,
          item: order.item,
          scheduledDate: o.scheduledDate ?? order.scheduledDate,
          scheduledWindow: o.scheduledWindow ?? order.scheduledWindow,
          status: o.status === "rescheduled" ? "rescheduled" : order.status,
        };
      }
    }
  }
  return order;
}

const TOOL_LABEL: Record<string, string> = {
  getMyDelivery: "Reading delivery",
  checkWeatherForDelivery: "Checking forecast",
  findClearDeliverySlots: "Finding clear days",
  confirmReschedule: "Updating dispatch",
};
const prettyTool = (n: string) => TOOL_LABEL[n] ?? n;

function deriveActiveTool(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const tool = readToolPart(msg.parts[j]);
      if (tool?.state === "input-available") return prettyTool(tool.name);
    }
  }
  return null;
}

// ───── pieces ─────

function Avatar({ who, size = 36 }: { who: "moana" | "andrew"; size?: number }) {
  const src = who === "moana" ? "/moana.png" : "/andrew.png";
  return (
    <div
      style={{ width: size, height: size }}
      className="relative shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-[0_2px_8px_rgba(88,44,131,0.18)]"
    >
      <Image src={src} alt={who} fill className="object-cover" sizes={`${size}px`} />
    </div>
  );
}

function ToolPill({ name, state }: { name: string; state: string }) {
  const isActive = state === "input-available";
  const isError = state === "output-error";
  return (
    <div
      className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ${
        isError
          ? "bg-red-50 text-red-700"
          : isActive
            ? "tool-pill-active text-[var(--wf-purple-deep)]"
            : "bg-[var(--wf-purple-soft)] text-[var(--wf-purple-deep)]"
      }`}
    >
      <span aria-hidden>✦</span>
      <span className="italic">{prettyTool(name)}</span>
      {isActive && <span className="opacity-60">…</span>}
      {isError && <span className="opacity-60">failed</span>}
    </div>
  );
}

function RichText({ text, isUser }: { text: string; isUser: boolean }) {
  // User messages stay plain (users don't type markdown).
  if (isUser) {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-[1.55] text-white">
        {text}
      </p>
    );
  }
  return (
    <div
      className={[
        "text-[15px] leading-[1.55] text-[var(--wf-ink)]",
        "[&_p]:my-0 [&_p+p]:mt-2",
        "[&_strong]:font-semibold [&_strong]:text-[var(--wf-purple-deep)]",
        "[&_em]:italic",
        // Unordered list — custom Wayfair-purple dot
        "[&_ul]:my-1.5 [&_ul]:list-none [&_ul]:space-y-1 [&_ul]:pl-0",
        "[&_ul>li]:relative [&_ul>li]:pl-5",
        "[&_ul>li]:before:absolute [&_ul>li]:before:left-1 [&_ul>li]:before:top-[10px] [&_ul>li]:before:h-1.5 [&_ul>li]:before:w-1.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-[var(--wf-purple)] [&_ul>li]:before:content-['']",
        // Ordered list — keep the numbers, make them prominent
        "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-7",
        "[&_ol>li]:pl-1",
        "[&_ol>li]:marker:font-bold [&_ol>li]:marker:text-[var(--wf-purple)]",
        "[&_code]:rounded [&_code]:bg-[var(--wf-cream-deeper)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:font-medium",
        "[&_a]:font-semibold [&_a]:text-[var(--wf-purple)] [&_a]:underline [&_a]:decoration-[var(--wf-purple)]/30 [&_a]:underline-offset-2",
        "[&_hr]:my-3 [&_hr]:border-[var(--wf-line)]",
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function MessagePart({
  part,
  isUser,
}: {
  part: UIMessage["parts"][number];
  isUser: boolean;
}) {
  if (part.type === "text") {
    const text = "text" in part ? part.text : "";
    return <RichText text={text} isUser={isUser} />;
  }
  if (part.type.startsWith("tool-")) {
    const tool = readToolPart(part);
    if (!tool) return null;
    return <ToolPill name={tool.name} state={tool.state} />;
  }
  return null;
}

function DeliveryStatusCard({ order }: { order: OrderSnapshot }) {
  const isRescheduled = order.status === "rescheduled";
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--wf-line)] bg-white p-3 shadow-[0_1px_2px_rgba(31,20,34,0.04)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--wf-cream-deeper)] ring-1 ring-[var(--wf-line)]">
            <Image
              src="/sofa.jpg"
              alt="Birch Lane Heritage velvet sectional"
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--wf-ink-soft)]">
              Order {order.orderId} · White-glove delivery
            </div>
            <div className="text-[15px] font-semibold leading-tight text-[var(--wf-ink)]">
              {order.item}
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--wf-ink-soft)]">
              42 Beacon St, Boston, MA
            </div>
          </div>
        </div>

        <div
          key={`${order.status}-${order.scheduledDate}-${order.scheduledWindow}`}
          className={`status-flip flex flex-col items-end gap-0.5 rounded-xl px-3 py-2 text-right ${
            isRescheduled
              ? "bg-[rgba(232,112,76,0.12)] text-[var(--wf-coral)]"
              : "bg-[var(--wf-purple-soft)] text-[var(--wf-purple-deep)]"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
            {isRescheduled ? "Rescheduled ✓" : "Scheduled"}
          </span>
          <span className="font-display text-[15px] font-semibold leading-tight">
            {order.scheduledDate}
          </span>
          <span className="text-[11px] font-medium opacity-80">
            {order.scheduledWindow}
          </span>
        </div>
      </div>
    </div>
  );
}

type Group = { role: "user" | "assistant"; messages: UIMessage[] };

function groupMessages(messages: UIMessage[]): Group[] {
  const groups: Group[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const last = groups[groups.length - 1];
    if (last && last.role === m.role) last.messages.push(m);
    else groups.push({ role: m.role as "user" | "assistant", messages: [m] });
  }
  return groups;
}

// ───── main ─────

export function ChatApp() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport,
  });

  const isBusy = status === "streaming" || status === "submitted";
  const visibleMessages = messages.filter((m) => !isDispatchTrigger(m));
  const order = useMemo(() => deriveOrder(messages), [messages]);
  const activeTool = isBusy ? deriveActiveTool(messages) : null;
  const hasStarted = messages.length > 0;
  const groups = useMemo(() => groupMessages(visibleMessages), [visibleMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visibleMessages.length, isBusy]);

  function startConversation() {
    sendMessage({ parts: [{ type: "text", text: DISPATCH_TRIGGER }] });
  }

  function reset() {
    setMessages([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ parts: [{ type: "text", text }] });
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--wf-cream)]">
      {/* Brand strip */}
      <div className="bg-[var(--wf-purple-deep)] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
          <div className="flex items-center gap-4 whitespace-nowrap">
            <span>Wayfair</span>
            <span className="opacity-50">All Modern</span>
            <span className="opacity-50">Birch Lane</span>
            <span className="hidden opacity-50 md:inline">Joss & Main</span>
            <span className="hidden opacity-50 md:inline">Perigold</span>
          </div>
          <div className="hidden gap-4 whitespace-nowrap sm:flex">
            <span>Rewards</span>
            <span>Financing</span>
            <span className="hidden md:inline">Free Shipping over $35</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="border-b border-[var(--wf-line)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-bold leading-none tracking-tight text-[var(--wf-purple)]">
              wayfair
            </span>
            <span className="h-6 w-px bg-[var(--wf-line)]" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--wf-purple-deep)]">
                Delivery Updates
              </div>
              <div className="text-[12px] text-[var(--wf-ink-soft)]">
                A note from your delivery coordinator
              </div>
            </div>
          </div>
          {hasStarted && (
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-[var(--wf-line)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--wf-ink-soft)] transition hover:text-[var(--wf-purple)]"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-4 px-5 pb-5 pt-5">
        {!hasStarted && (
          <div className="grain relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border border-[var(--wf-line)] bg-gradient-to-b from-[var(--wf-purple-soft)] via-white to-[var(--wf-cream)] p-10 text-center shadow-[0_8px_40px_-12px_rgba(127,24,126,0.25)]">
            <Avatar who="moana" size={92} />
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--wf-coral)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
              ◆ Weather Alert
            </div>
            <h2 className="font-display mt-4 text-[34px] font-semibold leading-[1.1] tracking-tight text-[var(--wf-ink)]">
              Severe weather just changed
              <br />
              tomorrow&apos;s plan.
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--wf-ink-soft)]">
              Andrew has a velvet sectional scheduled for white-glove delivery
              tomorrow morning. Watch Moana, his Wayfinder, reach out and find
              him a better day.
            </p>
            <button
              type="button"
              onClick={startConversation}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--wf-purple)] px-7 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(127,24,126,0.55)] transition hover:bg-[var(--wf-purple-deep)] active:scale-[0.98]"
            >
              Run overnight delivery check
              <span aria-hidden>→</span>
            </button>
            <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-[var(--wf-ink-soft)]">
              You play Andrew · Reply however you like
            </p>
          </div>
        )}

        {hasStarted && (
          <>
            <DeliveryStatusCard order={order} />

            <div
              ref={scrollRef}
              className="scroll-soft grain relative min-h-0 flex-1 overflow-y-auto rounded-3xl border border-[var(--wf-line)] bg-white p-6"
            >
              <div className="relative space-y-5">
                {groups.map((group, groupIdx) => {
                  const isUser = group.role === "user";
                  const who = isUser ? "andrew" : "moana";
                  return (
                    <div
                      key={`g-${groupIdx}`}
                      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div className="self-end">
                        <Avatar who={who} size={32} />
                      </div>
                      <div
                        className={`flex max-w-[78%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`text-[11px] font-semibold tracking-[0.08em] ${
                            isUser
                              ? "text-[var(--wf-ink-soft)]"
                              : "text-[var(--wf-purple)]"
                          }`}
                        >
                          {isUser ? "Andrew" : "Moana · Wayfinder"}
                        </div>
                        {group.messages.map((msg, mi) => (
                          <div
                            key={msg.id}
                            className={`bubble-in space-y-1 rounded-2xl px-4 py-3 ${
                              isUser
                                ? "bg-[var(--wf-purple)] text-white shadow-[0_2px_10px_-4px_rgba(127,24,126,0.4)]"
                                : "border border-[var(--wf-line)] bg-[var(--wf-cream)] shadow-[0_1px_2px_rgba(31,20,34,0.04)]"
                            } ${
                              isUser
                                ? "rounded-br-md"
                                : "rounded-bl-md"
                            }`}
                            style={{ animationDelay: `${mi * 60}ms` }}
                          >
                            {msg.parts.map((part, pi) => (
                              <MessagePart
                                key={`${msg.id}-${pi}`}
                                part={part}
                                isUser={isUser}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {isBusy && (
                  <div className="flex gap-3">
                    <div className="self-end">
                      <Avatar who="moana" size={32} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[11px] font-semibold tracking-[0.08em] text-[var(--wf-purple)]">
                        Moana · Wayfinder
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[var(--wf-line)] bg-[var(--wf-cream)] px-4 py-3.5">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                      {activeTool && (
                        <div className="ml-1 inline-flex items-center gap-1 text-[11px] italic text-[var(--wf-ink-soft)]">
                          <span className="text-[var(--wf-purple)]">✦</span>
                          {activeTool}…
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        {hasStarted && (
          <form onSubmit={handleSubmit} className="relative shrink-0">
            <div className="flex items-center gap-2 rounded-full border border-[var(--wf-line)] bg-white p-1.5 shadow-[0_4px_24px_-12px_rgba(31,20,34,0.18)]">
              <div className="pl-1">
                <Avatar who="andrew" size={32} />
              </div>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Reply as Andrew…"
                className="flex-1 bg-transparent px-2 py-2 text-[15px] text-[var(--wf-ink)] outline-none placeholder:text-[var(--wf-ink-soft)]"
                disabled={isBusy}
                autoFocus
              />
              {isBusy ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-full border border-[var(--wf-line)] bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-[var(--wf-ink-soft)] hover:text-[var(--wf-purple)]"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wf-purple)] text-white transition hover:bg-[var(--wf-purple-deep)] disabled:opacity-30"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path
                      d="M4 12L20 4l-5 16-3-7-8-1z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
