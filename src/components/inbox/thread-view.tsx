interface ThreadMessage {
  id: string;
  from_email: string;
  from_name: string | null;
  body_text: string | null;
  created_at: string;
  is_agent_reply?: boolean;
  reply_content?: string;
}

export function ThreadView({ messages }: { messages: ThreadMessage[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Thread History
      </h3>
      <div className="space-y-2">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">
                  {msg.from_name || msg.from_email}
                </span>
                <span>
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {msg.body_text}
              </p>
            </div>
            {msg.is_agent_reply && msg.reply_content && (
              <div className="ml-4 mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950">
                <div className="mb-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Agent Reply
                </div>
                <p className="whitespace-pre-wrap text-sm text-emerald-800 dark:text-emerald-200">
                  {msg.reply_content}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { ThreadMessage };
