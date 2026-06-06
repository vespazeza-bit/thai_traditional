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
      sql = `SELECT p.hn, ${hx('p.pname')} AS pname, ${hx('p.fname')} AS fname, ${hx('p.lname')} AS lname, p.sex, p.mobile_phone_number, MIN(e.name) AS pttype_name FROM patient p INNER JOIN ovst v ON v.hn = p.hn AND v.vstdate = '${dateSafe}' INNER JOIN pttype e ON e.pttype = v.pttype WHERE (${nameWhere}) GROUP BY p.hn, p.pname, p.fname, p.lname, p.sex, p.mobile_phone_number ORDER BY p.lname, p.fname LIMIT 20`;
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
  const [dupWarn,    setDupWarn]    = useState(null); // appointment ที่ซ้ำ

  const isEdit = !!(draft && draft.id);

  useEffect(() => {
    if (open && draft) {
      setTherapistId(draft.therapistId || therapists[0]?.id);
      setStart(draft.start ?? OPEN_MIN);
      setCustomer(draft.customer || "");
      setPhone(draft.phone || "");
      setHn(draft.hn || "");
      setNote(draft.note || "");
      // เลือก serviceId จาก draft ถ้ามีใน serviceList ไม่งั้นเลือกแรก
      const draftSvc = draft.serviceId && serviceList.find(sv => sv.id === draft.serviceId);
      setServiceId(draftSvc ? draft.serviceId : (serviceList[0]?.id || "thai60"));
      setShowSearch(false);
    }
  }, [open, draft, serviceList.length]);

  const selectPatient = (p) => {
    setCustomer(p.fullname || "");
    setPhone(p.phone || p.mobile_phone_number || p.tel1 || "");
    setHn(p.hn || "");
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
              if (!isEdit && hn) {
                const dup = (existingAppts || []).find(
                  a => a.hn === hn && a.status !== "cancelled" && a.id !== draft?.id
                );
                if (dup) { setDupWarn(dup); return; }
              }
              onSave({
                ...(isEdit ? { id: draft.id, status: draft.status } : { status: "booked" }),
                customer: customer.trim(), phone, hn,
                serviceId, therapistId, start, note, gender: "ญ",
              });
            }}>
            <Icon name="check" size={16} /> {isEdit ? "บันทึกการแก้ไข" : "ยืนยันการจอง"}
          </button>
        </div>

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
                  onSave({ status: "booked", customer: customer.trim(), phone, hn, serviceId, therapistId, start, note, gender: "ญ" });
                }}>จองต่อ</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ open, onClose, appt, onStatus, onCancel }) {
  if (!appt) return <Drawer open={open} onClose={onClose} title="รายละเอียดนัด"><div /></Drawer>;
  const s  = svc(appt.serviceId)   || { name: appt.serviceId   || '—', dur: 60, price: 0 };
  const t  = ther(appt.therapistId) || { name: appt.therapistId || '—', color: 'clay', spec: '—' };
  const st = STATUSES[appt.status]  || STATUSES.booked;
  return (
    <Drawer
      open={open} onClose={onClose} title="รายละเอียดนัด"
      foot={
        appt.status === "cancelled" || appt.status === "done" ? (
          <button className="btn-ghost" onClick={onClose}>ปิด</button>
        ) : (
          <>
            <button className="btn-ghost btn-danger" onClick={() => onCancel(appt)}>ยกเลิกนัด</button>
            <button className="btn-ghost" onClick={onClose}>ปิด</button>
          </>
        )
      }
    >
      <div className="detail-hero">
        <Avatar name={appt.customer} color={t.color} size={54} />
        <div style={{ minWidth: 0 }}>
          <div className="detail-big-name">{appt.customer}</div>
          <div className="detail-sub">{appt.phone || "ไม่ระบุเบอร์"}</div>
          {appt.hn && (
            <div className="hn-badge" style={{ marginTop: 6, display: 'inline-flex' }}>
              <Icon name="users" size={13} /> HN {appt.hn}
            </div>
          )}
          <div style={{ marginTop: 7 }}><Pill status={appt.status} /></div>
        </div>
      </div>

      <div>
        <div className="kv">
          <div className="kv-ic"><Icon name="leaf" size={17} /></div>
          <div><div className="kv-k">บริการ</div><div className="kv-v">{s.name}</div></div>
        </div>
        <div className="kv">
          <div className="kv-ic"><Icon name="clock" size={17} /></div>
          <div><div className="kv-k">เวลา</div><div className="kv-v">{fmtMin(appt.start)}–{fmtMin(appt.start + s.dur)} ({s.dur} นาที)</div></div>
        </div>
        <div className="kv">
          <div className="kv-ic"><Icon name="user" size={17} /></div>
          <div><div className="kv-k">หมอนวด</div><div className="kv-v">{t.name} · {t.spec}</div></div>
        </div>
        <div className="kv">
          <div className="kv-ic"><Icon name="money" size={17} /></div>
          <div><div className="kv-k">ค่าบริการ</div><div className="kv-v">{s.price} บาท</div></div>
        </div>
        {appt.note && (
          <div className="kv">
            <div className="kv-ic"><Icon name="note" size={17} /></div>
            <div><div className="kv-k">หมายเหตุ</div><div className="kv-v" style={{ fontWeight: 500 }}>{appt.note}</div></div>
          </div>
        )}
      </div>

      {appt.status !== "cancelled" && (
        <div className="field">
          <label>อัปเดตสถานะ</label>
          <div className="status-flow">
            {STATUS_ORDER.map(key => {
              const on = appt.status === key;
              const sinfo = STATUSES[key];
              return (
                <button key={key} className={"status-opt" + (on ? " on" : "")}
                  style={on ? { borderColor: sinfo.ink, background: sinfo.bg, color: sinfo.ink } : {}}
                  onClick={() => onStatus(appt, key)}>
                  <span className="dot" style={{ width: 9, height: 9, borderRadius: "50%",
                    background: sinfo.ink }}></span>
                  {sinfo.label}
                  {on && <span style={{ marginLeft: "auto" }}><Icon name="check" size={16} /></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Drawer>
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

Object.assign(window, { BookingForm, DetailPanel, Drawer, ServiceForm });
