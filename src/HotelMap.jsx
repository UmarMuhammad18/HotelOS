/**
 * HotelMap.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive hotel floor-map component for HotelOS.
 *
 * Features
 * ────────
 *  • Floor-by-floor grid of room cards with status color coding
 *  • Framer-motion animated status transitions (scale + background pulse)
 *  • Rich tooltip on hover (guest name, check-in/out, housekeeping note)
 *  • Slide-in room detail panel on click
 *  • WebSocket simulation: random room status changes every 3–8 s
 *  • Filter bar (All / Vacant / Occupied / Cleaning / Maintenance)
 *  • Legend + live event log strip at the bottom
 *
 * Dependencies
 * ────────────
 *   npm install framer-motion
 *   (Google Fonts loaded via @import inside the injected <style> tag)
 *
 * Usage
 * ─────
 *   import HotelMap from "./HotelMap";
 *   <HotelMap />
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Sora:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg0: #07090d;
  --bg1: #0c0f16;
  --bg2: #121720;
  --bg3: #192030;
  --bg4: #1f2a3c;
  --bg5: #283548;

  --border:    rgba(255,255,255,0.06);
  --border-hi: rgba(255,255,255,0.12);

  /* status palette */
  --vacant-bg:      #0e1f18;
  --vacant-border:  #1a4a30;
  --vacant-text:    #3ddc84;
  --vacant-glow:    rgba(61,220,132,0.18);

  --occupied-bg:    #0e1828;
  --occupied-border:#1a3460;
  --occupied-text:  #5ba4f5;
  --occupied-glow:  rgba(91,164,245,0.18);

  --cleaning-bg:    #1e1a08;
  --cleaning-border:#4a3c0a;
  --cleaning-text:  #f5c842;
  --cleaning-glow:  rgba(245,200,66,0.18);

  --maintenance-bg:    #1e0e0e;
  --maintenance-border:#4a1a1a;
  --maintenance-text:  #f07070;
  --maintenance-glow:  rgba(240,112,112,0.18);

  --checkout-bg:    #1a1228;
  --checkout-border:#3a2660;
  --checkout-text:  #c084fc;
  --checkout-glow:  rgba(192,132,252,0.18);

  --mono: 'Space Mono', monospace;
  --sans: 'Sora', sans-serif;
  --text1: #dde4f0;
  --text2: #7a8899;
  --text3: #3e4e62;
}

body { background: var(--bg0); color: var(--text1); font-family: var(--sans); }

@media (max-width: 768px) {
  .room-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)) !important;
    gap: 8px !important;
  }
  .detail-panel {
    width: 100% !important;
    max-width: 100% !important;
  }
}

