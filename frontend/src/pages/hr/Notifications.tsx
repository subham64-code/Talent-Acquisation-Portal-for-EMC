import { useEffect, useState } from "react";
import { hrApi } from "../../lib/api";

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
    await hrApi.markRead(id);
    setItems(items.map((n) => n.id === id ? { ...n, isRead: true } : items));
    setCount(Math.max(0, count - 1));
  };

  const markAll = async () => {
    await hrApi.markReadAll();
    setItems(items.map((n) => ({ ...n, isRead: true })));
    setCount(0);
  };

  return (
    <div className="min-h-screen bg-surface p-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold ink-body">Notifications</h2>
        <div className="flex items-center gap-2">
          <span className={`badge ${count > 0 ? "badge border-[#F28C28]/30 bg-[#F28C28]/10 text-[#F28C28]/80" : "badge line-border surface-ink/5 ink-body"}`}>{count} unread</span>
          <button className="btn-sm btn-outline" onClick={markAll} disabled={count === 0}>Mark all read</button>
        </div>
      </div>
      {loading ? <div className="h-64 flex items-center justify-center ink-soft">Loadingâ€¦</div> : (
        <div className="space-y-3">
          {items.length === 0 && <p className="ink-soft">No notifications.</p>}
          {items.map((n: any) => (
            <div key={n.id} className={`card p-4 flex items-start gap-3 ${n.isRead ? "" : "border-brand-50/50 bg-brand-25"}`}>
              <div className="w-8 h-8 rounded-full bg-ink/100 flex items-center justify-center text-[10px] font-bold ink-body">{n.type.split(".").pop()?.charAt(0) || "N"}</div>
              <div className="flex flex-col gap-1">
                <div className="font-medium ink-body">{n.title}</div>
                <div className="text-sm ink-soft">{n.body}</div>
                <div className="text-xs ink-soft">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              {!n.isRead && <button className="ml-2 btn-xs btn-outline" onClick={() => mark(n.id)}>Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

