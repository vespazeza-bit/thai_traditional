/* ===== Drawers: booking form + appointment detail ===== */

function Drawer({ open, onClose, title, children, foot }) {
  return (
    <>
      <div className={"scrim" + (open ? " show" : "")} onClick={onClose}></div>
      <aside className={"drawer" + (open ? " show" : "")}>
        <div className="drawer-head">
          <div className="drawer-title">{title}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot && <div className="drawer-foot">{foot}</div>}
      </aside>
    </>
  );
}

// ── Patient autocomplete (HOSxP patient table) ───────────────────────────────

// TIS-620 → Unicode decoder สำหรับ patient.fname / lname ที่เก็บ charset ผิด
const TIS620_MAP = {
  0xA0:0x00A0,0xA1:0x0E01,0xA2:0x0E02,0xA3:0x0E03,0xA4:0x0E04,0xA5:0x0E05,0xA6:0x0E06,0xA7:0x0E07,
  0xA8:0x0E08,0xA9:0x0E09,0xAA:0x0E0A,0xAB:0x0E0B,0xAC:0x0E0C,0xAD:0x0E0D,0xAE:0x0E0E,0xAF:0x0E0F,
  0xB0:0x0E10,0xB1:0x0E11,0xB2:0x0E12,0xB3:0x0E13,0xB4:0x0E14,0xB5:0x0E15,0xB6:0x0E16,0xB7:0x0E17,
  0xB8:0x0E18,0xB9:0x0E19,0xBA:0x0E1A,0xBB:0x0E1B,0xBC:0x0E1C,0xBD:0x0E1D,0xBE:0x0E1E,0xBF:0x0E1F,
  0xC0:0x0E20,0xC1:0x0E21,0xC2:0x0E22,0xC3:0x0E23,0xC4:0x0E24,0xC5:0x0E25,0xC6:0x0E26,0xC7:0x0E27,
  0xC8:0x0E28,0xC9:0x0E29,0xCA:0x0E2A,0xCB:0x0E2B,0xCC:0x0E2C,0xCD:0x0E2D,0xCE:0x0E2E,0xCF:0x0E2F,
  0xD0:0x0E30,0xD1:0x0E31,0xD2:0x0E32,0xD3:0x0E33,0xD4:0x0E34,0xD5:0x0E35,0xD6:0x0E36,0xD7:0x0E37,
  0xD8:0x0E38,0xD9:0x0E39,0xDA:0x0E3A,0xDF:0x0E3F,
  0xE0:0x0E40,0xE1:0x0E41,0xE2:0x0E42,0xE3:0x0E43,0xE4:0x0E44,0xE5:0x0E45,0xE6:0x0E46,0xE7:0x0E47,
  0xE8:0x0E48,0xE9:0x0E49,0xEA:0x0E4A,0xEB:0x0E4B,0xEC:0x0E4C,0xED:0x0E4D,0xEE:0x0E4E,0xEF:0x0E4F,
  0xF0:0x0E50,0xF1:0x0E51,0xF2:0x0E52,0xF3:0x0E53,0xF4:0x0E54,0xF5:0x0E55,0xF6:0x0E56,0xF7:0x0E57,
  0xF8:0x0E58,0xF9:0x0E59,0xFA:0x0E5A,0xFB:0x0E5B,
};
function decodeHexBytes(hex) {
  if (!hex) return '';
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  // ลอง UTF-8 ก่อน (ถ้าฐานข้อมูลเก็บ UTF-8 แต่ connection charset ผิด)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (_) {}
  // fallback TIS-620 (ถ้า raw bytes เป็น TIS-620)
  let out = '';
  for (const b of bytes) {
    if (b < 0x80) out += String.fromCharCode(b);
    else if (TIS620_MAP[b]) out += String.fromCharCode(TIS620_MAP[b]);
  }
  return out;
}

function sexLabel(sex) {
  if (sex === '1' || sex === 1 || sex === 'M') return 'ชาย';
  if (sex === '2' || sex === 2 || sex === 'F') return 'หญิง';
  return sex || '';
}

