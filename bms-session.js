/* ===== BMS Session — HOSxP integration ===== */
/* Spec: D:\thai_traditional\BMS-SESSION-SPECIFICATION.md */

const BMS_COOKIE_NAME = 'bms-session-id';
const BMS_COOKIE_DAYS = 7;
const BMS_PASTE_API   = 'https://hosxp.net/phapi/PasteJSON';

// ── Cookie helpers ────────────────────────────────────────────────────────────

function setSessionCookie(id) {
  const exp = new Date(Date.now() + BMS_COOKIE_DAYS * 86400000).toUTCString();
  const sec = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${BMS_COOKIE_NAME}=${encodeURIComponent(id)}; expires=${exp}; path=/${sec}; SameSite=Lax`;
}

function getSessionCookie() {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + BMS_COOKIE_NAME + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function removeSessionCookie() {
  document.cookie = BMS_COOKIE_NAME + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function getSessionFromUrl() {
  return new URLSearchParams(location.search).get('bms-session-id');
}

function removeSessionFromUrl() {
  const p = new URLSearchParams(location.search);
  if (!p.has('bms-session-id')) return;
  p.delete('bms-session-id');
  const q = p.toString();
  history.replaceState({}, '', location.pathname + (q ? '?' + q : ''));
}

// ── BMS PasteJSON API ─────────────────────────────────────────────────────────

async function retrieveBmsSession(sessionId) {
  const url = BMS_PASTE_API + '?Action=GET&code=' + encodeURIComponent(sessionId);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : {});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractConnectionConfig(data) {
  const kv = (data && data.result && data.result.key_value)  || {};
  const ui = (data && data.result && data.result.user_info)  || {};
  return {
    apiUrl:    kv['hosxp.api_url']     || ui['hosxp.api_url']     || ui.bms_url          || null,
    apiAuthKey: kv['hosxp.api_auth_key'] || ui['hosxp.api_auth_key'] || ui.bms_session_code || null,
  };
}

// ── SQL execution ─────────────────────────────────────────────────────────────

function minifySql(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
}

function escapeSqlStr(s) {
  return String(s == null ? '' : s).replace(/'/g, "''");
}

async function executeSqlViaApi(sql, config) {
  if (!config || !config.apiUrl || !config.apiAuthKey)
    throw new Error('ยังไม่ได้เชื่อมต่อ BMS Session');

  const url = config.apiUrl + '/api/sql?sql=' +
    encodeURIComponent(minifySql(sql)) + '&app=ThaiMassage.Scheduler';

  const ctrl  = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;

  try {
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + config.apiAuthKey },
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    if (res.status === 401) throw new Error('Session หมดอายุหรือไม่ถูกต้อง (401)');
    if (res.status === 502) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ (502)');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (json.MessageCode !== 200) throw new Error(json.Message || 'Query ล้มเหลว');
    return json.data || [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

Object.assign(window, {
  setSessionCookie, getSessionCookie, removeSessionCookie,
  getSessionFromUrl, removeSessionFromUrl,
  retrieveBmsSession, extractConnectionConfig,
  executeSqlViaApi, escapeSqlStr,
});
