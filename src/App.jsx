import { useState, useEffect } from "react";

// ── CONFIG ─────────────────────────────────────────────────────────────────
const STRAVA_CLIENT_ID = "230220";
const STRAVA_CLIENT_SECRET = "917e437903069e4125c34c7f562864a5f5ad39e4";
const STRAVA_AUTH_CODE = "06c31e7dd0efe6d0521b14e3c16a890b32e25412";
const RACE_DATE = new Date("2026-05-31T09:00:00");
const PB_SECONDS = 2 * 3600 + 2 * 60;
const VAPORFLY_TARGET = 25;

// ── UTILS ──────────────────────────────────────────────────────────────────
const secsToPace = (mps) => {
  if (!mps || mps === 0) return "--:--";
  const spk = 1000 / mps;
  return `${Math.floor(spk / 60)}:${String(Math.round(spk % 60)).padStart(2, "0")}`;
};
const secsToTime = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};
const daysUntil = (d) => Math.ceil((d - new Date()) / 86400000);

// ── STRAVA ─────────────────────────────────────────────────────────────────
const stravaPost = (body) =>
  fetch("https://www.strava.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).then((r) => r.json());

const fetchActs = (token) =>
  fetch("https://www.strava.com/api/v3/athlete/activities?per_page=50", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

// ── METRICS ────────────────────────────────────────────────────────────────
const weeklyStats = (acts) => {
  const cutoff = Date.now() - 7 * 86400000;
  const runs = acts.filter((a) => a.type === "Run" && new Date(a.start_date) > cutoff);
  const km = runs.reduce((s, r) => s + r.distance / 1000, 0);
  const cads = runs.filter((r) => r.average_cadence).map((r) => r.average_cadence * 2);
  return { runs, km, avgCadence: cads.length ? cads.reduce((a, b) => a + b, 0) / cads.length : 0, count: runs.length };
};
const computeACWR = (acts) => {
  const now = Date.now();
  const runs = acts.filter((a) => a.type === "Run");
  const acute = runs.filter((a) => now - new Date(a.start_date) < 7 * 86400000).reduce((s, r) => s + r.distance / 1000, 0);
  const chronicBase = runs.filter((a) => now - new Date(a.start_date) < 28 * 86400000).reduce((s, r) => s + r.distance / 1000, 0) / 4;
  return { ratio: chronicBase > 0 ? acute / chronicBase : 1.0, acute, chronic: chronicBase };
};
const predictFinish = (acts) => {
  const runs = acts.filter((a) => a.type === "Run" && a.distance > 3000).slice(0, 8);
  if (!runs.length) return null;
  const avgSpeed = runs.reduce((s, r) => s + r.average_speed, 0) / runs.length;
  return Math.round(21097.5 / (avgSpeed * 1.04));
};

// ── DEMO DATA ──────────────────────────────────────────────────────────────
const DEMO = [
  { type: "Run", name: "Morning Run", distance: 6200, average_speed: 2.78, average_cadence: 84, start_date: new Date(Date.now() - 86400000).toISOString() },
  { type: "Run", name: "Easy Recovery", distance: 4800, average_speed: 2.65, average_cadence: 82, start_date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { type: "Run", name: "Tempo Run", distance: 7500, average_speed: 2.92, average_cadence: 86, start_date: new Date(Date.now() - 5 * 86400000).toISOString() },
  { type: "Run", name: "Long Run", distance: 12000, average_speed: 2.71, average_cadence: 83, start_date: new Date(Date.now() - 8 * 86400000).toISOString() },
  { type: "Run", name: "Morning Run", distance: 5500, average_speed: 2.74, average_cadence: 83, start_date: new Date(Date.now() - 10 * 86400000).toISOString() },
];

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  bg: "#f8f6f1",
  card: "#ffffff",
  gold: "#C9A227",
  goldLight: "#FBF3D9",
  goldDark: "#9A7A1A",
  green: "#1A7A47",
  greenLight: "#EAF5EE",
  amber: "#C96000",
  amberLight: "#FFF2E5",
  red: "#C42B2B",
  redLight: "#FDEAEA",
  pink: "#B83A62",
  pinkLight: "#FCEEF4",
  text: "#1a1a1a",
  textMid: "#4a4a4a",
  textMuted: "#8a8a8a",
  border: "#e6e1d6",
  borderLight: "#f0ece3",
  shadow: "0 2px 20px rgba(0,0,0,0.055)",
  shadowMd: "0 4px 32px rgba(0,0,0,0.08)",
  shadowGold: "0 4px 24px rgba(201,162,39,0.2)",
  // Typography
  fontDisplay: "'Playfair Display', Georgia, serif",
  fontNum: "'Oswald', 'Arial Narrow', sans-serif",
  fontBody: "'DM Sans', system-ui, sans-serif",
};

const sColor = { green: C.green, amber: C.amber, red: C.red };
const sBg = { green: C.greenLight, amber: C.amberLight, red: C.redLight };

// ── COMPONENTS ─────────────────────────────────────────────────────────────

const Dot = ({ s }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: sColor[s] || C.amber, marginRight: 7, verticalAlign: "middle" }} />
);

