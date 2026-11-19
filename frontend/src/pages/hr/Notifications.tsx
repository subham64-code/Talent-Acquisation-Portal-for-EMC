import { useEffect, useState } from "react";
import { hrApi } from "../../lib/api";
import PageHeader from "../../components/ref/PageHeader";

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hrApi.notifications({ page: 1, pageSize: 50 }).then((r: any) => setItems(r.data.items ?? r.data)).catch(() => setItems([])),
      hrApi.unreadCount().then((r: any) => setCount(r.data.count ?? 0)).catch(() => setCount(0)),
    ]).finally(() => setLoading(false));
  }, []);

  const mark = async (id: string) => {
    try {
      await hrApi.markRead(id);
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
      {loading ? (
        <div className="h-64 flex items-center justify-center ink-soft">Loading…</div>
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
