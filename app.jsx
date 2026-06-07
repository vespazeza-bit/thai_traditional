/* ===== Main app ===== */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "herbal",
  "density": "regular",
  "fontFamily": "Sarabun",
  "showNow": true,
  "showSat": true
}/*EDITMODE-END*/;

const THEMES = {
  herbal:   { primary: "0.50 0.072 158", deep: "0.42 0.066 160", soft: "0.93 0.034 156", tint: "0.965 0.018 154", accent: "0.605 0.108 44" },
  indigo:   { primary: "0.48 0.10 268",  deep: "0.40 0.095 268", soft: "0.93 0.04 270",  tint: "0.965 0.02 270",  accent: "0.62 0.10 44" },
  teal:     { primary: "0.52 0.09 200",  deep: "0.43 0.085 202", soft: "0.93 0.04 200",  tint: "0.965 0.02 200",  accent: "0.62 0.10 40" },
  clay:     { primary: "0.55 0.10 38",   deep: "0.46 0.095 36",  soft: "0.93 0.045 44",  tint: "0.965 0.022 44",  accent: "0.52 0.07 158" },
  ocean:    { primary: "0.50 0.12 236",  deep: "0.42 0.11 234",  soft: "0.93 0.045 234", tint: "0.965 0.022 234", accent: "0.60 0.11 200" },
  hibiscus: { primary: "0.50 0.14 350",  deep: "0.42 0.13 348",  soft: "0.93 0.050 348", tint: "0.965 0.025 346", accent: "0.60 0.12 30" },
  mocha:    { primary: "0.48 0.11 42",   deep: "0.40 0.10 40",   soft: "0.93 0.042 46",  tint: "0.965 0.020 48",  accent: "0.62 0.12 78" },
  dark:     { primary: "0.65 0.10 158",  deep: "0.55 0.09 158",  soft: "0.28 0.07 158",  tint: "0.25 0.05 154",   accent: "0.65 0.12 44",
    _dark: true,
    bg: "0.17 0.022 158", surface: "0.22 0.019 158", surface2: "0.26 0.019 158", surface3: "0.30 0.018 156",
    ink: "0.93 0.008 82", inkSoft: "0.76 0.008 80", inkFaint: "0.55 0.008 78",
    line: "0.33 0.020 158", lineSoft: "0.29 0.018 158",
  },
};

const DARK_VARS = ["--bg","--surface","--surface-2","--surface-3","--ink","--ink-soft","--ink-faint","--line","--line-soft"];

function applyTheme(name) {
  const th = THEMES[name] || THEMES.herbal;
  const r = document.documentElement.style;
  r.setProperty("--primary",      `oklch(${th.primary})`);
  r.setProperty("--primary-deep", `oklch(${th.deep})`);
  r.setProperty("--primary-soft", `oklch(${th.soft})`);
  r.setProperty("--primary-tint", `oklch(${th.tint})`);
  r.setProperty("--accent",       `oklch(${th.accent})`);
  if (th._dark) {
    r.setProperty("--bg",         `oklch(${th.bg})`);
    r.setProperty("--surface",    `oklch(${th.surface})`);
    r.setProperty("--surface-2",  `oklch(${th.surface2})`);
    r.setProperty("--surface-3",  `oklch(${th.surface3})`);
    r.setProperty("--ink",        `oklch(${th.ink})`);
    r.setProperty("--ink-soft",   `oklch(${th.inkSoft})`);
    r.setProperty("--ink-faint",  `oklch(${th.inkFaint})`);
    r.setProperty("--line",       `oklch(${th.line})`);
    r.setProperty("--line-soft",  `oklch(${th.lineSoft})`);
  } else {
    DARK_VARS.forEach(v => r.removeProperty(v));
  }
}

const PALETTE_KEYS = ["green", "clay", "blue", "plum", "gold"];

// Thai label map สำหรับ column ใน health_med_provider
const HMP_LABELS = {
  provider_id:"รหัส", pname:"คำนำหน้า", fname:"ชื่อ", lname:"นามสกุล",
  license_no:"เลขที่ใบประกอบวิชาชีพ", cid:"เลขบัตรประชาชน",
  active:"สถานะ", fullname:"ชื่อ-สกุล",
  school_name:"สถานศึกษา", education_type:"วุฒิการศึกษา",
  service_type:"ชนิดการบริการ", provider_type:"ประเภทการให้บริการ",
  license_type:"ประเภทใบอนุญาต", branch:"สาขา/หลักสูตร",
};

function colLabel(rawKey) {
  const stripped = rawKey.replace(/^health_med_provider_/, "");
  return HMP_LABELS[stripped] || HMP_LABELS[rawKey]
    || stripped.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ดึงค่าจาก row โดยลอง key หลายรูปแบบ (รองรับทั้ง "fname" และ "health_med_provider_fname")
function rowGet(row, ...keys) {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && val !== null && val !== "") return String(val).trim();
    const prefixed = `health_med_provider_${k}`;
    const val2 = row[prefixed];
    if (val2 !== undefined && val2 !== null && val2 !== "") return String(val2).trim();
  }
  // สุดท้าย: ค้นหา key ที่มี keyword ใน raw object
  for (const k of keys) {
    const found = Object.keys(row).find(c => c.toLowerCase().endsWith(`_${k}`) || c === k);
    if (found && row[found] !== null && row[found] !== undefined && row[found] !== "")
      return String(row[found]).trim();
  }
  return "";
}