const Card = ({ children, gold, pink, style }) => (
  <div style={{
    background: C.card,
    border: `1px solid ${gold ? C.gold + "88" : pink ? C.pink + "44" : C.border}`,
    borderRadius: 18,
    padding: "20px 22px",
    boxShadow: gold ? C.shadowGold : C.shadow,
    ...style,
  }}>
    {children}
  </div>
);

// Section title — Playfair Display, elegant
const SectionTitle = ({ children, color }) => (
  <h2 style={{
    fontFamily: C.fontDisplay,
    fontSize: 26,
    fontWeight: 700,
    color: color || C.text,
    marginBottom: 18,
    marginTop: 0,
    letterSpacing: "-0.3px",
    lineHeight: 1.2,
  }}>{children}</h2>
);

// Card heading — DM Sans semibold
const CardTitle = ({ children, color }) => (
  <div style={{
    fontFamily: C.fontBody,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.8,
    color: color || C.textMuted,
    textTransform: "uppercase",
    marginBottom: 10,
  }}>{children}</div>
);

// Big data number — Oswald
const Big = ({ n, unit, color, size = 52 }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
    <span style={{ fontFamily: C.fontNum, fontSize: size, fontWeight: 400, color: color || C.text, lineHeight: 1, letterSpacing: "-0.5px" }}>{n}</span>
    {unit && <span style={{ fontFamily: C.fontBody, fontSize: 12, fontWeight: 400, color: C.textMuted, lineHeight: 1 }}>{unit}</span>}
  </div>
);

// Body text
const Body = ({ children, size = 13, color, style }) => (
  <p style={{ fontFamily: C.fontBody, fontSize: size, color: color || C.textMid, lineHeight: 1.7, margin: 0, ...style }}>{children}</p>
);

const Bar = ({ pct, color = C.gold, bg = C.goldLight }) => (
  <div style={{ height: 7, background: bg, borderRadius: 4, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 4, transition: "width 1.3s ease" }} />
  </div>
);

const Pill = ({ children, color = C.gold, bg = C.goldLight }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "4px 12px", background: bg, color,
    borderRadius: 20, fontSize: 11, fontWeight: 600,
    fontFamily: C.fontBody, letterSpacing: 0.3,
  }}>{children}</span>
);

const CircleGauge = ({ val }) => {
  const r = 52, circ = 2 * Math.PI * r;
  const col = val >= 70 ? C.green : val >= 50 ? C.amber : C.red;
  const bg = val >= 70 ? C.greenLight : val >= 50 ? C.amberLight : C.redLight;
  return (
    <div style={{ position: "relative", width: 140, height: 140 }}>
      <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke={bg} strokeWidth={10} />
        <circle cx={70} cy={70} r={r} fill="none" stroke={col} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={circ - (val / 100) * circ}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.3s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: C.fontNum, fontSize: 42, fontWeight: 400, color: col, lineHeight: 1 }}>{val}</span>
        <span style={{ fontFamily: C.fontBody, fontSize: 11, color: C.textMuted, marginTop: 2 }}>/100</span>
      </div>
    </div>
  );
};

const RangeInput = ({ value, onChange, color = C.gold }) => (
  <input type="range" min={0} max={100} value={value} onChange={onChange}
    style={{ width: "100%", marginTop: 8, accentColor: color, cursor: "pointer" }} />
);

const NumberInput = ({ value, onChange }) => (
  <input type="number" value={value} onChange={onChange} style={{
    width: "100%", background: C.bg, border: `1.5px solid ${C.border}`,
    color: C.text, padding: "9px 12px", borderRadius: 10,
    fontFamily: C.fontNum, fontSize: 18, fontWeight: 400,
    boxSizing: "border-box", outline: "none",
  }} />
);

