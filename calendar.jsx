/* ===== Timeline board: หมอนวด × เวลา ===== */
const { useState, useEffect, useRef, useMemo } = React;

/* ── Custom tooltip portal ── */
function ApptTooltip({ data, pos }) {
  if (!data || !pos) return null;
  const { a, s } = data;
  const displayName = a.customer || (a.hn ? `HN ${a.hn}` : '—');
  const st = STATUSES[a.status] || STATUSES.booked;
  // position: try right of cursor, clamp to viewport
  const vpW = window.innerWidth;
  const tipW = 230;
  const left = pos.x + 14 + tipW > vpW ? pos.x - tipW - 8 : pos.x + 14;
  const top  = Math.min(pos.y - 8, window.innerHeight - 160);
  return ReactDOM.createPortal(
    <div className="appt-tip" style={{ top, left }}>
      <div className="appt-tip-time">
        <Icon name="clock" size={11} />
        {fmtMin(a.start)}–{fmtMin(a.start + s.dur)} · {s.dur}น.
      </div>
      <div className="appt-tip-divider" />
      {a.hn && <div className="appt-tip-hn">HN {a.hn}</div>}
      <div className="appt-tip-name">{displayName}</div>
      {s.name && <div className="appt-tip-svc">
        <Icon name="leaf" size={11} /> {s.name}
      </div>}
      <div className="appt-tip-status" style={{ color: st.ink, background: st.bg }}>
        {st.label}
      </div>
    </div>,
    document.body
  );
}

function TimeGutter() {
  const rows = [];
  for (let m = OPEN_MIN; m <= CLOSE_MIN; m += SLOT) {
    rows.push(
      <div className="time-cell" key={m}>
        {m % 60 === 0 && <span>{fmtMin(m)}</span>}
      </div>
    );
  }
  return (
    <div className="col-time">
      <div className="time-head"></div>
      {rows}
    </div>
  );
}

function ApptCard({ a, rowH, onClick }) {
  const s = svc(a.serviceId) || { name: a.serviceId || '—', dur: 60, price: 0 };
  const st = STATUSES[a.status] || STATUSES["booked"];
  const top = ((a.start - OPEN_MIN) / SLOT) * rowH;
  const height = (s.dur / SLOT) * rowH - 4;
  const cancelled = a.status === "cancelled";
  const done = a.status === "done";
  const displayName = a.customer || (a.hn ? `HN ${a.hn}` : '—');
  const hnLabel = a.hn ? `HN ${a.hn}` : '';
  const [tipPos, setTipPos] = useState(null);

  return (
    <>
      <div
        className="appt"
        style={{
          top: top + 2, height,
          background: st.bg,
          borderLeftColor: st.ink,
          color: st.ink,
          opacity: cancelled ? 0.5 : 1,
          textDecoration: cancelled ? "line-through" : "none",
          filter: done ? "saturate(0.7)" : "none",
        }}
        onMouseEnter={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e)  => setTipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={()  => setTipPos(null)}
        onClick={(e) => { e.stopPropagation(); setTipPos(null); onClick(a); }}
      >
        {hnLabel && <div className="appt-hn">{hnLabel}</div>}
        <div className="appt-name" style={{ color: "var(--ink)" }}>{displayName}</div>
        {(a.status === "service" || a.status === "arrived") && (
          <span className="appt-tag" style={{ color: st.ink }}>
            {a.status === "service" ? "● กำลังนวด" : "มาถึง"}
          </span>
        )}
      </div>
      <ApptTooltip data={tipPos ? { a, s } : null} pos={tipPos} />
    </>
  );
}

function TherapistColumn({ t, appts, rowH, onSlot, onAppt }) {
  const [hover, setHover] = useState(null);
  const bodyRef = useRef(null);
  const nRows = (CLOSE_MIN - OPEN_MIN) / SLOT;
  const lines = [];
  for (let i = 0; i < nRows; i++) {
    const m = OPEN_MIN + i * SLOT;
    lines.push(<div key={i} className={"slot-line" + (m % 60 === 0 ? " hour" : "")}></div>);
  }
  const handleMove = (e) => {
    const rect = bodyRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = Math.floor(y / rowH);
    const m = OPEN_MIN + slot * SLOT;
    // occupied?
    const occupied = appts.some(a => {
      const sv = svc(a.serviceId) || { dur: 60 };
      return a.status !== "cancelled" && m >= a.start && m < a.start + sv.dur;
    });
    setHover(occupied ? null : m);
  };
  return (
    <div className="therapist-col" style={{ minWidth: "var(--col-min)" }}>
      <div className="col-head">
        <Avatar name={t.name} color={t.color} />
        <div style={{ minWidth: 0 }}>
          <div className="col-name">{t.name}</div>
          <div className="col-spec">{t.spec}</div>
        </div>
      </div>
      <div
        className="col-body" ref={bodyRef}
        style={{ height: nRows * rowH }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={() => hover != null && onSlot(t.id, hover)}
      >
        {lines}
        <div
          className={"slot-hover" + (hover != null ? " show" : "")}
          style={{ top: hover != null ? ((hover - OPEN_MIN)/SLOT)*rowH + 2 : 0, height: rowH - 4 }}
        >
          + {hover != null ? fmtMin(hover) : ""}
        </div>
        {appts.map(a => <ApptCard key={a.id} a={a} rowH={rowH} onClick={onAppt} />)}
      </div>
    </div>
  );
}

function NowLine({ rowH, show }) {
  const [min, setMin] = useState(() => new Date().getHours()*60 + new Date().getMinutes());
  useEffect(() => {
    const id = setInterval(() => setMin(new Date().getHours()*60 + new Date().getMinutes()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!show || min < OPEN_MIN || min > CLOSE_MIN) return null;
  const top = 64 + ((min - OPEN_MIN) / SLOT) * rowH;
  return <div className="now-line" style={{ top }} title={"ตอนนี้ " + fmtMin(min)}></div>;
}

function Board({ appts, therapists, rowH, onSlot, onAppt, showNow }) {
  const cols = `72px repeat(${therapists.length}, minmax(var(--col-min), 1fr))`;
  return (
    <div className="board">
      <div className="board-scroll">
        <NowLine rowH={rowH} show={showNow} />
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <TimeGutter />
          {therapists.map(t => (
            <TherapistColumn
              key={t.id} t={t} rowH={rowH}
              appts={appts.filter(a => a.therapistId === t.id)}
              onSlot={onSlot} onAppt={onAppt}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Board });
