"use client";

import { useEveAgent, type EveMessagePart } from "eve/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ProductSuggestionCard,
  type ProductSuggestion,
} from "@/components/agent/product-suggestion";
import { Button } from "@/components/ui/button";
import { ensureCartSession, refreshCartCache } from "@/lib/actions/session";

/** Human-readable progress per tool, so "thinking" is never opaque. */
const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching the catalogue",
  get_product_details: "Looking up the product",
  check_stock: "Checking stock",
  list_categories: "Listing categories",
  view_cart: "Reading your cart",
  add_to_cart: "Adding to your cart",
  update_cart_item: "Updating your cart",
  remove_from_cart: "Removing from your cart",
  get_promotion: "Checking the current promotion",
  watch_stock: "Setting up a stock watch",
};

const SUGGESTIONS = [
  "What mugs do you have?",
  "Something black under $25",
  "Add a hoodie to my cart",
];

/** Where the durable session cursor survives page reloads. */
const SESSION_STORAGE_KEY = "assistant-eve-session";

function storedSession(): { sessionId: string; streamIndex: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * The store assistant, as a client of the eve agent mounted at /eve/v1.
 *
 * The visible UI is unchanged from the AI SDK version — same panel, same
 * product cards, same badge behaviour. What changed underneath is durability:
 * the session lives on the server, so a reload replays the transcript and
 * re-attaches to an in-flight reply (`resume`), and a background stock watch
 * started in this conversation reports back into it even if the panel was
 * closed in between. The session cursor is the only client-held state, kept in
 * sessionStorage so it scopes to the tab like the rest of the browsing session.
 */
export function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const sessionPromise = useRef<Promise<void> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialSession] = useState(storedSession);

  const router = useRouter();

  const agent = useEveAgent({
    ...(initialSession ? { initialSession, resume: true } : {}),
    onSessionChange: (session) => {
      try {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } catch {
        // Storage being unavailable only costs resume-on-reload.
      }
    },
  });

  const messages = agent.data.messages;
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const resuming = agent.status === "resuming";

  /*
   * Refresh the header badge the moment a successful add streams in — the
   * same contract as before eve: the agent's text claims success as soon as
   * it sees the tool result, so the badge must move at that same moment. The
   * Server Action matters (vs a bare router.refresh) because only it may call
   * `updateTag` to expire the cached cart immediately. Works for straight
   * adds and for approval-gated ones alike: an approved add's part reaches
   * `output-available` only after the approval let `execute` run and the
   * cart write actually finished.
   */
  const refreshedAdds = useRef(new Set<string>());
  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type !== "dynamic-tool" || part.toolName !== "add_to_cart") continue;
        if (part.state !== "output-available") continue;
        const added = Boolean(
          part.output &&
            typeof part.output === "object" &&
            (part.output as { added?: unknown }).added === true,
        );
        if (!added || refreshedAdds.current.has(part.toolCallId)) continue;
        refreshedAdds.current.add(part.toolCallId);
        void refreshCartCache().then(() => router.refresh());
      }
    }
  }, [messages, router]);

  /*
   * Provision the cart before the agent can need it: a streamed agent route
   * cannot set a storefront cookie, so the Server Action creates the cart and
   * cookie when the panel opens — the ~2.5s creation overlaps the shopper
   * typing — and `submit` awaits it so a fast first message cannot outrun it.
   * The channel lifts the cookie into the eve session on every turn.
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
    if (!trimmed || busy || resuming) return;
    setInput("");
    sessionPromise.current ??= ensureCartSession();
    await sessionPromise.current;
    void agent.send(trimmed);
  };

  const startNewChat = () => {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* see above */
    }
    refreshedAdds.current.clear();
    agent.reset();
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
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startNewChat}
              className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Close
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !resuming && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              I can search the catalogue, check stock, watch restocks and add
              things to your cart.
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

        {resuming && messages.length === 0 && (
          <p className="text-sm text-muted">Restoring your conversation…</p>
        )}

        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-2">
            {message.parts.map((part, index) => (
              <MessagePart
                key={index}
                part={part}
                role={message.role}
                respond={agent.respond}
              />
            ))}
          </div>
        ))}

        {agent.error && (
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
          disabled={resuming}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        />
        <Button type="submit" disabled={busy || resuming || !input.trim()} className="shrink-0">
          Send
        </Button>
      </form>
    </div>
  );
}

function MessagePart({
  part,
  role,
  respond,
}: {
  part: EveMessagePart;
  role: string;
  respond: (responses: Array<{ requestId: string; optionId?: string; text?: string }>) => Promise<void>;
}) {
  if (part.type === "text") {
    return role === "user" ? (
      <p className="ml-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
        {part.text}
      </p>
    ) : (
      <p className="text-sm leading-relaxed text-foreground">
        <InlineFormatted text={part.text} />
      </p>
    );
  }

  if (part.type !== "dynamic-tool") return null;

  /*
   * A durable pause for the shopper — the add_to_cart approval. The request
   * rides on the tool part; answering resumes the parked run. The framework
   * owns the request's generic prompt ("Approve tool call: …"), so for the
   * add we compose shopper-facing copy from the tool input — the product
   * card the model just showed sits directly above for full context.
   */
  if (part.state === "approval-requested") {
    const request = part.toolMetadata?.eve?.inputRequest;
    if (!request) return null;
    const input = part.input as { productId?: string; quantity?: number } | undefined;
    const prompt =
      part.toolName === "add_to_cart" && typeof input?.productId === "string"
        ? `Add ${input.quantity ?? 1} × ${input.productId} to your cart?`
        : request.prompt;
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
        <p className="text-sm text-foreground">{prompt}</p>
        <div className="flex gap-2">
          {request.options?.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={option.style === "primary" ? "primary" : "secondary"}
              onClick={() =>
                void respond([{ requestId: request.requestId, optionId: option.id }])
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (part.state !== "output-available") {
    const label = TOOL_LABELS[part.toolName] ?? "Working";
    return (
      <p className="text-xs text-muted" aria-live="polite">
        {label}…
      </p>
    );
  }

  const products = extractProducts(part.output);
  if (products.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {products.map((product) => (
        <ProductSuggestionCard key={product.id} product={product} />
      ))}
    </div>
  );
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
