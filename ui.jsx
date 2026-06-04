/* ===== shared UI: icons, avatar, pill ===== */

function Icon({ name, size = 18, sw = 1.7 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></>,
    users: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.2a3 3 0 0 1 0 5.8M17 19.5c0-2.4-1.2-4.2-3-4.8"/></>,
    leaf: <><path d="M4 20c0-9 6-15 16-15 0 10-6 16-15 16-1 0-1-1-1-1z"/><path d="M5 19c4-5 8-8 13-10"/></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
    chevL: <path d="M15 5l-7 7 7 7"/>,
    chevR: <path d="M9 5l7 7-7 7"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="M6 6l12 12M18 6L6 18"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    phone: <path d="M5 4h4l2 5-3 2a13 13 0 0 0 5 5l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 3 6c0-1 1-2 2-2z"/>,
    spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></>,
    note: <><path d="M5 3h11l4 4v14H5z"/><path d="M15 3v5h5M9 13h7M9 17h5"/></>,
    user: <><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></>,
    money: <><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5h.01M18 14.5h.01"/></>,
    check: <path d="M5 12.5l4.5 4.5L19 7"/>,
    panel: <><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9 4.5v15"/></>,
    pen: <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>,
    refresh: <path d="M1 4v6h6M23 20v-6h-6M20.5 9A9 9 0 0 0 5.2 5.2M3.5 15a9 9 0 0 0 14.8 3.8"/>,
    eye: <><path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="M17.9 17.9A10.1 10.1 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
    sun: <><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M19.5 4.5l-1.8 1.8M6.3 17.7l-1.8 1.8"/></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
}

function initials(name) {
  return name.replace(/\s+/g, " ").trim().charAt(0);
}

function Avatar({ name, color, size = 36 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size*0.38,
      background: `linear-gradient(150deg, ${PALETTE[color].avatar}, color-mix(in oklch, ${PALETTE[color].avatar}, black 18%))` }}>
      {initials(name)}
    </div>
  );
}

function Pill({ status, sm }) {
  const s = STATUSES[status];
  return (
    <span className="pill" style={{ color: s.ink, background: s.bg, fontSize: sm ? 11 : 12,
      padding: sm ? "3px 8px" : "4px 10px" }}>
      <span className="dot"></span>{s.label}
    </span>
  );
}

Object.assign(window, { Icon, Avatar, Pill, initials });