// ตัดคำนำหน้าออกจาก fullname แล้วย่อนามสกุล: "น.ส.กนกพร ปิงคำ" → "กนกพร ป."
function shortenFromFullname(fullname, pname) {
  if (!fullname) return "";
  // ลบ pname ออกก่อน (ถ้ามี)
  let s = pname ? fullname.replace(pname, "").trim() : fullname.trim();
  // ลบคำนำหน้าที่รู้จัก เผื่อ pname ไม่ตรง
  s = s.replace(/^(น\.ส\.|นาย|นาง(?:สาว)?|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)\s*/u, "").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullname;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function mapProviderRow(row, i) {
  const id      = rowGet(row, "health_med_provider_id", "provider_id", "id") || i;
  const pname   = rowGet(row, "pname", "prefix", "title");
  const license = rowGet(row, "license_no", "license_number", "certificate_no", "license");

  // fullname จาก SQL CONCAT — แสดงถูกต้องเสมอแม้ fname/lname อาจ encode ผิด
  const fullname = (row.fullname || "").trim() || `ผู้ให้บริการ ${i + 1}`;

  // shortName: ดึงจาก fullname เพื่อหลีกเลี่ยง encoding issue ของ fname/lname
  const shortName = shortenFromFullname(fullname, pname) || fullname;

  const spec = rowGet(row, "provider_type_name", "position_name")
    || (license ? `ใบอนุญาต ${license}` : "แพทย์แผนไทย");

  return {
    id: `hmp_${id}`, name: shortName, fullname, spec, license,
    color: PALETTE_KEYS[i % PALETTE_KEYS.length], since: "",
    _raw: row,
  };
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onConnect, loading, error }) {
  const [sid, setSid] = useState("");
  const go = () => { const v = sid.trim(); if (v) onConnect(v); };
  return (
    <div className="login-wrap">
      <div className="login-card fade-up">
        <div className="login-logo">
          <div className="brand-mark" style={{ width: 64, height: 64, borderRadius: 20, overflow: "hidden", background: "none", boxShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
            <img src="thaimed scheduler.png" alt="ThaiMed Scheduler" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div className="login-brand">ThaiMed Scheduler</div>
          <div className="login-title">ระบบจัดการคิวนัดหมายบริการแพทย์แผนไทย</div>
        </div>
        <div className="login-divider" />
        <div className="login-section-label">เชื่อมต่อระบบ HOSxP</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center", lineHeight: 1.65 }}>
          กรุณาใส่ BMS Session ID ที่ได้จากระบบ HOSxP<br />เพื่อเข้าใช้งานและดึงข้อมูลผู้ป่วย
        </div>
        <div className="field" style={{ width: "100%" }}>
          <label>BMS Session ID</label>
          <input className="input" placeholder="วาง Session ID ที่ได้จาก HOSxP ที่นี่…"
            value={sid} onChange={e => setSid(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
            autoFocus style={{ fontFamily: "monospace, sans-serif", letterSpacing: "0.02em" }} />
        </div>
        {error && <div className="login-error"><Icon name="close" size={15} />{error}</div>}
        <button className="btn-fill login-submit" onClick={go} disabled={loading || !sid.trim()}>
          {loading ? <><Icon name="clock" size={16} /> กำลังเชื่อมต่อ…</> : <><Icon name="check" size={16} /> เชื่อมต่อระบบ</>}
        </button>
        <div className="login-hint">เคล็ดลับ: เพิ่ม <code>?bms-session-id=XXXXX</code> ใน URL เพื่อเชื่อมต่ออัตโนมัติ</div>
      </div>
    </div>
  );
}

// ── Shared top bar ────────────────────────────────────────────────────────────

function TopBar({ userInfo, therapistStatus, onDisconnect, children, rightSlot }) {
  return (
    <div className="topbar">
      {children}
      <div className="spacer" />
      {rightSlot}
      {/* HOSxP session status */}
      <div className="session-bar">
        <div className="session-dot" />
        <div className="session-info">
          {userInfo.name  && <span className="session-name">{userInfo.name}</span>}
          {userInfo.location && <span className="session-loc">{userInfo.location}</span>}
          {!userInfo.name && !userInfo.location && <span className="session-name">HOSxP</span>}
        </div>
        <button className="session-disconnect" onClick={onDisconnect}><Icon name="close" size={14} /> ออก</button>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ activePage, onNav, collapsed, onToggle }) {
  const nav = [
    { id: "sched",  icon: "calendar", label: "ตารางนัด" },
    { id: "cust",   icon: "users",    label: "ทะเบียนผู้รับบริการ" },
    { id: "queue",  icon: "bell",     label: "เรียกคิว" },
    { id: "report", icon: "chart",    label: "รายงาน" },
  ];
  const settingsItems = [
    { id: "ther",   icon: "user",  label: "ผู้ให้บริการ" },
    { id: "svc",    icon: "leaf",  label: "บริการแพทย์แผนไทย" },
    { id: "bed",    icon: "list",  label: "เตียงบริการ" },
    { id: "screen", icon: "sun",   label: "หน้าจอ" },
  ];
  const inSettings = settingsItems.some(i => i.id === activePage);
  const [settingsOpen, setSettingsOpen] = useState(inSettings);

  useEffect(() => { if (inSettings) setSettingsOpen(true); }, [activePage]);

  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
      <div className="brand">
        <img src="thaimed scheduler.png" alt="ThaiMed Scheduler" style={{ width: "100%", display: "block", objectFit: "contain" }} />
      </div>

      <div className="nav-section">เมนูหลัก</div>
      {nav.map(n => (
        <button key={n.id} className={"nav-item" + (activePage === n.id ? " active" : "")}
          onClick={() => onNav(n.id)}>
          <Icon name={n.icon} size={19} />
          <span className="nav-label">{n.label}</span>
        </button>
      ))}

      {/* ── ตั้งค่า (expandable) ── */}
      <button
        className={"nav-item" + (inSettings && collapsed ? " active" : "")}
        style={{ justifyContent: "space-between" }}
        onClick={() => collapsed ? onNav("cust") : setSettingsOpen(o => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="settings" size={19} />
          <span className="nav-label">ตั้งค่า</span>
        </div>
        <span className="nav-label" style={{
          color: "var(--ink-faint)",
          transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform .2s",
          display: "flex",
        }}>
          <Icon name="chevR" size={14} />
        </span>
      </button>

      {settingsOpen && !collapsed && (
        <div className="nav-sub-group">
          {settingsItems.map(n => (
            <button key={n.id}
              className={"nav-item nav-sub" + (activePage === n.id ? " active" : "")}
              onClick={() => onNav(n.id)}
            >
              <Icon name={n.icon} size={16} />
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="side-foot">
        <button className="nav-item" onClick={onToggle}>
          <Icon name="panel" size={19} />
          <span className="nav-label">ย่อแถบเมนู</span>
        </button>
      </div>
    </aside>
  );
}

// ── Operation item detail modal ───────────────────────────────────────────────

const OI_LABELS = {
  item_name:"ชื่อบริการ/หัตถการ", operation_name:"ชื่อหัตถการ",
  name:"ชื่อ", price:"ราคา (บาท)", cost:"ต้นทุน",
  minute:"ระยะเวลา (นาที)", duration:"ระยะเวลา",
  icd9cm_code:"รหัส ICD-9-CM", icd10:"รหัส ICD-10",
  active:"สถานะ", group_name:"หมวดหมู่", category:"หมวดหมู่",
  description:"รายละเอียด", note:"หมายเหตุ",
};
function oiLabel(rawKey) {
  const s = rawKey.replace(/^health_med_operation_item_/, "").replace(/^health_med_/, "");
  return OI_LABELS[s] || OI_LABELS[rawKey]
    || s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function OperationDetail({ item, onClose, therFee, onSaveTherFee }) {
  const [editFee, setEditFee] = useState(therFee ?? 0);
  useEffect(() => { setEditFee(therFee ?? 0); }, [therFee, item?.id]);

  if (!item) return null;
  const raw = item._raw || {};
  const fields = Object.entries(raw).filter(([k, v]) => {
    if (v === null || v === undefined || v === "" || v === 0 || v === "0") return false;
    if (/_(type|category|group|level)_id$/i.test(k)) return false;
    if (k === "item_name") return false;
    return true;
  });
  const isActive = item.isActive !== false;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card fade-up">
        <div className="modal-head">
          <div className="drawer-title">รายละเอียดบริการ</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body">
          {/* Hero */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
            <div className="stat-ic" style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: "var(--primary-soft)", color: "var(--primary-deep)",
            }}>
              <Icon name="leaf" size={26} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>{item.name}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {item.price && (
                  <span className="hn-badge" style={{ background: "var(--st-confirm-bg)", color: "var(--st-confirm-ink)" }}>
                    <Icon name="money" size={13} /> {Number(item.price).toLocaleString()} บาท
                  </span>
                )}
                {item.minute && (
                  <span className="hn-badge">
                    <Icon name="clock" size={13} /> {item.minute} นาที
                  </span>
                )}
                <span className="pill" style={{
                  color: isActive ? "var(--st-confirm-ink)" : "var(--st-cancel-ink)",
                  background: isActive ? "var(--st-confirm-bg)" : "var(--st-cancel-bg)",
                  fontSize: 12, padding: "4px 10px",
                }}>
                  <span className="dot" />{isActive ? "ใช้งานอยู่" : "ปิดการใช้งาน"}
                </span>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: "var(--line)", marginBottom: 20 }} />
          <div className="detail-kv-grid">
            {fields.map(([k, v]) => (
              <div className="detail-kv-item" key={k}>
                <div className="detail-kv-label">{oiLabel(k)}</div>
                <div className="detail-kv-value">{String(v)}</div>
              </div>
            ))}
          </div>

          {/* ── ค่าบริการผู้ให้บริการ ── */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>ค่าบริการผู้ให้บริการ</div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 12 }}>
              อัตราค่าตอบแทนที่จ่ายให้ผู้ให้บริการต่อครั้ง — ใช้คำนวณยอดในทะเบียนผู้รับบริการ
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label>ราคา (บาท)</label>
                <div style={{ position: "relative" }}>
                  <input className="input" type="number" min="0" step="10" value={editFee}
                    onChange={e => setEditFee(Math.max(0, +e.target.value))} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    fontSize: 12, color: "var(--ink-faint)", pointerEvents: "none" }}>฿</span>
                </div>
              </div>
              <button className="btn-fill" style={{ marginBottom: 1, whiteSpace: "nowrap" }}
                onClick={() => onSaveTherFee && onSaveTherFee(item.id, editFee)}>
                บันทึก
              </button>
            </div>
            {(therFee ?? 0) > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "oklch(0.38 0.12 165)", fontWeight: 600 }}>
                ปัจจุบัน: {Number(therFee).toLocaleString()} ฿ / ครั้ง
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" style={{ width: "100%" }} onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

// ── Mini calendar date picker ─────────────────────────────────────────────────
const THAI_MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const CAL_DAY_HDR = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function MiniCalendar({ value, onChange, onClose, anchorRect }) {
  const today = new Date();
  const todayStr = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
  const initDate = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();
  const cells = [];
  for (let i = firstDay-1; i >= 0; i--) {
    const pm = viewMonth === 0 ? 11 : viewMonth-1;
    cells.push({ day: daysInPrev-i, month: pm, year: viewMonth === 0 ? viewYear-1 : viewYear, cur: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: viewMonth, year: viewYear, cur: true });
  const rem = 42 - cells.length;
  for (let d = 1; d <= rem; d++) {
    const nm = viewMonth === 11 ? 0 : viewMonth+1;
    cells.push({ day: d, month: nm, year: viewMonth === 11 ? viewYear+1 : viewYear, cur: false });
  }
  const toStr = c => `${c.year}-${String(c.month+1).padStart(2,'0')}-${String(c.day).padStart(2,'0')}`;

  const style = { position: 'fixed', zIndex: 10000 };
  if (anchorRect) {
    const vpW = window.innerWidth;
    style.top  = anchorRect.bottom + 4;
    style.left = Math.min(anchorRect.left, vpW - 306);
  }

  return ReactDOM.createPortal(
    <div className="cal-picker" style={style} onMouseDown={e => e.stopPropagation()}>
      <div className="cal-picker-head">
        <button className="cal-nav-btn" onClick={() => setViewYear(y => y-1)} title="ปีก่อน">«</button>
        <button className="cal-nav-btn" onClick={prevMonth} title="เดือนก่อน">‹</button>
        <span className="cal-picker-title">{THAI_MONTHS_FULL[viewMonth]} {viewYear+543}</span>
        <button className="cal-nav-btn" onClick={nextMonth} title="เดือนถัดไป">›</button>
        <button className="cal-nav-btn" onClick={() => setViewYear(y => y+1)} title="ปีถัดไป">»</button>
      </div>
      <div className="cal-picker-days">
        {CAL_DAY_HDR.map((d, i) => <div key={i} className={"cal-day-hd"+(i===0?" sun":"")}>{d}</div>)}
      </div>
      <div className="cal-picker-grid">
        {cells.map((c, i) => {
          const str = toStr(c);
          return (
            <button key={i}
              className={"cal-day"+(!c.cur?" other":"")+(str===todayStr?" today":"")+(str===value?" selected":"")+(i%7===0?" sun":"")}
              onClick={() => { onChange(str); onClose(); }}>
              {c.day}
            </button>
          );
        })}
      </div>
      <div className="cal-picker-foot">
        <button className="cal-foot-btn clear" onClick={() => { onChange(""); onClose(); }}>ล้าง</button>
        <button className="cal-foot-btn today-btn" onClick={() => { onChange(todayStr); onClose(); }}>วันนี้</button>
      </div>
    </div>,
    document.body
  );
}

function DatePickerInput({ label, value, onChange, placeholder = "เลือกวันที่" }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setOpen(o => !o);
  };

  const display = (() => {
    if (!value) return '';
    const [y, m, d] = value.split('-');
    const mo = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${Number(d)} ${mo[Number(m)]} ${Number(y)+543}`;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 11.5, color: "var(--ink-faint)", fontWeight: 600 }}>{label}</label>}
      <div ref={ref} className={"input cal-trigger"+(open?" active":"")}
        style={{ width: 148, fontSize: 13, padding: "6px 10px", color: value ? "var(--ink)" : "var(--ink-faint)" }}
        onClick={handleToggle}>
        <span>{display || placeholder}</span>
        <Icon name="calendar" size={13} />
      </div>
      {open && <MiniCalendar value={value} onChange={onChange} onClose={() => setOpen(false)} anchorRect={rect} />}
    </div>
  );
}

// ── Auto page size: วัด DOM จริงเพื่อคำนวณแถว/หน้าที่พอดีกับหน้าจอ ─────────────
function useAutoPageSize(contentRef, rowH = 52) {
  const [ps, setPs] = useState(10);

  const calc = React.useCallback(() => {
    const el = contentRef.current;
    if (!el || el.clientHeight === 0) return;
    const totalH = el.clientHeight;
    const gap  = parseFloat(getComputedStyle(el).gap)         || 0;
    const padT = parseFloat(getComputedStyle(el).paddingTop)  || 0;
    const padB = parseFloat(getComputedStyle(el).paddingBottom)|| 0;
    let overhead = padT + padB;
    let nonTableCount = 0;
    for (const child of el.children) {
      if (!child.classList.contains('reg-table')) {
        overhead += child.offsetHeight;
        nonTableCount++;
      }
    }
    overhead += gap * (nonTableCount + 1); // gaps including gap before table
    const head = el.querySelector('.reg-head');
    overhead += head ? head.offsetHeight : 42;
    setPs(Math.max(3, Math.floor((totalH - overhead) / rowH)));
  }, [rowH]);

  useEffect(() => {
    // รอ 2 animation frames ให้ layout settle ก่อนวัด
    const raf = requestAnimationFrame(() => requestAnimationFrame(calc));
    const ro = new ResizeObserver(calc);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [calc]);

  // recalc เมื่อ ps เปลี่ยน (rows เปลี่ยนทำให้ layout เปลี่ยน)
  useEffect(() => {
    const raf = requestAnimationFrame(calc);
    return () => cancelAnimationFrame(raf);
  }, [ps, calc]);

  return ps;
}

// ── Customers page (ทะเบียนคนไข้จากการจองนัด) ────────────────────────────────

function CustomersPage({ appts, therapistsData, operationItems,
  userInfo, therapistStatusText, onDisconnect, bmsConfig, serviceTherFees }) {

  const [search,    setSearch]    = useState("");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [ptFilter,  setPtFilter]  = useState("");
  const [page,      setPage]      = useState(1);
  const [pttypeMap, setPttypeMap] = useState({}); // hn → pttype_name จาก HOSxP
  const contentRef = useRef(null);
  const pageSize   = useAutoPageSize(contentRef, 52);

  // Build lookup maps directly from props (ไม่ใช้ window.svc/ther เพราะ timing issue)
  const svcMap = useMemo(() => {
    const fees = serviceTherFees || {};
    const m = {};
    operationItems.forEach(it => {
      m[it.id] = {
        name:    it.name  || '—',
        dur:     it.minute != null ? Number(it.minute) : (it.dur != null ? Number(it.dur) : null),
        price:   it.price  != null ? Number(it.price)  : null,
        therFee: fees[it.id] != null ? Number(fees[it.id]) : null,
      };
    });
    SERVICES.forEach(sv => {
      if (!m[sv.id]) m[sv.id] = {
        name:    sv.name,
        dur:     sv.dur,
        price:   sv.price,
        therFee: fees[sv.id] != null ? Number(fees[sv.id]) : null,
      };
    });
    return m;
  }, [operationItems, serviceTherFees]);

  const therMap = useMemo(() => {
    const m = {};
    therapistsData.forEach(t => { m[t.id] = t.fullname || t.name || t.id; });
    THERAPISTS.forEach(t => { if (!m[t.id]) m[t.id] = t.name; });
    return m;
  }, [therapistsData]);

  // Flatten appointments from all dates → rows
  const allRows = useMemo(() => {
    const rows = [];
    Object.entries(appts).forEach(([dateKey, dayAppts]) => {
      (dayAppts || []).forEach(a => {
        if (a.status === "cancelled") return;
        const sv = svcMap[a.serviceId] || {};
        rows.push({
          ...a,
          dateKey,
          svcName:    sv.name    || a.serviceId || '—',
          svcDur:     sv.dur     != null ? sv.dur     : null,
          svcPrice:   sv.price   != null ? sv.price   : null,
          svcTherFee: sv.therFee != null ? sv.therFee : null,
          therName:   therMap[a.therapistId] || a.therapistId || '—',
        });
      });
    });
    return rows.sort((a, b) =>
      b.dateKey.localeCompare(a.dateKey) || a.start - b.start
    );
  }, [appts, svcMap, therMap]);

  // Enrich สิทธิรักษา from HOSxP via ovst → visit_pttype → pttype (by date range)
  useEffect(() => {
    if (!bmsConfig?.apiUrl) return;
    const needRows = allRows.filter(r => !r.pttypeName && r.hn && r.dateKey);
    if (needRows.length === 0) return;
    const dates = needRows.map(r => r.dateKey);
    const minDate = dates.reduce((a, b) => a < b ? a : b);
    const maxDate = dates.reduce((a, b) => a > b ? a : b);
    executeSqlViaApi(
      `SELECT o.hn, MIN(e.name) AS pttype_name
       FROM ovst o
       INNER JOIN visit_pttype v ON v.vn = o.vn
       INNER JOIN patient p ON p.hn = o.hn
       INNER JOIN pttype e ON e.pttype = v.pttype
       WHERE o.vstdate BETWEEN '${minDate}' AND '${maxDate}'
       GROUP BY o.hn`,
      bmsConfig
    ).then(rows => {
      if (!rows || rows.length === 0) return;
      const map = {};
      rows.forEach(r => { if (r.hn && r.pttype_name) map[r.hn] = r.pttype_name; });
      setPttypeMap(prev => ({ ...prev, ...map }));
    }).catch(() => {});
  }, [allRows, bmsConfig]);

  // Unique pttype list for filter dropdown (รวมทั้งจาก appointment + HOSxP query)
  const pttypeOptions = useMemo(() => {
    const set = new Set([
      ...allRows.map(r => r.pttypeName),
      ...allRows.map(r => pttypeMap[r.hn]),
    ].filter(Boolean));
    return [...set].sort();
  }, [allRows, pttypeMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(r => {
      const pttype = r.pttypeName || pttypeMap[r.hn] || "";
      if (dateFrom && r.dateKey < dateFrom) return false;
      if (dateTo   && r.dateKey > dateTo)   return false;
      if (ptFilter && pttype !== ptFilter)  return false;
      if (q && !(
        (r.hn || "").toLowerCase().includes(q) ||
        (r.customer || "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [allRows, pttypeMap, search, dateFrom, dateTo, ptFilter]);

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, ptFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows   = filtered.slice((page - 1) * pageSize, page * pageSize);

  const thaiDateStr = (d) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const months = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${Number(day)} ${months[Number(m)]} ${Number(y) + 543}`;
  };

  const exportCSV = () => {
    const headers = ['ลำดับ','วันที่รับบริการ','HN','ชื่อ-สกุล','สิทธิรักษา',
      'รายการรับบริการ','ระยะเวลา(นาที)','ผู้ให้บริการ','ราคาค่าบริการ','ค่าบริการผู้ให้บริการ','สถานะ'];
    const dataRows = filtered.map((r, i) => [
      i + 1,
      thaiDateStr(r.dateKey),
      r.hn || '',
      r.customer || '',
      r.pttypeName || pttypeMap[r.hn] || '',
      r.svcName,
      r.svcDur != null ? r.svcDur : '',
      r.therName,
      r.svcPrice   != null ? r.svcPrice   : '',
      r.svcTherFee != null ? r.svcTherFee : '',
      STATUSES[r.status]?.label || r.status || '',
    ]);
    const csv = [headers, ...dataRows]
      .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `appointments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">ทะเบียนผู้รับบริการแพทย์แผนไทย</div>
          <div className="page-sub">รายการจองนัดทั้งหมด · {allRows.length} รายการ</div>
        </div>
        <button className="btn-primary" onClick={exportCSV}
          style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <Icon name="chart" size={16} /> Export Excel
        </button>
      </TopBar>

      <div ref={contentRef} className="svc-content" style={{ gap: 12 }}>
        {/* ── Filter bar ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <DatePickerInput label="วันที่เริ่ม" value={dateFrom} onChange={setDateFrom} />
          <DatePickerInput label="ถึงวันที่"  value={dateTo}   onChange={setDateTo} />
          {/* Search */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11.5, color: "var(--ink-faint)", fontWeight: 600 }}>ค้นหา HN / ชื่อ-สกุล</label>
            <div className="search" style={{ width: "100%" }}>
              <Icon name="search" size={15} />
              <input placeholder="พิมพ์ HN หรือชื่อ..." value={search}
                onChange={e => setSearch(e.target.value)} style={{ width: "100%" }} />
            </div>
          </div>
          {/* สิทธิรักษา filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11.5, color: "var(--ink-faint)", fontWeight: 600 }}>สิทธิรักษา</label>
            <select className="select" style={{ width: 160, fontSize: 13, padding: "6px 10px" }}
              value={ptFilter} onChange={e => setPtFilter(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {pttypeOptions.map(pt => <option key={pt} value={pt}>{pt}</option>)}
            </select>
          </div>
          {/* Clear */}
          {(search || dateFrom || dateTo || ptFilter) && (
            <button className="btn-ghost" style={{ padding: "6px 14px", fontSize: 13, alignSelf: "flex-end" }}
              onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setPtFilter(""); }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* ── Summary row ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
            แสดง {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} จาก {filtered.length} รายการ
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button className="btn-ghost" style={{ padding: "4px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <Icon name="chevL" size={13} /> ก่อนหน้า
              </button>
              <span style={{ fontSize: 13, color: "var(--ink-soft)", minWidth: 80, textAlign: "center", whiteSpace: "nowrap" }}>
                หน้า {page} / {totalPages}
              </span>
              <button className="btn-ghost" style={{ padding: "4px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                ถัดไป <Icon name="chevR" size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="reg-table" style={{ fontSize: 13 }}>
          <div className="reg-head" style={{ fontSize: 12 }}>
            <div className="reg-cell reg-num">#</div>
            <div className="reg-cell" style={{ width: 108 }}>วันที่รับบริการ</div>
            <div className="reg-cell" style={{ width: 90 }}>HN</div>
            <div className="reg-cell" style={{ flex: 2 }}>ชื่อ-สกุล</div>
            <div className="reg-cell" style={{ width: 110 }}>สิทธิรักษา</div>
            <div className="reg-cell" style={{ flex: 3 }}>รายการรับบริการ</div>
            <div className="reg-cell" style={{ width: 70, textAlign: "center" }}>เวลา(น.)</div>
            <div className="reg-cell" style={{ flex: 2 }}>ผู้ให้บริการ</div>
            <div className="reg-cell" style={{ width: 90, textAlign: "right" }}>ค่าบริการ</div>
            <div className="reg-cell" style={{ width: 105, textAlign: "right" }}>ค่าบริการผู้ให้บริการ</div>
            <div className="reg-cell" style={{ width: 88 }}>สถานะ</div>
          </div>

          {pageRows.map((r, i) => {
            const globalIdx = (page - 1) * pageSize + i + 1;
            const st = STATUSES[r.status] || STATUSES.booked;
            return (
              <div key={r.id} className="reg-row">
                <div className="reg-cell reg-num">{globalIdx}</div>
                <div className="reg-cell" style={{ width: 108, fontSize: 12 }}>{thaiDateStr(r.dateKey)}</div>
                <div className="reg-cell" style={{ width: 90, fontFamily: "monospace", fontSize: 12, color: "var(--ink-soft)" }}>
                  {r.hn || '—'}
                </div>
                <div className="reg-cell" style={{ flex: 2, fontWeight: 600 }}>{r.customer || '—'}</div>
                <div className="reg-cell" style={{ width: 110, fontSize: 12, color: "var(--ink-soft)" }}>
                  {(r.pttypeName || pttypeMap[r.hn]) ||
                    <span style={{ color: "var(--ink-faint)" }}>—</span>}
                </div>
                <div className="reg-cell" style={{ flex: 3, fontSize: 12, lineHeight: 1.4 }}>{r.svcName}</div>
                <div className="reg-cell" style={{ width: 70, textAlign: "center", color: "var(--ink-soft)" }}>
                  {r.svcDur != null ? r.svcDur : <span style={{ color: "var(--ink-faint)" }}>—</span>}
                </div>
                <div className="reg-cell" style={{ flex: 2, fontSize: 12 }}>{r.therName}</div>
                <div className="reg-cell" style={{ width: 90, textAlign: "right", fontWeight: 700,
                  color: r.svcPrice ? "var(--primary-deep)" : "var(--ink-faint)" }}>
                  {r.svcPrice != null ? Number(r.svcPrice).toLocaleString() + '฿' : '—'}
                </div>
                <div className="reg-cell" style={{ width: 105, textAlign: "right", fontWeight: 700,
                  color: r.svcTherFee ? "oklch(0.38 0.12 165)" : "var(--ink-faint)" }}>
                  {r.svcTherFee != null ? Number(r.svcTherFee).toLocaleString() + '฿' : '—'}
                </div>
                <div className="reg-cell" style={{ width: 88 }}>
                  <span className="pill" style={{ color: st.ink, background: st.bg, fontSize: 11, padding: "2px 7px" }}>
                    <span className="dot" />{st.label}
                  </span>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-faint)" }}>
              <Icon name="users" size={32} />
              <div style={{ marginTop: 10 }}>ไม่พบรายการที่ตรงกับเงื่อนไข</div>
            </div>
          )}
        </div>

        {/* ── Summary footer ── */}
        {(() => {
          const totalIncome   = filtered.reduce((s, r) => s + (r.svcPrice != null ? Number(r.svcPrice) : 0), 0);
          const doneCount     = filtered.filter(r => r.status === "done").length;
          const doneIncome    = filtered.filter(r => r.status === "done")
                                        .reduce((s, r) => s + (r.svcPrice != null ? Number(r.svcPrice) : 0), 0);
          const totalTherFee  = filtered.reduce((s, r) => s + (r.svcTherFee != null ? Number(r.svcTherFee) : 0), 0);
          const hasTherFee    = filtered.some(r => r.svcTherFee != null);
          return (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              flexWrap: "wrap", gap: 0,
              borderTop: "2px solid var(--line)",
              paddingTop: 14, paddingBottom: 8,
            }}>
              <div style={{
                display: "flex", alignItems: "stretch", gap: 0,
                background: "var(--surface-2)", borderRadius: 12,
                border: "1px solid var(--line)", overflow: "hidden",
              }}>
                {/* total rows */}
                <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 2, borderRight: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>จำนวนรายการ</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{filtered.length.toLocaleString()}</span>
                </div>
                {/* done count */}
                <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 2, borderRight: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>เสร็จสิ้น</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink-soft)" }}>{doneCount.toLocaleString()}</span>
                </div>
                {/* total income (all statuses) */}
                <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 2, borderRight: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>ยอดรวมค่าบริการ</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--primary-deep)" }}>
                    {totalIncome.toLocaleString('th-TH')}
                    <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 3 }}>฿</span>
                  </span>
                </div>
                {/* done income */}
                <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 2, borderRight: hasTherFee ? "1px solid var(--line)" : "none" }}>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>รายได้จริง (เสร็จสิ้น)</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>
                    {doneIncome.toLocaleString('th-TH')}
                    <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 3 }}>฿</span>
                  </span>
                </div>
                {/* therapist fee total */}
                {hasTherFee && (
                  <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>ค่าบริการผู้ให้บริการรวม</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "oklch(0.38 0.12 165)" }}>
                      {totalTherFee.toLocaleString('th-TH')}
                      <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 3 }}>฿</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}

// ── Bed management ────────────────────────────────────────────────────────────

function BedForm({ open, bed, onClose, onSave }) {
  const isEdit = !!bed?.id;
  const [name,   setName]   = useState("");
  const [room,   setRoom]   = useState("");
  const [note,   setNote]   = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setName(bed.name || ""); setRoom(bed.room || "");
      setNote(bed.note || ""); setActive(bed.active !== false);
    } else {
      setName(""); setRoom(""); setNote(""); setActive(true);
    }
  }, [open, isEdit, bed]);

  const valid = name.trim().length > 0;
  const save  = () => onSave({
    ...(bed || {}),
    id:     isEdit ? bed.id : `bed_${Date.now()}`,
    name:   name.trim(),
    room:   room.trim(),
    note:   note.trim(),
    active,
  });

  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card fade-up" style={{ maxWidth: 460, width: "100%" }}>
        <div className="modal-head">
          <div className="drawer-title">{isEdit ? "แก้ไขเตียงบริการ" : "เพิ่มเตียงบริการ"}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>ชื่อเตียง / หมายเลขเตียง</label>
            <input className="input" placeholder="เช่น เตียง 1, เตียง A, VIP 01" value={name}
              onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>ห้อง / ตำแหน่ง</label>
            <input className="input" placeholder="เช่น ห้องนวด 1, ชั้น 2" value={room}
              onChange={e => setRoom(e.target.value)} />
          </div>
          <div className="field">
            <label>หมายเหตุ</label>
            <input className="input" placeholder="เช่น สำหรับผู้พิการ, มีอ่างน้ำ" value={note}
              onChange={e => setNote(e.target.value)} />
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer",
            padding:"12px 0", borderTop:"1px solid var(--line)" }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
              style={{ width:17, height:17, accentColor:"var(--primary)", cursor:"pointer", flexShrink:0 }} />
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>Active — เตียงพร้อมให้บริการ</div>
              <div style={{ fontSize:12, color:"var(--ink-faint)", marginTop:2 }}>
                {active ? "เตียงนี้จะแสดงในระบบและพร้อมรับผู้รับบริการ"
                        : "เตียงนี้ถูกปิด จะไม่แสดงในการจองนัด"}
              </div>
            </div>
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn-fill" disabled={!valid} onClick={save}>
            {isEdit ? "บันทึกการแก้ไข" : "เพิ่มเตียง"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BedsPage({ beds, onSaveBed, onToggleBed, userInfo, therapistStatusText, onDisconnect }) {
  const [bedForm, setBedForm] = useState(null);

  const activeBeds   = beds.filter(b => b.active !== false).length;
  const inactiveBeds = beds.length - activeBeds;

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">จัดการเตียงบริการ</div>
          <div className="page-sub">
            เตียงและพื้นที่ให้บริการแพทย์แผนไทย · เปิด {activeBeds} / ปิด {inactiveBeds} / รวม {beds.length}
          </div>
        </div>
        <button className="btn-primary" onClick={() => setBedForm({})}
          style={{ display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap" }}>
          <Icon name="plus" size={17} /> เพิ่มเตียง
        </button>
      </TopBar>

      <div className="svc-content">
        {beds.length === 0 && (
          <div className="empty" style={{ flex:1 }}>
            <Icon name="list" size={36} />
            <div>ยังไม่มีเตียงบริการ กด "เพิ่มเตียง" เพื่อเริ่มต้น</div>
          </div>
        )}

        {beds.length > 0 && (
          <div className="reg-table">
            <div className="reg-head">
              <div className="reg-cell reg-num">#</div>
              <div className="reg-cell" style={{ flex:2 }}>ชื่อเตียง / หมายเลข</div>
              <div className="reg-cell" style={{ flex:1 }}>ห้อง / ตำแหน่ง</div>
              <div className="reg-cell" style={{ flex:2 }}>หมายเหตุ</div>
              <div className="reg-cell" style={{ width:80 }}>สถานะ</div>
              <div className="reg-cell" style={{ width:110 }}></div>
            </div>
            <div className="reg-body">
              {beds.map((b, i) => {
                const on = b.active !== false;
                return (
                  <div key={b.id} className="reg-row">
                    <div className="reg-cell reg-num">{i + 1}</div>
                    <div className="reg-cell" style={{ flex:2, fontWeight:600, fontSize:14,
                      opacity: on ? 1 : .5 }}>
                      {b.name}
                    </div>
                    <div className="reg-cell" style={{ flex:1, color:"var(--ink-soft)", opacity: on ? 1 : .5 }}>
                      {b.room || <span style={{ color:"var(--ink-faint)" }}>—</span>}
                    </div>
                    <div className="reg-cell" style={{ flex:2, fontSize:12, color:"var(--ink-faint)", opacity: on ? 1 : .5 }}>
                      {b.note || <span>—</span>}
                    </div>
                    <div className="reg-cell" style={{ width:80 }}>
                      <span className="pill" style={{
                        color:      on ? "var(--st-confirm-ink)"  : "var(--st-cancel-ink)",
                        background: on ? "var(--st-confirm-bg)"   : "var(--st-cancel-bg)",
                        fontSize:11, padding:"3px 8px",
                      }}>
                        <span className="dot" />{on ? "เปิด" : "ปิด"}
                      </span>
                    </div>
                    <div className="reg-cell" style={{ width:110, display:"flex", gap:6, justifyContent:"flex-end" }}>
                      <button className="icon-btn" title="แก้ไข" onClick={() => setBedForm(b)}>
                        <Icon name="pen" size={15} />
                      </button>
                      <button className="icon-btn" title={on ? "ปิดเตียง" : "เปิดเตียง"}
                        onClick={() => onToggleBed(b)}
                        style={{ color: on ? "var(--st-cancel-ink)" : "var(--st-confirm-ink)" }}>
                        <Icon name={on ? "eyeOff" : "eye"} size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BedForm
        open={bedForm !== null}
        bed={bedForm?.id ? bedForm : null}
        onClose={() => setBedForm(null)}
        onSave={(data) => { onSaveBed(data); setBedForm(null); }}
      />
    </>
  );
}

// ── Services registry page (HOSxP health_med_operation_item) ──────────────────

function ServicesPage({ operationItems, operationStatus, operationErrMsg,
  userInfo, therapistStatusText, onDisconnect, onReload,
  serviceTherFees, onSaveTherFee }) {

  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [page,     setPage]     = useState(1);
  const contentRef = useRef(null);
  const pageSize   = useAutoPageSize(contentRef, 52);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return operationItems;
    return operationItems.filter(it =>
      (it.name || "").toLowerCase().includes(q) ||
      Object.values(it._raw || {}).some(v => v && String(v).toLowerCase().includes(q))
    );
  }, [operationItems, search]);

  // reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems  = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">ทะเบียนรายการหัตถการแพทย์แผนไทย</div>
          <div className="page-sub">รายการหัตถการจาก HOSxP · health_med_operation_item</div>
        </div>
        <button className="btn-primary" onClick={onReload}
          style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <Icon name="refresh" size={16} /> โหลดใหม่
        </button>
      </TopBar>

      <div ref={contentRef} className="svc-content">
        {operationStatus === "loading" && (
          <div className="empty" style={{ flex: 1 }}>
            <Icon name="clock" size={36} /><div>กำลังโหลดข้อมูลจาก HOSxP…</div>
          </div>
        )}

        {operationStatus === "error" && (
          <div className="login-error" style={{ width: "auto" }}>
            <Icon name="close" size={15} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>โหลดข้อมูลไม่สำเร็จ</div>
              <div style={{ fontSize: 12.5, fontFamily: "monospace", opacity: .85 }}>{operationErrMsg}</div>
            </div>
          </div>
        )}

        {operationStatus === "idle" && (
          <div className="empty" style={{ flex: 1 }}>
            <Icon name="leaf" size={36} />
            <div>กด "โหลดใหม่" เพื่อดึงข้อมูลจาก HOSxP</div>
          </div>
        )}

        {(operationStatus === "ok") && (
          <>
            {/* Search */}
            <div className="search" style={{ width: "100%", maxWidth: 420 }}>
              <Icon name="search" size={16} />
              <input placeholder="ค้นหาชื่อบริการ หรือรหัส…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
                แสดง {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} จากทั้งหมด {filtered.length} รายการ
                {filtered.length !== operationItems.length && ` (กรองจาก ${operationItems.length})`}
              </div>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button className="btn-ghost" style={{ padding: "5px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                    disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <Icon name="chevL" size={14} /> ก่อนหน้า
                  </button>
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", minWidth: 80, textAlign: "center", whiteSpace: "nowrap" }}>
                    หน้า {page} / {totalPages}
                  </span>
                  <button className="btn-ghost" style={{ padding: "5px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                    disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    ถัดไป <Icon name="chevR" size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Registry table */}
            <div className="reg-table">
              <div className="reg-head">
                <div className="reg-cell reg-num">#</div>
                <div className="reg-cell" style={{ flex: 2 }}>ชื่อบริการ / หัตถการ</div>
                <div className="reg-cell" style={{ width: 120, textAlign: "right" }}>ราคา (บาท)</div>
                <div className="reg-cell" style={{ width: 130, textAlign: "right" }}>ค่าบริการผู้ให้บริการ</div>
                <div className="reg-cell" style={{ width: 100, textAlign: "center" }}>เวลา (นาที)</div>
                <div className="reg-cell" style={{ width: 90 }}>สถานะ</div>
                <div className="reg-cell reg-action"></div>
              </div>
              {pageItems.map((it, i) => {
                const active = it.isActive !== false;
                const globalIndex = (page - 1) * pageSize + i + 1;
                const therFee = serviceTherFees?.[it.id];
                return (
                  <div key={it.id} className="reg-row" onClick={() => setSelected(it)}>
                    <div className="reg-cell reg-num">{globalIndex}</div>
                    <div className="reg-cell" style={{ flex: 2, fontWeight: 600, fontSize: 14 }}>
                      {it.name}
                    </div>
                    <div className="reg-cell" style={{ width: 120, textAlign: "right" }}>
                      {it.price
                        ? <span style={{ fontWeight: 700, color: "var(--primary-deep)" }}>
                            {Number(it.price).toLocaleString()} ฿
                          </span>
                        : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>}
                    </div>
                    <div className="reg-cell" style={{ width: 130, textAlign: "right" }}>
                      {therFee != null && therFee > 0
                        ? <span style={{ fontWeight: 700, color: "oklch(0.38 0.12 165)" }}>
                            {Number(therFee).toLocaleString()} ฿
                          </span>
                        : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>ยังไม่ตั้งค่า</span>}
                    </div>
                    <div className="reg-cell" style={{ width: 100, textAlign: "center" }}>
                      {it.minute
                        ? <span style={{ color: "var(--ink-soft)" }}>{it.minute}</span>
                        : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>}
                    </div>
                    <div className="reg-cell" style={{ width: 90 }}>
                      <span className="pill" style={{
                        color: active ? "var(--st-confirm-ink)" : "var(--st-cancel-ink)",
                        background: active ? "var(--st-confirm-bg)" : "var(--st-cancel-bg)",
                        fontSize: 11, padding: "3px 8px",
                      }}>
                        <span className="dot" />{active ? "ใช้งาน" : "ปิด"}
                      </span>
                    </div>
                    <div className="reg-cell reg-action">
                      <Icon name="chevR" size={16} />
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-faint)" }}>
                  ไม่พบรายการที่ตรงกับการค้นหา
                </div>
              )}
            </div>

          </>
        )}
      </div>

      <OperationDetail item={selected} onClose={() => setSelected(null)}
        therFee={selected ? (serviceTherFees?.[selected.id] ?? 0) : 0}
        onSaveTherFee={onSaveTherFee} />
    </>
  );
}

// ── Therapist detail modal (centered) ────────────────────────────────────────

// label ภาษาไทยแบบละเอียดสำหรับ detail view
const DETAIL_LABELS = {
  provider_id:"รหัสหมอนวด", pname:"คำนำหน้า", fname:"ชื่อ", lname:"นามสกุล",
  license_no:"เลขที่ใบประกอบวิชาชีพ", cid:"เลขบัตรประชาชน (CID)",
  active:"สถานะการใช้งาน", fullname:"ชื่อ-สกุลเต็ม",
  school_name:"ชื่อสถานศึกษา", education_type:"วุฒิการศึกษา",
  service_type:"ชนิดการบริการ", provider_type:"ประเภทการให้บริการ",
  license_type:"ประเภทใบอนุญาต", branch:"สาขา/หลักสูตร",
  doctor_code:"รหัสแพทย์", hospital_code:"รหัสโรงพยาบาล",
};

function detailLabel(rawKey) {
  const stripped = rawKey.replace(/^health_med_provider_/, "");
  return DETAIL_LABELS[stripped] || DETAIL_LABELS[rawKey]
    || stripped.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const FK_SKIP = /_(curriculum|educational|institute|service_type|branch|position|level|category|type)_id$/i;

function TherapistDetail({ therapist, onClose }) {
  if (!therapist) return null;

  const raw = therapist._raw || {};

  // ฟิลด์ที่จะแสดง: มีค่า + ไม่ใช่ FK id + ไม่ใช่ computed fullname
  const fields = Object.entries(raw).filter(([k, v]) => {
    if (v === null || v === undefined || v === "" || v === 0 || v === "0") return false;
    if (k === "fullname") return false;
    if (FK_SKIP.test(k)) return false;
    return true;
  });

  const activeVal = raw.active ?? raw.health_med_provider_active;
  const isActive  = activeVal !== 0 && activeVal !== "0"
    && activeVal !== "N" && activeVal !== "n" && activeVal !== false;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card fade-up">

        {/* Header */}
        <div className="modal-head">
          <div className="drawer-title">รายละเอียดหมอนวด</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="modal-body">
          {/* Hero */}
          <div className="therapist-hero">
            <Avatar name={therapist.name} color={therapist.color} size={72} />
            <div style={{ minWidth: 0 }}>
              <div className="therapist-hero-name">{therapist.fullname}</div>
              <div className="therapist-hero-sub">{therapist.spec}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {therapist.license && (
                  <span className="hn-badge">
                    <Icon name="note" size={13} /> {therapist.license}
                  </span>
                )}
                <span className="pill" style={{
                  color:      isActive ? "var(--st-confirm-ink)" : "var(--st-cancel-ink)",
                  background: isActive ? "var(--st-confirm-bg)"  : "var(--st-cancel-bg)",
                  fontSize: 12, padding: "4px 10px",
                }}>
                  <span className="dot" />
                  {isActive ? "ใช้งานอยู่" : "ปิดการใช้งาน"}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />

          {/* Key-value grid */}
          <div className="detail-kv-grid">
            {fields.map(([k, v]) => (
              <div className="detail-kv-item" key={k}>
                <div className="detail-kv-label">{detailLabel(k)}</div>
                <div className="detail-kv-value">{String(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-foot">
          <button className="btn-ghost" style={{ width: "100%" }} onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

// ── Therapist registry page ───────────────────────────────────────────────────

function TherapistPage({ therapistsData, therapistStatus, errMsg, apiUrl, rawSession,
  onReload, onTest, testResult, onSaveManualConfig, userInfo, therapistStatusText, onDisconnect }) {

  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(null);
  const [showRaw,   setShowRaw]   = useState(false);
  const [manualUrl, setManualUrl] = useState(apiUrl || "");
  const [manualKey, setManualKey] = useState("");
  const [therPage,  setTherPage]  = useState(1);
  const contentRef = useRef(null);
  const pageSize   = useAutoPageSize(contentRef, 62);

  const rawUi = rawSession && rawSession.result && rawSession.result.user_info;
  const rawKv = rawSession && rawSession.result && rawSession.result.key_value;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return therapistsData;
    return therapistsData.filter(t => {
      // ค้นจาก mapped fields
      if ((t.fullname || "").toLowerCase().includes(q)) return true;
      if ((t.license  || "").toLowerCase().includes(q)) return true;
      if ((t.name     || "").toLowerCase().includes(q)) return true;
      if ((t.spec     || "").toLowerCase().includes(q)) return true;
      // ค้นจาก raw data ทั้งหมด (ครอบคลุมทุก column ที่ดึงมา)
      return Object.values(t._raw || {}).some(v =>
        v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      );
    });
  }, [therapistsData, search]);

  useEffect(() => { setTherPage(1); }, [search]);
  const therTotalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const therPageRows   = filtered.slice((therPage - 1) * pageSize, therPage * pageSize);

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">ทะเบียนผู้ให้บริการแพทย์แผนไทย</div>
          <div className="page-sub">ผู้ให้บริการจาก HOSxP · health_med_provider</div>
        </div>
        <button className="btn-ghost" onClick={onTest}
          style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <Icon name="spark" size={16} /> ทดสอบ API
        </button>
        <button className="btn-primary" onClick={onReload}
          style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <Icon name="refresh" size={16} /> โหลดใหม่
        </button>
      </TopBar>

      <div ref={contentRef} className="svc-content">
        {/* แสดง API URL เฉพาะเมื่อหาไม่พบ (เพื่อ debug) */}
        {!apiUrl && (
          <div className="debug-strip">
            <span className="debug-label">API URL</span>
            <span className="debug-val">ไม่พบใน session — กรอกด้านล่าง</span>
          </div>
        )}

        {testResult && (
          <div className="login-error" style={{
            width: "auto",
            background: testResult.ok ? "var(--st-confirm-bg)" : "var(--st-cancel-bg)",
            color:      testResult.ok ? "var(--st-confirm-ink)" : "var(--st-cancel-ink)",
          }}>
            <Icon name={testResult.ok ? "check" : "close"} size={15} /> {testResult.msg}
          </div>
        )}

        {!apiUrl && (
          <div className="manual-config-box">
            <div className="manual-config-title"><Icon name="settings" size={16} /> ตั้งค่าการเชื่อมต่อ HOSxP API</div>
            <div className="field">
              <label>HOSxP API URL</label>
              <input className="input" placeholder="https://hospital.bmscloud.in.th"
                value={manualUrl} onChange={e => setManualUrl(e.target.value)}
                style={{ fontFamily: "monospace", fontSize: 13 }} />
            </div>
            <div className="field">
              <label>API Auth Key</label>
              <input className="input" type="password" placeholder="bms_session_code"
                value={manualKey} onChange={e => setManualKey(e.target.value)}
                style={{ fontFamily: "monospace", fontSize: 13 }} />
            </div>
            <button className="btn-fill" disabled={!manualUrl.trim()}
              onClick={() => onSaveManualConfig(manualUrl.trim(), manualKey.trim())}
              style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
              <Icon name="check" size={16} /> บันทึกและโหลดข้อมูล
            </button>
          </div>
        )}

        {therapistStatus === "loading" && (
          <div className="empty" style={{ flex: 1 }}>
            <Icon name="clock" size={36} /><div>กำลังโหลดข้อมูลจาก HOSxP…</div>
          </div>
        )}

        {therapistStatus === "error" && (
          <div className="login-error" style={{ width: "auto" }}>
            <Icon name="close" size={15} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>โหลดข้อมูลไม่สำเร็จ</div>
              <div style={{ fontSize: 12.5, fontFamily: "monospace", opacity: .85 }}>{errMsg}</div>
            </div>
          </div>
        )}

        {/* ── Registry ── */}
        {(therapistStatus === "ok" || therapistStatus === "mock") && (
          <>
            {therapistStatus === "mock" && (
              <div className="login-error" style={{ width: "auto", background: "var(--st-arrived-bg)", color: "var(--st-arrived-ink)" }}>
                <Icon name="bell" size={15} /> แสดงข้อมูลตัวอย่าง — กรอก API URL ด้านบนแล้วกด "บันทึก"
              </div>
            )}

            {/* Search */}
            <div className="search" style={{ width: "100%", maxWidth: 400 }}>
              <Icon name="search" size={16} />
              <input placeholder="ค้นหาชื่อ หรือเลขใบอนุญาต…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%" }} />
            </div>

            {/* Count + pagination */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
                แสดง {filtered.length === 0 ? 0 : (therPage-1)*pageSize+1}–{Math.min(therPage*pageSize, filtered.length)} จาก {therapistsData.length} คน
              </div>
              {therTotalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 13, whiteSpace: "nowrap" }}
                    disabled={therPage <= 1} onClick={() => setTherPage(p => p-1)}>
                    <Icon name="chevL" size={13} /> ก่อนหน้า
                  </button>
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", minWidth: 80, textAlign: "center" }}>
                    หน้า {therPage} / {therTotalPages}
                  </span>
                  <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 13, whiteSpace: "nowrap" }}
                    disabled={therPage >= therTotalPages} onClick={() => setTherPage(p => p+1)}>
                    ถัดไป <Icon name="chevR" size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="reg-table">
              <div className="reg-head">
                <div className="reg-cell reg-num">#</div>
                <div className="reg-cell reg-name">ชื่อ-สกุล</div>
                <div className="reg-cell reg-license">เลขที่ใบอนุญาต</div>
                <div className="reg-cell reg-spec">ประเภทการให้บริการ</div>
                <div className="reg-cell reg-action"></div>
              </div>
              {therPageRows.map((t, i) => (
                <div key={t.id} className="reg-row" onClick={() => setSelected(t)}>
                  <div className="reg-cell reg-num">{(therPage-1)*pageSize + i + 1}</div>
                  <div className="reg-cell reg-name">
                    <Avatar name={t.name} color={t.color} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.fullname}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 1 }}>{t.name}</div>
                    </div>
                  </div>
                  <div className="reg-cell reg-license">
                    {t.license
                      ? <span className="hn-badge" style={{ fontSize: 12 }}>
                          <Icon name="note" size={12} /> {t.license}
                        </span>
                      : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>ไม่มีข้อมูล</span>}
                  </div>
                  <div className="reg-cell reg-spec" style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t.spec}</div>
                  <div className="reg-cell reg-action">
                    <Icon name="chevR" size={16} />
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--ink-faint)" }}>
                  ไม่พบข้อมูลที่ตรงกับการค้นหา
                </div>
              )}
            </div>
          </>
        )}

        {/* Raw session */}
        <div>
          <button className="hosxp-toggle" onClick={() => setShowRaw(v => !v)}>
            {showRaw ? "ซ่อน" : "ดู"} ข้อมูลดิบจาก BMS Session
          </button>
          {showRaw && (
            <div className="raw-session-box">
              <div className="raw-section-label">user_info</div>
              <pre className="raw-pre">{JSON.stringify(rawUi || {}, null, 2)}</pre>
              <div className="raw-section-label" style={{ marginTop: 10 }}>key_value</div>
              <pre className="raw-pre">{JSON.stringify(rawKv || {}, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      <TherapistDetail therapist={selected} onClose={() => setSelected(null)} />
    </>
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

// ── Report Page ──────────────────────────────────────────────────────────────

function ReportPage({ appts, therapistsData, activeServices, userInfo, therapistStatusText, onDisconnect, serviceTherFees, onNewBooking }) {
  const [tab, setTab] = useState("live");
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours()*60+d.getMinutes(); });
  const [dailyMode, setDailyMode] = useState("count");
  const [svcMode, setSvcMode] = useState("income");

  useEffect(() => {
    const id = setInterval(() => { const d = new Date(); setNowMin(d.getHours()*60+d.getMinutes()); }, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Today's data ────────────────────────────────────────────────────────────
  const todayStr = dayKey(new Date());
  const todayList = appts[todayStr] || [];
  const todayActive = todayList.filter(a => a.status !== "cancelled");
  const todayWaiting  = todayActive.filter(a => ["booked","confirmed","arrived"].includes(a.status)).length;
  const todayService  = todayActive.filter(a => a.status === "service").length;
  const todayDone     = todayActive.filter(a => a.status === "done").length;
  const todayIncome   = todayActive.filter(a => a.status === "done").reduce((s,a) => s+(svc(a.serviceId)?.price||0), 0);
  const dayPct        = Math.max(0, Math.min(100, ((nowMin-OPEN_MIN)/(CLOSE_MIN-OPEN_MIN))*100));
  const upcomingQueue = todayActive.filter(a => !["done","cancelled"].includes(a.status)).sort((a,b)=>a.start-b.start).slice(0,8);

  // ── All stored appointments for historical stats ─────────────────────────────
  const allEntries = Object.entries(appts);
  const allFlat    = allEntries.flatMap(([k,list]) => (list||[]).map(a => ({...a,_day:k})));
  const allActive  = allFlat.filter(a => a.status !== "cancelled");
  const allTotal   = allFlat; // includes cancelled

  // ── 14-day daily chart ───────────────────────────────────────────────────────
  const last14 = Array.from({length:14}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-(13-i)); return dayKey(d); });
  const dailyData = last14.map(k => {
    const day  = (appts[k]||[]).filter(a => a.status !== "cancelled");
    const done = day.filter(a => a.status === "done");
    return { key:k, label:`${k.slice(8)}/${k.slice(5,7)}`, count:day.length, income:done.reduce((s,a)=>s+(svc(a.serviceId)?.price||0),0) };
  });
  const dailyMax = Math.max(1, ...dailyData.map(d => dailyMode==="count" ? d.count : d.income));

  // ── Service breakdown ────────────────────────────────────────────────────────
  const svcMap = {};
  allActive.forEach(a => {
    const sv = svc(a.serviceId)||{name:a.serviceId||"ไม่ระบุ",price:0};
    if (!svcMap[a.serviceId]) svcMap[a.serviceId] = {name:sv.name,count:0,income:0};
    svcMap[a.serviceId].count++;
    if (a.status==="done") svcMap[a.serviceId].income += sv.price;
  });
  const svcRows = Object.values(svcMap).sort((a,b)=>b.count-a.count).slice(0,8);
  const svcMax  = Math.max(1, ...svcRows.map(s => svcMode==="income" ? s.income : s.count));

  // ── Therapist workload (live + historical) ───────────────────────────────────
  const therRows = therapistsData.map(t => {
    const all      = allActive.filter(a => a.therapistId === t.id);
    const todayT   = todayActive.filter(a => a.therapistId === t.id);
    const done     = all.filter(a => a.status==="done");
    const totalMins = all.reduce((s,a)=>s+(svc(a.serviceId)?.dur||60),0);
    const income        = done.reduce((s,a)=>s+(svc(a.serviceId)?.price||0),0);
    const therFeeIncome = all.reduce((s,a)=>s+((serviceTherFees||{})[a.serviceId]||0),0);
    const availMins = (CLOSE_MIN-OPEN_MIN)*(allEntries.length||1);
    const utilPct  = availMins>0 ? Math.min(100, Math.round(totalMins/availMins*100)) : 0;
    const current  = todayT.find(a => a.status==="service" && a.start<=nowMin && (a.start+(svc(a.serviceId)?.dur||60))>nowMin);
    const nextAppt = todayT.filter(a => ["booked","confirmed","arrived"].includes(a.status)&&a.start>nowMin).sort((a,b)=>a.start-b.start)[0];
    const todayUsedMins  = todayT.reduce((s,a)=>s+(svc(a.serviceId)?.dur||60),0);
    const todayTotalMins = CLOSE_MIN - OPEN_MIN;
    const todayFreeSlots = Math.max(0, Math.floor((todayTotalMins - todayUsedMins) / SLOT));
    const todayUtilPct   = Math.min(100, Math.round(todayUsedMins / todayTotalMins * 100));
    return {...t, count:all.length, todayCount:todayT.length, totalMins, income, therFeeIncome, utilPct, current, nextAppt, todayFreeSlots, todayUtilPct};
  });
  const todayMaxQ = Math.max(1, ...therRows.map(r=>r.todayCount));

  // ── 6-month chart ────────────────────────────────────────────────────────────
  const now6 = new Date();
  const months6 = Array.from({length:6}, (_,i) => {
    const d = new Date(now6.getFullYear(), now6.getMonth()-(5-i), 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const thaiMo = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const monthData = months6.map(m => {
    const mo   = parseInt(m.slice(5))-1;
    const days = allActive.filter(a => (a._day||"").startsWith(m));
    const done = days.filter(a => a.status==="done");
    return { key:m, label:thaiMo[mo], count:days.length, income:done.reduce((s,a)=>s+(svc(a.serviceId)?.price||0),0) };
  });
  const monthMax = Math.max(1, ...monthData.map(m=>m.count));

  // ── Popular time slots ───────────────────────────────────────────────────────
  const timeMap = {};
  allActive.forEach(a => { const sl=Math.floor(a.start/30)*30; timeMap[sl]=(timeMap[sl]||0)+1; });
  const timeSlots = Object.entries(timeMap).map(([m,c])=>({m:+m,c,label:fmtMin(+m)})).sort((a,b)=>a.m-b.m);
  const timeMax = Math.max(1, ...timeSlots.map(t=>t.c));

  // ── Quality metrics ──────────────────────────────────────────────────────────
  const cancelledCnt = allTotal.filter(a=>a.status==="cancelled").length;
  const doneTotalCnt = allTotal.filter(a=>a.status==="done").length;
  const cancelRate = allTotal.length>0 ? Math.round(cancelledCnt/allTotal.length*100) : 0;
  const doneRate   = allTotal.length>0 ? Math.round(doneTotalCnt/allTotal.length*100) : 0;

  // ── Regular customers ────────────────────────────────────────────────────────
  const custMap = {};
  allActive.forEach(a => {
    const nm = a.customer||(a.hn?`HN ${a.hn}`:null)||"ไม่ทราบ";
    if (!custMap[nm]) custMap[nm]={name:nm,count:0,income:0};
    custMap[nm].count++;
    custMap[nm].income += svc(a.serviceId)?.price||0;
  });
  const regularCusts = Object.values(custMap).filter(c=>c.count>=2).sort((a,b)=>b.count-a.count).slice(0,8);

  // ── Reusable micro-components ────────────────────────────────────────────────
  const BarH = ({pct,color="var(--primary)",h=8}) => (
    <div style={{flex:1,height:h,background:"var(--surface-2)",borderRadius:4,overflow:"hidden"}}>
      <div style={{width:`${Math.max(0,pct)}%`,height:"100%",background:color,borderRadius:4,transition:"width .4s"}}/>
    </div>
  );
  const Card = ({title,action,children}) => (
    <div style={{background:"var(--surface-1)",border:"1px solid var(--line)",borderRadius:14,padding:"18px 20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
  const ToggleSeg = ({value,onChange,options}) => (
    <div className="seg" style={{zoom:.85,transformOrigin:"right"}}>
      {options.map(o => <button key={o.v} className={value===o.v?"on":""} onClick={()=>onChange(o.v)}>{o.l}</button>)}
    </div>
  );
  const Empty = ({msg="ยังไม่มีข้อมูล"}) => (
    <div style={{textAlign:"center",padding:"20px 0",color:"var(--ink-faint)",fontSize:13}}>{msg}</div>
  );

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">รายงาน</div>
          <div className="page-sub">ติดตามการให้บริการและสถิติ</div>
        </div>
        <div className="seg" style={{marginLeft:16}}>
          <button className={tab==="live"?"on":""} onClick={()=>setTab("live")}>🟢 ติดตามการให้บริการ</button>
          <button className={tab==="stats"?"on":""} onClick={()=>setTab("stats")}>📊 รายงานและสถิติ</button>
        </div>
      </TopBar>

      <div className="svc-content">

        {/* ══════ TAB 1: LIVE ══════ */}
        {tab === "live" && (<>

          {/* Stat cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
            {[
              {icon:"users", val:todayActive.length,  lab:"ผู้รับบริการวันนี้", ink:"var(--st-booked-ink)",  bg:"var(--st-booked-bg)"},
              {icon:"clock", val:todayWaiting,         lab:"คิวที่รอดำเนินการ", ink:"var(--st-arrived-ink)", bg:"var(--st-arrived-bg)"},
              {icon:"spark", val:todayService,         lab:"กำลังให้บริการ",    ink:"var(--st-service-ink)", bg:"var(--st-service-bg)"},
              {icon:"check", val:todayDone,            lab:"ให้บริการแล้ว",     ink:"var(--st-done-ink)",    bg:"var(--st-done-bg)"},
            ].map(s => <Stat key={s.lab} icon={s.icon} val={s.val} lab={s.lab} ink={s.ink} bg={s.bg}/>)}
          </div>

          {/* Day progress bar */}
          <Card title={`ความคืบหน้าของวัน · ${fmtMin(OPEN_MIN)} – ${fmtMin(CLOSE_MIN)}`}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:12,color:"var(--ink-faint)",whiteSpace:"nowrap"}}>{fmtMin(OPEN_MIN)}</span>
              <div style={{flex:1,height:14,background:"var(--surface-2)",borderRadius:8,position:"relative",overflow:"visible"}}>
                <div style={{width:`${dayPct}%`,height:"100%",background:"linear-gradient(90deg,var(--primary-tint),var(--primary))",borderRadius:8,transition:"width .5s"}}/>
                <div style={{position:"absolute",top:"50%",left:`${dayPct}%`,transform:"translate(-50%,-50%)",width:22,height:22,borderRadius:"50%",background:"var(--primary)",border:"3px solid var(--surface-0)",boxShadow:"0 2px 8px rgba(0,0,0,.2)",zIndex:1}}/>
              </div>
              <span style={{fontSize:12,color:"var(--ink-faint)",whiteSpace:"nowrap"}}>{fmtMin(CLOSE_MIN)}</span>
              <span style={{fontSize:13,fontWeight:700,color:"var(--primary)",whiteSpace:"nowrap",minWidth:64,textAlign:"right"}}>{fmtMin(nowMin)} · {Math.round(dayPct)}%</span>
            </div>
          </Card>

          {/* Therapist real-time workload */}
          <Card title="ภาระงานผู้ให้บริการแพทย์แผนไทย">
            {therapistsData.length === 0 ? <Empty msg="ยังไม่มีข้อมูลผู้ให้บริการ"/> : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:10}}>
                {therRows.map(t => {
                  const isCurrent = !!t.current;
                  const hasNext   = !!t.nextAppt && !isCurrent;
                  const stLabel   = isCurrent ? "● กำลังนวด" : hasNext ? `คิวถัดไป ${fmtMin(t.nextAppt.start)}` : "ว่าง";
                  const stInk     = isCurrent ? "var(--st-service-ink)" : hasNext ? "var(--st-booked-ink)" : "var(--ink-faint)";
                  const stBg      = isCurrent ? "var(--st-service-bg)" : hasNext ? "var(--st-booked-bg)" : "var(--surface-2)";
                  return (
                    <div key={t.id}
                      onClick={() => onNewBooking && onNewBooking(t.id)}
                      style={{
                        background:"var(--surface-2)", borderRadius:12, padding:"12px 14px",
                        cursor:"pointer", transition:"box-shadow .15s, transform .1s",
                        border:"1px solid transparent",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,.1)"; e.currentTarget.style.borderColor="var(--primary)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow=""; e.currentTarget.style.borderColor="transparent"; }}
                    >
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <Avatar name={t.name} color={t.color} size={30}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.fullname||t.name}</div>
                          {t.spec && <div style={{fontSize:11,color:"var(--ink-faint)"}}>{t.spec}</div>}
                        </div>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:stBg,color:stInk,fontWeight:600,whiteSpace:"nowrap",border:`1px solid ${stInk}22`}}>{stLabel}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <BarH pct={todayMaxQ>0?(t.todayCount/todayMaxQ)*100:0} h={6} color={isCurrent?"var(--st-service-ink)":"var(--primary)"}/>
                        <span style={{fontSize:11,color:"var(--ink-faint)",whiteSpace:"nowrap"}}>{t.todayCount} คิว</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"flex-end"}}>
                        <span style={{fontSize:11,color:"var(--primary)",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                          <Icon name="plus" size={12}/> จองนัดใหม่
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Upcoming queue */}
          <Card title="คิวถัดไปที่รอดำเนินการ">
            {upcomingQueue.length===0 ? <Empty msg="ไม่มีคิวที่รอดำเนินการ"/> : (
              <div className="reg-table">
                <div className="reg-head">
                  <div className="reg-cell" style={{width:70}}>เวลา</div>
                  <div className="reg-cell" style={{flex:1}}>ชื่อ</div>
                  <div className="reg-cell" style={{flex:1,display:"flex"}}>บริการ</div>
                  <div className="reg-cell" style={{width:130}}>ผู้ให้บริการ</div>
                  <div className="reg-cell" style={{width:90}}>สถานะ</div>
                </div>
                <div className="reg-body">
                  {upcomingQueue.map(a => {
                    // ค้นหาบริการจาก activeServices prop ก่อน (ครอบคลุมทั้ง HOSxP และ mock)
                    const svObj = activeServices.find(s => s.id === a.serviceId)
                               || svc(a.serviceId)
                               || {};
                    const svName = svObj.name || a.serviceId || "—";
                    // ค้นหาหมอนวดจาก therapistsData prop
                    const thObj  = therapistsData.find(t => t.id === a.therapistId) || {};
                    const thName = thObj.fullname || thObj.name || a.therapistId || "—";
                    const st = STATUSES[a.status] || STATUSES.booked;
                    return (
                      <div key={a.id} className="reg-row">
                        <div className="reg-cell" style={{width:70,flex:"none",fontFamily:"monospace",fontWeight:700,color:"var(--primary)"}}>{fmtMin(a.start)}</div>
                        <div className="reg-cell" style={{flex:1,minWidth:0,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.customer||a.hn||"—"}</div>
                        <div className="reg-cell" style={{flex:1,minWidth:0,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{svName}</div>
                        <div className="reg-cell" style={{width:130,flex:"none",fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{thName}</div>
                        <div className="reg-cell" style={{width:90,flex:"none"}}>
                          <span style={{padding:"2px 8px",borderRadius:20,background:st.bg,color:st.ink,fontSize:11,fontWeight:600}}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

        </>)}

        {/* ══════ TAB 2: STATISTICS ══════ */}
        {tab === "stats" && (<>

          {/* Daily bar chart */}
          <Card
            title="รายงานผู้รับบริการรายวัน (14 วันล่าสุด)"
            action={<ToggleSeg value={dailyMode} onChange={setDailyMode} options={[{v:"count",l:"ผู้รับบริการ"},{v:"income",l:"รายได้"}]}/>}
          >
            {(() => {
              const BAR_H   = 160;
              const TICK_H  = 26;
              const Y_W     = 38;
              const totalW  = 0; // ใช้ flex
              const gridPcts = [100, 75, 50, 25];
              const fmtY = v => dailyMode === "income"
                ? (v >= 1000 ? Math.round(v/1000)+"k" : v)
                : v;
              return (
                <div style={{marginTop:4}}>
                  {/* Chart wrapper: Y-axis + bars */}
                  <div style={{display:"flex",gap:0}}>
                    {/* Y-axis */}
                    <div style={{width:Y_W,flexShrink:0,position:"relative",height:BAR_H}}>
                      {gridPcts.map(p => (
                        <div key={p} style={{
                          position:"absolute",
                          bottom:`${p}%`,
                          right:6,
                          fontSize:10,
                          color:"var(--ink-faint)",
                          lineHeight:1,
                          transform:"translateY(50%)",
                        }}>
                          {fmtY(Math.round(dailyMax*p/100))}
                        </div>
                      ))}
                      <div style={{position:"absolute",bottom:0,right:6,fontSize:10,color:"var(--ink-faint)",lineHeight:1}}>0</div>
                    </div>

                    {/* Plot area */}
                    <div style={{flex:1,position:"relative"}}>
                      {/* Grid lines */}
                      <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
                        {[...gridPcts,0].map(p => (
                          <div key={p} style={{
                            position:"absolute",
                            bottom:`${p}%`,
                            left:0,right:0,
                            borderTop:`1px ${p===0?"solid":"dashed"} var(--line)`,
                          }}/>
                        ))}
                      </div>

                      {/* Bars */}
                      <div style={{display:"flex",alignItems:"flex-end",height:BAR_H,gap:5,position:"relative",zIndex:1,paddingBottom:1}}>
                        {dailyData.map(d => {
                          const val     = dailyMode==="count" ? d.count : d.income;
                          const pct     = dailyMax>0 ? val/dailyMax : 0;
                          const barH    = Math.max(val>0?3:0, Math.round(pct*(BAR_H-4)));
                          const isToday = d.key===todayStr;
                          const barBg   = isToday
                            ? "oklch(0.44 0.09 158)"
                            : "oklch(0.66 0.10 158)";
                          const tipText = dailyMode==="income"
                            ? `${d.income.toLocaleString()} ฿`
                            : `${d.count} คน`;
                          return (
                            <div key={d.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
                              {/* Value label above bar */}
                              <span style={{
                                fontSize:10,
                                fontWeight:isToday?700:500,
                                color:isToday?"oklch(0.38 0.09 158)":"var(--ink)",
                                lineHeight:1,
                                marginBottom:3,
                                visibility:val>0?"visible":"hidden",
                              }}>
                                {dailyMode==="income" && val>=1000 ? `${Math.round(val/1000)}k` : val||""}
                              </span>
                              {/* Bar */}
                              <div
                                title={tipText}
                                style={{
                                  width:"100%",
                                  height:`${barH}px`,
                                  background:barBg,
                                  borderRadius:"4px 4px 0 0",
                                  transition:"height .35s ease",
                                  boxShadow:isToday?"0 -2px 6px oklch(0.44 0.09 158 / .3)":"none",
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* X-axis labels (aligned under bars, offset by Y_W) */}
                  <div style={{display:"flex",paddingLeft:Y_W,gap:5,marginTop:4,height:TICK_H,alignItems:"flex-start"}}>
                    {dailyData.map(d => {
                      const isToday = d.key===todayStr;
                      return (
                        <div key={d.key} style={{flex:1,textAlign:"center"}}>
                          {isToday && (
                            <div style={{
                              width:6,height:6,borderRadius:"50%",
                              background:"oklch(0.44 0.09 158)",
                              margin:"0 auto 2px",
                            }}/>
                          )}
                          <div style={{
                            fontSize:10,
                            fontWeight:isToday?700:400,
                            color:isToday?"oklch(0.38 0.09 158)":"var(--ink-faint)",
                            lineHeight:1.2,
                          }}>
                            {d.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary row */}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--ink-faint)",marginTop:8,paddingTop:10,borderTop:"1px solid var(--line)"}}>
                    <span>รวม: <strong style={{color:"var(--ink)"}}>
                      {dailyMode==="count"
                        ? `${dailyData.reduce((s,d)=>s+d.count,0).toLocaleString()} ครั้ง`
                        : `${dailyData.reduce((s,d)=>s+d.income,0).toLocaleString()} ฿`}
                    </strong></span>
                    <span>เฉลี่ย/วัน: <strong style={{color:"var(--ink)"}}>
                      {dailyMode==="count"
                        ? `${(dailyData.reduce((s,d)=>s+d.count,0)/14).toFixed(1)} ครั้ง`
                        : `${Math.round(dailyData.reduce((s,d)=>s+d.income,0)/14).toLocaleString()} ฿`}
                    </strong></span>
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* 2-col: Service breakdown + 6-month */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>

            <Card title="การให้บริการแยกตามประเภทการรักษา" action={<ToggleSeg value={svcMode} onChange={setSvcMode} options={[{v:"income",l:"รายได้"},{v:"count",l:"จำนวนครั้ง"}]}/>}>
              {svcRows.length===0 ? <Empty/> : svcRows.map(s => {
                const val = svcMode==="income" ? s.income : s.count;
                return (
                  <div key={s.name} style={{marginBottom:9}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%",fontWeight:500}}>{s.name}</span>
                      <span style={{color:"var(--ink-faint)",whiteSpace:"nowrap"}}>{svcMode==="income"?`${s.income.toLocaleString()} ฿`:`${s.count} ครั้ง`}</span>
                    </div>
                    <BarH pct={svcMax>0?(val/svcMax)*100:0}/>
                  </div>
                );
              })}
            </Card>

            <Card title="สถิติการใช้บริการย้อนหลัง 6 เดือน">
              <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
                {monthData.map(m => {
                  const pct = monthMax>0 ? m.count/monthMax : 0;
                  return (
                    <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                      {m.count>0 && <span style={{fontSize:11,color:"var(--primary)",fontWeight:700}}>{m.count}</span>}
                      <div style={{width:"100%",flex:1,display:"flex",alignItems:"flex-end"}}>
                        <div style={{width:"100%",height:`${Math.max(2,pct*72)}px`,background:"var(--primary)",borderRadius:"4px 4px 0 0",opacity:.85}}/>
                      </div>
                      <span style={{fontSize:11,color:"var(--ink-faint)"}}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:8,fontSize:11,color:"var(--ink-faint)",paddingTop:8,borderTop:"1px solid var(--line)"}}>
                รวม 6 เดือน · {monthData.reduce((s,m)=>s+m.count,0)} ครั้ง · รายได้ {monthData.reduce((s,m)=>s+m.income,0).toLocaleString()} ฿
              </div>
            </Card>
          </div>

          {/* Therapist workload table */}
          <Card title="รายงานภาระงานผู้ให้บริการแพทย์แผนไทย">
            {therRows.length===0 ? <Empty msg="ยังไม่มีข้อมูลผู้ให้บริการ"/> : (<>

              {/* ── Today cards ── */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:"var(--ink-faint)",marginBottom:8,letterSpacing:.3}}>
                  ภาระงานวันนี้ — {new Date().toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long"})}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10}}>
                  {therRows.map(t => {
                    const busy = t.todayUtilPct;
                    const barClr = busy>=80 ? "oklch(0.52 0.18 27)" : busy>=50 ? "oklch(0.62 0.15 75)" : "oklch(0.44 0.09 158)";
                    const freeClr = t.todayFreeSlots===0 ? "oklch(0.52 0.18 27)" : t.todayFreeSlots<=4 ? "oklch(0.62 0.15 75)" : "oklch(0.38 0.12 165)";
                    return (
                      <div key={t.id} style={{border:"1px solid var(--line)",borderRadius:"var(--r-sm)",padding:"10px 12px",background:"var(--surface-2)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:9}}>
                          <Avatar name={t.name} color={t.color} size={26}/>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.fullname||t.name}</div>
                            <div style={{fontSize:10,color:"var(--ink-faint)"}}>{t.spec||"ผู้ให้บริการ"}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,marginBottom:9}}>
                          <div style={{flex:1,textAlign:"center",background:"var(--surface)",borderRadius:6,padding:"7px 4px"}}>
                            <div style={{fontSize:22,fontWeight:800,color:barClr,lineHeight:1}}>{t.todayCount}</div>
                            <div style={{fontSize:10,color:"var(--ink-faint)",marginTop:3}}>คิวงานวันนี้</div>
                          </div>
                          <div style={{flex:1,textAlign:"center",background:"var(--surface)",borderRadius:6,padding:"7px 4px"}}>
                            <div style={{fontSize:22,fontWeight:800,color:freeClr,lineHeight:1}}>{t.todayFreeSlots}</div>
                            <div style={{fontSize:10,color:"var(--ink-faint)",marginTop:3}}>ช่องว่าง (30น.)</div>
                          </div>
                        </div>
                        <div style={{height:5,borderRadius:5,background:"var(--line)",overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${busy}%`,background:barClr,borderRadius:5,transition:"width .4s"}}/>
                        </div>
                        <div style={{fontSize:10,color:"var(--ink-faint)",marginTop:4,textAlign:"right"}}>ใช้เวลาวันนี้ {busy}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Historical table ── */}
              <div style={{fontSize:12,fontWeight:600,color:"var(--ink-faint)",marginBottom:8,letterSpacing:.3}}>ข้อมูลสะสมทั้งหมด</div>
              <div className="reg-table">
                <div className="reg-head">
                  <div className="reg-cell" style={{flex:1}}>ผู้ให้บริการ</div>
                  <div className="reg-cell" style={{width:72,textAlign:"right"}}>คิวรวม</div>
                  <div className="reg-cell" style={{width:80,textAlign:"right"}}>ชั่วโมง</div>
                  <div className="reg-cell" style={{width:120,textAlign:"right"}}>รายได้ผู้ให้บริการ</div>
                  <div className="reg-cell" style={{width:130}}>การใช้เวลา</div>
                </div>
                <div className="reg-body">
                  {therRows.map(t => (
                    <div key={t.id} className="reg-row">
                      <div className="reg-cell" style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
                        <Avatar name={t.name} color={t.color} size={28}/>
                        <span style={{fontWeight:500}}>{t.fullname||t.name}</span>
                      </div>
                      <div className="reg-cell" style={{width:72,textAlign:"right",fontWeight:700,color:"var(--primary)"}}>{t.count}</div>
                      <div className="reg-cell" style={{width:80,textAlign:"right"}}>{(t.totalMins/60).toFixed(1)}</div>
                      <div className="reg-cell" style={{width:120,textAlign:"right"}}>
                        {t.therFeeIncome > 0
                          ? <span style={{fontWeight:700,color:"oklch(0.38 0.12 165)"}}>{t.therFeeIncome.toLocaleString()} ฿</span>
                          : <span style={{color:"var(--ink-faint)",fontSize:12}}>ยังไม่ตั้งค่า</span>}
                      </div>
                      <div className="reg-cell" style={{width:130,display:"flex",alignItems:"center",gap:6}}>
                        <BarH pct={t.utilPct} h={6}/><span style={{fontSize:11,color:"var(--ink-faint)",whiteSpace:"nowrap"}}>{t.utilPct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>)}
          </Card>

          {/* 2-col: Popular times + Appointment quality */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>

            <Card title="ช่วงเวลายอดนิยม">
              {timeSlots.length===0 ? <Empty/> : timeSlots.map(ts => (
                <div key={ts.m} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                    <span style={{fontWeight:500}}>{ts.label}</span>
                    <span style={{color:"var(--ink-faint)"}}>{ts.c} คิว</span>
                  </div>
                  <BarH pct={(ts.c/timeMax)*100}/>
                </div>
              ))}
            </Card>

            <Card title="คุณภาพการนัด">
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span>อัตราให้บริการสำเร็จ</span>
                    <span style={{fontWeight:700,color:"var(--primary)"}}>{doneRate}%</span>
                  </div>
                  <BarH pct={doneRate}/>
                </div>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span>อัตรายกเลิกนัด</span>
                    <span style={{fontWeight:700,color:"#ef4444"}}>{cancelRate}%</span>
                  </div>
                  <BarH pct={cancelRate} color="#ef4444"/>
                </div>
                <div style={{fontSize:12,color:"var(--ink-faint)",paddingTop:10,borderTop:"1px solid var(--line)"}}>
                  นัดทั้งหมด {allTotal.length} รายการ · สำเร็จ {doneTotalCnt} · ยกเลิก {cancelledCnt}
                </div>
              </div>
            </Card>
          </div>

          {/* Regular customers */}
          <Card title="ลูกค้าประจำ — เข้าใช้บริการ 2 ครั้งขึ้นไป">
            {regularCusts.length===0 ? <Empty msg="ยังไม่มีลูกค้าที่เข้ามาซ้ำ"/> : (
              <div className="reg-table">
                <div className="reg-head">
                  <div className="reg-cell" style={{width:36}}>#</div>
                  <div className="reg-cell" style={{flex:1}}>ชื่อ-สกุล</div>
                  <div className="reg-cell" style={{width:90,textAlign:"right"}}>จำนวนครั้ง</div>
                  <div className="reg-cell" style={{width:110,textAlign:"right"}}>ยอดรวม</div>
                </div>
                <div className="reg-body">
                  {regularCusts.map((c,i) => (
                    <div key={c.name} className="reg-row">
                      <div className="reg-cell" style={{width:36,color:"var(--ink-faint)",fontSize:12}}>{i+1}</div>
                      <div className="reg-cell" style={{flex:1,fontWeight:500}}>{c.name}</div>
                      <div className="reg-cell" style={{width:90,textAlign:"right",fontWeight:700,color:"var(--primary)"}}>{c.count} ครั้ง</div>
                      <div className="reg-cell" style={{width:110,textAlign:"right",fontWeight:600,color:"var(--primary-deep)"}}>{c.income.toLocaleString()} ฿</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

        </>)}
      </div>
    </>
  );
}

// ── ScreenPage ────────────────────────────────────────────────────────────────
function ScreenPage({ t, setTweak, userInfo, therapistStatusText, onDisconnect }) {
  const THEME_OPTIONS = [
    { id: "herbal",   label: "สมุนไพร",   sub: "เขียวธรรมชาติ", primary: "#3d7a5b", bg: "#f4efe6", accent: "#cf6b43" },
    { id: "ocean",    label: "มหาสมุทร",  sub: "ฟ้าสดใส",       primary: "#2860b0", bg: "#eff4fc", accent: "#0ea5c4" },
    { id: "hibiscus", label: "ดอกชบา",    sub: "ชมพูอบอุ่น",     primary: "#a0305a", bg: "#fdf0f5", accent: "#e05888" },
    { id: "mocha",    label: "กาแฟ",      sub: "น้ำตาลอบอุ่น",   primary: "#7c4f2a", bg: "#f5efe8", accent: "#c9843e" },
    { id: "dark",     label: "กลางคืน",   sub: "โหมดมืด",       primary: "#4ade80", bg: "#1e2d26", accent: "#fb923c" },
    { id: "indigo",   label: "อินดิโก",   sub: "ม่วงสดใส",       primary: "#4338ca", bg: "#f5f3ff", accent: "#f59e0b" },
    { id: "teal",     label: "ทีล",       sub: "เขียวน้ำทะเล",   primary: "#0d9488", bg: "#f0fdfa", accent: "#f97316" },
    { id: "clay",     label: "ดินเผา",    sub: "ส้มแดงอบอุ่น",   primary: "#c2410c", bg: "#fff7ed", accent: "#16a34a" },
  ];
  const FONT_OPTIONS = [
    { id: "Sarabun",           label: "Sarabun",          sub: "คลาสสิก" },
    { id: "Prompt",            label: "Prompt",            sub: "ทันสมัย" },
    { id: "Noto Sans Thai",    label: "Noto Sans Thai",    sub: "อ่านง่าย" },
    { id: "IBM Plex Sans Thai",label: "IBM Plex Sans Thai",sub: "เทคนิค" },
  ];
  const DENSITY_OPTIONS = [
    { id: "compact", label: "กระชับ", icon: "▤", desc: "46px / ช่อง" },
    { id: "regular", label: "ปกติ",   icon: "▣", desc: "58px / ช่อง" },
    { id: "comfy",   label: "โปร่ง",  icon: "□", desc: "70px / ช่อง" },
  ];
  const curTheme   = t.theme    || "herbal";
  const curFont    = t.fontFamily|| "Sarabun";
  const curDensity = t.density  || "regular";

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">ตั้งค่าหน้าจอ</div>
          <div className="page-sub">ปรับธีมสี · ฟอนต์ · และขนาดการแสดงผล</div>
        </div>
      </TopBar>

      <div className="svc-content" style={{ gap: 28, maxWidth: 820 }}>

        {/* ── Themes ── */}
        <section>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>🎨 ธีมสี</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {THEME_OPTIONS.map(th => {
              const active = curTheme === th.id;
              return (
                <button key={th.id} onClick={() => setTweak("theme", th.id)} style={{
                  border: `2px solid ${active ? "var(--primary)" : "var(--line)"}`,
                  borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "none", padding: 0,
                  boxShadow: active ? "0 0 0 3px var(--primary-soft)" : "0 1px 3px rgba(0,0,0,.06)",
                  transition: "all .15s",
                }}>
                  <div style={{ height: 54, background: th.bg, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: th.primary, boxShadow: "0 2px 6px rgba(0,0,0,.25)" }} />
                    <div style={{ width: 13, height: 13, borderRadius: 4, background: th.accent }} />
                  </div>
                  <div style={{ padding: "8px 6px 10px", background: "var(--surface)", textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--primary)" : "var(--ink)" }}>{th.label}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 2 }}>{th.sub}</div>
                    {active && <div style={{ fontSize: 10, color: "var(--primary)", marginTop: 3, fontWeight: 600 }}>● ใช้งานอยู่</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Fonts ── */}
        <section>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>🔤 ฟอนต์</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {FONT_OPTIONS.map(f => {
              const active = curFont === f.id;
              return (
                <button key={f.id} onClick={() => setTweak("fontFamily", f.id)} style={{
                  border: `2px solid ${active ? "var(--primary)" : "var(--line)"}`,
                  borderRadius: 10, padding: "14px 8px",
                  background: active ? "var(--primary-tint)" : "var(--surface)",
                  boxShadow: active ? "0 0 0 3px var(--primary-soft)" : "0 1px 3px rgba(0,0,0,.06)",
                  cursor: "pointer", transition: "all .15s", textAlign: "center",
                }}>
                  <div style={{ fontFamily: `"${f.id}", sans-serif`, fontSize: 22, fontWeight: 700,
                    color: active ? "var(--primary)" : "var(--ink)", marginBottom: 5 }}>กขค</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--primary)" : "var(--ink-soft)" }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 2 }}>{f.sub}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Density ── */}
        <section>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 14 }}>📐 ขนาดตาราง</div>
          <div style={{ display: "flex", gap: 10 }}>
            {DENSITY_OPTIONS.map(d => {
              const active = curDensity === d.id;
              return (
                <button key={d.id} onClick={() => setTweak("density", d.id)} style={{
                  flex: 1, border: `2px solid ${active ? "var(--primary)" : "var(--line)"}`,
                  borderRadius: 10, padding: "16px 8px",
                  background: active ? "var(--primary-tint)" : "var(--surface)",
                  boxShadow: active ? "0 0 0 3px var(--primary-soft)" : "0 1px 3px rgba(0,0,0,.06)",
                  cursor: "pointer", transition: "all .15s", textAlign: "center",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{d.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--primary)" : "var(--ink)" }}>{d.label}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 3 }}>{d.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

      </div>
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  // ALL hooks before any conditional return
  const [t, setTweak]       = useTweaks(TWEAK_DEFAULTS);
  const todayKey             = useMemo(() => dayKey(new Date()), []);
  const [date, setDate]      = useState(() => new Date());
  const [appts, setAppts]    = useState(() => {
    try { const s = localStorage.getItem('thai_appts'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [filter, setFilter]  = useState("all");
  const [query, setQuery]    = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [booking,    setBooking]    = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [printAppt,  setPrintAppt]  = useState(null);
  const [toast, setToast]       = useState("");
  const [hosxpStats, setHosxpStats] = useState(null);
  const [activePage, setActivePage] = useState("sched");

  // BMS session
  const [bms, setBms] = useState({
    connected: false, loading: false, error: null, config: null, userInfo: null,
  });

  // Therapists from HOSxP: "loading" | "ok" | "error" | "mock"
  const [therapistsData,   setTherapistsData]   = useState(THERAPISTS);
  const [therapistStatus,  setTherapistStatus]  = useState("mock");
  const [therapistErrMsg,  setTherapistErrMsg]  = useState("");
  const [testResult,       setTestResult]       = useState(null);

  // Services: HOSxP operation items
  const [operationItems,  setOperationItems]  = useState([]);
  const [operationStatus, setOperationStatus] = useState("idle");
  const [operationErrMsg, setOperationErrMsg] = useState("");

  // Local services สำหรับ BookingForm (fallback ถ้ายังไม่มี HOSxP data)
  const [services, setServices] = useState(SERVICES.map(s => ({ ...s, active: true })));
  const [svcForm, setSvcForm]   = useState(null);
  const [queueTicket, setQueueTicket] = useState(null);

  // ค่าบริการผู้ให้บริการต่อรายการหัตถการ (บันทึก local, ใช้กับทั้ง HOSxP และ local services)
  const [serviceTherFees, setServiceTherFees] = useState(() => {
    try { return JSON.parse(localStorage.getItem('thai_svc_therfees') || '{}'); } catch { return {}; }
  });

  // เตียงบริการ
  const [beds, setBeds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('thai_beds') || '[]'); } catch { return []; }
  });

  // ── Queue call state ──────────────────────────────────────────────────────────
  const [currentQueue, setCurrentQueue] = useState(null);
  const [queueHistory, setQueueHistory] = useState([]);
  const [queueDate, setQueueDate] = useState(() => new Date());

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState(() => loadNotifs().filter(n => n.type === "change"));
  const [notifOpen, setNotifOpen] = useState(false);
  const prevApptsRef = useRef(null);

  // ── Effects (must all be before early return) ─────────────────────────────
  useEffect(() => { applyTheme(t.theme); }, [t.theme]);
  useEffect(() => { document.documentElement.dataset.density = t.density; }, [t.density]);
  useEffect(() => {
    document.body.style.fontFamily = `"${t.fontFamily}", system-ui, sans-serif`;
  }, [t.fontFamily]);

  // Auto-connect from URL param or cookie
  useEffect(() => {
    const urlId = getSessionFromUrl();
    if (urlId) { removeSessionFromUrl(); doConnect(urlId); }
    else { const c = getSessionCookie(); if (c) doConnect(c); }
  }, []);

  const key = dayKey(date);

  useEffect(() => {
    setAppts(p => {
      if (therapistStatus === "ok") {
        // เชื่อมต่อ HOSxP จริง — ตัด mock data ออก เหลือเฉพาะนัดที่สร้างจริง
        const realOnly = (p[key] || []).filter(a => a.id && a.id.includes('_new_'));
        return { ...p, [key]: realOnly };
      }
      if (p[key]) return p;
      return { ...p, [key]: genDay(date, todayKey) };
    });
  }, [key, therapistStatus]);

  // บันทึกนัดทั้งหมดลง localStorage ทุกครั้งที่เปลี่ยน
  useEffect(() => {
    try { localStorage.setItem('thai_appts', JSON.stringify(appts)); } catch {}
  }, [appts]);

  useEffect(() => {
    try { localStorage.setItem('thai_svc_therfees', JSON.stringify(serviceTherFees)); } catch {}
  }, [serviceTherFees]);

  useEffect(() => {
    try { localStorage.setItem('thai_beds', JSON.stringify(beds)); } catch {}
  }, [beds]);

  // ดึงสถิติจาก HOSxP ovst ตามวันที่เลือก (เฉพาะจำนวนนัด)
  useEffect(() => {
    if (!bms.connected || !bms.config?.apiUrl) { setHosxpStats(null); return; }
    const dateKey = dayKey(date);
    (async () => {
      try {
        const r1 = await executeSqlViaApi(`SELECT COUNT(*) AS total FROM ovst WHERE vstdate='${dateKey}'`, bms.config);
        setHosxpStats({ total: r1?.[0] ? Number(r1[0].total) : 0 });
      } catch { setHosxpStats(null); }
    })();
  }, [key, bms.connected]);

  // Keep global svc() in sync — ค้นหาจาก HOSxP items ก่อน แล้ว fallback mock
  useEffect(() => {
    const hosxpList = operationItems
      .filter(it => it.isActive !== false)
      .map(it => ({ id: it.id, name: it.name, price: Number(it.price)||0, dur: Number(it.minute)||60, group:"HOSxP" }));
    window.svc = (id) =>
      hosxpList.find(s => s.id === id) ||
      services.find(s => s.id === id)  ||
      SERVICES.find(s => s.id === id);
  }, [operationItems, services]);

  // Keep global ther() in sync — ค้นหาจาก HOSxP therapists ก่อน แล้ว fallback mock
  useEffect(() => {
    window.ther = (id) =>
      therapistsData.find(t => t.id === id) ||
      THERAPISTS.find(t => t.id === id);
  }, [therapistsData]);

  // ── Notification: periodic refresh (queue countdown + tomorrow alerts) ─────
  useEffect(() => {
    // Apply the same HOSxP filter the calendar uses — prevents mock/unverified data
    // appearing in notifications when a date hasn't been loaded from HOSxP yet.
    const verifiedAppts = therapistStatus === "ok"
      ? Object.fromEntries(
          Object.entries(appts).map(([dk, list]) => [
            dk,
            (list || []).filter(a => a.id && a.id.includes('_new_')),
          ])
        )
      : appts;

    const refresh = () => {
      setNotifications(prev => {
        const withoutQueue = prev.filter(n => n.type !== "upcoming_queue");
        const readMap = {};
        prev.filter(n => n.type === "upcoming_queue").forEach(n => { readMap[n.apptId] = n.read; });

        const freshQueue = buildUpcomingQueueNotifs(verifiedAppts, todayKey)
          .map(n => ({ ...n, read: readMap[n.apptId] || false }));

        // Toast for newly urgent items
        freshQueue.filter(n => n.urgent && !readMap[n.apptId])
          .forEach(n => setTimeout(() => setToast(`⏰ ${n.body}`), 0));

        // Tomorrow alerts (dedup by id)
        const existingIds = new Set(withoutQueue.map(n => n.id));
        const freshTomorrow = buildTomorrowNotifs(verifiedAppts, todayKey)
          .filter(n => !existingIds.has(n.id));

        const next = [...freshQueue, ...freshTomorrow, ...withoutQueue].slice(0, 100);
        saveNotifs(next);
        return next;
      });
    };
    refresh();
    const tid = setInterval(refresh, 60000);
    return () => clearInterval(tid);
  }, [appts, todayKey, therapistStatus]);

  // ── Notification: change detection (cancel / reschedule) ──────────────────
  useEffect(() => {
    if (prevApptsRef.current === null) {
      const snap = {};
      Object.values(appts).flat().forEach(a => { snap[a.id] = { status: a.status, start: a.start }; });
      prevApptsRef.current = snap;
      return;
    }
    const changeNotifs = [];
    Object.entries(appts).forEach(([dk, dayAppts]) => {
      (dayAppts || []).forEach(a => {
        const p = prevApptsRef.current[a.id];
        if (!p) { prevApptsRef.current[a.id] = { status: a.status, start: a.start }; return; }
        if (p.status !== "cancelled" && a.status === "cancelled") {
          changeNotifs.push({
            id: `chg_${a.id}_${Date.now()}`,
            type: "change", title: "ยกเลิกนัด",
            body: `${a.customer || 'ผู้รับบริการ'} · ${fmtMin(p.start)}`,
            changeDetail: `คิว ${fmtMin(p.start)} ว่างแล้ว`,
            read: false, urgent: false, at: Date.now(),
          });
        } else if (p.start !== a.start && a.status !== "cancelled") {
          changeNotifs.push({
            id: `chg_${a.id}_${Date.now()}`,
            type: "change", title: "เลื่อนนัด",
            body: `${a.customer || 'ผู้รับบริการ'}`,
            changeDetail: `${fmtMin(p.start)} → ${fmtMin(a.start)}`,
            read: false, urgent: false, at: Date.now(),
          });
        }
        prevApptsRef.current[a.id] = { status: a.status, start: a.start };
      });
    });
    if (changeNotifs.length > 0) {
      setNotifications(prev => {
        const next = [...changeNotifs, ...prev].slice(0, 100);
        saveNotifs(next); return next;
      });
    }
  }, [appts]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ── Notification handlers ──────────────────────────────────────────────────
  const markNotifRead = (id) => setNotifications(prev => {
    const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifs(next); return next;
  });
  const markAllRead = () => setNotifications(prev => {
    const next = prev.map(n => ({ ...n, read: true }));
    saveNotifs(next); return next;
  });

  const doTestApi = async () => {
    setTestResult(null);
    const config = bms.config;
    if (!config || !config.apiUrl) {
      setTestResult({ ok: false, msg: "ไม่มี API URL — session นี้ไม่มีค่า hosxp.api_url" });
      return;
    }
    try {
      const rows = await executeSqlViaApi("SELECT VERSION() AS ver", config);
      setTestResult({ ok: true, msg: `เชื่อมต่อ HOSxP API สำเร็จ — MySQL ${(rows[0] && rows[0].ver) || "?"}` });
    } catch (e) {
      setTestResult({ ok: false, msg: `API ตอบไม่ได้: ${e.message}` });
    }
  };

  const doLoadTherapists = async (config) => {
    setTherapistStatus("loading");
    setTherapistErrMsg("");
    setTestResult(null);

    try {
      // ── Step 1: DESCRIBE → รู้ชื่อ column จริง ────────────────────────────
      let cols = [];
      let pkCol = null;
      try {
        const desc = await executeSqlViaApi("DESCRIBE health_med_provider", config);
        cols = (desc || []).map(r => r.Field || r.field || "").filter(Boolean);
        // หา primary key จาก Key='PRI'
        const pkRow = (desc || []).find(r => (r.Key || r.key || "").toUpperCase() === "PRI");
        pkCol = pkRow ? (pkRow.Field || pkRow.field) : null;
      } catch (_) {}

      // ── Step 2: ค้นหา column ด้วย substring match ────────────────────────
      // รองรับทั้ง "fname" และ "health_med_provider_fname"
      const findCol = (...keywords) =>
        cols.find(c => keywords.some(k => c.toLowerCase().includes(k.toLowerCase())));

      if (!pkCol) pkCol = findCol("_provider_id", "provider_id") || cols.find(c => c.endsWith("_id"));

      const fnameCol  = findCol("_fname", "first_name");
      const lnameCol  = findCol("_lname", "last_name", "surname");
      const pnameCol  = findCol("_pname", "prefix", "title");
      const licCol    = findCol("license_no", "license_num", "certificate");
      // active column — ต้องไม่ใช่ FK ที่มี "type" หรือ "service"
      const activeCol = cols.find(c =>
        (c === "active" || c.endsWith("_active") || c === "is_active") &&
        !c.includes("service") && !c.includes("type")
      );

      // ── Step 3: SELECT * + CONCAT fullname ───────────────────────────────
      // ใช้ SELECT * เพื่อดึงข้อมูลครบ แล้วเพิ่ม fullname ที่ compute ได้
      // CONVERT USING utf8mb4 แก้ปัญหา TIS-620 → UTF-8 ที่ระดับ MySQL
      const concatExpr = (pnameCol && fnameCol && lnameCol)
        ? `, CONVERT(CONCAT(
              COALESCE(CONVERT(${pnameCol} USING utf8mb4),''),
              COALESCE(CONVERT(${fnameCol} USING utf8mb4),''),
              ' ',
              COALESCE(CONVERT(${lnameCol} USING utf8mb4),'')
            ) USING utf8mb4) AS fullname`
        : "";

      const whereClause = activeCol
        ? `WHERE ${activeCol} NOT IN (0,'N','n','false','inactive','')`
        : "";
      const orderBy = fnameCol
        ? `ORDER BY ${fnameCol}, ${lnameCol || fnameCol}`
        : "";

      // ── Step 4: รัน query ─────────────────────────────────────────────────
      let rows = null;
      try {
        rows = await executeSqlViaApi(
          `SELECT *${concatExpr} FROM health_med_provider ${whereClause} ${orderBy} LIMIT 100`,
          config
        );
      } catch (_) {}

      // ถ้าผลว่าง → ลองไม่กรอง active
      if (!rows || rows.length === 0) {
        rows = await executeSqlViaApi(
          `SELECT *${concatExpr} FROM health_med_provider ${orderBy} LIMIT 100`,
          config
        );
      }

      if (rows && rows.length > 0) {
        setTherapistsData(rows.map(mapProviderRow));
        setTherapistStatus("ok");
        showToast(`โหลดหมอนวด ${rows.length} คนจาก HOSxP เรียบร้อย`);
      } else {
        setTherapistsData([]);
        setTherapistStatus("ok");
        showToast("ไม่พบข้อมูลในตาราง health_med_provider");
      }

    } catch (e) {
      setTherapistErrMsg(e.message);
      setTherapistStatus("error");
      showToast("โหลดหมอนวดจาก HOSxP ไม่สำเร็จ");
    }
  };

  const doLoadOperationItems = async (config) => {
    setOperationStatus("loading");
    setOperationErrMsg("");
    try {
      // DESCRIBE เพื่อรู้ column จริง
      let cols = [], pkCol = null;
      try {
        const desc = await executeSqlViaApi("DESCRIBE health_med_operation_item", config);
        cols  = (desc || []).map(r => r.Field || r.field || "").filter(Boolean);
        const pkRow = (desc || []).find(r => (r.Key || r.key || "").toUpperCase() === "PRI");
        pkCol = pkRow ? (pkRow.Field || pkRow.field) : null;
      } catch (_) {}

      const findCol = (...kw) =>
        cols.find(c => kw.some(k => c.toLowerCase().includes(k.toLowerCase())));

      if (!pkCol) pkCol = findCol("_operation_item_id", "item_id") || cols.find(c => c.endsWith("_id"));
      const nameCol   = findCol("_name", "operation_name", "item_name");
      const priceCol  = findCol("price", "cost", "fee");
      const minuteCol = findCol("minute", "duration", "time_");
      // หา active column — ให้ active_status มีความสำคัญสูงสุด
      const activeCol =
        cols.find(c => c === "active_status") ||
        cols.find(c => c.endsWith("_active_status")) ||
        cols.find(c => (c === "active" || c.endsWith("_active") || c === "is_active") &&
          !c.includes("type") && !c.includes("service")) ||
        null;

      // ฟังก์ชันตรวจสอบค่า active: รองรับ Y/N และ 1/0
      const isActiveVal = (v) => {
        if (v === null || v === undefined || v === "") return false;
        const s = String(v).trim();
        return s === "Y" || s === "y" || s === "1" || s === "true";
      };

      // CONVERT name เป็น UTF-8 และ alias
      const extras = [];
      if (nameCol)   extras.push(`CONVERT(${nameCol} USING utf8mb4) AS item_name`);
      if (priceCol)  extras.push(`${priceCol}  AS item_price`);
      if (minuteCol) extras.push(`${minuteCol} AS item_minute`);
      if (pkCol)     extras.push(`${pkCol} AS item_id`);
      if (activeCol) extras.push(`${activeCol} AS item_active_status`);
      const extraStr = extras.length > 0 ? `, ${extras.join(", ")}` : "";

      // WHERE: active_status = 'Y' หรือรูปแบบอื่น
      const whereClause = activeCol
        ? `WHERE ${activeCol} = 'Y'`
        : "";
      const orderBy = nameCol ? `ORDER BY ${nameCol}` : "";

      let rows = null;
      try {
        rows = await executeSqlViaApi(
          `SELECT *${extraStr} FROM health_med_operation_item ${whereClause} ${orderBy} LIMIT 500`,
          config
        );
      } catch (_) {}
      // fallback: ไม่กรอง active
      if (!rows || rows.length === 0) {
        rows = await executeSqlViaApi(
          `SELECT *${extraStr} FROM health_med_operation_item ${orderBy} LIMIT 500`,
          config
        );
      }

      if (rows && rows.length > 0) {
        const mapped = rows.map((r, i) => ({
          id:       `oi_${r.item_id || i}`,
          name:     (r.item_name || rowGet(r, "name", "operation_name", "item_name") || `รายการ ${i+1}`).trim(),
          price:    r.item_price  != null ? r.item_price  : (rowGet(r, "price", "cost", "fee") || ""),
          minute:   r.item_minute != null ? r.item_minute : (rowGet(r, "minute", "duration") || ""),
          // สถานะ: เช็คจาก active_status = 'Y' เป็นหลัก
          isActive: isActiveVal(r.item_active_status != null
            ? r.item_active_status
            : rowGet(r, "active_status", "active", "is_active")),
          _raw: r,
        }));
        setOperationItems(mapped);
        setOperationStatus("ok");
        showToast(`โหลดรายการบริการ ${mapped.length} รายการจาก HOSxP`);
      } else {
        setOperationItems([]);
        setOperationStatus("ok");
        showToast("ไม่พบข้อมูลใน health_med_operation_item");
      }
    } catch (e) {
      setOperationErrMsg(e.message);
      setOperationStatus("error");
      showToast("โหลดรายการบริการไม่สำเร็จ");
    }
  };

  const doConnect = async (sessionId) => {
    setBms(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await retrieveBmsSession(sessionId);
      if (data.MessageCode === 500) throw new Error("Session หมดอายุ กรุณา login HOSxP ใหม่");
      if (data.MessageCode !== 200) throw new Error(data.Message || "ไม่สามารถเชื่อมต่อได้");
      const config   = extractConnectionConfig(data);
      const userInfo = (data.result && data.result.user_info) || {};
      // restore manual config from localStorage if API URL not in session
      let finalConfig = config;
      if (!finalConfig.apiUrl) {
        try {
          const saved = JSON.parse(localStorage.getItem("hosxp_manual_config") || "{}");
          if (saved.apiUrl) finalConfig = { ...finalConfig, ...saved };
        } catch (_) {}
      }
      setSessionCookie(sessionId);
      setBms({ connected: true, loading: false, error: null, config: finalConfig, userInfo, rawSession: data });
      doLoadTherapists(finalConfig);
      doLoadOperationItems(finalConfig);
    } catch (e) {
      setBms(prev => ({ ...prev, loading: false, error: e.message }));
    }
  };

  const doDisconnect = () => {
    removeSessionCookie();
    setBms({ connected: false, loading: false, error: null, config: null, userInfo: null });
    setTherapistsData(THERAPISTS);
    setTherapistStatus("mock");
  };

  const executeQuery = async (sql, signal, _retry = 0) => {
    try {
      const data = await executeSqlViaApi(sql, bms.config, signal);
      return { ok: true, data };
    } catch (e) {
      if (e.name === 'AbortError') return { ok: false, aborted: true, error: '' };
      // 409 Conflict: HOSxP ยังประมวลผล request เดิมอยู่ — retry 1 ครั้งหลัง 600ms
      if (e.message === '__CONFLICT__') {
        if (_retry < 2) {
          await new Promise(r => setTimeout(r, 1000 + _retry * 500));
          if (signal && signal.aborted) return { ok: false, aborted: true, error: '' };
          return executeQuery(sql, signal, _retry + 1);
        }
        return { ok: false, error: 'HOSxP ไม่ว่าง กรุณารอแล้วพิมพ์ใหม่' };
      }
      return { ok: false, error: e.message };
    }
  };

  // Service CRUD
  const handleSaveService = (svcData) => {
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === svcData.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = svcData; return n; }
      return [...prev, svcData];
    });
    setSvcForm(null);
    showToast(svcData.id && svcData._isEdit ? "บันทึกการแก้ไขเรียบร้อย" : "เพิ่มบริการเรียบร้อยแล้ว");
  };
  const handleToggleService = (sv) => {
    setServices(prev => prev.map(s => s.id === sv.id ? { ...s, active: sv.active === false } : s));
    showToast(sv.active === false ? `เปิดใช้งาน "${sv.name}" แล้ว` : `ปิดการใช้งาน "${sv.name}" แล้ว`);
  };

  const handleSaveTherFee = (serviceId, fee) => {
    setServiceTherFees(prev => ({ ...prev, [serviceId]: Number(fee) }));
    showToast("บันทึกค่าบริการผู้ให้บริการเรียบร้อย");
  };

  const handleSaveBed = (bedData) => {
    setBeds(prev => {
      const idx = prev.findIndex(b => b.id === bedData.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = bedData; return n; }
      return [...prev, bedData];
    });
    showToast(bedData._isEdit ? "บันทึกการแก้ไขเตียงเรียบร้อย" : "เพิ่มเตียงเรียบร้อยแล้ว");
  };

  const handleToggleBed = (bed) => {
    setBeds(prev => prev.map(b => b.id === bed.id ? { ...b, active: b.active === false } : b));
    showToast(bed.active === false ? `เปิดเตียง "${bed.name}" แล้ว` : `ปิดเตียง "${bed.name}" แล้ว`);
  };

  // ── Queue handlers ─────────────────────────────────────────────────────────
  const handleCallQueue = (appt) => {
    // Mark as arrived — ใช้ queueDate (วันที่เลือกในหน้าเรียกคิว)
    const qk = dayKey(queueDate);
    setAppts(p => ({ ...p, [qk]: (p[qk] || []).map(a => a.id === appt.id ? { ...a, status: "arrived" } : a) }));

    const bedObj = beds.find(b => b.id === appt.bedId);
    const bedLabel = bedObj ? `${bedObj.name}${bedObj.room ? ` ห้อง ${bedObj.room}` : ""}` : null;
    const svcObj  = svc(appt.serviceId);
    const therObj = therapistsData.find(t => t.id === appt.therapistId) || ther(appt.therapistId);

    // normalize: ใช้ _displayQ เป็น fallback สำหรับนัดเก่าที่ไม่มี queueNo
    const resolvedQNo = appt._displayQ || appt.queueNo || 0;

    const entry = {
      ...appt,
      queueNo: resolvedQNo,  // เขียนทับให้แน่ใจว่า queueNo ถูกต้องเสมอ
      calledAt: Date.now(),
      bedLabel,
      svcName:  svcObj?.name  || appt.serviceId || "",
      therName: therObj?.name || therObj?.fullname || "",
    };

    setCurrentQueue(entry);
    setQueueHistory(prev => {
      const next = [entry, ...prev.filter(q => q.id !== appt.id)].slice(0, 8);
      broadcastQueue(entry, next);
      return next;
    });

    speakQueue(
      fmtQueueNo(resolvedQNo),
      appt.customer || "",
      bedLabel,
      null,
      bedObj?.room || null,
      bedObj?.name || null
    );
    showToast(`🔔 เรียกคิว ${fmtQueueNo(resolvedQNo)} — ${appt.customer || "ผู้รับบริการ"}`);
  };

  const handleRepeatCall = (queue) => {
    if (!queue) return;
    const bedObj = beds.find(b => b.id === queue.bedId);
    const bedLabel = queue.bedLabel || (bedObj ? `${bedObj.name}${bedObj.room ? ` ห้อง ${bedObj.room}` : ""}` : null);
    const resolvedQNo = queue._displayQ || queue.queueNo || 0;
    speakQueue(
      fmtQueueNo(resolvedQNo),
      queue.customer || "",
      bedLabel,
      null,
      bedObj?.room || null,
      bedObj?.name || null
    );
    showToast(`🔁 เรียกซ้ำ ${fmtQueueNo(resolvedQNo)}`);
  };

  // ── Login gate ────────────────────────────────────────────────────────────
  if (!bms.connected) {
    return (
      <>
        <LoginScreen onConnect={doConnect} loading={bms.loading} error={bms.error} />
        <TweaksPanel>
          <TweakSection label="ธีมสี" />
          <TweakRadio label="โทนหลัก" value={t.theme}
            options={["herbal", "ocean", "hibiscus", "mocha", "dark", "indigo", "teal", "clay"]} onChange={v => setTweak("theme", v)} />
        </TweaksPanel>
      </>
    );
  }

  // ── Connected: compute schedule data ─────────────────────────────────────
  const list = appts[key] || [];
  // ใช้ HOSxP operation items เป็น service list ถ้าโหลดมาแล้ว
  // map minute → dur เพื่อให้ BookingForm และ svc() ใช้ได้
  const bookingServiceList = operationItems.length > 0
    ? operationItems
        .filter(it => it.isActive !== false)
        .map(it => ({
          id:    it.id,
          name:  it.name,
          price: Number(it.price) || 0,
          dur:   Number(it.minute) || 60,
          group: "HOSxP",
        }))
    : services.filter(s => s.active !== false);

  const activeServices = bookingServiceList;
  const visibleTherapists = filter === "all" ? therapistsData : therapistsData.filter(x => x.id === filter);
  const filtered = list.filter(a =>
    (filter === "all" || a.therapistId === filter) &&
    (!query || a.customer.includes(query) || (a.phone || "").includes(query))
  );
  const rowH = t.density === "compact" ? 46 : t.density === "comfy" ? 70 : 58;
  const activeAppts = list.filter(a => a.status !== "cancelled");
  const upcoming   = activeAppts.filter(a => a.status === "booked").length;
  const confirmed  = activeAppts.filter(a => a.status === "confirmed").length;
  const inHouse    = activeAppts.filter(a => a.status === "arrived").length;
  const inService  = activeAppts.filter(a => a.status === "service").length;
  const doneCnt    = activeAppts.filter(a => a.status === "done").length;
  const totalStat  = hosxpStats?.total ?? activeAppts.length;
  const incomeStat = activeAppts.filter(a => a.status === "done").reduce((s, a) => s + (svc(a.serviceId)?.price || 0), 0);
  const shiftDay = (d) => { const nd = new Date(date); nd.setDate(nd.getDate() + d); setDate(nd); };
  const td = thaiDate(date);
  const selectedAppt = list.find(a => a.id === selected);

  const therapistStatusText = therapistStatus === "loading" ? "กำลังโหลดหมอนวด…"
    : therapistStatus === "ok"    ? `หมอนวด ${therapistsData.length} คน`
    : therapistStatus === "error" ? "โหลดหมอนวดไม่สำเร็จ"
    : `หมอนวด (ตัวอย่าง ${therapistsData.length} คน)`;

  const saveAppt = (data) => {
    if (data.id) {
      setAppts(p => ({ ...p, [key]: (p[key] || []).map(a => a.id === data.id ? { ...a, ...data } : a) }));
      showToast("บันทึกการแก้ไขเรียบร้อยแล้ว");
    } else {
      const id = `a${key}_new_${Date.now()}`;
      const todayList = appts[key] || [];
      const maxQNo = todayList.reduce((mx, a) => Math.max(mx, a.queueNo || 0), 0);
      const queueNo = maxQNo + 1;
      const saved = { ...data, id, queueNo };
      setAppts(p => ({ ...p, [key]: [...(p[key] || []), saved] }));
      showToast("จองนัดเรียบร้อยแล้ว");
      setPrintAppt({ appt: saved, date, queueNo });
    }
    setBooking(null);
  };

  const setApptStatus = (appt, status) => {
    setAppts(p => ({ ...p, [key]: (p[key] || []).map(a => a.id === appt.id ? { ...a, status } : a) }));
    showToast(`อัปเดตเป็น "${STATUSES[status]?.label || status}"`);
  };
  const cancelAppt = (appt) => {
    setAppts(p => ({ ...p, [key]: (p[key] || []).map(a => a.id === appt.id ? { ...a, status: "cancelled" } : a) }));
    setSelected(null);
    showToast("ยกเลิกนัดแล้ว");
  };

  return (
    <div className="app">
      <Sidebar activePage={activePage} onNav={setActivePage}
        collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div className="main">
        {/* ── Report page ── */}
        {activePage === "report" && (
          <ReportPage
            appts={appts}
            therapistsData={therapistsData}
            activeServices={activeServices}
            userInfo={bms.userInfo}
            therapistStatusText={therapistStatusText}
            onDisconnect={doDisconnect}
            serviceTherFees={serviceTherFees}
            onNewBooking={(therapistId) => {
              setBooking({ therapistId, start: OPEN_MIN });
              setActivePage("sched");
            }}
          />
        )}

        {/* ── Queue page ── */}
        {activePage === "queue" && (
          <QueuePage
            appts={appts}
            therapistsData={therapistsData}
            activeServices={activeServices}
            beds={beds}
            userInfo={bms.userInfo}
            therapistStatusText={therapistStatusText}
            onDisconnect={doDisconnect}
            onUpdateStatus={(appt, status) => {
              const qk = dayKey(queueDate);
              setAppts(p => ({ ...p, [qk]: (p[qk] || []).map(a => a.id === appt.id ? { ...a, status } : a) }));
              showToast(`อัปเดตเป็น "${STATUSES[status]?.label || status}"`);
            }}
            dateKey={dayKey(queueDate)}
            queueDate={queueDate}
            onQueueDateChange={setQueueDate}
            todayKey={todayKey}
            currentQueue={currentQueue}
            queueHistory={queueHistory}
            onCallQueue={handleCallQueue}
            onRepeatCall={handleRepeatCall}
          />
        )}

        {/* ── Services page (HOSxP registry) ── */}
        {activePage === "svc" && (
          <ServicesPage
            operationItems={operationItems}
            operationStatus={operationStatus}
            operationErrMsg={operationErrMsg}
            userInfo={bms.userInfo}
            therapistStatusText={therapistStatusText}
            onDisconnect={doDisconnect}
            onReload={() => doLoadOperationItems(bms.config)}
            serviceTherFees={serviceTherFees}
            onSaveTherFee={handleSaveTherFee}
          />
        )}

        {/* ── Beds page ── */}
        {activePage === "bed" && (
          <BedsPage
            beds={beds}
            onSaveBed={handleSaveBed}
            onToggleBed={handleToggleBed}
            userInfo={bms.userInfo}
            therapistStatusText={therapistStatusText}
            onDisconnect={doDisconnect}
          />
        )}

        {/* ── Therapist page ── */}
        {activePage === "ther" && (
          <TherapistPage
            therapistsData={therapistsData}
            therapistStatus={therapistStatus}
            errMsg={therapistErrMsg}
            apiUrl={bms.config && bms.config.apiUrl}
            rawSession={bms.rawSession}
            onReload={() => doLoadTherapists(bms.config)}
            onTest={doTestApi}
            testResult={testResult}
            onSaveManualConfig={(url, key) => {
              const newConfig = { ...bms.config, apiUrl: url, apiAuthKey: key || bms.config?.apiAuthKey };
              localStorage.setItem("hosxp_manual_config", JSON.stringify({ apiUrl: url, apiAuthKey: key }));
              setBms(prev => ({ ...prev, config: newConfig }));
              doLoadTherapists(newConfig);
            }}
            userInfo={bms.userInfo}
            therapistStatusText={therapistStatusText}
            onDisconnect={doDisconnect}
          />
        )}

        {/* ── Screen settings page ── */}
        {activePage === "screen" && (
          <ScreenPage
            t={t}
            setTweak={setTweak}
            userInfo={bms.userInfo}
            therapistStatusText={therapistStatusText}
            onDisconnect={doDisconnect}
          />
        )}

        {/* ── Customers page ── */}
        {activePage === "cust" && (
          <CustomersPage
            appts={appts}
            therapistsData={therapistsData}
            operationItems={operationItems}
            userInfo={bms.userInfo}
            therapistStatusText={therapistStatusText}
            onDisconnect={doDisconnect}
            bmsConfig={bms.config}
            serviceTherFees={serviceTherFees}
          />
        )}

        {/* ── Schedule page (default) ── */}
        {activePage === "sched" && (
          <>
            <TopBar userInfo={bms.userInfo} therapistStatus={therapistStatusText} onDisconnect={doDisconnect}
              rightSlot={
                <div style={{ position: "relative" }}>
                  <NotifBell notifs={notifications} onClick={() => setNotifOpen(p => !p)} />
                  {notifOpen && (
                    <NotificationPanel
                      notifs={notifications}
                      onRead={markNotifRead}
                      onReadAll={markAllRead}
                      onClose={() => setNotifOpen(false)}
                      onGotoQueue={() => { setNotifOpen(false); setActivePage("queue"); }}
                    />
                  )}
                </div>
              }
            >
              <div>
                <div className="page-title">ตารางให้บริการแพทย์แผนไทย</div>
                <div className="page-sub">จัดการคิวและนัดหมายประจำวัน</div>
              </div>
              <div className="search" style={{ marginLeft: 12 }}>
                <Icon name="search" size={16} />
                <input placeholder="ค้นหาชื่อ / เบอร์โทร" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <button className="btn-primary"
                onClick={() => setBooking({ therapistId: therapistsData[0]?.id, start: OPEN_MIN })}>
                <Icon name="plus" size={17} /> จองนัดใหม่
              </button>
            </TopBar>

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
              <div className="spacer" />
              <div className="seg" style={{ maxWidth: "55vw", overflowX: "auto", flexWrap: "nowrap" }}>
                <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>ทุกคน</button>
                {therapistStatus === "loading"
                  ? <button disabled style={{ opacity: .5 }}>โหลด…</button>
                  : therapistsData.map(tt => (
                    <button key={tt.id} className={filter === tt.id ? "on" : ""} onClick={() => setFilter(tt.id)}>
                      {tt.name.split(" ")[0]}
                    </button>
                  ))
                }
              </div>
            </div>

            <div className="stats">
              <Stat icon="calendar" val={totalStat}                                  lab="นัดทั้งหมดวันนี้"   ink="var(--st-booked-ink)"  bg="var(--st-booked-bg)" />
              <Stat icon="clock"    val={upcoming}                                   lab="รอเข้ารับบริการ"   ink="var(--st-arrived-ink)" bg="var(--st-arrived-bg)" />
              <Stat icon="check"    val={confirmed}                                  lab="ยืนยันแล้ว"        ink="var(--st-confirm-ink)" bg="var(--st-confirm-bg)" />
              <Stat icon="spark"    val={inHouse}                                    lab="อยู่ในร้านขณะนี้"   ink="var(--st-service-ink)" bg="var(--st-service-bg)" />
              <Stat icon="spark"    val={inService}                                  lab="กำลังนวด"          ink="var(--st-done-ink)"    bg="var(--st-done-bg)" />
              <Stat icon="check"    val={doneCnt}                                    lab="เสร็จสิ้น"          ink="var(--st-done-ink)"    bg="var(--st-done-bg)" />
              <Stat icon="money"    val={Number(incomeStat).toLocaleString() + "฿"} lab="รายได้ (เสร็จสิ้น)" ink="var(--st-confirm-ink)" bg="var(--st-confirm-bg)" />
            </div>

            <div className="board-wrap">
              {therapistStatus === "loading" ? (
                <div className="empty" style={{ flex: 1 }}>
                  <Icon name="clock" size={32} />
                  <div>กำลังโหลดรายชื่อหมอนวดจาก HOSxP…</div>
                </div>
              ) : (
                <Board
                  appts={filtered} therapists={visibleTherapists} rowH={rowH}
                  showNow={t.showNow && key === todayKey}
                  onSlot={(tid, start) => setBooking({ therapistId: tid, start })}
                  onAppt={(a) => setSelected(a.id)}
                  beds={beds}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Global drawers ── */}
      <BookingForm
        open={!!booking} draft={booking} therapists={therapistsData}
        services={activeServices}
        onClose={() => setBooking(null)} onSave={saveAppt}
        executeQuery={executeQuery}
        vstdate={key}
        existingAppts={list}
        beds={beds}
      />
      <DetailPanel
        open={!!selected} appt={selectedAppt}
        onClose={() => setSelected(null)}
        onSave={saveAppt}
        onCancel={cancelAppt}
        therapists={therapistsData}
        services={activeServices}
        beds={beds}
        existingAppts={list}
      />
      {/* ServiceForm: เก็บไว้เผื่อใช้เพิ่มบริการ local */}

      {printAppt && (
        <QueueTicketModal
          appt={printAppt.appt}
          services={activeServices}
          therapists={therapistsData}
          queueNo={printAppt.queueNo}
          date={printAppt.date}
          onClose={() => setPrintAppt(null)}
          beds={beds}
        />
      )}

      <div className={"toast" + (toast ? " show" : "")}>
        <Icon name="check" size={16} /> {toast}
      </div>

      <TweaksPanel>
        <TweakSection label="ธีมสี" />
        <TweakRadio label="โทนหลัก" value={t.theme}
          options={["herbal", "ocean", "hibiscus", "mocha", "dark", "indigo", "teal", "clay"]} onChange={v => setTweak("theme", v)} />
        <TweakSection label="การแสดงผล" />
        <TweakRadio label="ความหนาแน่น" value={t.density}
          options={["compact", "regular", "comfy"]} onChange={v => setTweak("density", v)} />
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
