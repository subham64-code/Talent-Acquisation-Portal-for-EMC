import { useCallback, useEffect, useState } from "react";
import { hrApi } from "../../lib/api";
import PageHeader from "../../components/ref/PageHeader";

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      hrApi.notifications({ page: 1, pageSize: 50 }),
      hrApi.unreadCount(),
    ]);
    if (!active()) return;
    const [listResult, countResult] = results;
    if (listResult.status === "fulfilled") {
      const data: any = listResult.value?.data;
      setItems(data?.items ?? data ?? []);
    } else {
      setError("Could not load notifications.");
    }
    if (countResult.status === "fulfilled") {
      setCount(Number(countResult.value?.data?.count ?? 0));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]);

  const mark = async (id: string) => {
    try {
      await hrApi.markRead(id);
      // Patch only the affected row and count — no full-list reload.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setCount((c) => Math.max(0, c - 1));
    } catch {
      /* keep list unchanged on failure */
    }
  };

  const markAll = async () => {
    try {
      await hrApi.markReadAll();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setCount(0);
    } catch {
      /* keep state unchanged on failure */
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Ecometrix · Inbox"
        title="Notifications"
        actions={
          <div className="flex items-center gap-2">
            <span className={`badge ${count > 0 ? "badge--orange" : "badge--grey"}`}>{count} unread</span>
            <button className="btn btn--outline btn--sm" onClick={markAll} disabled={count === 0}>Mark all read</button>
          </div>
        }
      />
      {error && (
        <div className="notice notice--error" role="alert">
          <div className="notice__body">{error}</div>
          <button className="btn btn--outline btn--sm" onClick={() => void load(() => true)}>Retry</button>
        </div>
      )}
      {loading ? (
        <div className="space-y-3 max-w-4xl" aria-busy="true">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="card p-4 flex items-start gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-[var(--green-light)] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-[var(--color-border)]" />
                <div className="h-3 w-2/3 rounded bg-[var(--color-border)]" />
                <div className="h-2 w-1/4 rounded bg-[var(--color-border)]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl">
          {items.length === 0 && <p className="ink-soft">No notifications.</p>}
          {items.map((n: any) => (
            <div key={n.id} className={`card p-4 flex items-start gap-3 ${n.isRead ? "" : "border-[var(--green-line)] bg-[var(--green-softer)]"}`}>
              <div className="w-9 h-9 rounded-full bg-[var(--green-light)] border border-[var(--green-line)] flex items-center justify-center text-[11px] font-bold text-[var(--green-mid)] shrink-0">
                {n.type?.split(".").pop()?.charAt(0)?.toUpperCase() || "N"}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="font-semibold ink-body">{n.title}</div>
                <div className="text-sm ink-soft">{n.body}</div>
                <div className="text-xs ink-soft">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              {!n.isRead && <button className="ml-auto btn-xs btn-outline shrink-0" onClick={() => mark(n.id)}>Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
