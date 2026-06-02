/* ===== mock data + helpers ===== */

const PALETTE = {
  green:  { avatar: "oklch(0.50 0.072 158)" },
  clay:   { avatar: "oklch(0.605 0.108 44)" },
  blue:   { avatar: "oklch(0.50 0.07 250)" },
  plum:   { avatar: "oklch(0.50 0.09 330)" },
  gold:   { avatar: "oklch(0.58 0.09 80)" },
};

const THERAPISTS = [
  { id: "t1", name: "สมหญิง ป.",  spec: "นวดไทยราชสำนัก",  color: "green", since: "2558" },
  { id: "t2", name: "วิไล ก.",    spec: "นวดน้ำมันอโรมา",   color: "clay",  since: "2562" },
  { id: "t3", name: "ประไพ ส.",   spec: "นวดเชลยศักดิ์",     color: "gold",  since: "2560" },
  { id: "t4", name: "มานพ ท.",    spec: "นวดกดจุดบำบัด",     color: "blue",  since: "2557" },
  { id: "t5", name: "กัลยา พ.",   spec: "ประคบสมุนไพร",      color: "plum",  since: "2563" },
];

const SERVICES = [
  { id: "thai60",  name: "นวดไทย",            dur: 60,  price: 300, group: "นวดไทย" },
  { id: "thai90",  name: "นวดไทย (พิเศษ)",     dur: 90,  price: 450, group: "นวดไทย" },
  { id: "aroma",   name: "นวดน้ำมันอโรมา",      dur: 90,  price: 650, group: "อโรมา" },
  { id: "foot",    name: "นวดฝ่าเท้า",          dur: 45,  price: 280, group: "เท้า" },
  { id: "herbal",  name: "ประคบสมุนไพร",        dur: 60,  price: 450, group: "สมุนไพร" },
  { id: "head",    name: "นวดศีรษะ–บ่า",        dur: 45,  price: 300, group: "ออฟฟิศ" },
  { id: "steam",   name: "อบไอน้ำสมุนไพร",       dur: 30,  price: 220, group: "สมุนไพร" },
];

// status taxonomy
const STATUSES = {
  booked:   { label: "จองแล้ว",    ink: "var(--st-booked-ink)",  bg: "var(--st-booked-bg)" },
  confirmed:{ label: "ยืนยันแล้ว",  ink: "var(--st-confirm-ink)", bg: "var(--st-confirm-bg)" },
  arrived:  { label: "มาถึงแล้ว",   ink: "var(--st-arrived-ink)", bg: "var(--st-arrived-bg)" },
  service:  { label: "กำลังนวด",    ink: "var(--st-service-ink)", bg: "var(--st-service-bg)" },
  done:     { label: "เสร็จสิ้น",    ink: "var(--st-done-ink)",    bg: "var(--st-done-bg)" },
  cancelled:{ label: "ยกเลิก",      ink: "var(--st-cancel-ink)",  bg: "var(--st-cancel-bg)" },
};
const STATUS_ORDER = ["booked", "confirmed", "arrived", "service", "done"];

const OPEN_MIN = 600;   // 10:00
const CLOSE_MIN = 1260; // 21:00
const SLOT = 30;

// ----- helpers -----
function svc(id) { return SERVICES.find(s => s.id === id); }
function ther(id) { return THERAPISTS.find(t => t.id === id); }
function fmtMin(m) {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}
function thaiDate(d) {
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return { dow: "วัน" + days[d.getDay()], dm: `${d.getDate()} ${months[d.getMonth()]}`, full: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}` };
}
function dayKey(d) { return d.toISOString().slice(0,10); }

// ----- seeded appointment generation per day -----
const FIRST = ["สุภาพร","ธนวัฒน์","พิมพ์ชนก","อนุชา","วรรณา","กิตติพงษ์","ศิริพร","ณัฐพล","มาลี","จิราพร","ปรีชา","อรทัย","สมชาย","เบญจวรรณ","ธีระ","กนกวรรณ"];
const LAST = ["ใจดี","ศรีสุข","วงศ์ทอง","แสงทอง","พรหมมา","บุญมี","รักไทย","อินทร์ทอง"];
const NOTES = ["ปวดหลังส่วนล่าง","ออฟฟิศซินโดรม","ปวดบ่าไหล่เรื้อรัง","ลูกค้าประจำ","แพ้น้ำมันบางชนิด","ขอแรงปานกลาง","หลังออกกำลังกาย","",""];

function mulberry(seed){ return function(){ let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

function genDay(date, todayKey) {
  const seed = [...dayKey(date)].reduce((a,c)=>a+c.charCodeAt(0),0);
  const rnd = mulberry(seed);
  const out = [];
  let uid = 0;
  const isPast = dayKey(date) < todayKey;
  const isFuture = dayKey(date) > todayKey;
  const nowMin = new Date().getHours()*60 + new Date().getMinutes();

  THERAPISTS.forEach((t, ti) => {
    let cursor = OPEN_MIN + Math.floor(rnd()*3)*30;
    const load = 0.55 + rnd()*0.3;
    while (cursor < CLOSE_MIN - 30) {
      if (rnd() > load) { cursor += 30; continue; }
      const s = SERVICES[Math.floor(rnd()*SERVICES.length)];
      if (cursor + s.dur > CLOSE_MIN) break;
      // status logic
      let status;
      if (isFuture) status = rnd() > 0.4 ? "confirmed" : "booked";
      else if (isPast) status = rnd() > 0.12 ? "done" : "cancelled";
      else {
        if (cursor + s.dur < nowMin) status = rnd() > 0.1 ? "done" : "cancelled";
        else if (cursor <= nowMin && cursor + s.dur >= nowMin) status = "service";
        else if (cursor - nowMin < 45) status = rnd() > 0.5 ? "arrived" : "confirmed";
        else status = rnd() > 0.45 ? "confirmed" : "booked";
      }
      out.push({
        id: `a${dayKey(date)}_${uid++}`,
        therapistId: t.id,
        serviceId: s.id,
        start: cursor,
        customer: `${FIRST[Math.floor(rnd()*FIRST.length)]} ${LAST[Math.floor(rnd()*LAST.length)]}`,
        phone: `08${Math.floor(rnd()*9)+1}-${String(Math.floor(rnd()*900)+100)}-${String(Math.floor(rnd()*9000)+1000)}`,
        status,
        note: NOTES[Math.floor(rnd()*NOTES.length)],
        gender: rnd() > 0.5 ? "ญ" : "ช",
      });
      cursor += s.dur + (rnd()>0.6 ? 30 : 0);
    }
  });
  return out;
}

Object.assign(window, {
  THERAPISTS, SERVICES, STATUSES, STATUS_ORDER, PALETTE,
  OPEN_MIN, CLOSE_MIN, SLOT, svc, ther, fmtMin, thaiDate, dayKey, genDay,
});