/* scrollbars */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg5); border-radius: 4px; }
`;

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────
const STATUS = {
  vacant:      { label: "Vacant",      emoji: "○", color: "var(--vacant-text)",      bg: "var(--vacant-bg)",      border: "var(--vacant-border)",      glow: "var(--vacant-glow)" },
  occupied:    { label: "Occupied",    emoji: "●", color: "var(--occupied-text)",    bg: "var(--occupied-bg)",    border: "var(--occupied-border)",    glow: "var(--occupied-glow)" },
  cleaning:    { label: "Cleaning",    emoji: "◈", color: "var(--cleaning-text)",    bg: "var(--cleaning-bg)",    border: "var(--cleaning-border)",    glow: "var(--cleaning-glow)" },
  maintenance: { label: "Maintenance", emoji: "⚠", color: "var(--maintenance-text)", bg: "var(--maintenance-bg)", border: "var(--maintenance-border)", glow: "var(--maintenance-glow)" },
  checkout:    { label: "Checkout",    emoji: "◐", color: "var(--checkout-text)",    bg: "var(--checkout-bg)",    border: "var(--checkout-border)",    glow: "var(--checkout-glow)" },
};

// ─── SEED DATA ─────────────────────────────────────────────────────────────
const NAMES = [
  "James Harrington","Amara Diallo","Chen Wei","Sofia Rossi","Lena Brandt",
  "Omar Hassan","Yuki Tanaka","Priya Mehta","Lucas Ferreira","Anna Kovač",
  "David Osei","Fatima Al-Rashid","Marco Bianchi","Elena Volkov","Sam Park",
  "Isabel Cruz","Tariq Mansour","Nina Johansson","Kwame Asante","Mia Svensson",
];
const NOTES = [
  "Extra pillows requested","Late checkout approved","VIP — champagne on arrival",
  "Baby cot in room","Requested quiet floor","Allergen-free bedding",
  "Early check-in done","Mini-bar restocked","Towel replacement done",
  "Do not disturb since 10:00","Room inspection pending","Deep-clean in progress",
];
const TYPES = ["Standard King","Deluxe Twin","Junior Suite","Executive King","Suite","Penthouse"];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function randomDate(daysAgo, daysFwd) {
  const d = new Date();
  d.setDate(d.getDate() + randomInt(-daysAgo, daysFwd));
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
}

const FLOORS = [2, 3, 4, 5];
const ROOMS_PER_FLOOR = 12;
const STATUS_KEYS = Object.keys(STATUS);
const STATUS_WEIGHTS = [0.35, 0.40, 0.10, 0.08, 0.07]; // vacant, occupied, cleaning, maintenance, checkout

function weightedStatus() {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < STATUS_KEYS.length; i++) {
    acc += STATUS_WEIGHTS[i];
    if (r < acc) return STATUS_KEYS[i];
  }
  return "vacant";
}

function generateRooms() {
  const rooms = {};
  FLOORS.forEach(floor => {
    for (let i = 1; i <= ROOMS_PER_FLOOR; i++) {
      const num = `${floor}${String(i).padStart(2, "0")}`;
      const status = weightedStatus();
      rooms[num] = {
        number: num,
        floor,
        type: randomFrom(TYPES),
        status,
        guest: status === "occupied" || status === "checkout" ? randomFrom(NAMES) : null,
        checkIn:  randomDate(3, 0),
        checkOut: randomDate(0, 5),
        rate: randomInt(120, 620),
        note: randomFrom(NOTES),
        capacity: randomInt(1, 4),
        floor_pos: i,
      };
    }
  });
  return rooms;
}

// ─── WEBSOCKET SIMULATION ──────────────────────────────────────────────────
function useSimulatedWebSocket(onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;
  useEffect(() => {
    function schedule() {
      const delay = randomInt(3000, 8000);
      return setTimeout(() => {
        const floor = randomFrom(FLOORS);
        const pos   = randomInt(1, ROOMS_PER_FLOOR);
        const num   = `${floor}${String(pos).padStart(2, "0")}`;
        const newStatus = weightedStatus();
        cbRef.current({ type: "STATUS_CHANGE", room: num, status: newStatus, ts: new Date() });
        timerId = schedule();
      }, delay);
    }
    let timerId = schedule();
    return () => clearTimeout(timerId);
  }, []);
}

// ─── ROOM CARD ─────────────────────────────────────────────────────────────
function RoomCard({ room, isSelected, onClick, highlight }) {
  const s = STATUS[room.status];
  const [justChanged, setJustChanged] = useState(false);
  const prevStatus = useRef(room.status);

  useEffect(() => {
    if (prevStatus.current !== room.status) {
      prevStatus.current = room.status;
      setJustChanged(true);
      const t = setTimeout(() => setJustChanged(false), 900);
      return () => clearTimeout(t);
    }
  }, [room.status]);

  return (
    <motion.div
      layout
      layoutId={`room-${room.number}`}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{
        opacity:   highlight === false ? 0.25 : 1,
        scale:     isSelected ? 1.05 : 1,
        boxShadow: isSelected
          ? `0 0 0 2px ${s.color}, 0 8px 28px ${s.glow}`
          : justChanged
          ? `0 0 0 1.5px ${s.color}, 0 4px 18px ${s.glow}`
          : `0 0 0 1px ${s.border}`,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      style={{
        background: s.bg,
        borderRadius: 8,
        padding: "10px 8px",
        cursor: "pointer",
        position: "relative",
        userSelect: "none",
        minHeight: 72,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "visible",
      }}
      whileHover={{ scale: isSelected ? 1.05 : 1.04, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.97 }}
    >
      {/* pulse ring on status change */}
      <AnimatePresence>
        {justChanged && (
          <motion.div
            key="pulse"
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              position: "absolute", inset: 0, borderRadius: 8,
              border: `1.5px solid ${s.color}`, pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* room number */}
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: s.color, letterSpacing: "0.06em" }}>
        {room.number}
      </div>

      {/* status dot + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
        <motion.div
          animate={{ opacity: room.status === "cleaning" || room.status === "maintenance" ? [1, 0.3, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }}
        />
        <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: s.color, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>
          {s.label}
        </span>
      </div>

      {/* guest name (if occupied) */}
      {room.guest && (
        <div style={{ fontSize: 9, color: "var(--text2)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {room.guest.split(" ")[1]}
        </div>
      )}

      {/* rate */}
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text3)", marginTop: 2 }}>
        ${room.rate}/n
      </div>
    </motion.div>
  );
}

// ─── TOOLTIP ───────────────────────────────────────────────────────────────
function Tooltip({ room, pos }) {
  if (!room || !pos) return null;
  const s = STATUS[room.status];
  return (
    <AnimatePresence>
      <motion.div
        key={room.number}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        style={{
          position: "fixed",
          left: pos.x + 12,
          top: pos.y - 10,
          zIndex: 9999,
          pointerEvents: "none",
          background: "var(--bg2)",
          border: `1px solid ${s.border}`,
          borderRadius: 10,
          padding: "10px 14px",
          minWidth: 190,
          boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${s.border}`,
          fontFamily: "var(--sans)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13, color: s.color }}>
            Room {room.number}
          </span>
          <span style={{ fontSize: 10, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 4, padding: "1px 7px", fontFamily: "var(--mono)" }}>
            {s.label}
          </span>
        </div>
        <Row label="Type"     value={room.type} />
        {room.guest && <Row label="Guest"    value={room.guest} />}
        <Row label="Check-in"  value={room.checkIn} />
        <Row label="Check-out" value={room.checkOut} />
        <Row label="Rate"      value={`$${room.rate} / night`} />
        <Row label="Capacity"  value={`${room.capacity} guests`} />
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text2)", fontStyle: "italic" }}>
          {room.note}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--mono)" }}>{label}</span>
      <span style={{ fontSize: 10, color: "var(--text1)" }}>{value}</span>
    </div>
  );
}

