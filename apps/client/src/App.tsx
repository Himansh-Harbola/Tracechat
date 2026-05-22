import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  Clipboard,
  Database,
  Gauge,
  Menu,
  MessageSquarePlus,
  Pause,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Terminal,
  Trash2,
  X,
  XCircle,
  Zap
} from "lucide-react";
import {
  cancelConversation,
  API_BASE_URL,
  createConversation,
  deleteConversation,
  fetchConversations,
  fetchMessages,
  fetchMetrics,
  fetchProviders,
  selectProvider,
  type ChatMessage,
  type Conversation,
  type DashboardMetrics,
  type ProviderInfo,
  type ProviderStatus
} from "./api";

type View = "chat" | "dashboard";

const SUGGESTIONS = [
  "Explain MERN stack with a tiny architecture diagram",
  "Summarize today's inference logs",
  "Write a TypeScript fetch wrapper",
  "Compare PostgreSQL and MongoDB for chat history"
];

export function App() {
  const [view, setView] = useState<View>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics>();
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    refreshConversations();
    refreshMetrics();
    refreshProviders();
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    fetchMessages(activeConversationId).then(setMessages).catch((err: Error) => setError(err.message));
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations]
  );

  const latestLog = metrics?.recentLogs[0];
  const activeProvider = providerStatus?.providers.find((provider) => provider.active);
  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.title.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [conversations, query]
  );

  async function refreshConversations() {
    const data = await fetchConversations();
    setConversations(data);
    setActiveConversationId((current) => current ?? data[0]?.id);
  }

  async function refreshMetrics() {
    const data = await fetchMetrics();
    setMetrics(data);
  }

  async function refreshProviders() {
    const data = await fetchProviders();
    setProviderStatus(data);
  }

  async function handleNewConversation() {
    const conversation = await createConversation();
    await refreshConversations();
    setActiveConversationId(conversation.id);
    setMessages([]);
    setDraft("");
    setSidebarOpen(false);
    composerRef.current?.focus();
  }

  async function sendMessage(message: string, conversationId = activeConversationId) {
    if (!message || isStreaming) {
      return;
    }

    setDraft("");
    setError(undefined);
    setStreamingText("");

    const optimisticMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? "pending",
      role: "USER",
      content: message,
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, optimisticMessage]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;
    let streamedConversationId = conversationId;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
        signal: abortController.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat failed: ${response.status}`);
      }

      await readServerSentEvents(response.body, {
        meta: (payload) => {
          if (payload.conversationId) {
            streamedConversationId = payload.conversationId;
            setActiveConversationId(payload.conversationId);
          }
        },
        token: (payload) => {
          setStreamingText((current) => current + (payload.content ?? ""));
        },
        error: (payload) => {
          setError(payload.message ?? "Streaming error");
        }
      });

      await refreshConversations();
      if (streamedConversationId) {
        setMessages(await fetchMessages(streamedConversationId));
      }
      await refreshMetrics();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      abortRef.current = undefined;
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await sendMessage(draft.trim());
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      sendMessage(draft.trim());
    }
  }

  async function handleCancel() {
    abortRef.current?.abort();
    if (activeConversationId) {
      await cancelConversation(activeConversationId);
      await refreshConversations();
      await refreshMetrics();
    }
    setIsStreaming(false);
  }

  async function handleDeleteConversation(conversationId: string) {
    const nextConversation = conversations.find((conversation) => conversation.id !== conversationId);
    await deleteConversation(conversationId);
    await refreshConversations();

    if (activeConversationId === conversationId) {
      setActiveConversationId(nextConversation?.id);
      setMessages([]);
    }
  }

  async function handleSelectProvider(providerId: ProviderInfo["id"]) {
    setProviderStatus(await selectProvider(providerId));
    await refreshMetrics();
  }

  async function handleCopy(message: ChatMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(undefined), 1500);
  }

  function handleRegenerate() {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "USER");
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content);
    }
  }

  return (
    <main className="app-shell">
      <div className={sidebarOpen ? "sidebar-scrim visible" : "sidebar-scrim"} onClick={() => setSidebarOpen(false)} />

      <aside className={sidebarOpen ? "sidebar open" : "sidebar"} aria-label="Conversation navigation">
        <div className="brand">
          <div className="logo-mark" aria-hidden="true">
            <Bot size={19} />
          </div>
          <div>
            <span>TraceChat</span>
            <small>AI telemetry workspace</small>
          </div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="view-switcher" aria-label="View switcher">
          <button className={view === "chat" ? "active" : ""} onClick={() => setView("chat")}>
            <MessageSquarePlus size={16} />
            Chat
          </button>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <Gauge size={16} />
            Metrics
          </button>
        </div>

        <button className="new-chat" onClick={handleNewConversation}>
          <SquarePen size={16} />
          New chat
        </button>

        <label className="search-box">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" />
        </label>

        <div className="sidebar-stats">
          <div>
            <small>Requests</small>
            <strong>{metrics?.totalRequests ?? 0}</strong>
          </div>
          <div>
            <small>Latency</small>
            <strong>{metrics?.averageLatencyMs ?? 0} ms</strong>
          </div>
        </div>

        <div className="conversation-list">
          {filteredConversations.map((conversation) => (
            <div
              className={conversation.id === activeConversationId ? "conversation active" : "conversation"}
              key={conversation.id}
              onClick={() => {
                setActiveConversationId(conversation.id);
                setSidebarOpen(false);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setActiveConversationId(conversation.id);
                  setSidebarOpen(false);
                }
              }}
            >
              <div className="conversation-copy">
                <span>{conversation.title}</span>
                <small>
                  <i className={`dot ${conversation.status.toLowerCase()}`} />
                  {conversation.status.toLowerCase()} · {formatTime(conversation.updatedAt)}
                </small>
              </div>
              <button
                className="delete-chat"
                title="Delete conversation"
                aria-label={`Delete ${conversation.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteConversation(conversation.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <ShieldCheck size={15} />
          <span>Redaction on</span>
        </div>
      </aside>

      {view === "chat" ? (
        <section className="chat-panel">
          <AppTopbar
            activeConversation={activeConversation}
            activeProvider={activeProvider}
            latestLog={latestLog}
            onMenu={() => setSidebarOpen(true)}
            onProviderChange={handleSelectProvider}
            onRefresh={refreshConversations}
            providers={providerStatus?.providers ?? []}
          />

          <div className="messages" aria-live="polite">
            {messages.length === 0 && !streamingText ? (
              <EmptyChat onPick={(value) => {
                setDraft(value);
                composerRef.current?.focus();
              }} />
            ) : null}

            {messages.map((message) => (
              <MessageItem
                copied={copiedMessageId === message.id}
                key={message.id}
                message={message}
                onCopy={() => handleCopy(message)}
                onRegenerate={message.role === "ASSISTANT" ? handleRegenerate : undefined}
              />
            ))}

            {streamingText ? <StreamingMessage text={streamingText} /> : null}
            <div ref={messagesEndRef} />
          </div>

          {error ? (
            <div className="error-bar" role="alert">
              <XCircle size={16} />
              {error}
            </div>
          ) : null}

          <form className="composer" onSubmit={handleSubmit}>
            <div className="composer-shell">
              <textarea
                aria-label="Message"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask Gemini anything..."
                ref={composerRef}
                value={draft}
              />
              <div className="composer-meta">
                <span>{latestLog?.model ?? "gemini-2.5-flash-lite"}</span>
                <span>{draft.length.toLocaleString()} chars</span>
              </div>
            </div>
            {isStreaming ? (
              <button type="button" className="cancel-button" onClick={handleCancel}>
                <Pause size={17} />
                Cancel
              </button>
            ) : (
              <button type="submit" disabled={!draft.trim()}>
                <Send size={17} />
                Send
              </button>
            )}
          </form>
        </section>
      ) : (
        <DashboardPanel metrics={metrics} onMenu={() => setSidebarOpen(true)} onRefresh={refreshMetrics} />
      )}
    </main>
  );
}

