/**
 * AgentFeed.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time agent activity feed for HotelOS.
 *
 * Features
 * ────────
 *  • WebSocket connection with auto-reconnect + exponential back-off
 *  • Simulated WS stream when no URL is provided (demo mode)
 *  • Three entry types: thought / decision / execution
 *  • Per-agent color identity (consistent hue across entries)
 *  • Framer-motion staggered fade + slide-in on entry arrival
 *  • Auto-scroll that pauses on manual scroll, resumes on reaching bottom
 *  • Filter bar: All / Thought / Decision / Execution + per-agent toggle
 *  • Live entry counter and connection status badge
 *  • Expandable entries (click to reveal full context)
 *  • Keyboard accessible
 *
 * Dependencies
 * ────────────
 *   npm install framer-motion
 *
 * Usage
 * ─────
 *   // Demo mode (built-in simulation)
 *   <AgentFeed />
 *
 *   // Real WebSocket
 *   <AgentFeed wsUrl="wss://your-server/agents/stream" />
 *
 *   // Expected WS message shape:
 *   {
 *     id:        string,          // unique entry id
 *     agent:     string,          // agent display name
 *     type:      "thought" | "decision" | "execution",
 *     message:   string,          // short summary line
 *     detail?:   string,          // optional expanded context
 *     tags?:     string[],        // optional extra tag labels
 *     ts:        string | number, // ISO string or epoch ms
 *   }
 */

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Sora:wght@300;400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg0:#07090d; --bg1:#0c0f16; --bg2:#111620; --bg3:#192030;
  --bg4:#1f2a3c; --bg5:#27344a;
  --border:rgba(255,255,255,0.06); --border-hi:rgba(255,255,255,0.13);
  --text1:#dde4f0; --text2:#7a8899; --text3:#3e4e62;
  --mono:'Space Mono',monospace; --sans:'Sora',sans-serif;

  /* type palette */
  --thought-bg:rgba(167,139,250,0.09);   --thought-border:rgba(167,139,250,0.25);
  --thought-text:#c4b5fd;                --thought-glow:rgba(167,139,250,0.15);

  --decision-bg:rgba(245,166,35,0.09);   --decision-border:rgba(245,166,35,0.28);
  --decision-text:#fbbf24;               --decision-glow:rgba(245,166,35,0.15);

  --execution-bg:rgba(52,211,153,0.09);  --execution-border:rgba(52,211,153,0.28);
  --execution-text:#34d399;              --execution-glow:rgba(52,211,153,0.15);
}
body { background:var(--bg0); color:var(--text1); font-family:var(--sans); }
::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--bg5); border-radius:4px; }
`;

// ─── TYPE CONFIG ──────────────────────────────────────────────────────────────
const TYPE_CFG = {
  thought: {
    label: "Thought",
    icon: "◆",
    color: "var(--thought-text)",
    bg: "var(--thought-bg)",
    border: "var(--thought-border)",
    glow: "var(--thought-glow)",
    leftBar: "#c4b5fd",
  },
  decision: {
    label: "Decision",
    icon: "⬡",
    color: "var(--decision-text)",
    bg: "var(--decision-bg)",
    border: "var(--decision-border)",
    glow: "var(--decision-glow)",
    leftBar: "#fbbf24",
  },
  execution: {
    label: "Execution",
    icon: "▶",
    color: "var(--execution-text)",
    bg: "var(--execution-bg)",
    border: "var(--execution-border)",
    glow: "var(--execution-glow)",
    leftBar: "#34d399",
  },
};

// ─── AGENT COLOR PALETTE ──────────────────────────────────────────────────────
const AGENT_COLORS = [
  { text: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.25)"  },
  { text: "#f472b6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.25)" },
  { text: "#38bdf8", bg: "rgba(56,189,248,0.10)",  border: "rgba(56,189,248,0.25)"  },
  { text: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.25)"  },
  { text: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)" },
  { text: "#2dd4bf", bg: "rgba(45,212,191,0.10)",  border: "rgba(45,212,191,0.25)"  },
];
const agentColorMap = {};
let colorIdx = 0;
function getAgentColor(agent) {
  if (!agentColorMap[agent]) {
    agentColorMap[agent] = AGENT_COLORS[colorIdx % AGENT_COLORS.length];
    colorIdx++;
  }
  return agentColorMap[agent];
}

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── WEBSOCKET HOOK ────────────────────────────────────────────────────────────
/**
 * useAgentWebSocket
 * Connects to `url` if provided; otherwise runs the built-in simulation.
 * Returns { status, entries }.
 * `onEntry` callback is called for each new parsed entry.
 */
function useAgentWebSocket(url, onEntry) {
  const [status, setStatus] = useState("connecting");
  const cbRef = useRef(onEntry);
  cbRef.current = onEntry;
  const wsRef = useRef(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!url) {
      // ── Simulation mode ───────────────────────────────────────────────────
      setStatus("connected");
      const AGENTS = [
        "Concierge AI","Housekeeping AI","Revenue AI","Maintenance AI","F&B AI","Security AI",
      ];
      const THOUGHTS = [
        "Evaluating guest request for late checkout on floor 3.",
        "Reviewing occupancy patterns for next 72 hours.",
        "Cross-checking linen inventory against scheduled checkouts.",
        "Monitoring lobby noise levels — assessing intervention threshold.",
        "Scanning F&B order volume — detecting surge pattern.",
        "Correlating maintenance ticket age with guest satisfaction score.",
        "Predicting demand spike for Friday evening based on event calendar.",
        "Assessing energy usage anomaly in HVAC zone B.",
        "Reviewing minibar restock frequency for VIP floor.",
        "Evaluating pricing elasticity for last-minute room availability.",
      ];
      const DECISIONS = [
        "Approved room 507 upgrade for guest Amara Diallo.",
        "Rescheduled deep-clean for room 214 to 14:30.",
        "Raised weekend rates by $24 based on demand forecast.",
        "Dispatched maintenance team to elevator B.",
        "Flagged room 312 for priority inspection before next check-in.",
        "Allocated backup linen stock to floors 4–6.",
        "Triggered automatic reorder for towel supply (level < 15%).",
        "Adjusted thermostat schedule for unoccupied wing.",
        "Escalated noise complaint in corridor 3B to duty manager.",
        "Cancelled pending minibar restock — guest checked out early.",
      ];
      const EXECUTIONS = [
        "Sent upgrade confirmation to guest via in-room tablet.",
        "Updated PMS with revised checkout time for room 211.",
        "Pushed dynamic pricing update to OTA channels.",
        "Created work-order ticket #4821 for elevator inspection.",
        "Notified housekeeping supervisor of priority room list.",
        "Confirmed towel reorder with supplier — ETA 09:00 tomorrow.",
        "Sent automated welcome message to 3 arriving VIP guests.",
        "Logged energy anomaly report to facilities dashboard.",
        "Applied 15% F&B discount to room 408 for service delay.",
        "Archived completed maintenance tickets from last shift.",
      ];
      const DETAILS = [
        "Context: guest has stayed 4× this year, satisfaction score 9.2/10. Upgrade cost offset by loyalty programme.",
        "Triggered by: occupancy < 60% on floors 2–3 for next 48 h. Confidence: 87%.",
        "Historical baseline exceeded by 2.3σ. Previous intervention at similar threshold resolved within 40 min.",
        "Integration: PMS webhook → OTA rate manager → confirmation receipt in 1.2 s.",
        "Ticket priority set HIGH based on guest arrival in < 2 h. Assigned to team Alpha.",
        "Decision tree depth: 4 nodes. Alternative considered: defer to AM shift. Rejected due to VIP flag.",
      ];
      const TAGS_POOL = [
        ["VIP","urgent"], ["pricing","revenue"], ["housekeeping"], ["maintenance","priority"],
        ["guest-facing"], ["automated"], ["scheduled"], ["anomaly"], ["f&b","surge"], [],
      ];

      let counter = 0;
      function emit() {
        const type = ["thought","decision","execution"][Math.floor(Math.random()*3)];
        const agent = AGENTS[Math.floor(Math.random()*AGENTS.length)];
        const pool = type === "thought" ? THOUGHTS : type === "decision" ? DECISIONS : EXECUTIONS;
        const entry = {
          id: `sim-${++counter}`,
          agent,
          type,
          message: pool[Math.floor(Math.random()*pool.length)],
          detail: Math.random() > 0.45 ? DETAILS[Math.floor(Math.random()*DETAILS.length)] : null,
          tags: TAGS_POOL[Math.floor(Math.random()*TAGS_POOL.length)],
          ts: new Date(),
        };
        cbRef.current(entry);
        const next = 800 + Math.random() * 3400;
        return setTimeout(emit, next);
      }
      // seed with 6 entries immediately
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          const type = ["thought","decision","execution"][i % 3];
          const agent = AGENTS[i % AGENTS.length];
          const pool = type === "thought" ? THOUGHTS : type === "decision" ? DECISIONS : EXECUTIONS;
          cbRef.current({
            id: `seed-${i}`,
            agent,
            type,
            message: pool[i % pool.length],
            detail: i % 2 === 0 ? DETAILS[i % DETAILS.length] : null,
            tags: TAGS_POOL[i % TAGS_POOL.length],
            ts: new Date(Date.now() - (6 - i) * 12000),
          });
        }, i * 60);
      }
      const tid = setTimeout(emit, 1800);
      return () => clearTimeout(tid);
    }

    // ── Real WebSocket ────────────────────────────────────────────────────────
    function connect() {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { setStatus("connected"); retryRef.current = 0; };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRef.current({ ...data, ts: data.ts ? new Date(data.ts) : new Date() });
        } catch {}
      };
      ws.onclose = () => {
        setStatus("reconnecting");
        const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
        retryRef.current++;
        setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { wsRef.current?.close(); };
  }, [url]);

  return status;
}

// ─── FEED ENTRY ───────────────────────────────────────────────────────────────
function FeedEntry({ entry, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const tc = TYPE_CFG[entry.type];
  const ac = getAgentColor(entry.agent);

  const ts = useMemo(() => {
    const d = entry.ts instanceof Date ? entry.ts : new Date(entry.ts);
    return d.toLocaleTimeString("en-GB", { hour12: false });
  }, [entry.ts]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -18, filter: "blur(3px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 12, filter: "blur(2px)" }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      onClick={() => entry.detail && setExpanded(e => !e)}
      style={{
        position: "relative",
        background: expanded ? tc.bg : "transparent",
        borderLeft: `2px solid ${tc.leftBar}`,
        borderRadius: "0 8px 8px 0",
        padding: "10px 14px 10px 16px",
        cursor: entry.detail ? "pointer" : "default",
        transition: "background 0.2s",
        userSelect: "none",
      }}
    >
      {/* new-entry flash */}
      <AnimatePresence>
        {isNew && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{
              position: "absolute", inset: 0, borderRadius: "0 8px 8px 0",
              background: tc.glow, pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* type icon + label */}
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10, color: tc.color,
          background: tc.bg, border: `1px solid ${tc.border}`,
          borderRadius: 4, padding: "1px 8px", letterSpacing: "0.07em",
          display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        }}>
          <span style={{ fontSize: 8 }}>{tc.icon}</span>
          {tc.label.toUpperCase()}
        </span>

        {/* agent chip */}
        <span style={{
          fontFamily: "var(--mono)", fontSize: 10,
          color: ac.text, background: ac.bg, border: `1px solid ${ac.border}`,
          borderRadius: 4, padding: "1px 8px", letterSpacing: "0.05em", flexShrink: 0,
        }}>
          {entry.agent}
        </span>

        {/* extra tags */}
        {entry.tags?.map(tag => (
          <span key={tag} style={{
            fontFamily: "var(--mono)", fontSize: 9, color: "var(--text3)",
            background: "var(--bg3)", border: "1px solid var(--border)",
            borderRadius: 4, padding: "1px 7px", letterSpacing: "0.06em",
          }}>
            {tag}
          </span>
        ))}

        {/* timestamp */}
        <span style={{
          marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text3)",
          letterSpacing: "0.05em", flexShrink: 0,
        }}>
          {ts}
        </span>

        {/* expand caret */}
        {entry.detail && (
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            style={{ fontSize: 9, color: "var(--text3)", flexShrink: 0 }}
          >
            ▶
          </motion.span>
        )}
      </div>

      {/* message */}
      <div style={{
        marginTop: 7, fontSize: 13, color: "var(--text1)", lineHeight: 1.55,
        fontWeight: 400,
      }}>
        {entry.message}
      </div>

      {/* expanded detail */}
      <AnimatePresence>
        {expanded && entry.detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              marginTop: 10, paddingTop: 10,
              borderTop: `1px solid ${tc.border}`,
              fontSize: 12, color: "var(--text2)", lineHeight: 1.6,
              fontStyle: "italic",
            }}>
              {entry.detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── FILTER BAR ───────────────────────────────────────────────────────────────
function FilterBar({ typeFilter, setTypeFilter, agentFilter, setAgentFilter, agents, counts }) {
  const types = ["all", "thought", "decision", "execution"];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "10px 16px", borderBottom: "1px solid var(--border)",
      background: "var(--bg1)", flexWrap: "wrap", flexShrink: 0,
    }}>
      {/* type filters */}
      {types.map(t => {
        const cfg = t === "all" ? null : TYPE_CFG[t];
        const isActive = typeFilter === t;
        const count = t === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[t] || 0);
        return (
          <motion.button
            key={t}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setTypeFilter(t)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.07em",
              padding: "4px 11px", borderRadius: 6, cursor: "pointer",
              background: isActive ? (cfg ? cfg.bg : "var(--bg4)") : "transparent",
              border: `1px solid ${isActive ? (cfg ? cfg.border : "var(--border-hi)") : "var(--border)"}`,
              color: isActive ? (cfg ? cfg.color : "var(--text1)") : "var(--text3)",
              transition: "color 0.15s, border-color 0.15s, background 0.15s",
            }}
          >
            {t === "all" ? "ALL" : cfg.label.toUpperCase()}
            <span style={{
              background: "rgba(0,0,0,0.3)", borderRadius: 10,
              padding: "0 6px", fontSize: 9,
              color: isActive ? (cfg ? cfg.color : "var(--text2)") : "var(--text3)",
            }}>
              {count}
            </span>
          </motion.button>
        );
      })}

      <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

      {/* agent filters */}
      {agents.map(agent => {
        const ac = getAgentColor(agent);
        const isActive = agentFilter.includes(agent);
        return (
          <motion.button
            key={agent}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setAgentFilter(prev =>
              prev.includes(agent) ? prev.filter(a => a !== agent) : [...prev, agent]
            )}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.05em",
              padding: "3px 9px", borderRadius: 5, cursor: "pointer",
              background: isActive ? ac.bg : "transparent",
              border: `1px solid ${isActive ? ac.border : "var(--border)"}`,
              color: isActive ? ac.text : "var(--text3)",
              transition: "all 0.15s",
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isActive ? ac.text : "var(--text3)",
              flexShrink: 0,
            }} />
            {initials(agent)}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── STATUS BAR ───────────────────────────────────────────────────────────────
function StatusBar({ status, total, paused, onResume }) {
  const statusCfg = {
    connected:    { color: "#34d399", label: "CONNECTED",    pulse: true },
    connecting:   { color: "#fbbf24", label: "CONNECTING",   pulse: true },
    reconnecting: { color: "#f87171", label: "RECONNECTING", pulse: true },
  }[status] || { color: "var(--text3)", label: "OFFLINE", pulse: false };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 16px", height: 40,
      background: "var(--bg1)", borderBottom: "1px solid var(--border)",
      flexShrink: 0,
    }}>
      {/* wordmark */}
      <span style={{
        fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
        color: "var(--text2)", letterSpacing: "0.18em",
      }}>
        AGENTFEED
      </span>

      <div style={{ width: 1, height: 18, background: "var(--border)" }} />

      {/* ws status */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <motion.div
          animate={statusCfg.pulse ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: statusCfg.color }}
        />
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: statusCfg.color, letterSpacing: "0.1em" }}>
          {statusCfg.label}
        </span>
      </div>

      <div style={{ width: 1, height: 18, background: "var(--border)" }} />

      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text3)" }}>
        {total} entries
      </span>

      {/* manual-scroll notice */}
      <AnimatePresence>
        {paused && (
          <motion.button
            key="resume"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={onResume}
            style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--bg4)", border: "1px solid var(--border-hi)",
              borderRadius: 6, padding: "4px 12px", cursor: "pointer",
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--text2)",
              letterSpacing: "0.07em",
            }}
          >
            <motion.span
              animate={{ y: [0, -2, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              ↓
            </motion.span>
            RESUME LIVE
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
/**
 * @param {string} [wsUrl]  - WebSocket URL. Omit for demo simulation mode.
 * @param {number} [maxEntries=300] - Max entries to keep in memory.
 */
export default function AgentFeed({ wsUrl, maxEntries = 300 }) {
  const [entries, setEntries] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const [typeFilter, setTypeFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef(null);

  // incoming entry handler
  const handleEntry = useCallback((entry) => {
    setEntries(prev => {
      const next = [entry, ...prev];
      return next.length > maxEntries ? next.slice(0, maxEntries) : next;
    });
    setNewIds(prev => {
      const s = new Set(prev);
      s.add(entry.id);
      setTimeout(() => setNewIds(p => { const n = new Set(p); n.delete(entry.id); return n; }), 1400);
      return s;
    });
  }, [maxEntries]);

  const wsStatus = useAgentWebSocket(wsUrl || null, handleEntry);

  // auto-scroll logic — feed is newest-on-top so we scroll to scrollTop = 0
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [entries, autoScroll]);

  const handleScroll = useCallback(() => {
    if (isScrollingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    // if user scrolled away from top, pause auto-scroll
    if (el.scrollTop > 80) {
      setAutoScroll(false);
    }
  }, []);

  const handleScrollStart = useCallback(() => {
    isScrollingRef.current = true;
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => { isScrollingRef.current = false; }, 200);
  }, []);

  const resumeLive = useCallback(() => {
    setAutoScroll(true);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // derived state
  const agents = useMemo(() => [...new Set(entries.map(e => e.agent))], [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (agentFilter.length > 0 && !agentFilter.includes(e.agent)) return false;
      return true;
    });
  }, [entries, typeFilter, agentFilter]);

  const counts = useMemo(() => {
    const c = { thought: 0, decision: 0, execution: 0 };
    entries.forEach(e => { c[e.type] = (c[e.type] || 0) + 1; });
    return c;
  }, [entries]);

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100vh", background: "var(--bg0)",
        fontFamily: "var(--sans)", overflow: "hidden",
      }}>
        {/* status bar */}
        <StatusBar
          status={wsStatus}
          total={entries.length}
          paused={!autoScroll}
          onResume={resumeLive}
        />

        {/* filter bar */}
        <FilterBar
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          agentFilter={agentFilter}
          setAgentFilter={setAgentFilter}
          agents={agents}
          counts={counts}
        />

        {/* feed */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onPointerDown={handleScrollStart}
          onTouchStart={handleScrollStart}
          style={{
            flex: 1, overflowY: "auto",
            padding: "12px 12px 24px",
            display: "flex", flexDirection: "column", gap: 2,
          }}
        >
          <AnimatePresence initial={false}>
            {filtered.map((entry) => (
              <FeedEntry
                key={entry.id}
                entry={entry}
                isNew={newIds.has(entry.id)}
              />
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                textAlign: "center", padding: "60px 20px",
                fontFamily: "var(--mono)", fontSize: 11,
                color: "var(--text3)", letterSpacing: "0.12em",
              }}
            >
              NO ENTRIES MATCH CURRENT FILTERS
            </motion.div>
          )}
        </div>

        {/* bottom bar: type legend + rate indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "8px 16px",
          background: "var(--bg1)", borderTop: "1px solid var(--border)",
          flexShrink: 0, flexWrap: "wrap",
        }}>
          {Object.entries(TYPE_CFG).map(([k, cfg]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: cfg.leftBar }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text3)", letterSpacing: "0.1em" }}>
                {cfg.label.toUpperCase()}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: cfg.color }}>
                {counts[k] || 0}
              </span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 9, color: "var(--text3)" }}>
            {filtered.length}/{entries.length} shown · click entry to expand
          </div>
        </div>
      </div>
    </>
  );
}
