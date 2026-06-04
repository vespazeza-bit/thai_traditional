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

function TopBar({ userInfo, therapistStatus, onDisconnect, children }) {
  return (
    <div className="topbar">
      {children}
      <div className="spacer" />
      {/* HOSxP session status */}
      <div className="session-bar">
        <div className="session-dot" />
        <div className="session-info">
          {userInfo.name  && <span className="session-name">{userInfo.name}</span>}
          {userInfo.location && <span className="session-loc">{userInfo.location}</span>}
          {!userInfo.name && !userInfo.location && <span className="session-name">HOSxP</span>}
          {therapistStatus && <span className="session-loc">{therapistStatus}</span>}
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
    { id: "cust",   icon: "users",    label: "ลูกค้า" },
    { id: "ther",   icon: "user",     label: "หมอนวด" },
    { id: "svc",    icon: "leaf",     label: "บริการ" },
    { id: "report", icon: "chart",    label: "รายงาน" },
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
        <button key={n.id} className={"nav-item" + (activePage === n.id ? " active" : "")}
          onClick={() => onNav(n.id)}>
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

function OperationDetail({ item, onClose }) {
  if (!item) return null;
  const raw = item._raw || {};
  const fields = Object.entries(raw).filter(([k, v]) => {
    if (v === null || v === undefined || v === "" || v === 0 || v === "0") return false;
    if (/_(type|category|group|level)_id$/i.test(k)) return false;
    if (k === "item_name") return false; // shown in hero
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
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" style={{ width: "100%" }} onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

// ── Services registry page (HOSxP health_med_operation_item) ──────────────────

function ServicesPage({ operationItems, operationStatus, operationErrMsg,
  userInfo, therapistStatusText, onDisconnect, onReload }) {

  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return operationItems;
    return operationItems.filter(it =>
      (it.name || "").toLowerCase().includes(q) ||
      Object.values(it._raw || {}).some(v => v && String(v).toLowerCase().includes(q))
    );
  }, [operationItems, search]);

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">ทะเบียนบริการ</div>
          <div className="page-sub">รายการหัตถการจาก HOSxP · health_med_operation_item</div>
        </div>
        <button className="btn-primary" onClick={onReload}
          style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <Icon name="refresh" size={16} /> โหลดใหม่
        </button>
      </TopBar>

      <div className="svc-content">
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
            <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
              แสดง {filtered.length} รายการ จากทั้งหมด {operationItems.length} รายการ
            </div>

            {/* Registry table */}
            <div className="reg-table">
              <div className="reg-head">
                <div className="reg-cell reg-num">#</div>
                <div className="reg-cell" style={{ flex: 2 }}>ชื่อบริการ / หัตถการ</div>
                <div className="reg-cell" style={{ width: 110 }}>ราคา (บาท)</div>
                <div className="reg-cell" style={{ width: 110 }}>เวลา (นาที)</div>
                <div className="reg-cell" style={{ width: 90 }}>สถานะ</div>
                <div className="reg-cell reg-action"></div>
              </div>
              {filtered.map((it, i) => {
                const active = it.isActive !== false;
                return (
                  <div key={it.id} className="reg-row" onClick={() => setSelected(it)}>
                    <div className="reg-cell reg-num">{i + 1}</div>
                    <div className="reg-cell" style={{ flex: 2, fontWeight: 600, fontSize: 14 }}>
                      {it.name}
                    </div>
                    <div className="reg-cell" style={{ width: 110 }}>
                      {it.price
                        ? <span style={{ fontWeight: 700, color: "var(--primary-deep)" }}>
                            {Number(it.price).toLocaleString()}
                          </span>
                        : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>}
                    </div>
                    <div className="reg-cell" style={{ width: 110 }}>
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

      <OperationDetail item={selected} onClose={() => setSelected(null)} />
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

  return (
    <>
      <TopBar userInfo={userInfo} therapistStatus={therapistStatusText} onDisconnect={onDisconnect}>
        <div>
          <div className="page-title">ทะเบียนหมอนวด</div>
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

      <div className="svc-content">
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

            {/* Count */}
            <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
              แสดง {filtered.length} รายการ จากทั้งหมด {therapistsData.length} คน
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
              {filtered.map((t, i) => (
                <div key={t.id} className="reg-row" onClick={() => setSelected(t)}>
                  <div className="reg-cell reg-num">{i + 1}</div>
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
  const [booking, setBooking] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast]    = useState("");
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
      if (p[key]) return p;
      const useReal = therapistStatus === "ok";
      return { ...p, [key]: useReal ? [] : genDay(date, todayKey) };
    });
  }, [key, therapistStatus]);

  // บันทึกนัดทั้งหมดลง localStorage ทุกครั้งที่เปลี่ยน
  useEffect(() => {
    try { localStorage.setItem('thai_appts', JSON.stringify(appts)); } catch {}
  }, [appts]);

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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

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

  // ── Login gate ────────────────────────────────────────────────────────────
  if (!bms.connected) {
    return (
      <>
        <LoginScreen onConnect={doConnect} loading={bms.loading} error={bms.error} />
        <TweaksPanel>
          <TweakSection label="ธีมสี" />
          <TweakRadio label="โทนหลัก" value={t.theme}
            options={["herbal", "indigo", "teal", "clay"]} onChange={v => setTweak("theme", v)} />
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
  const revenue  = activeAppts.filter(a => a.status === "done").reduce((s, a) => s + (svc(a.serviceId)?.price || 0), 0);
  const upcoming = activeAppts.filter(a => a.status === "booked" || a.status === "confirmed").length;
  const inHouse  = activeAppts.filter(a => a.status === "arrived" || a.status === "service").length;
  const shiftDay = (d) => { const nd = new Date(date); nd.setDate(nd.getDate() + d); setDate(nd); };
  const td = thaiDate(date);
  const selectedAppt = list.find(a => a.id === selected);

  const therapistStatusText = therapistStatus === "loading" ? "กำลังโหลดหมอนวด…"
    : therapistStatus === "ok"    ? `หมอนวด ${therapistsData.length} คน`
    : therapistStatus === "error" ? "โหลดหมอนวดไม่สำเร็จ"
    : `หมอนวด (ตัวอย่าง ${therapistsData.length} คน)`;

  const saveAppt = (data) => {
    const id = `a${key}_new_${Date.now()}`;
    setAppts(p => ({ ...p, [key]: [...(p[key] || []), { ...data, id }] }));
    setBooking(null);
    showToast("จองนัดเรียบร้อยแล้ว");
  };
  const setApptStatus = (appt, status) => {
    setAppts(p => ({ ...p, [key]: (p[key] || []).map(a => a.id === appt.id ? { ...a, status } : a) }));
    showToast(`อัปเดตเป็น "${STATUSES[status].label}"`);
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

        {/* ── Schedule page (default) ── */}
        {activePage === "sched" && (
          <>
            <TopBar userInfo={bms.userInfo} therapistStatus={therapistStatusText} onDisconnect={doDisconnect}>
              <div>
                <div className="page-title">ตารางนัดหมอนวด</div>
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
              <Stat icon="calendar" val={activeAppts.length}             lab="นัดทั้งหมดวันนี้"   ink="var(--st-booked-ink)"  bg="var(--st-booked-bg)" />
              <Stat icon="clock"    val={upcoming}                        lab="รอเข้ารับบริการ"   ink="var(--st-arrived-ink)" bg="var(--st-arrived-bg)" />
              <Stat icon="spark"    val={inHouse}                         lab="อยู่ในร้านขณะนี้"   ink="var(--st-service-ink)" bg="var(--st-service-bg)" />
              <Stat icon="money"    val={revenue.toLocaleString() + "฿"}  lab="รายได้ (เสร็จสิ้น)" ink="var(--st-confirm-ink)" bg="var(--st-confirm-bg)" />
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
      />
      <DetailPanel
        open={!!selected} appt={selectedAppt}
        onClose={() => setSelected(null)} onStatus={setApptStatus} onCancel={cancelAppt}
      />
      {/* ServiceForm: เก็บไว้เผื่อใช้เพิ่มบริการ local */}

      <div className={"toast" + (toast ? " show" : "")}>
        <Icon name="check" size={16} /> {toast}
      </div>

      <TweaksPanel>
        <TweakSection label="ธีมสี" />
        <TweakRadio label="โทนหลัก" value={t.theme}
          options={["herbal", "indigo", "teal", "clay"]} onChange={v => setTweak("theme", v)} />
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