const Divider = () => <div style={{ height: 1, background: C.borderLight, margin: "10px 0" }} />;

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function RaceDayDashboard() {
  const [tab, setTab] = useState("command");
  const [acts, setActs] = useState([]);
  const [stravaStatus, setStravaStatus] = useState("loading");
  const [note, setNote] = useState("");
  const [genNote, setGenNote] = useState(false);
  const [data, setData] = useState({
    nightFeeds: 2, hrv: 45, bodyBattery: 62, sleepScore: 68,
    vaporMiles: 0, pelvic: "green", calcium: 800, vitD: 12,
    ferritin: null, book: "Atomic Habits — James Clear",
  });

  const save = async (updates) => {
    const next = { ...data, ...updates };
    setData(next);
    try { await window.storage.set("rd_v5", JSON.stringify(next)); } catch {}
    try { localStorage.setItem("rd_v5", JSON.stringify(next)); } catch {}
  };

  useEffect(() => {
    const l = document.createElement("link");
    l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Oswald:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap";
    l.rel = "stylesheet";
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch {} };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let d; try { const s = await window.storage.get("rd_v5"); if (s) d = s.value; } catch {}
        if (!d) d = localStorage.getItem("rd_v5");
        if (d) setData(JSON.parse(d));
      } catch {}
      try {
        let n; try { const s = await window.storage.get("rd_note"); if (s) n = s.value; } catch {}
        if (!n) n = localStorage.getItem("rd_note");
        if (n) setNote(n);
      } catch {}

      let rt = null;
      try { const s = await window.storage.get("rd_rt"); if (s) rt = s.value; } catch {}
      if (!rt) rt = localStorage.getItem("rd_rt");

      const storeRt = async (t) => {
        try { await window.storage.set("rd_rt", t); } catch {}
        try { localStorage.setItem("rd_rt", t); } catch {}
      };

      if (rt) {
        try {
          const r = await stravaPost({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: rt });
          if (r.access_token) {
            await storeRt(r.refresh_token);
            const a = await fetchActs(r.access_token);
            if (Array.isArray(a) && a.length) { setActs(a); setStravaStatus("live"); return; }
          }
        } catch {}
      }
      try {
        const r = await stravaPost({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, code: STRAVA_AUTH_CODE, grant_type: "authorization_code" });
        if (r.access_token) {
          await storeRt(r.refresh_token);
          const a = await fetchActs(r.access_token);
          if (Array.isArray(a)) { setActs(a); setStravaStatus("live"); return; }
        }
      } catch {}

      setActs(DEMO); setStravaStatus("demo");
    })();
  }, []);

  // ── Computed ──
  const days = daysUntil(RACE_DATE);
  const wk = weeklyStats(acts);
  const acwr = computeACWR(acts);
  const predSecs = predictFinish(acts) || PB_SECONDS + 300;
  const onPB = predSecs < PB_SECONDS;
  const acwrS = acwr.ratio < 0.8 ? "amber" : acwr.ratio <= 1.3 ? "green" : acwr.ratio <= 1.5 ? "amber" : "red";
  const mumTax = (1 - data.sleepScore / 100) * 0.08 + data.nightFeeds * 0.015;
  const recentRun = acts.filter((a) => a.type === "Run")[0];
  const rawPace = recentRun ? secsToPace(recentRun.average_speed) : "--:--";
  const adjPace = recentRun ? secsToPace(recentRun.average_speed * (1 + mumTax)) : "--:--";
  const conf = Math.min(100, Math.round(
    (acwr.ratio >= 0.8 && acwr.ratio <= 1.3 ? 20 : 10) +
    (data.sleepScore / 100) * 15 + (data.bodyBattery / 100) * 15 +
    (data.pelvic === "green" ? 10 : data.pelvic === "amber" ? 5 : 0) +
    Math.max(0, 10 - data.nightFeeds * 2) +
    Math.min(15, (data.vaporMiles / VAPORFLY_TARGET) * 15) +
    (days > 21 ? 15 : days > 14 ? 12 : days > 7 ? 8 : 5)
  ));

  const genCoachNote = async () => {
    setGenNote(true);
    try {
      const runSummary = acts.filter((a) => a.type === "Run").slice(0, 4)
        .map((r) => `${(r.distance / 1000).toFixed(1)}km @ ${secsToPace(r.average_speed)}/km`).join("; ");
      const prompt = `You are Tony Horton from P90X — motivating, punchy, energetic, never harsh. Write a coaching note (max 5 sentences) for Laura, a 6-month postpartum runner (C-section, still breastfeeding) targeting a half marathon PB on 31 May 2026. PB to beat: 2:02:00.

STATS: ${days} days to race | Confidence: ${conf}/100 | This week: ${wk.km.toFixed(1)}km in ${wk.count} runs | Recent: ${runSummary || "just getting started"} | ACWR: ${acwr.ratio.toFixed(2)} | Sleep: ${data.sleepScore}/100 | Body Battery: ${data.bodyBattery} | Night feeds: ${data.nightFeeds} | Predicted finish: ${secsToTime(predSecs)} | Book: ${data.book}

Be unmistakably Tony Horton. Acknowledge the dual mum-athlete load. End with ONE concrete focus for this week. Reference the book if relevant. SHORT and punchy.`;

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await r.json();
      const text = d.content?.[0]?.text || "DO YOUR BEST AND FORGET THE REST, LAURA!";
      setNote(text);
      try { await window.storage.set("rd_note", text); } catch {}
      localStorage.setItem("rd_note", text);
    } catch { setNote("Connection error — but you don't need me. You're already doing the impossible. Bring it!"); }
    setGenNote(false);
  };

  const navTabs = [
    { id: "command", label: "🏁 Command" },
    { id: "training", label: "📊 Training" },
    { id: "mum", label: "🍼 Mum Hub" },
    { id: "fuel", label: "🍽️ Fuel & Mind" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.fontBody, paddingBottom: 60 }}>

      {/* ── HEADER ── */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "22px 20px 20px", boxShadow: C.shadow }}>

        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: C.fontBody, fontSize: 10, fontWeight: 600, letterSpacing: 2.5, color: C.gold, textTransform: "uppercase", marginBottom: 6 }}>
              ◆ Race Day Intelligence
            </div>
            <div style={{ fontFamily: C.fontDisplay, fontSize: 32, fontWeight: 700, color: C.text, lineHeight: 1.1, letterSpacing: "-0.5px" }}>
              Laura Bailey
            </div>
            <div style={{ fontFamily: C.fontBody, fontSize: 12, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center" }}>
              {stravaStatus === "live"
                ? <><Dot s="green" /><span style={{ color: C.green, fontWeight: 500 }}>Strava Connected</span></>
                : stravaStatus === "demo"
                ? <><Dot s="amber" /><span style={{ color: C.amber, fontWeight: 500 }}>Demo Mode</span></>
                : <><Dot s="amber" /><span>Connecting...</span></>}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: C.fontBody, fontSize: 10, fontWeight: 500, letterSpacing: 1.5, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>
              Race Day In
            </div>
            <div style={{ fontFamily: C.fontNum, fontSize: 62, fontWeight: 400, color: days <= 14 ? C.amber : C.gold, lineHeight: 1, letterSpacing: "-1px" }}>
              {days}
            </div>
            <div style={{ fontFamily: C.fontBody, fontSize: 10, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Days
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: C.fontBody, fontSize: 11, fontWeight: 500, color: C.textMuted }}>Race Confidence</span>
            <span style={{ fontFamily: C.fontNum, fontSize: 16, fontWeight: 400, color: C.gold }}>{conf}<span style={{ fontSize: 11, fontFamily: C.fontBody, color: C.textMuted, fontWeight: 400 }}>/100</span></span>
          </div>
          <div style={{ height: 6, background: C.borderLight, borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${conf}%`, background: `linear-gradient(90deg, ${C.gold}, ${conf >= 70 ? C.green : C.amber})`, borderRadius: 3, transition: "width 1.5s ease" }} />
          </div>
        </div>
      </div>

      {/* ── NAV ── */}
      <div style={{ display: "flex", background: C.card, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 9, overflowX: "auto" }}>
        {navTabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: "0 0 auto", padding: "13px 18px",
            fontFamily: C.fontBody, fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
            background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? C.gold : "transparent"}`,
            color: tab === t.id ? C.gold : C.textMuted,
            cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px 16px" }}>

        {/* ── COMMAND ── */}
        {tab === "command" && <>
          <SectionTitle color={C.gold}>Race Command Centre</SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Card style={{ borderColor: onPB ? C.green + "88" : C.amber + "88", boxShadow: onPB ? `0 4px 24px ${C.green}22` : `0 4px 24px ${C.amber}22` }}>
              <CardTitle color={onPB ? C.green : C.amber}>Predicted Finish</CardTitle>
              <Big n={secsToTime(predSecs)} size={28} color={onPB ? C.green : C.amber} />
              <div style={{ marginTop: 10 }}>
                <Pill color={onPB ? C.green : C.amber} bg={onPB ? C.greenLight : C.amberLight}>
                  {onPB ? "✓ PB on track" : `▲ ${Math.round((predSecs - PB_SECONDS) / 60)} min off`}
                </Pill>
              </div>
              <Body size={11} color={C.textMuted} style={{ marginTop: 8 }}>Target: 2:01:59</Body>
            </Card>

            <Card>
              <CardTitle>Confidence</CardTitle>
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                <CircleGauge val={conf} />
              </div>
            </Card>
          </div>

          {/* Vaporfly */}
          <Card style={{ marginBottom: 12 }}>
            <CardTitle>👟 Vaporfly Break-In Progress</CardTitle>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Big n={data.vaporMiles} unit={`/ ${VAPORFLY_TARGET} miles`} si
