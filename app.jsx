/* ===== Main app ===== */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "herbal",
  "density": "regular",
  "fontFamily": "IBM Plex Sans Thai",
  "showNow": true,
  "showSat": true
}/*EDITMODE-END*/;

const THEMES = {
  herbal: { primary: "0.50 0.072 158", deep: "0.42 0.066 160", soft: "0.93 0.034 156", tint: "0.965 0.018 154", accent: "0.605 0.108 44" },
  indigo: { primary: "0.48 0.10 268",  deep: "0.40 0.095 268", soft: "0.93 0.04 270",  tint: "0.965 0.02 270",  accent: "0.62 0.10 44" },
  teal:   { primary: "0.52 0.09 200",  deep: "0.43 0.085 202", soft: "0.93 0.04 200",  tint: "0.965 0.02 200",  accent: "0.62 0.10 40" },
  clay:   { primary: "0.55 0.10 38",   deep: "0.46 0.095 36",  soft: "0.93 0.045 44",  tint: "0.965 0.022 44",  accent: "0.52 0.07 158" },
};

function applyTheme(name) {
  const th = THEMES[name] || THEMES.herbal;
  const r = document.documentElement.style;
  r.setProperty("--primary", `oklch(${th.primary})`);
  r.setProperty("--primary-deep", `oklch(${th.deep})`);
  r.setProperty("--primary-soft", `oklch(${th.soft})`);
  r.setProperty("--primary-tint", `oklch(${th.tint})`);
  r.setProperty("--accent", `oklch(${th.accent})`);
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onConnect, loading, error }) {
  const [sid, setSid] = useState("");

  const doConnect = () => {
    const v = sid.trim();
    if (v) onConnect(v);
  };

  return (
    <div className="login-wrap">
      <div className="login-card fade-up">
        <div className="login-logo">
          <div className="brand-mark" style={{ width: 64, height: 64, borderRadius: 20, boxShadow: "var(--shadow)" }}>
            <Icon name="leaf" size={30} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="login-brand">เรือนสมุนไพร</div>
          <div className="login-title">ระบบจัดตารางนัดหมอนวด</div>
        </div>

        <div className="login-divider" />

        <div className="login-section-label">เชื่อมต่อระบบ HOSxP</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center", lineHeight: 1.65 }}>
          กรุณาใส่ BMS Session ID ที่ได้จากระบบ HOSxP
          <br />เพื่อเข้าใช้งานและดึงข้อมูลผู้ป่วย
        </div>

        <div className="field" style={{ width: "100%" }}>
          <label>BMS Session ID</label>
          <input
            className="input"
            placeholder="วาง Session ID ที่ได้จาก HOSxP ที่นี่…"
            value={sid}
            onChange={e => setSid(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doConnect()}
            autoFocus
            style={{ fontFamily: "monospace, sans-serif", letterSpacing: "0.02em" }}
          />
        </div>

        {error && (
          <div className="login-error">
            <Icon name="close" size={15} />
            {error}
          </div>
        )}

        <button
          className="btn-fill login-submit"
          onClick={doConnect}
          disabled={loading || !sid.trim()}
        >
          {loading
            ? <><Icon name="clock" size={16} /> กำลังเชื่อมต่อ…</>
            : <><Icon name="check" size={16} /> เชื่อมต่อระบบ</>
          }
        </button>

        <div className="login-hint">
          เคล็ดลับ: เพิ่ม <code>?bms-session-id=XXXXX</code> ใน URL เพื่อเชื่อมต่ออัตโนมัติ
        </div>
      </div>
    </div>
  );
}

// ── Session status bar ────────────────────────────────────────────────────────

function SessionBar({ userInfo, onDisconnect }) {
  const name = userInfo && userInfo.name;
  const loc  = userInfo && userInfo.location;
  return (
    <div className="session-bar">
      <div className="session-dot" />
      <div className="session-info">
        {name && <span className="session-name">{name}</span>}
        {loc  && <span className="session-loc">{loc}</span>}
        {!name && !loc && <span className="session-name">เชื่อมต่อ HOSxP แล้ว</span>}
      </div>
      <button className="session-disconnect" onClick={onDisconnect} title="ออกจากระบบ HOSxP">
        <Icon name="close" size={14} /> ออก
      </button>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ collapsed, onToggle }) {
  const nav = [
    { id: "sched", icon: "calendar", label: "ตารางนัด", active: true },
    { id: "cust", icon: "users", label: "ลูกค้า" },
    { id: "ther", icon: "user", label: "หมอนวด" },
    { id: "svc", icon: "leaf", label: "บริการ" },
    { id: "report", icon: "chart", label: "รายงาน" },
  ];
  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
      <div className="brand">
        <div className="brand-mark"><Icon name="leaf" size={20} /></div>
        <div className="brand-text">
          <div className="brand-name">เรือนสมุนไพร</div>
          <div className="brand-sub">นวดแผนไทย</div>
        </div>
      </div>
      <div className="nav-section">เมนูหลัก</div>
      {nav.map(n => (
        <button key={n.id} className={"nav-item" + (n.active ? " active" : "")}>
          <Icon name={n.icon} size={19} />
          <span className="nav-label">{n.label}</span>
        </button>
      ))}
      <div className="side-foot">
        <button className="nav-item" onClick={onToggle}>
          <Icon name="panel" size={19} />
          <span className="nav-label">ย่อแถบเมนู</span>
        </button>
        <button className="nav-item">
          <Icon name="settings" size={19} />
          <span className="nav-label">ตั้งค่า</span>
        </button>
      </div>
    </aside>
  );
}

