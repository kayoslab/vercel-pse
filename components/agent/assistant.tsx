"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ProductSuggestionCard,
  type ProductSuggestion,
} from "@/components/agent/product-suggestion";
import { Button } from "@/components/ui/button";
import { ensureCartSession, refreshCartCache } from "@/lib/actions/session";

/** Human-readable progress for each tool, so "thinking" is never opaque. */
const TOOL_LABELS: Record<string, string> = {
  "tool-searchProducts": "Searching the catalogue",
  "tool-getProductDetails": "Looking up the product",
  "tool-checkStock": "Checking stock",
  "tool-listCategories": "Listing categories",
  "tool-viewCart": "Reading your cart",
  "tool-addToCart": "Adding to your cart",
};

const SUGGESTIONS = [
  "What mugs do you have?",
  "Something black under $25",
  "Add a hoodie to my cart",
];

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const sessionPromise = useRef<Promise<void> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    /*
     * Refresh the server tree when the agent actually changed the cart.
     *
     * A chat response is a plain fetch, not a navigation or a Server Action, so
     * nothing re-renders the header when it completes — the badge would keep
     * showing the pre-add count while the cart page showed the item, which reads
     * as the agent having lied. Only refreshing on a successful add avoids
     * re-requesting the tree after every search.
     */
  });

  /*
   * Refresh the badge the moment a successful addToCart tool result streams
   * in — not in onFinish, which waits for the model to finish writing its
   * whole reply. The model's text says "added" right after it sees the tool
   * result, so the badge must move at the same point or the two disagree for
   * as long as the model keeps typing. Each tool call refreshes exactly once,
   * keyed by toolCallId.
   */
  const refreshedAdds = useRef(new Set<string>());
  useEffect(() => {
    for (const id of successfulAddIds(messages.at(-1))) {
      if (refreshedAdds.current.has(id)) continue;
      refreshedAdds.current.add(id);
      // A Server Action, not just router.refresh(): only a Server Action can
      // call `updateTag` to expire the cached cart immediately, and its
      // response re-renders the header in the same round trip.
      void refreshCartCache().then(() => router.refresh());
    }
  }, [messages, router]);

  const busy = status === "submitted" || status === "streaming";

  /*
   * Provision the cart session as soon as the panel opens, not when the first
   * add happens. A streamed route handler cannot set a cookie — headers are
   * already sent by the time a tool runs — so the session has to exist up front.
   * Doing it on open means the ~3s cart creation overlaps the shopper typing,
   * and visitors who never open the assistant never trigger it.
   */
  useEffect(() => {
    if (!open || sessionPromise.current) return;
    sessionPromise.current = ensureCartSession();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");

    /*
     * Await the session before sending. Kicking it off on open is not enough on
     * its own — cart creation takes ~3s against this API, and a shopper who types
     * fast beats it. The agent then found no session and told them their cart was
     * unreachable, which looked like a broken feature rather than a race.
     */
    sessionPromise.current ??= ensureCartSession();
    await sessionPromise.current;

    void sendMessage({ text: trimmed });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-foreground shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <SparkleIcon />
        Ask the store
      </button>
    );
  }

  return (
    /*
      Fixed overlay, so opening the assistant cannot shift the page behind it.
      Full width on small screens, a panel on larger ones.
    */
    <div
      role="dialog"
      aria-label="Shopping assistant"
      className="fixed inset-x-0 bottom-0 z-20 flex h-[85dvh] flex-col border-t border-border bg-surface-raised shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[600px] sm:w-[400px] sm:rounded-xl sm:border"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <SparkleIcon />
          <h2 className="text-sm font-semibold">Store assistant</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Close
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              I can search the catalogue, check stock and add things to your cart.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void submit(s)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-2">
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return message.role === "user" ? (
                  <p
                    key={index}
                    className="ml-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground"
                  >
                    {part.text}
                  </p>
                ) : (
                  <p key={index} className="text-sm leading-relaxed text-foreground">
                    <InlineFormatted text={part.text} />
                  </p>
                );
              }

              if (!part.type.startsWith("tool-")) return null;

              // Tool parts carry a `state` and, once resolved, an `output`.
              const toolPart = part as { type: string; state?: string; output?: unknown };
              const label = TOOL_LABELS[toolPart.type] ?? "Working";

              if (toolPart.state !== "output-available") {
                return (
                  <p key={index} className="text-xs text-muted" aria-live="polite">
                    {label}…
                  </p>
                );
              }

              const products = extractProducts(toolPart.output);
              if (products.length === 0) return null;

              return (
                <div key={index} className="flex flex-col gap-2">
                  {products.map((product) => (
                    <ProductSuggestionCard key={product.id} product={product} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Something went wrong. Please try again.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3"
      >
        <label className="sr-only" htmlFor="assistant-input">
          Message the store assistant
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products…"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <Button type="submit" disabled={busy || !input.trim()} className="shrink-0">
          Send
        </Button>
      </form>
    </div>
  );
}

/**
 * Tool-call ids of addToCart calls in this message that actually succeeded.
 * The model reporting success in prose is not evidence — the tool output is.
 */
function successfulAddIds(
  message: { role: string; parts: Array<{ type: string }> } | undefined,
): string[] {
  if (!message || message.role !== "assistant") return [];
  const ids: string[] = [];
  for (const part of message.parts) {
    if (part.type !== "tool-addToCart") continue;
    const { output, toolCallId } = part as { output?: unknown; toolCallId?: string };
    const added = Boolean(
      output && typeof output === "object" && (output as { added?: unknown }).added === true,
    );
    if (added && toolCallId) ids.push(toolCallId);
  }
  return ids;
}

/**
 * Pulls renderable products out of a tool result without trusting its shape.
 * Tool output crosses a network boundary and is shaped by the model's call, so it
 * is validated structurally rather than cast.
 */
function extractProducts(output: unknown): ProductSuggestion[] {
  if (!output || typeof output !== "object") return [];

  const record = output as Record<string, unknown>;
  const candidates = Array.isArray(record.products)
    ? record.products
    : record.product
      ? [record.product]
      : [];

  return candidates.filter((item): item is ProductSuggestion => {
    if (!item || typeof item !== "object") return false;
    const p = item as Record<string, unknown>;
    return (
      typeof p.id === "string" &&
      typeof p.slug === "string" &&
      typeof p.name === "string" &&
      typeof p.price === "string"
    );
  });
}

/**
 * Renders the three inline markdown fragments models emit even when the system
 * prompt forbids markdown: **bold**, *italic* and `code`. Without this they
 * appear as literal asterisks and backticks, because assistant text is plain
 * text by design. Deliberately not a markdown library: a chat panel does not
 * justify the bundle, the prompt keeps output plain, and anything beyond these
 * three tokens (lists, headings) degrades to readable plain text anyway.
 */
function InlineFormatted({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  // Bold, code, and italic whose delimiters hug the content ("2 * 3 * 4" stays untouched).
  const token = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*(?!\s)[^*\n]+?(?<!\s)\*)/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const raw = match[0];
    if (raw.startsWith("**")) {
      nodes.push(<strong key={key++}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-surface px-1 font-mono text-[0.85em]">
          {raw.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key++}>{raw.slice(1, -1)}</em>);
    }
    last = index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9.4 13.8 11.2 12 16.8 10.2 11.2 4.5 9.4l5.7-1.8z" />
      <path d="M18.5 15l.9 2.7 2.6.9-2.6.9-.9 2.6-.9-2.6-2.7-.9 2.7-.9z" />
    </svg>
  );
}
