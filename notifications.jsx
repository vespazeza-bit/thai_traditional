/* ===== Notification System ===== */

// ── Meta ──────────────────────────────────────────────────────────────────────
const NOTIF_META = {
  upcoming_queue: { label: "คิวจะถึง",    icon: "⏰", color: "oklch(0.54 0.18 25)",  bg: "oklch(0.99 0.025 30)" },
  tomorrow_appt:  { label: "วันนัด",       icon: "🔔", color: "oklch(0.48 0.10 268)", bg: "oklch(0.98 0.020 268)" },
  change:         { label: "เปลี่ยนแปลง",  icon: "🔄", color: "oklch(0.46 0.14 148)", bg: "oklch(0.98 0.018 148)" },
};

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadNotifs() {
  try { return JSON.parse(localStorage.getItem('thai_notifs') || '[]'); } catch { return []; }
}
function saveNotifs(arr) {
  try { localStorage.setItem('thai_notifs', JSON.stringify(arr.slice(0, 100))); } catch {}
}

// ── Builders ──────────────────────────────────────────────────────────────────
function buildTomorrowNotifs(appts, todayKey) {
  const d = new Date(todayKey + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const tKey = dayKey(d);
  return (appts[tKey] || [])
    .filter(a => a.status !== "cancelled" && a.id && a.id.includes('_new_'))
    .map(a => ({
      id: `tmrw_${a.id}_${tKey}`,
      type: "tomorrow_appt",
      apptId: a.id,
      dateKey: tKey,
      title: "นัดพรุ่งนี้",
      body: `${a.customer || 'ผู้รับบริการ'} · ${fmtMin(a.start)}`,
      extra: { serviceId: a.serviceId, therapistId: a.therapistId },
      read: false, urgent: false, at: Date.now(),
    }));
}

function buildUpcomingQueueNotifs(appts, todayKey) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (appts[todayKey] || [])
    .filter(a => ["booked", "confirmed"].includes(a.status) && a.id && a.id.includes('_new_'))
    .reduce((acc, a) => {
      const diff = a.start - nowMin;
      if (diff < 0 || diff > 60) return acc;
      acc.push({
        id: `queue_${a.id}`,
        type: "upcoming_queue",
        apptId: a.id,
        dateKey: todayKey,
        minsLeft: diff,
        title: diff <= 15 ? "คิวด่วน!" : "คิวกำลังจะถึง",
        body: `${a.customer || 'ผู้รับบริการ'} · อีก ${diff} นาที`,
        read: false, urgent: diff <= 15, at: Date.now(),
      });
      return acc;
    }, []);
}

// ── Bell button ───────────────────────────────────────────────────────────────
function NotifBell({ notifs, onClick }) {
  const unread = notifs.filter(n => !n.read).length;
  return (
    <button onClick={onClick} className="icon-btn" style={{ position: "relative" }}>
      <Icon name="bell" size={19} />
      {unread > 0 && (
        <span style={{
          position: "absolute", top: 2, right: 2,
          background: "oklch(0.55 0.22 25)", color: "#fff",
          borderRadius: 100, fontSize: 9, fontWeight: 800,
          minWidth: 15, height: 15, padding: "0 3px",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", lineHeight: 1,
        }}>{unread > 9 ? "9+" : unread}</span>
      )}
    </button>
  );
}

// ── Single item ───────────────────────────────────────────────────────────────
function NotifItem({ n, onRead, onGotoQueue }) {
  const meta = NOTIF_META[n.type] || NOTIF_META.tomorrow_appt;
  return (
    <div
      onClick={() => { if (!n.read) onRead(n.id); }}
      style={{
        display: "flex", gap: 10, padding: "11px 14px",
        borderBottom: "1px solid var(--line-soft)", cursor: n.read ? "default" : "pointer",
        background: n.read ? "transparent" : meta.bg,
        borderLeft: n.urgent ? "3px solid oklch(0.55 0.22 25)" : "3px solid transparent",
        transition: "background .15s",
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1.3, flexShrink: 0 }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <div style={{
            fontWeight: n.read ? 500 : 700, fontSize: 13,
            color: n.urgent ? "oklch(0.48 0.22 25)" : "var(--ink)",
          }}>{n.title}</div>
          {!n.read && (
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
          )}
        </div>
        <div style={{
          fontSize: 12, marginTop: 2,
          color: n.urgent ? "oklch(0.50 0.18 25)" : "var(--ink-soft)",
          fontWeight: n.urgent ? 600 : 400,
        }}>{n.body}</div>
        {n.changeDetail && (
          <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>{n.changeDetail}</div>
        )}
        {n.type === "upcoming_queue" && (
          <button
            onClick={e => { e.stopPropagation(); onGotoQueue(); }}
            style={{
              marginTop: 5, fontSize: 11, padding: "2px 10px", borderRadius: 6,
              border: `1px solid ${meta.color}`, color: meta.color,
              background: "none", cursor: "pointer", fontWeight: 600,
            }}>ไปหน้าเรียกคิว →</button>
        )}
      </div>
    </div>
  );
}

// ── Notification Panel ────────────────────────────────────────────────────────
function NotificationPanel({ notifs, onRead, onReadAll, onClose, onGotoQueue }) {
  const [filter, setFilter] = React.useState("all");

  const unread = notifs.filter(n => !n.read).length;
  const counts = {
    all:            notifs.length,
    upcoming_queue: notifs.filter(n => n.type === "upcoming_queue").length,
    tomorrow_appt:  notifs.filter(n => n.type === "tomorrow_appt").length,
    change:         notifs.filter(n => n.type === "change").length,
  };
  const TABS = [
    ["all", "ทั้งหมด"],
    ["upcoming_queue", "คิวจะถึง"],
    ["tomorrow_appt", "วันนัด"],
    ["change", "เปลี่ยนแปลง"],
  ];
  const visible = filter === "all" ? notifs : notifs.filter(n => n.type === filter);

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: "fixed", inset: 0, zIndex: 149 }} onClick={onClose} />
      {/* Panel */}
      <div style={{
        position: "absolute", right: 0, top: "calc(100% + 8px)",
        width: 360, zIndex: 150,
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,.18)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--line-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              การแจ้งเตือน
              {unread > 0 && (
                <span style={{
                  background: "oklch(0.55 0.22 25)", color: "#fff",
                  borderRadius: 100, fontSize: 10, fontWeight: 800, padding: "2px 7px",
                }}>{unread}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {unread > 0 && (
                <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={onReadAll}>
                  อ่านทั้งหมด
                </button>
              )}
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}>
                <Icon name="close" size={14} />
              </button>
            </div>
          </div>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {TABS.filter(([k]) => k === "all" || counts[k] > 0).map(([k, lb]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 100,
                border: `1px solid ${filter === k ? "var(--primary)" : "var(--line)"}`,
                fontWeight: 600, cursor: "pointer",
                background: filter === k ? "var(--primary)" : "transparent",
                color: filter === k ? "#fff" : "var(--ink-soft)",
              }}>
                {lb} <span style={{ opacity: .75 }}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "var(--ink-faint)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
              ไม่มีการแจ้งเตือน
            </div>
          ) : visible.map(n => (
            <NotifItem key={n.id} n={n} onRead={onRead} onGotoQueue={onGotoQueue} />
          ))}
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  NOTIF_META, loadNotifs, saveNotifs,
  buildTomorrowNotifs, buildUpcomingQueueNotifs,
  NotifBell, NotifItem, NotificationPanel,
});
