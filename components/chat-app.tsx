"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useState } from "react";

const WF_PURPLE = "#7F187E";
const WF_PURPLE_DARK = "#582C83";
const WF_PURPLE_LIGHT = "#F4EBF8";

const DISPATCH_TRIGGER =
  "[DISPATCH] Severe weather alert just came in for tomorrow morning. " +
  "Check Andrew's scheduled delivery and reach out to him proactively if there's a risk to his order.";

function MessagePart({
  part,
  role,
}: {
  part: UIMessage["parts"][number];
  role: "user" | "assistant" | "system";
}) {
  if (part.type === "text") {
    return (
      <p
        className={`whitespace-pre-wrap text-[15px] leading-relaxed ${
          role === "user" ? "text-white" : "text-zinc-900"
        }`}
      >
        {part.text}
      </p>
    );
  }

  if (part.type.startsWith("tool-")) {
    const label = part.type.replace("tool-", "");
    const state = "state" in part ? part.state : "unknown";
    const stateLabel =
      state === "input-available"
        ? "Calling…"
        : state === "output-available"
          ? "Done"
          : state === "output-error"
            ? "Error"
            : "";
    return (
      <div
        className="mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium"
        style={{
          borderColor: `${WF_PURPLE}33`,
          backgroundColor: WF_PURPLE_LIGHT,
          color: WF_PURPLE_DARK,
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: WF_PURPLE }}
        />
        <span className="font-mono">{label}</span>
        <span className="text-zinc-500">· {stateLabel}</span>
      </div>
    );
  }

  return null;
}

export function ChatApp() {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport,
  });

  const isBusy = status === "streaming" || status === "submitted";

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

  // Hide the initial dispatcher trigger message from the customer's view.
  const visibleMessages = messages.filter((m) => {
    if (m.role !== "user") return true;
    const first = m.parts.find((p) => p.type === "text");
    if (first && "text" in first && first.text.startsWith("[DISPATCH]")) {
      return false;
    }
    return true;
  });

  const hasStarted = messages.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top utility nav (Wayfair-style brand strip) */}
      <div
        className="border-b text-[11px] text-white"
        style={{ backgroundColor: WF_PURPLE_DARK, borderColor: WF_PURPLE_DARK }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-4 font-semibold tracking-wide">
            <span>WAYFAIR</span>
            <span className="opacity-60">ALL MODERN</span>
            <span className="opacity-60">BIRCH LANE</span>
            <span className="opacity-60">JOSS & MAIN</span>
          </div>
          <div className="hidden gap-4 sm:flex">
            <span>Rewards</span>
            <span>Financing</span>
            <span>Fast & Free Shipping</span>
          </div>
        </div>
      </div>

      {/* Header with logo + delivery context */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ color: WF_PURPLE }}
            >
              wayfair
            </span>
            <span className="text-zinc-300">|</span>
            <div className="text-sm">
              <div className="font-semibold text-zinc-900">Delivery Updates</div>
              <div className="text-xs text-zinc-500">
                Order WF-2407 · Velvet Sectional
              </div>
            </div>
          </div>
          {hasStarted && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              Reset demo
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {!hasStarted && (
          <div
            className="flex flex-1 flex-col items-center justify-center rounded-2xl border p-10 text-center"
            style={{
              borderColor: `${WF_PURPLE}33`,
              backgroundColor: WF_PURPLE_LIGHT,
            }}
          >
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: WF_PURPLE }}
            >
              Demo
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900">
              Severe weather alert just came in
            </h2>
            <p className="mt-2 max-w-md text-sm text-zinc-600">
              Andrew has a velvet sectional scheduled for white-glove delivery
              tomorrow morning. The forecast just turned ugly. Watch Moana, our
              delivery coordinator, reach out to him.
            </p>
            <button
              type="button"
              onClick={startConversation}
              className="mt-6 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: WF_PURPLE }}
            >
              Run overnight delivery check →
            </button>
            <p className="mt-3 text-xs text-zinc-500">
              You&apos;ll play Andrew. Reply however you want.
            </p>
          </div>
        )}

        {hasStarted && (
          <div className="flex-1 space-y-5 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
            {visibleMessages.map((message) => {
              const isUser = message.role === "user";
              const label = isUser ? "Andrew" : "Moana · Wayfair";
              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`mb-1 px-1 text-[11px] font-medium uppercase tracking-wide ${
                      isUser ? "text-zinc-500" : ""
                    }`}
                    style={!isUser ? { color: WF_PURPLE } : undefined}
                  >
                    {label}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      isUser ? "text-white" : "border border-zinc-200 bg-white"
                    }`}
                    style={isUser ? { backgroundColor: WF_PURPLE } : undefined}
                  >
                    {message.parts.map((part, index) => (
                      <MessagePart
                        key={`${message.id}-${index}`}
                        part={part}
                        role={message.role}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {isBusy && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full"
                  style={{ backgroundColor: WF_PURPLE }}
                />
                Moana is typing…
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        )}

        {hasStarted && (
          <form onSubmit={handleSubmit} className="mt-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Reply as Andrew…"
                className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[color:var(--wf)] focus:ring-2"
                style={
                  {
                    ["--wf" as string]: WF_PURPLE,
                    ["--tw-ring-color" as string]: `${WF_PURPLE}33`,
                  } as React.CSSProperties
                }
                disabled={isBusy}
              />
              {isBusy ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: WF_PURPLE }}
                >
                  Send
                </button>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
