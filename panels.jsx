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

// ── Patient search (HOSxP) ────────────────────────────────────────────────────

function sexLabel(sex) {
  if (sex === '1' || sex === 1 || sex === 'M') return 'ชาย';
  if (sex === '2' || sex === 2 || sex === 'F') return 'หญิง';
  return sex || '';
}

function PatientSearch({ executeQuery, onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [err, setErr] = useState(null);

  const search = async () => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setErr(null);
    const safe = escapeSqlStr(term);
    const sql = `
      SELECT hn,
        CONCAT(pname, fname, ' ', lname) AS fullname,
        sex, birthday, tel1
      FROM patient
      WHERE fname  LIKE '%${safe}%'
         OR lname  LIKE '%${safe}%'
         OR hn      = '${safe}'
         OR tel1   LIKE '%${safe}%'
      ORDER BY lname, fname
      LIMIT 20
    `;
    const res = await executeQuery(sql);
    setLoading(false);
    setSearched(true);
    if (res.ok) {
      setResults(res.data || []);
    } else {
      setErr(res.error);
      setResults([]);
    }
  };

  return (
    <div className="patient-search">
      <div className="patient-search-row">
        <input
          className="input"
          placeholder="ชื่อ–สกุล, HN, หรือเบอร์โทร"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button
          className="btn-ghost"
          onClick={search}
          disabled={loading || !q.trim()}
          style={{ whiteSpace: 'nowrap', flex: 'none' }}
        >
          {loading ? '…' : <><Icon name="search" size={14} /> ค้นหา</>}
        </button>
      </div>

      {err && (
        <div style={{ color: 'var(--st-cancel-ink)', fontSize: 12.5, padding: '6px 2px' }}>
          <Icon name="close" size={13} /> {err}
        </div>
      )}

      {searched && !err && results.length === 0 && (
        <div style={{ color: 'var(--ink-faint)', fontSize: 13, padding: '8px 0', textAlign: 'center' }}>
          ไม่พบข้อมูลผู้ป่วย
        </div>
      )}

      {results.length > 0 && (
        <div className="patient-results">
          {results.map(p => (
            <button key={p.hn} className="patient-result-item" onClick={() => onSelect(p)}>
              <div className="patient-result-name">{p.fullname}</div>
              <div className="patient-result-meta">
                HN {p.hn}
                {p.sex && <span> · {sexLabel(p.sex)}</span>}
                {p.tel1 && <span> · {p.tel1}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Booking form ──────────────────────────────────────────────────────────────

function BookingForm({ open, onClose, draft, therapists, onSave, executeQuery }) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [hn, setHn] = useState("");
  const [serviceId, setServiceId] = useState("thai60");
  const [therapistId, setTherapistId] = useState(therapists[0]?.id);
  const [start, setStart] = useState(OPEN_MIN);
  const [note, setNote] = useState("");
  const [showPatientSearch, setShowPatientSearch] = useState(false);

  useEffect(() => {
    if (open && draft) {
      setTherapistId(draft.therapistId || therapists[0]?.id);
      setStart(draft.start ?? OPEN_MIN);
      setCustomer(""); setPhone(""); setHn(""); setNote(""); setServiceId("thai60");
      setShowPatientSearch(false);
    }
  }, [open, draft]);

  const selectPatient = (p) => {
    setCustomer(p.fullname || '');
    setPhone(p.tel1 || '');
    setHn(p.hn || '');
    setShowPatientSearch(false);
  };

  const s = svc(serviceId);
  const th = ther(therapistId);
  const valid = customer.trim().length > 1;

  const timeOpts = [];
  for (let m = OPEN_MIN; m <= CLOSE_MIN - 30; m += SLOT) timeOpts.push(m);

  return (
    <Drawer
      open={open} onClose={onClose} title="จองนัดใหม่"
      foot={
        <>
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn-fill" disabled={!valid}
            onClick={() => onSave({
              customer: customer.trim(), phone, hn,
              serviceId, therapistId, start, note,
              status: "booked", gender: "ญ",
            })}>
            ยืนยันการจอง
          </button>
        </>
      }
    >
      {/* Patient lookup from HOSxP */}
      {executeQuery && (
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>ค้นหาผู้ป่วยจาก HOSxP</label>
            <button
              className="hosxp-toggle"
              onClick={() => setShowPatientSearch(v => !v)}
            >
              {showPatientSearch ? 'ซ่อน' : 'เปิดการค้นหา'}
            </button>
          </div>
          {showPatientSearch && (
            <PatientSearch executeQuery={executeQuery} onSelect={selectPatient} />
          )}
          {hn && (
            <div className="hn-badge">
              <Icon name="users" size={13} /> HN {hn} — {customer}
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label>ชื่อลูกค้า {hn && <span style={{ color: 'var(--primary)', fontWeight: 400 }}>(จาก HOSxP)</span>}</label>
        <input className="input" placeholder="เช่น คุณสุภาพร ใจดี" value={customer}
          onChange={e => setCustomer(e.target.value)} autoFocus={!executeQuery} />
      </div>
      <div className="field">
        <label>เบอร์โทรศัพท์</label>
        <input className="input" placeholder="08x-xxx-xxxx" value={phone}
          onChange={e => setPhone(e.target.value)} />
      </div>

      <div className="field">
        <label>เลือกบริการ</label>
        <div className="choice-grid">
          {SERVICES.map(sv => (
            <button key={sv.id} className={"choice" + (serviceId === sv.id ? " on" : "")}
              onClick={() => setServiceId(sv.id)}>
              <div className="choice-name">{sv.name}</div>
              <div className="choice-meta"><span>{sv.dur} นาที</span><span>{sv.price}฿</span></div>
            </button>
          ))}
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>หมอนวด</label>
          <select className="select" value={therapistId} onChange={e => setTherapistId(e.target.value)}>
            {therapists.map(tt => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>เวลาเริ่ม</label>
          <select className="select" value={start} onChange={e => setStart(+e.target.value)}>
            {timeOpts.map(m => <option key={m} value={m}>{fmtMin(m)}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>หมายเหตุ / อาการ</label>
        <textarea className="input" placeholder="เช่น ปวดบ่าไหล่ ขอแรงปานกลาง"
          value={note} onChange={e => setNote(e.target.value)} />
      </div>

      <div style={{ background: "var(--surface-2)", borderRadius: "var(--r)", padding: "14px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>สรุป</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{fmtMin(start)}–{fmtMin(start + s.dur)} · {th?.name}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--primary-deep)" }}>{s.price}฿</div>
      </div>
    </Drawer>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ open, onClose, appt, onStatus, onCancel }) {
  if (!appt) return <Drawer open={open} onClose={onClose} title="รายละเอียดนัด"><div /></Drawer>;
  const s = svc(appt.serviceId);
  const t = ther(appt.therapistId);
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

Object.assign(window, { BookingForm, DetailPanel, Drawer });