// ─── DETAIL PANEL ──────────────────────────────────────────────────────────
const STATUS_TRANSITIONS = {
  vacant:      ["occupied", "maintenance", "cleaning"],
  occupied:    ["checkout", "maintenance"],
  cleaning:    ["vacant"],
  maintenance: ["vacant", "cleaning"],
  checkout:    ["cleaning", "vacant"],
};

function DetailPanel({ room, onClose, onStatusChange }) {
  if (!room) return null;
  const s = STATUS[room.status];
  const transitions = STATUS_TRANSITIONS[room.status] || [];

  return (
    <motion.div
      key="detail"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="detail-panel"
      style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0,
        width: "min(100%, 360px)",
        background: "var(--bg1)",
        borderLeft: `1px solid var(--border)`,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* header */}
      <div style={{
        padding: "18px 20px 14px",
        borderBottom: "1px solid var(--border)",
        background: s.bg,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: s.color, letterSpacing: "0.14em", marginBottom: 4 }}>
              ROOM
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1 }}>
              {room.number}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "1px solid var(--border-hi)", borderRadius: 6, color: "var(--text2)", cursor: "pointer", padding: "4px 10px", fontSize: 13, fontFamily: "var(--mono)" }}
          >✕</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Tag color={s.color} bg={s.bg} border={s.border}>{s.label}</Tag>
          <Tag color="var(--text2)" bg="var(--bg2)" border="var(--border)">{room.type}</Tag>
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {/* guest block */}
        {room.guest ? (
          <Section title="Guest">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--occupied-bg)", border: "1px solid var(--occupied-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--occupied-text)",
                flexShrink: 0,
              }}>
                {room.guest.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)" }}>{room.guest}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 2 }}>
                  {room.capacity} guest{room.capacity > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </Section>
        ) : (
          <Section title="Guest">
            <div style={{ fontSize: 12, color: "var(--text3)", padding: "8px 0" }}>No guest assigned</div>
          </Section>
        )}

        {/* dates */}
        <Section title="Stay">
          <Grid2>
            <InfoBox label="Check-in"  value={room.checkIn} />
            <InfoBox label="Check-out" value={room.checkOut} />
          </Grid2>
        </Section>

        {/* financials */}
        <Section title="Financials">
          <Grid2>
            <InfoBox label="Rate / Night" value={`$${room.rate}`} accent="var(--vacant-text)" />
            <InfoBox label="Est. Revenue" value={`$${room.rate * 3}`} />
          </Grid2>
        </Section>

        {/* note */}
        <Section title="Housekeeping Note">
          <div style={{
            padding: "10px 12px", background: "var(--bg2)", borderRadius: 8,
            border: `1px solid var(--border)`, fontSize: 12, color: "var(--text2)",
            lineHeight: 1.55, fontStyle: "italic",
          }}>
            {room.note}
          </div>
        </Section>

        {/* status transitions */}
        {transitions.length > 0 && (
          <Section title="Change Status">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {transitions.map(st => {
                const cfg = STATUS[st];
                return (
                  <motion.button
                    key={st}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onStatusChange(room.number, st)}
                    style={{
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                      borderRadius: 7, padding: "9px 12px",
                      display: "flex", alignItems: "center", gap: 8,
                      cursor: "pointer", color: cfg.color,
                      fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
                    Mark as {cfg.label}
                  </motion.button>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </motion.div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.15em", color: "var(--text3)", textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
function Grid2({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>;
}
function InfoBox({ label, value, accent }) {
  return (
    <div style={{ background: "var(--bg2)", borderRadius: 7, padding: "8px 10px", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--text3)", marginBottom: 4, letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontSize: 12, color: accent || "var(--text1)", fontFamily: "var(--mono)", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
function Tag({ children, color, bg, border }) {
  return (
    <span style={{ fontSize: 10, fontFamily: "var(--mono)", padding: "2px 9px", borderRadius: 4, color, background: bg, border: `1px solid ${border}`, letterSpacing: "0.07em" }}>
      {children}
    </span>
  );
}

// ─── EVENT LOG STRIP ───────────────────────────────────────────────────────
function EventLog({ events }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [events]);

  return (
    <div style={{
      borderTop: "1px solid var(--border)",
      background: "var(--bg1)",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text3)", letterSpacing: "0.14em", flexShrink: 0 }}>
        WS LOG
      </div>
      <div
        ref={ref}
        style={{
          display: "flex", gap: 10, overflowX: "auto", flex: 1,
          scrollbarWidth: "none",
        }}
      >
        <AnimatePresence initial={false}>
          {events.slice(-14).map((ev, i) => {
            const s = STATUS[ev.status];
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                  background: s.bg, border: `1px solid ${s.border}`,
                  borderRadius: 5, padding: "2px 8px",
                  fontFamily: "var(--mono)", fontSize: 9,
                }}
              >
                <span style={{ color: s.color }}>{ev.room}</span>
                <span style={{ color: "var(--text3)"}}>→</span>
                <span style={{ color: s.color }}>{s.label}</span>
                <span style={{ color: "var(--text3)" }}>
                  {ev.ts.getHours().toString().padStart(2,"0")}:{ev.ts.getMinutes().toString().padStart(2,"0")}:{ev.ts.getSeconds().toString().padStart(2,"0")}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {/* live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <motion.div
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--vacant-text)" }}
        />
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--vacant-text)" }}>LIVE</span>
      </div>
    </div>
  );
}

// ─── FILTER BAR ────────────────────────────────────────────────────────────
function FilterBar({ active, onSelect, rooms }) {
  const counts = {};
  STATUS_KEYS.forEach(k => { counts[k] = 0; });
  Object.values(rooms).forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const total = Object.values(rooms).length;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
      borderBottom: "1px solid var(--border)", background: "var(--bg1)", flexShrink: 0,
      flexWrap: "wrap",
    }}>
      <div className="filter-chips-container" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
        <FilterChip
          label="All" count={total}
          isActive={active === "all"}
          color="var(--text1)" bg="var(--bg3)" border="var(--border-hi)"
          onClick={() => onSelect("all")}
        />
        {STATUS_KEYS.map(k => {
          const s = STATUS[k];
          return (
            <FilterChip key={k}
              label={s.label} count={counts[k]}
              isActive={active === k}
              color={s.color} bg={s.bg} border={s.border}
              onClick={() => onSelect(k)}
            />
          );
        })}
      </div>
      <div className="filter-stats" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text3)" }}>
        {total} rooms · {FLOORS.length} floors
      </div>
    </div>
  );
}

function FilterChip({ label, count, isActive, color, bg, border, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: isActive ? bg : "transparent",
        border: `1px solid ${isActive ? border : "var(--border)"}`,
        borderRadius: 6, padding: "4px 11px", cursor: "pointer",
        color: isActive ? color : "var(--text3)",
        fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.07em",
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      {label}
      <span style={{
        background: isActive ? "rgba(0,0,0,0.25)" : "var(--bg3)",
        borderRadius: 10, padding: "0px 6px", fontSize: 9,
        color: isActive ? color : "var(--text3)",
      }}>
        {count}
      </span>
    </motion.button>
  );
}

// ─── LEGEND ────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 20px 0", flexWrap: "wrap" }}>
      {STATUS_KEYS.map(k => {
        const s = STATUS[k];
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text3)", letterSpacing: "0.1em" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── FLOOR LABEL ───────────────────────────────────────────────────────────
function FloorLabel({ floor, rooms }) {
  const counts = {};
  STATUS_KEYS.forEach(k => { counts[k] = 0; });
  rooms.forEach(r => { counts[r.status]++ });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--text2)", letterSpacing: "0.12em" }}>
        FLOOR {floor}
      </div>
      <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      <div style={{ display: "flex", gap: 6 }}>
        {STATUS_KEYS.filter(k => counts[k] > 0).map(k => (
          <span key={k} style={{ fontFamily: "var(--mono)", fontSize: 9, color: STATUS[k].color }}>
            {counts[k]}{k[0].toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function HotelMap({ embedded = false }) {
  const [rooms, setRooms] = useState(() => generateRooms());
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [filter, setFilter] = useState("all");
  const [tooltip, setTooltip] = useState({ room: null, pos: null });
  const [wsEvents, setWsEvents] = useState([]);
  const tooltipTimer = useRef(null);
  let evtCounter = useRef(0);

  // WebSocket simulation
  useSimulatedWebSocket(useCallback(({ room, status, ts }) => {
    setRooms(prev => ({
      ...prev,
      [room]: {
        ...prev[room],
        status,
        guest: status === "occupied" ? randomFrom(NAMES) : status === "checkout" ? prev[room].guest : null,
      },
    }));
    setWsEvents(prev => [
      ...prev,
      { id: ++evtCounter.current, room, status, ts },
    ].slice(-30));
    // update selected panel too
    setSelectedRoom(sel => sel?.number === room ? { ...sel, status } : sel);
  }, []));

  const handleStatusChange = useCallback((roomNum, newStatus) => {
    setRooms(prev => ({
      ...prev,
      [roomNum]: {
        ...prev[roomNum],
        status: newStatus,
        guest: newStatus === "occupied" ? randomFrom(NAMES) : newStatus === "vacant" || newStatus === "cleaning" ? null : prev[roomNum].guest,
      },
    }));
    setSelectedRoom(sel => sel?.number === roomNum ? { ...rooms[roomNum], status: newStatus } : sel);
  }, [rooms]);

  const handleCardClick = useCallback((room) => {
    setSelectedRoom(prev => prev?.number === room.number ? null : room);
  }, []);

  const handleMouseEnter = useCallback((room, e) => {
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ room, pos: { x: e.clientX, y: e.clientY } });
    }, 300);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (tooltip.room) {
      setTooltip(t => t.room ? { ...t, pos: { x: e.clientX, y: e.clientY } } : t);
    }
  }, [tooltip.room]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(tooltipTimer.current);
    setTooltip({ room: null, pos: null });
  }, []);

  const roomList = Object.values(rooms);
  const filteredNums = new Set(
    (filter === "all" ? roomList : roomList.filter(r => r.status === filter)).map(r => r.number)
  );

  // sync selectedRoom with live state
  const liveSelected = selectedRoom ? rooms[selectedRoom.number] : null;

  return (
    <>
      <style>{CSS}</style>
      <div
        style={{
          display: "flex", flexDirection: "column",
          height: embedded ? "100%" : "100vh",
          minHeight: embedded ? "100%" : "100vh",
          background: "var(--bg0)",
          fontFamily: "var(--sans)", overflow: "hidden",
        }}
        onMouseMove={handleMouseMove}
      >
        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "0 20px", height: 48,
          background: "var(--bg1)", borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--occupied-text)", letterSpacing: "0.18em" }}>
            HOTELMAP
          </div>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text3)" }}>
            {FLOORS.length} floors · {roomList.length} rooms
          </div>
          <Legend />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <motion.div
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--vacant-text)" }}
            />
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--vacant-text)" }}>WS CONNECTED</span>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <FilterBar active={filter} onSelect={setFilter} rooms={rooms} />

        {/* ── Grid ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {FLOORS.map(floor => {
            const floorRooms = roomList.filter(r => r.floor === floor);
            return (
              <motion.div
                key={floor}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (floor - FLOORS[0]) * 0.07 }}
                style={{ marginBottom: 24 }}
              >
                <FloorLabel floor={floor} rooms={floorRooms} />
                <div className="room-grid" style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
                  gap: 8,
                }}>
                  {floorRooms.map(room => (
                    <div
                      key={room.number}
                      onMouseEnter={e => handleMouseEnter(room, e)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <RoomCard
                        room={rooms[room.number]}
                        isSelected={selectedRoom?.number === room.number}
                        highlight={filter === "all" ? undefined : filteredNums.has(room.number) ? true : false}
                        onClick={() => handleCardClick(rooms[room.number])}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── WS Event log ── */}
        <EventLog events={wsEvents} />

        {/* ── Tooltip ── */}
        {tooltip.room && <Tooltip room={tooltip.room} pos={tooltip.pos} />}

        {/* ── Detail panel ── */}
        <AnimatePresence>
          {liveSelected && (
            <DetailPanel
              key="detail"
              room={liveSelected}
              onClose={() => setSelectedRoom(null)}
              onStatusChange={handleStatusChange}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