function calcAge(birthday) {
  if (!birthday) return '';
  const dob = new Date(birthday);
  if (isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? `${age} ปี` : '';
}

function highlightText(text, query) {
  if (!query || !text) return text;
  const words = query.trim().split(/\s+/).filter(Boolean);
  const pat = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = String(text).split(new RegExp(`(${pat})`, 'gi'));
  return parts.map((part, i) =>
    words.some(w => part.toLowerCase() === w.toLowerCase())
      ? <mark key={i} style={{ background: '#fef3c7', color: '#92400e', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
      : part
  );
}

function PatientAutocomplete({ executeQuery, value, onChange, onSelect, vstdate }) {
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [errMsg,   setErrMsg]   = useState('');
  const [query,    setQuery]    = useState('');
  const timerRef        = useRef(null);
  const abortRef        = useRef(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = value.trim();
    if (q.length < 2) {
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      setResults([]); setShowDrop(false); setErrMsg(''); setQuery('');
      return;
    }
    timerRef.current = setTimeout(() => doSearch(q), 800);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  const doSearch = async (q) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortRef.current = ctrl;
    setQuery(q);
    setLoading(true); setErrMsg('');

    const words = q.trim().split(/\s+/).filter(Boolean);
    const qSafe   = escapeSqlStr(q.trim());
    const telSafe = escapeSqlStr(q.trim().replace(/\s+/g, ''));

    // HEX(CAST AS BINARY) → ดึง raw bytes หลีกเลี่ยง API connection charset
    // decode client-side: UTF-8 ก่อน (ข้อมูลเก็บ UTF-8) fallback TIS-620
    const hx = col => `HEX(CAST(${col} AS BINARY))`;
    let sql;
    if (vstdate) {
      const dateSafe = escapeSqlStr(vstdate);
      const nameCond = words
        .map(w => { const s = escapeSqlStr(w); return `(p.fname LIKE '%${s}%' OR p.lname LIKE '%${s}%')`; })
        .join(' AND ');
      const nameWhere = nameCond
        ? `(${nameCond}) OR p.hn = '${qSafe}' OR p.mobile_phone_number LIKE '%${telSafe}%'`
        : `p.hn = '${qSafe}' OR p.mobile_phone_number LIKE '%${telSafe}%'`;
      sql = `SELECT p.hn, ${hx('p.pname')} AS pname, ${hx('p.fname')} AS fname, ${hx('p.lname')} AS lname, p.sex, p.mobile_phone_number, COALESCE(MIN(ev.name), MIN(ep.name)) AS pttype_name, MAX(CASE WHEN v.vstdate = '${dateSafe}' THEN 1 ELSE 0 END) AS has_visit FROM patient p LEFT JOIN ovst v ON v.hn = p.hn AND v.vstdate = '${dateSafe}' LEFT JOIN visit_pttype vp ON vp.vn = v.vn LEFT JOIN pttype ev ON ev.pttype = vp.pttype LEFT JOIN pttype ep ON ep.pttype = p.pttype WHERE (${nameWhere}) GROUP BY p.hn, p.pname, p.fname, p.lname, p.sex, p.mobile_phone_number ORDER BY has_visit DESC, p.lname, p.fname LIMIT 20`;
    } else {
      const nameCond = words
        .map(w => { const s = escapeSqlStr(w); return `(fname LIKE '%${s}%' OR lname LIKE '%${s}%')`; })
        .join(' AND ');
      sql = `SELECT hn, ${hx('pname')} AS pname, ${hx('fname')} AS fname, ${hx('lname')} AS lname, sex, tel1 AS mobile_phone_number FROM patient WHERE (${nameCond}) OR hn = '${qSafe}' OR tel1 LIKE '%${telSafe}%' ORDER BY lname, fname LIMIT 20`;
    }

    const res = await executeQuery(sql, ctrl ? ctrl.signal : undefined);

    if (res.aborted) {
      if (abortRef.current === ctrl) setLoading(false);
      return;
    }

    setLoading(false);
    if (res.ok) {
      const rows = (res.data || []).map(r => {
        const pname = decodeHexBytes(r.pname);
        const fname = decodeHexBytes(r.fname);
        const lname = decodeHexBytes(r.lname);
        return {
          ...r,
          fullname: `${pname}${fname} ${lname}`.trim() || `HN ${r.hn}`,
          phone: r.mobile_phone_number || r.tel1 || '',
        };
      });
      setResults(rows);
      setShowDrop(true);
    } else {
      setErrMsg(res.error || 'ค้นหาไม่สำเร็จ');
      setResults([]); setShowDrop(false);
    }
  };

  const handleSelect = (p) => {
    justSelectedRef.current = true;
    onSelect(p);
    setShowDrop(false);
    setResults([]);
  };

  // dropdown แบบ inline (ไม่ใช้ position:fixed/absolute) — หลีกเลี่ยงปัญหา backdrop-filter
  // ปรากฏใต้ช่องชื่อในฟอร์มตามที่ผู้ใช้ต้องการ
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          placeholder="พิมพ์ชื่อ-สกุล, HN หรือเบอร์โทร เพื่อค้นหา…"
          value={value}
          onChange={e => { onChange(e.target.value); setShowDrop(false); }}
          onFocus={() => results.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 200)}
          autoFocus
        />
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--ink-faint)', pointerEvents: 'none' }}>
          {loading ? <Icon name="clock" size={14} /> : <Icon name="search" size={14} />}
        </div>
      </div>

      {errMsg && (
        <div style={{ fontSize: 12, color: 'var(--st-cancel-ink)', padding: '4px 2px' }}>{errMsg}</div>
      )}

      {/* dropdown inline — แสดงใต้ช่องชื่อ ไม่ลอยออกจากฟอร์ม */}
      {showDrop && (
        <div style={{
          marginTop: 2,
          background: '#fff',
          border: '1px solid #b0b8c1',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
          maxHeight: 260,
          overflowY: 'auto',
          fontSize: 13,
        }}>
          <div style={{ padding: '4px 10px', background: '#e8edf2', borderBottom: '1px solid #c8d0d8',
            fontSize: 12, fontWeight: 600, color: '#444' }}>
            รายการ
          </div>

          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#888', fontStyle: 'italic' }}>
              ไม่พบข้อมูลผู้ป่วย
            </div>
          ) : results.map((p, i) => {
            const sub = [p.hn ? `HN ${p.hn}` : '', sexLabel(p.sex), p.pttype_name || '', p.phone].filter(Boolean).join('  ·  ');
            return (
              <button key={p.hn || i}
                onMouseDown={() => handleSelect(p)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 12px', border: 'none', background: 'none',
                  borderBottom: '1px solid #eef0f2', cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e8f4fd'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <div style={{ fontWeight: 500, color: '#1a1a1a', lineHeight: 1.4 }}>
                  {highlightText(p.fullname, query)}
                </div>
                {sub && (
                  <div style={{ fontSize: 11.5, color: '#666', marginTop: 2 }}>
                    {highlightText(sub, query)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Booking form (centered modal) ────────────────────────────────────────────

function BookingForm({ open, onClose, draft, therapists, onSave, executeQuery, services: servicesProp, vstdate, existingAppts }) {
  const serviceList = servicesProp || SERVICES;
  const [customer,   setCustomer]   = useState("");
  const [phone,      setPhone]      = useState("");
  const [hn,         setHn]         = useState("");
  const [serviceId,  setServiceId]  = useState(serviceList[0]?.id || "thai60");
  const [therapistId,setTherapistId]= useState(therapists[0]?.id);
  const [start,      setStart]      = useState(OPEN_MIN);
  const [note,       setNote]       = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [dupWarn,    setDupWarn]    = useState(null);
  const [slotConflict, setSlotConflict] = useState(null);
  const [pttypeName, setPttypeName] = useState("");

  const isEdit = !!(draft && draft.id);

  useEffect(() => {
    if (open && draft) {
      setTherapistId(draft.therapistId || therapists[0]?.id);
      setStart(draft.start ?? OPEN_MIN);
      setCustomer(draft.customer || "");
      setPhone(draft.phone || "");
      setHn(draft.hn || "");
      setNote(draft.note || "");
      setPttypeName(draft.pttypeName || "");
      const draftSvc = draft.serviceId && serviceList.find(sv => sv.id === draft.serviceId);
      setServiceId(draftSvc ? draft.serviceId : (serviceList[0]?.id || "thai60"));
      setShowSearch(false);
    }
  }, [open, draft, serviceList.length]);

  const selectPatient = (p) => {
    setCustomer(p.fullname || "");
    setPhone(p.phone || p.mobile_phone_number || p.tel1 || "");
    setHn(p.hn || "");
    setPttypeName(p.pttype_name || "");
    setShowSearch(false);
  };

  // ค้นหาบริการจาก serviceList (HOSxP หรือ mock) ก่อน ถ้าไม่เจอค่อย fallback svc()
  const s   = serviceList.find(sv => sv.id === serviceId) || svc(serviceId) || serviceList[0] || {};
  const th  = ther(therapistId) || therapists[0];
  const valid = customer.trim().length > 1;

  const timeOpts = [];
  for (let m = OPEN_MIN; m <= CLOSE_MIN - 30; m += SLOT) timeOpts.push(m);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card booking-modal fade-up">

        {/* Header */}
        <div className="modal-head">
          <div className="drawer-title">{isEdit ? "แก้ไขการจองนัด" : "จองนัดใหม่"}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        {/* Body: 2 columns */}
        <div className="booking-body">

          {/* ── Left column: ข้อมูลผู้ป่วย + นัด ── */}
          <div className="booking-left">

            {/* ชื่อลูกค้า: autocomplete จาก HOSxP patient */}
            <div className="field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label>ชื่อ-สกุลลูกค้า</label>
                {executeQuery && !hn && (
                  <span style={{ fontSize: 11.5, color: "var(--primary)" }}>
                    ค้นหาจาก HOSxP อัตโนมัติ
                  </span>
                )}
              </div>
              {executeQuery ? (
                <PatientAutocomplete
                  executeQuery={executeQuery}
                  value={customer}
                  onChange={setCustomer}
                  onSelect={selectPatient}
                  vstdate={vstdate}
                />
              ) : (
                <input className="input" placeholder="เช่น คุณสุภาพร ใจดี"
                  value={customer} onChange={e => setCustomer(e.target.value)} autoFocus />
              )}
              {hn && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="hn-badge">
                    <Icon name="users" size={12} /> HN {hn}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setHn(""); setCustomer(""); setPhone(""); }}
                    style={{ fontSize: 11, color: "var(--ink-faint)", background: "none", border: "none",
                      cursor: "pointer", padding: 0, lineHeight: 1 }}
                    title="ล้างข้อมูลผู้ป่วย">
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="field">
              <label>เบอร์โทรศัพท์</label>
              <input className="input" placeholder="08x-xxx-xxxx"
                value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            <div className="row2">
              <div className="field">
                <label>หมอนวด</label>
                <select className="select" value={therapistId} onChange={e => setTherapistId(e.target.value)}>
                  {therapists.map(tt => (
                    <option key={tt.id} value={tt.id}>{tt.fullname || tt.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>เวลาเริ่มต้น</label>
                <select className="select" value={start} onChange={e => setStart(+e.target.value)}>
                  {timeOpts.map(m => <option key={m} value={m}>{fmtMin(m)}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label>หมายเหตุ / อาการ</label>
              <textarea className="input" placeholder="เช่น ปวดบ่าไหล่ ขอแรงปานกลาง"
                rows={3} value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {/* Summary */}
            <div className="booking-summary">
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 2 }}>สรุปการจอง</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {fmtMin(start)}–{fmtMin(start + (s.dur || 60))}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>
                  {th?.fullname || th?.name} · {s.name || "—"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>ค่าบริการ</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--primary-deep)", lineHeight: 1 }}>
                  {s.price ? Number(s.price).toLocaleString() : "—"}
                </div>
                {s.price && <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>บาท</div>}
              </div>
            </div>
          </div>

          {/* ── Right column: เลือกบริการ ── */}
          <div className="booking-right">
            <div className="field">
              <label>เลือกบริการ</label>
              <div className="choice-grid-v">
                {serviceList.map(sv => (
                  <button key={sv.id} className={"choice" + (serviceId === sv.id ? " on" : "")}
                    onClick={() => setServiceId(sv.id)}>
                    <div className="choice-name">{sv.name}</div>
                    <div className="choice-meta">
                      {sv.dur && <span><Icon name="clock" size={12} /> {sv.dur} นาที</span>}
                      {sv.price && <span style={{ fontWeight: 700 }}>{Number(sv.price).toLocaleString()}฿</span>}
                    </div>
                  </button>
                ))}
                {serviceList.length === 0 && (
                  <div style={{ color: "var(--ink-faint)", fontSize: 13, padding: 16, textAlign: "center" }}>
                    ไม่มีข้อมูลบริการ
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-foot" style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>ยกเลิก</button>
          <button className="btn-fill"  style={{ flex: 2 }} disabled={!valid}
            onClick={() => {
              const newDur = (s && s.dur) ? s.dur : 60;
              // ตรวจสอบการจองซ้ำช่วงเวลา: หมอนวดคนเดียวกัน เวลาทับซ้อนกัน
              const timeConflict = (existingAppts || []).find(a => {
                if (a.status === "cancelled") return false;
                if (a.id === draft?.id) return false;
                if (a.therapistId !== therapistId) return false;
                const aDur = (svc(a.serviceId)?.dur) || 60;
                return a.start < start + newDur && a.start + aDur > start;
              });
              if (timeConflict) { setSlotConflict(timeConflict); return; }
              // ตรวจสอบ HN ซ้ำ (เตือนได้แต่ยังจองได้)
              if (!isEdit && hn) {
                const dup = (existingAppts || []).find(
                  a => a.hn === hn && a.status !== "cancelled" && a.id !== draft?.id
                );
                if (dup) { setDupWarn(dup); return; }
              }
              onSave({
                ...(isEdit ? { id: draft.id, status: draft.status } : { status: "booked" }),
                customer: customer.trim(), phone, hn, pttypeName,
                serviceId, therapistId, start, note, gender: "ญ",
              });
            }}>
            <Icon name="check" size={16} /> {isEdit ? "บันทึกการแก้ไข" : "ยืนยันการจอง"}
          </button>
        </div>

        {/* Therapist time-conflict dialog — hard block */}
        {slotConflict && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, borderRadius: 16,
          }}>
            <div style={{
              background: "var(--surface)", borderRadius: 14, padding: 24, maxWidth: 340,
              boxShadow: "0 8px 32px rgba(0,0,0,.22)", textAlign: "center",
            }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🚫</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "#dc2626" }}>
                ไม่สามารถจองได้ — เวลาทับซ้อน
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 16, lineHeight: 1.7 }}>
                ผู้ให้บริการมีนัดอยู่แล้วช่วง <strong style={{ color: "var(--ink)" }}>
                  {fmtMin(slotConflict.start)}–{fmtMin(slotConflict.start + ((svc(slotConflict.serviceId)?.dur) || 60))}
                </strong><br/>
                ลูกค้า: <strong style={{ color: "var(--ink)" }}>{slotConflict.customer || "—"}</strong><br/>
                กรุณาเลือกเวลาอื่นหรือผู้ให้บริการท่านอื่น
              </div>
              <button className="btn-fill" style={{ width: "100%" }} onClick={() => setSlotConflict(null)}>
                ตกลง — เลือกเวลาใหม่
              </button>
            </div>
          </div>
        )}

        {/* Duplicate HN warning dialog */}
        {dupWarn && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, borderRadius: 16,
          }}>
            <div style={{
              background: "var(--surface)", borderRadius: 14, padding: 24, maxWidth: 320,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>มีนัดซ้ำในวันเดียวกัน</div>
              <div style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 16, lineHeight: 1.6 }}>
                HN {dupWarn.hn} — <strong>{dupWarn.customer}</strong><br/>
                มีนัดอยู่แล้ว เวลา {fmtMin(dupWarn.start)}<br/>
                ต้องการจองนัดเพิ่มหรือไม่?
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setDupWarn(null)}>ยกเลิก</button>
                <button className="btn-fill" style={{ flex: 1 }} onClick={() => {
                  setDupWarn(null);
                  onSave({ status: "booked", customer: customer.trim(), phone, hn, pttypeName, serviceId, therapistId, start, note, gender: "ญ" });
                }}>จองต่อ</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail / Edit panel (modal) ───────────────────────────────────────────────

function DetailPanel({ open, onClose, appt, onSave, onCancel, therapists, services }) {
  const serviceList = services || SERVICES;
  const [serviceId,   setServiceId]   = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [start,       setStart]       = useState(OPEN_MIN);
  const [status,      setStatus]      = useState("booked");

  useEffect(() => {
    if (open && appt) {
      setServiceId(appt.serviceId || serviceList[0]?.id || "");
      setTherapistId(appt.therapistId || therapists?.[0]?.id || "");
      setStart(appt.start ?? OPEN_MIN);
      setStatus(appt.status || "booked");
    }
  }, [open, appt]);

  if (!open || !appt) return null;

  const s  = serviceList.find(sv => sv.id === serviceId) || svc(serviceId) || { name: serviceId || '—', dur: 60, price: 0 };
  const t  = (therapists || []).find(tt => tt.id === therapistId) || ther(therapistId) || { name: therapistId || '—', color: 'clay' };
  const cancelled = appt.status === "cancelled";

  const timeOpts = [];
  for (let m = OPEN_MIN; m <= CLOSE_MIN - 30; m += SLOT) timeOpts.push(m);

  const handleSave = () => {
    onSave({ ...appt, serviceId, therapistId, start, status });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card booking-modal fade-up" style={{ position: "relative" }}>

        {/* Header */}
        <div className="modal-head">
          <div className="drawer-title">แก้ไขการจองนัด</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        {/* Body: 2 columns */}
        <div className="booking-body">

          {/* ── Left column ── */}
          <div className="booking-left">

            {/* Patient hero */}
            <div className="detail-hero" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line-soft)", marginBottom: 4 }}>
              <Avatar name={appt.customer || "?"} color={t.color || "clay"} size={48} />
              <div style={{ minWidth: 0 }}>
                <div className="detail-big-name" style={{ fontSize: 17 }}>{appt.customer || "—"}</div>
                <div className="detail-sub">{appt.phone || "ไม่ระบุเบอร์"}</div>
                {appt.hn && (
                  <div className="hn-badge" style={{ marginTop: 4, display: "inline-flex" }}>
                    <Icon name="users" size={12} /> HN {appt.hn}
                  </div>
                )}
                <div style={{ marginTop: 6 }}><Pill status={appt.status} /></div>
              </div>
            </div>

            {/* บริการที่เลือก (display only — เปลี่ยนได้จากคอลัมน์ขวา) */}
            <div className="kv" style={{ background: "var(--primary-tint)", borderRadius: 10, padding: "10px 12px", margin: "0 -2px" }}>
              <div className="kv-ic"><Icon name="leaf" size={17} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="kv-k">บริการ</div>
                <div className="kv-v" style={{ fontWeight: 600 }}>{s.name}</div>
              </div>
            </div>

            {/* เวลา (auto from start + dur) */}
            <div className="kv">
              <div className="kv-ic"><Icon name="clock" size={17} /></div>
              <div>
                <div className="kv-k">เวลา</div>
                <div className="kv-v">{fmtMin(start)}–{fmtMin(start + (s.dur || 60))} ({s.dur || 60} นาที)</div>
              </div>
            </div>

            {/* หมอนวด + เวลาเริ่มต้น (editable) */}
            <div className="row2">
              <div className="field">
                <label>หมอนวด</label>
                <select className="select" value={therapistId} onChange={e => setTherapistId(e.target.value)}>
                  {(therapists || []).map(tt => (
                    <option key={tt.id} value={tt.id}>{tt.fullname || tt.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>เวลาเริ่มต้น</label>
                <select className="select" value={start} onChange={e => setStart(+e.target.value)}>
                  {timeOpts.map(m => <option key={m} value={m}>{fmtMin(m)}</option>)}
                </select>
              </div>
            </div>

            {/* ค่าบริการ */}
            <div className="kv">
              <div className="kv-ic"><Icon name="money" size={17} /></div>
              <div>
                <div className="kv-k">ค่าบริการ</div>
                <div className="kv-v">{s.price ? Number(s.price).toLocaleString() + " บาท" : "—"}</div>
              </div>
            </div>

            {/* หมายเหตุ */}
            {appt.note && (
              <div className="kv">
                <div className="kv-ic"><Icon name="note" size={17} /></div>
                <div>
                  <div className="kv-k">หมายเหตุ</div>
                  <div className="kv-v" style={{ fontWeight: 500 }}>{appt.note}</div>
                </div>
              </div>
            )}

            {/* อัปเดตสถานะ */}
            {!cancelled && (
              <div className="field">
                <label>อัปเดตสถานะ</label>
                <div className="status-flow">
                  {STATUS_ORDER.map(key => {
                    const on = status === key;
                    const si = STATUSES[key];
                    return (
                      <button key={key} className={"status-opt" + (on ? " on" : "")}
                        style={on ? { borderColor: si.ink, background: si.bg, color: si.ink } : {}}
                        onClick={() => setStatus(key)}>
                        <span className="dot" style={{ width: 9, height: 9, borderRadius: "50%", background: si.ink }} />
                        {si.label}
                        {on && <span style={{ marginLeft: "auto" }}><Icon name="check" size={16} /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: เลือกบริการ ── */}
          <div className="booking-right">
            <div className="field">
              <label>เลือกบริการ</label>
              <div className="choice-grid-v">
                {serviceList.map(sv => (
                  <button key={sv.id} className={"choice" + (serviceId === sv.id ? " on" : "")}
                    onClick={() => setServiceId(sv.id)}>
                    <div className="choice-name">{sv.name}</div>
                    <div className="choice-meta">
                      {sv.dur  && <span><Icon name="clock" size={12} /> {sv.dur} นาที</span>}
                      {sv.price && <span style={{ fontWeight: 700 }}>{Number(sv.price).toLocaleString()}฿</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-foot" style={{ display: "flex", gap: 10 }}>
          {!cancelled && (
            <button className="btn-ghost btn-danger" style={{ marginRight: "auto" }}
              onClick={() => { onCancel(appt); onClose(); }}>
              ยกเลิกนัด
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          {!cancelled && (
            <button className="btn-fill" style={{ flex: 2 }} onClick={handleSave}>
              <Icon name="check" size={16} /> บันทึก
            </button>
          )}
          {cancelled && <button className="btn-ghost" onClick={onClose}>ปิด</button>}
        </div>
      </div>
    </div>
  );
}

// ── Service form (add / edit) ─────────────────────────────────────────────────

const SERVICE_GROUP_SUGGESTIONS = ["นวดไทย", "อโรมา", "เท้า", "สมุนไพร", "ออฟฟิศ", "อื่นๆ"];

function ServiceForm({ open, onClose, service, onSave }) {
  const isEdit = !!service && !!service.id;
  const [name, setName]   = useState("");
  const [group, setGroup] = useState("");
  const [dur, setDur]     = useState(60);
  const [price, setPrice] = useState(300);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setName(service.name || "");
      setGroup(service.group || "");
      setDur(service.dur || 60);
      setPrice(service.price || 0);
      setActive(service.active !== false);
    } else {
      setName(""); setGroup(""); setDur(60); setPrice(300); setActive(true);
    }
  }, [open, isEdit, service]);

  const valid = name.trim().length > 0 && dur > 0 && price >= 0;

  const save = () => {
    onSave({
      ...(service || {}),
      id:     isEdit ? service.id : `svc_${Date.now()}`,
      name:   name.trim(),
      group:  group.trim() || "ทั่วไป",
      dur, price, active,
    });
  };

  return (
    <Drawer
      open={open} onClose={onClose}
      title={isEdit ? "แก้ไขบริการ" : "เพิ่มบริการใหม่"}
      foot={
        <>
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn-fill" disabled={!valid} onClick={save}>
            {isEdit ? "บันทึกการแก้ไข" : "เพิ่มบริการ"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>ชื่อบริการ</label>
        <input className="input" placeholder="เช่น นวดไทย 60 นาที" value={name}
          onChange={e => setName(e.target.value)} autoFocus />
      </div>

      <div className="field">
        <label>หมวดหมู่</label>
        <input className="input" placeholder="เช่น นวดไทย, อโรมา, สมุนไพร" value={group}
          onChange={e => setGroup(e.target.value)} list="svc-groups" />
        <datalist id="svc-groups">
          {SERVICE_GROUP_SUGGESTIONS.map(g => <option key={g} value={g} />)}
        </datalist>
      </div>

      <div className="row2">
        <div className="field">
          <label>ระยะเวลา (นาที)</label>
          <input className="input" type="number" min="5" step="5" value={dur}
            onChange={e => setDur(Math.max(5, +e.target.value))} />
        </div>
        <div className="field">
          <label>ราคา (บาท)</label>
          <input className="input" type="number" min="0" step="10" value={price}
            onChange={e => setPrice(Math.max(0, +e.target.value))} />
        </div>
      </div>

      {/* Active toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 0", borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>เปิดใช้งาน</div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            {active ? "บริการนี้จะปรากฏในฟอร์มจองนัด" : "บริการนี้ถูกซ่อน จะไม่ปรากฏในฟอร์มจองนัด"}
          </div>
        </div>
        <button type="button" className="twk-toggle" data-on={active ? "1" : "0"}
          role="switch" onClick={() => setActive(v => !v)}><i /></button>
      </div>

      {/* Preview card */}
      <div style={{ background: "var(--surface-2)", borderRadius: "var(--r)", padding: "14px 16px" }}>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 8 }}>ตัวอย่างการแสดงผล</div>
        <div className={"choice" + (active ? " on" : "")} style={{ pointerEvents: "none" }}>
          <div className="choice-name">{name || "ชื่อบริการ"}</div>
          <div className="choice-meta">
            <span>{dur} นาที</span>
            <span>{price.toLocaleString()}฿</span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// ── Queue Ticket Print Modal ──────────────────────────────────────────────────

function QueueTicketModal({ appt, services, therapists, queueNo, date, onClose }) {
  if (!appt) return null;
  const sl = services || SERVICES;
  const s  = sl.find(sv => sv.id === appt.serviceId) || svc(appt.serviceId) || { name: appt.serviceId || '—', dur: 60, price: 0 };
  const tl = therapists || [];
  const t  = tl.find(tt => tt.id === appt.therapistId) || ther(appt.therapistId) || { name: appt.therapistId || '—' };

  const pad2 = n => String(n).padStart(2, '0');
  const thaiDate = d => {
    if (!d) return '';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
  };
  const qNum = String(queueNo || 1).padStart(3, '0');
  const dateStr = thaiDate(date || new Date());
  const timeStr = fmtMin(appt.start);
  const timeEnd = fmtMin(appt.start + (s.dur || 60));

  const handlePrint = () => {
    const el = document.getElementById('queue-ticket-print');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap');
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'IBM Plex Sans Thai',sans-serif;background:#fff;display:flex;justify-content:center;padding:20px;}
      .queue-ticket{width:300px;border:2px solid #2d6a4f;border-radius:16px;overflow:hidden;background:#fff;}
      .qt-header{background:linear-gradient(135deg,#2d6a4f,#52b788);padding:14px 18px;color:#fff;text-align:center;}
      .qt-band{border-top:3px dashed #74c69d;border-bottom:3px dashed #74c69d;padding:16px 18px;text-align:center;background:#fff;}
      .qt-label{font-size:10px;color:#888;font-weight:700;letter-spacing:.12em;text-transform:uppercase;}
      .qt-number{font-size:68px;font-weight:700;color:#2d6a4f;line-height:1;letter-spacing:.02em;}
      .qt-date{font-size:13px;color:#555;margin-top:4px;}
      .qt-body{padding:10px 16px 14px;}
      .qt-row{display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid #f0f0f0;gap:8px;}
      .qt-row:last-child{border-bottom:none;}
      .qt-key{font-size:11px;color:#888;font-weight:600;white-space:nowrap;min-width:64px;}
      .qt-val{font-size:13px;color:#1a1a1a;font-weight:600;text-align:right;flex:1;}
      .qt-footer{background:#f0f7f4;padding:8px 16px;text-align:center;font-size:10.5px;color:#666;border-top:1px solid #d0e8dc;}
    </style></head><body>${el.outerHTML}</body></html>`;
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card fade-up" style={{ width: 400, maxWidth: "95vw" }}>
        <div className="modal-head">
          <div className="drawer-title">บัตรคิวนัดหมาย</div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="modal-body" style={{ padding: "24px", display: "flex", justifyContent: "center" }}>
          {/* ─── Ticket Design ─── */}
          <div id="queue-ticket-print" className="queue-ticket">
            {/* Header */}
            <div className="qt-header">
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em" }}>THAI MED SCHEDULER</div>
              <div style={{ fontSize: 11, opacity: .85, marginTop: 2 }}>ระบบจัดการคิวแพทย์แผนไทย</div>
            </div>

            {/* Queue number band */}
            <div className="qt-band">
              <div className="qt-label">หมายเลขคิว / QUEUE NO.</div>
              <div className="qt-number">{qNum}</div>
              <div className="qt-date">{dateStr}</div>
            </div>

            {/* Info rows */}
            <div className="qt-body">
              <div className="qt-row">
                <span className="qt-key">ชื่อ-สกุล</span>
                <span className="qt-val">{appt.customer || '—'}</span>
              </div>
              {appt.hn && (
                <div className="qt-row">
                  <span className="qt-key">HN</span>
                  <span className="qt-val" style={{ fontFamily: "monospace" }}>{appt.hn}</span>
                </div>
              )}
              <div className="qt-row">
                <span className="qt-key">บริการ</span>
                <span className="qt-val">{s.name}</span>
              </div>
              <div className="qt-row">
                <span className="qt-key">เวลานัด</span>
                <span className="qt-val">{timeStr}–{timeEnd} ({s.dur || 60} นาที)</span>
              </div>
              <div className="qt-row">
                <span className="qt-key">ผู้ให้บริการ</span>
                <span className="qt-val">{t.fullname || t.name}</span>
              </div>
              {s.price > 0 && (
                <div className="qt-row">
                  <span className="qt-key">ค่าบริการ</span>
                  <span className="qt-val" style={{ color: "var(--primary-deep)", fontWeight: 700 }}>
                    {Number(s.price).toLocaleString()} บาท
                  </span>
                </div>
              )}
              {appt.note && (
                <div className="qt-row">
                  <span className="qt-key">หมายเหตุ</span>
                  <span className="qt-val">{appt.note}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="qt-footer">
              กรุณาแสดงบัตรนี้เมื่อมาถึง · กรุณามาก่อนเวลานัด 10 นาที
            </div>
          </div>
        </div>

        <div className="modal-foot" style={{ gap: 10 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>ปิด</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={handlePrint}>
            <Icon name="note" size={16} /> พิมพ์บัตรคิว
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BookingForm, DetailPanel, Drawer, ServiceForm, QueueTicketModal });
