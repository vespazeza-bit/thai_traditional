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
  const wrapperRef      = useRef(null);

  useEffect(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = value.trim();
    if (q.length < 2) {
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      setResults([]); setShowDrop(false); setErrMsg(''); setQuery('');
      return;
    }
    timerRef.current = setTimeout(() => doSearch(q), 450);
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

    let sql;
    if (vstdate) {
      // ค้นเฉพาะคนไข้ที่มี visit เปิดใน ovst วันที่กำลังจองเท่านั้น
      const dateSafe = escapeSqlStr(vstdate);
      const nameCond = words
        .map(w => { const s = escapeSqlStr(w); return `(p.fname LIKE '%${s}%' OR p.lname LIKE '%${s}%')`; })
        .join(' AND ');
      const whereName = nameCond
        ? `(${nameCond}) OR o.hn = '${qSafe}' OR p.tel1 LIKE '%${telSafe}%'`
        : `o.hn = '${qSafe}' OR p.tel1 LIKE '%${telSafe}%'`;
      sql = `SELECT p.hn, CONCAT(COALESCE(p.pname,''),COALESCE(p.fname,''),' ',COALESCE(p.lname,'')) AS fullname, p.sex, p.tel1, p.birthday FROM ovst o JOIN patient p ON p.hn = o.hn WHERE o.vstdate = '${dateSafe}' AND (${whereName}) GROUP BY p.hn ORDER BY p.lname, p.fname LIMIT 20`;
    } else {
      const nameCond = words
        .map(w => { const s = escapeSqlStr(w); return `(fname LIKE '%${s}%' OR lname LIKE '%${s}%')`; })
        .join(' AND ');
      sql = `SELECT hn, CONCAT(COALESCE(pname,''),COALESCE(fname,''),' ',COALESCE(lname,'')) AS fullname, sex, tel1, birthday FROM patient WHERE (${nameCond}) OR hn = '${qSafe}' OR tel1 LIKE '%${telSafe}%' ORDER BY lname, fname LIMIT 20`;
    }

    const res = await executeQuery(sql, ctrl ? ctrl.signal : undefined);

    // abort = request ถูกยกเลิกเพราะมี request ใหม่มาแทน — ไม่ต้องอัพเดท UI
    // แต่ต้องเคลียร์ loading เฉพาะกรณีที่ไม่มี request ใหม่กำลังรอ
    if (res.aborted) {
      if (abortRef.current === ctrl) setLoading(false);
      return;
    }

    setLoading(false);
    if (res.ok) {
      setResults(res.data || []);
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

  // คำนวณตำแหน่ง dropdown จาก ref ตรง render — ไม่ต้องเก็บ state แยก
  // position:fixed หลุดพ้น overflow:hidden ของ modal container ได้เลย
  let dropStyle = null;
  if (showDrop && wrapperRef.current) {
    const r = wrapperRef.current.getBoundingClientRect();
    dropStyle = { position: 'fixed', top: r.bottom + 2, left: r.left, width: r.width, zIndex: 9999 };
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
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

      {/* dropdown list */}
      {showDrop && dropStyle && (
        <div style={{
          ...dropStyle,
          background: '#fff',
          border: '1px solid #b0b8c1',
          borderRadius: 4,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          maxHeight: 320,
          overflowY: 'auto',
          fontSize: 13,
        }}>
          {/* header bar */}
          <div style={{ padding: '4px 10px', background: '#e8edf2', borderBottom: '1px solid #c8d0d8',
            fontSize: 12, fontWeight: 600, color: '#444', letterSpacing: 0.3 }}>
            รายการ
          </div>

          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#888', fontStyle: 'italic' }}>
              ไม่พบข้อมูลผู้ป่วย
            </div>
          ) : results.map((p, i) => {
            const age  = calcAge(p.birthday);
            const sub  = [p.hn ? `HN ${p.hn}` : '', sexLabel(p.sex), age, p.tel1 || ''].filter(Boolean).join('  ·  ');
            return (
              <button key={p.hn || i}
                onMouseDown={() => handleSelect(p)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 12px', border: 'none', background: 'none',
                  borderBottom: '1px solid #eef0f2', cursor: 'pointer',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e8f4fd'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <div style={{ fontWeight: 500, color: '#1a1a1a', lineHeight: 1.4 }}>
                  {highlightText(p.fullname, query)}
                </div>
                {sub && (
                  <div style={{ fontSize: 11.5, color: '#666', marginTop: 2, lineHeight: 1.3 }}>
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

function BookingForm({ open, onClose, draft, therapists, onSave, executeQuery, services: servicesProp, vstdate }) {
  const serviceList = servicesProp || SERVICES;
  const [customer,   setCustomer]   = useState("");
  const [phone,      setPhone]      = useState("");
  const [hn,         setHn]         = useState("");
  const [serviceId,  setServiceId]  = useState(serviceList[0]?.id || "thai60");
  const [therapistId,setTherapistId]= useState(therapists[0]?.id);
  const [start,      setStart]      = useState(OPEN_MIN);
  const [note,       setNote]       = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (open && draft) {
      setTherapistId(draft.therapistId || therapists[0]?.id);
      setStart(draft.start ?? OPEN_MIN);
      // เลือกบริการแรกที่มีอยู่จริงใน serviceList
      setServiceId(serviceList[0]?.id || "thai60");
      setCustomer(""); setPhone(""); setHn(""); setNote("");
      setShowSearch(false);
    }
  }, [open, draft, serviceList.length]);

  const selectPatient = (p) => {
    setCustomer(p.fullname || "");
    setPhone(p.tel1 || "");
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
          <div className="drawer-title">จองนัดใหม่</div>
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
            onClick={() => onSave({
              customer: customer.trim(), phone, hn,
              serviceId, therapistId, start, note,
              status: "booked", gender: "ญ",
            })}>
            <Icon name="check" size={16} /> ยืนยันการจอง
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ open, onClose, appt, onStatus, onCancel }) {
  if (!appt) return <Drawer open={open} onClose={onClose} title="รายละเอียดนัด"><div /></Drawer>;
  const s = svc(appt.serviceId) || { name: appt.serviceId || '—', dur: 60, price: 0 };
  const t = ther(appt.therapistId) || { name: appt.therapistId || '—', color: '#888', spec: '—' };
  const st = STATUSES[appt.status];
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