function Stat({ icon, val, lab, ink, bg }) {
  return (
    <div className="stat">
      <div className="stat-ic" style={{ background: bg, color: ink }}><Icon name={icon} size={19} /></div>
      <div><div className="stat-val">{val}</div><div className="stat-lab">{lab}</div></div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const todayKey = useMemo(() => dayKey(new Date()), []);
  const [date, setDate] = useState(() => new Date());
  const [appts, setAppts] = useState({});
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [booking, setBooking] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");

  // BMS Session state
  const [bms, setBms] = useState({
    connected: false,
    loading: false,
    error: null,
    config: null,
    userInfo: null,
  });

  useEffect(() => { applyTheme(t.theme); }, [t.theme]);
  useEffect(() => { document.documentElement.dataset.density = t.density; }, [t.density]);
  useEffect(() => { document.body.style.fontFamily = `"${t.fontFamily}", system-ui, sans-serif`; }, [t.fontFamily]);

  // Auto-connect from URL or cookie on mount
  useEffect(() => {
    const urlId = getSessionFromUrl();
    if (urlId) {
      removeSessionFromUrl();
      connectBms(urlId);
    } else {
      const cookieId = getSessionCookie();
      if (cookieId) connectBms(cookieId);
    }
  }, []);

  const connectBms = async (sessionId) => {
    setBms(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await retrieveBmsSession(sessionId);
      if (data.MessageCode === 500) throw new Error("Session หมดอายุ กรุณา login HOSxP ใหม่");
      if (data.MessageCode !== 200) throw new Error(data.Message || "ไม่สามารถเชื่อมต่อได้");
      const config   = extractConnectionConfig(data);
      const userInfo = (data.result && data.result.user_info) || {};
      setSessionCookie(sessionId);
      setBms({ connected: true, loading: false, error: null, config, userInfo });
    } catch (e) {
      setBms(prev => ({ ...prev, loading: false, error: e.message }));
    }
  };

  const disconnectBms = () => {
    removeSessionCookie();
    setBms({ connected: false, loading: false, error: null, config: null, userInfo: null });
  };

  const executeQuery = async (sql) => {
    try {
      const data = await executeSqlViaApi(sql, bms.config);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Show login screen when not connected (and not auto-loading)
  if (!bms.connected) {
    return (
      <>
        <LoginScreen onConnect={connectBms} loading={bms.loading} error={bms.error} />
        <TweaksPanel>
          <TweakSection label="ธีมสี" />
          <TweakRadio label="โทนหลัก" value={t.theme}
            options={["herbal", "indigo", "teal", "clay"]}
            onChange={v => setTweak("theme", v)} />
        </TweaksPanel>
      </>
    );
  }

  const key = dayKey(date);
  const dayAppts = appts[key] || (appts[key] = genDay(date, todayKey));
  useEffect(() => {
    if (!appts[key]) setAppts(p => ({ ...p, [key]: genDay(date, todayKey) }));
  }, [key]);

  const list = appts[key] || dayAppts;
  const visibleTherapists = filter === "all" ? THERAPISTS : THERAPISTS.filter(x => x.id === filter);
  const filtered = list.filter(a =>
    (filter === "all" || a.therapistId === filter) &&
    (!query || a.customer.includes(query) || (a.phone || "").includes(query))
  );

  const rowH = t.density === "compact" ? 46 : t.density === "comfy" ? 70 : 58;

  const active  = list.filter(a => a.status !== "cancelled");
  const revenue = active.filter(a => a.status === "done").reduce((s, a) => s + svc(a.serviceId).price, 0);
  const upcoming = active.filter(a => a.status === "booked" || a.status === "confirmed").length;
  const inHouse  = active.filter(a => a.status === "arrived" || a.status === "service").length;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };
  const shiftDay = (d) => { const nd = new Date(date); nd.setDate(nd.getDate() + d); setDate(nd); };
  const td = thaiDate(date);
  const selectedAppt = list.find(a => a.id === selected);

  const saveBooking = (data) => {
    const id = `a${key}_new_${Date.now()}`;
    setAppts(p => ({ ...p, [key]: [...(p[key] || list), { ...data, id }] }));
    setBooking(null);
    showToast("จองนัดเรียบร้อยแล้ว");
  };
  const setStatus = (appt, status) => {
    setAppts(p => ({ ...p, [key]: (p[key] || list).map(a => a.id === appt.id ? { ...a, status } : a) }));
    showToast(`อัปเดตเป็น "${STATUSES[status].label}"`);
  };
  const cancelAppt = (appt) => {
    setAppts(p => ({ ...p, [key]: (p[key] || list).map(a => a.id === appt.id ? { ...a, status: "cancelled" } : a) }));
    setSelected(null);
    showToast("ยกเลิกนัดแล้ว");
  };

  return (
    <div className="app">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">ตารางนัดหมอนวด</div>
            <div className="page-sub">จัดการคิวและนัดหมายประจำวัน</div>
          </div>
          <div className="spacer"></div>
          <SessionBar userInfo={bms.userInfo} onDisconnect={disconnectBms} />
          <div className="search">
            <Icon name="search" size={16} />
            <input placeholder="ค้นหาชื่อ / เบอร์โทร" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => setBooking({ therapistId: THERAPISTS[0].id, start: OPEN_MIN })}>
            <Icon name="plus" size={17} /> จองนัดใหม่
          </button>
        </div>

        <div className="topbar" style={{ borderTop: "none", paddingTop: 12, paddingBottom: 12 }}>
          <button className="today-btn" onClick={() => setDate(new Date())}>วันนี้</button>
          <div className="date-nav">
            <button className="icon-btn" onClick={() => shiftDay(-1)}><Icon name="chevL" /></button>
            <div className="date-display">
              <div className="date-main">{td.dow} {td.dm}</div>
              <div className="date-meta">{td.full} {key === todayKey && "· วันนี้"}</div>
            </div>
            <button className="icon-btn" onClick={() => shiftDay(1)}><Icon name="chevR" /></button>
          </div>
          <div className="spacer"></div>
          <div className="seg">
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>ทุกคน</button>
            {THERAPISTS.map(tt => (
              <button key={tt.id} className={filter === tt.id ? "on" : ""} onClick={() => setFilter(tt.id)}>
                {tt.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="stats">
          <Stat icon="calendar" val={active.length}     lab="นัดทั้งหมดวันนี้"   ink="var(--st-booked-ink)"  bg="var(--st-booked-bg)" />
          <Stat icon="clock"    val={upcoming}           lab="รอเข้ารับบริการ"   ink="var(--st-arrived-ink)" bg="var(--st-arrived-bg)" />
          <Stat icon="spark"    val={inHouse}            lab="อยู่ในร้านขณะนี้"   ink="var(--st-service-ink)" bg="var(--st-service-bg)" />
          <Stat icon="money"    val={revenue.toLocaleString() + "฿"} lab="รายได้ (เสร็จสิ้น)" ink="var(--st-confirm-ink)" bg="var(--st-confirm-bg)" />
        </div>

        <div className="board-wrap">
          <Board
            appts={filtered} therapists={visibleTherapists} rowH={rowH}
            showNow={t.showNow && key === todayKey}
            onSlot={(tid, start) => setBooking({ therapistId: tid, start })}
            onAppt={(a) => setSelected(a.id)}
          />
        </div>
      </div>

      <BookingForm
        open={!!booking} draft={booking} therapists={THERAPISTS}
        onClose={() => setBooking(null)} onSave={saveBooking}
        executeQuery={executeQuery}
      />
      <DetailPanel
        open={!!selected} appt={selectedAppt}
        onClose={() => setSelected(null)} onStatus={setStatus} onCancel={cancelAppt}
      />

      <div className={"toast" + (toast ? " show" : "")}>
        <Icon name="check" size={16} /> {toast}
      </div>

      <TweaksPanel>
        <TweakSection label="ธีมสี" />
        <TweakRadio label="โทนหลัก" value={t.theme}
          options={["herbal", "indigo", "teal", "clay"]}
          onChange={v => setTweak("theme", v)} />
        <TweakSection label="การแสดงผล" />
        <TweakRadio label="ความหนาแน่น" value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={v => setTweak("density", v)} />
        <TweakSelect label="ฟอนต์" value={t.fontFamily}
          options={["IBM Plex Sans Thai", "Sarabun", "Prompt", "Noto Sans Thai"]}
          onChange={v => setTweak("fontFamily", v)} />
        <TweakToggle label="เส้นเวลาปัจจุบัน" value={t.showNow}
          onChange={v => setTweak("showNow", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