function AppTopbar({
  activeConversation,
  activeProvider,
  latestLog,
  onMenu,
  onProviderChange,
  onRefresh
  ,
  providers
}: {
  activeConversation?: Conversation;
  activeProvider?: ProviderInfo;
  latestLog?: DashboardMetrics["recentLogs"][number];
  onMenu: () => void;
  onProviderChange: (providerId: ProviderInfo["id"]) => void;
  onRefresh: () => void;
  providers: ProviderInfo[];
}) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu} aria-label="Open sidebar">
        <Menu size={18} />
      </button>
      <div className="title-stack">
        <h1>{activeConversation?.title ?? "New conversation"}</h1>
        <p>{activeConversation?.status.toLowerCase() ?? "active"} session</p>
      </div>
      <div className="topbar-actions">
        <label className="provider-select">
          <Zap size={14} />
          <select
            aria-label="Select LLM provider"
            onChange={(event) => onProviderChange(event.target.value as ProviderInfo["id"])}
            value={activeProvider?.id ?? latestLog?.provider ?? "mock"}
          >
            {providers.map((provider) => (
              <option disabled={!provider.configured} key={provider.id} value={provider.id}>
                {provider.name} {provider.configured ? `· ${provider.model}` : "· add key"}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <button className="icon-button" onClick={onRefresh} title="Refresh conversations">
          <RefreshCw size={18} />
        </button>
      </div>
    </header>
  );
}

function EmptyChat({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="empty-state">
      <div className="hero-orbit" aria-hidden="true">
        <Sparkles size={26} />
      </div>
      <h2>What should we trace next?</h2>
      <div className="suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} onClick={() => onPick(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageItem({
  copied,
  message,
  onCopy,
  onRegenerate
}: {
  copied: boolean;
  message: ChatMessage;
  onCopy: () => void;
  onRegenerate?: () => void;
}) {
  const isAssistant = message.role === "ASSISTANT";

  return (
    <article className={`message-row ${message.role.toLowerCase()}`}>
      <div className="message-avatar" aria-hidden="true">
        {isAssistant ? <Bot size={16} /> : <span>U</span>}
      </div>
      <div className="message-card">
        <div className="message-meta">
          <span>{isAssistant ? "Assistant" : "You"}</span>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>
        <RichText content={message.content} />
        <div className="message-actions">
          <button onClick={onCopy} title="Copy message">
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {onRegenerate ? (
            <button onClick={onRegenerate} title="Regenerate response">
              <RotateCcw size={14} />
              Regenerate
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StreamingMessage({ text }: { text: string }) {
  return (
    <article className="message-row assistant streaming">
      <div className="message-avatar" aria-hidden="true">
        <Bot size={16} />
      </div>
      <div className="message-card">
        <div className="message-meta">
          <span>Assistant</span>
          <span className="typing">
            <i />
            <i />
            <i />
          </span>
        </div>
        <RichText content={text} />
      </div>
    </article>
  );
}

function DashboardPanel({
  metrics,
  onMenu,
  onRefresh
}: {
  metrics?: DashboardMetrics;
  onMenu: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="dashboard-panel">
      <header className="topbar">
        <button className="menu-button" onClick={onMenu} aria-label="Open sidebar">
          <Menu size={18} />
        </button>
        <div className="title-stack">
          <h1>Trace Metrics</h1>
          <p>Pipeline telemetry</p>
        </div>
        <div className="topbar-actions">
          <span className="model-pill">
            <Database size={14} />
            postgres
          </span>
          <button className="icon-button" onClick={onRefresh} title="Refresh metrics">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className="metric-grid">
        <Metric icon={<Activity size={18} />} label="Requests" tone="teal" value={metrics?.totalRequests ?? 0} />
        <Metric icon={<Zap size={18} />} label="Throughput" tone="teal" value={`${metrics?.throughputPerMinute ?? 0}/min`} />
        <Metric icon={<Clock3 size={18} />} label="Avg latency" tone="indigo" value={`${metrics?.averageLatencyMs ?? 0} ms`} />
        <Metric icon={<XCircle size={18} />} label="Error rate" tone="red" value={`${metrics?.errorRate ?? 0}%`} />
        <Metric icon={<Pause size={18} />} label="Cancelled" tone="amber" value={metrics?.cancelledRequests ?? 0} />
        <Metric icon={<Database size={18} />} label="Tokens" tone="violet" value={metrics?.totalTokens ?? 0} />
        <Metric icon={<Sparkles size={18} />} label="Success" tone="green" value={metrics?.successfulRequests ?? 0} />
      </div>

      <div className="timeline-panel">
        <div className="table-heading">
          <Activity size={18} />
          Throughput timeline
        </div>
        <div className="timeline-bars">
          {(metrics?.timeline ?? []).map((bucket) => (
            <div className="timeline-bar" key={bucket.timestamp}>
              <span style={{ height: `${Math.max(8, bucket.requests * 16)}px` }} />
              <small>{new Date(bucket.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="log-table">
        <div className="table-heading">
          <Terminal size={18} />
          Recent logs
        </div>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Provider</th>
              <th>Model</th>
              <th>Latency</th>
              <th>Tokens</th>
            </tr>
          </thead>
          <tbody>
            {(metrics?.recentLogs ?? []).map((log) => (
              <tr key={log.id}>
                <td>
                  <span className={`status ${log.status.toLowerCase()}`}>{log.status.toLowerCase()}</span>
                </td>
                <td>{log.provider}</td>
                <td>{log.model}</td>
                <td>{log.latencyMs} ms</td>
                <td>{log.totalTokens ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  tone,
  value
}: {
  icon: ReactNode;
  label: string;
  tone: "teal" | "indigo" | "red" | "amber" | "violet" | "green";
  value: string | number;
}) {
  return (
    <div className={`metric ${tone}`}>
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function RichText({ content }: { content: string }) {
  const blocks = content.split(/```/g);

  return (
    <div className="rich-text">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          const [firstLine, ...rest] = block.split("\n");
          const language = firstLine.trim();
          const code = rest.join("\n") || block;

          return (
            <pre key={`${index}-${block.slice(0, 8)}`}>
              {language ? <span>{language}</span> : null}
              <code>{code.trim()}</code>
            </pre>
          );
        }

        return <MarkdownBlock content={block} key={`${index}-${block.slice(0, 8)}`} />;
      })}
    </div>
  );
}

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    elements.push(<p key={`p-${elements.length}`}>{renderInlineMarkdown(paragraph.join(" "))}</p>);
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    elements.push(<ul key={`ul-${elements.length}`}>{listItems}</ul>);
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const Tag = `h${Math.min(heading[1].length + 2, 4)}` as "h3" | "h4";
      elements.push(<Tag key={`h-${elements.length}`}>{renderInlineMarkdown(heading[2])}</Tag>);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      listItems.push(<li key={`li-${elements.length}-${listItems.length}`}>{renderInlineMarkdown(bullet[1])}</li>);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return elements;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function readServerSentEvents(
  body: ReadableStream<Uint8Array>,
  handlers: Record<string, (payload: Record<string, string | undefined>) => void>
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventText of events) {
      const eventName = eventText.match(/^event: (.+)$/m)?.[1];
      const data = eventText.match(/^data: (.+)$/m)?.[1];

      if (eventName && data && handlers[eventName]) {
        handlers[eventName](JSON.parse(data));
      }
    }
  }
}
