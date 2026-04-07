<<<<<<< HEAD
﻿import { useState, useEffect, useRef } from "react";
import HotelMap from "./HotelMap";
import AgentFeed from "./AgentFeed";
import Homepage from "./Homepage";

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  :root {
    --bg0: #090b0f; --bg1: #0e1117; --bg2: #141820; --bg3: #1c2230; --bg4: #232b3a;
    --border: rgba(255,255,255,0.07); --border-hi: rgba(255,255,255,0.13);
    --amber: #f5a623; --amber-dim: #a06a10; --amber-glow: rgba(245,166,35,0.12);
    --teal: #2dd4bf; --teal-dim: rgba(45,212,191,0.15);
    --red: #f87171; --red-dim: rgba(248,113,113,0.15);
    --green: #4ade80; --green-dim: rgba(74,222,128,0.12);
    --blue: #60a5fa; --blue-dim: rgba(96,165,250,0.12);
    --purple: #a78bfa;
    --text1: #e8eaf0; --text2: #8892a4; --text3: #4e5a6e;
    --mono: 'Space Mono', monospace; --sans: 'DM Sans', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .hos-root {
    font-family: var(--sans); background: var(--bg0); color: var(--text1);
    height: 100vh; display: grid;
    grid-template-columns: 56px 1fr 280px;
    grid-template-rows: 44px 1fr;
    overflow: hidden; font-size: 13px; line-height: 1.5;
  }

  /* TOPBAR */
  .hos-topbar {
    grid-column: 1 / -1; background: var(--bg1);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 16px 0 0; gap: 12px;
  }
  .hos-logo {
    width: 56px; height: 44px; display: flex; align-items: center;
    justify-content: center; border-right: 1px solid var(--border); flex-shrink: 0;
  }
  .hos-logo-mark {
    width: 22px; height: 22px; background: var(--amber);
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  }
  .hos-title {
    font-family: var(--mono); font-size: 12px; font-weight: 700;
    letter-spacing: 0.12em; color: var(--amber); text-transform: uppercase;
    padding: 0 12px; border-right: 1px solid var(--border);
  }
  .hos-indicators { display: flex; align-items: center; gap: 16px; margin-left: 8px; }
  .hos-ind { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text2); font-family: var(--mono); }
  .hos-sep { width: 1px; height: 20px; background: var(--border); }
  .hos-dot {
    width: 6px; height: 6px; border-radius: 50%;
    animation: pulse-dot 2s ease-in-out infinite;
  }
  .hos-dot.green  { background: var(--green); }
  .hos-dot.amber  { background: var(--amber); animation-delay: 0.5s; }
  .hos-dot.red    { background: var(--red);   animation-delay: 1s; }
  .hos-dot.blue   { background: var(--blue);  animation-delay: 0.3s; }
  @keyframes pulse-dot {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.5; transform:scale(0.8); }
  }
  .hos-clock { margin-left: auto; font-family: var(--mono); font-size: 12px; color: var(--amber); letter-spacing: 0.08em; }
  .hos-badge {
    background: var(--amber-glow); border: 1px solid var(--amber-dim);
    color: var(--amber); font-family: var(--mono); font-size: 10px;
    padding: 2px 8px; border-radius: 3px; letter-spacing: 0.1em;
  }

  /* SIDEBAR */
  .hos-sidebar {
    background: var(--bg1); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; align-items: center; padding: 10px 0; gap: 4px;
  }
  .hos-nav-btn {
    width: 40px; height: 40px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s, color 0.15s;
    color: var(--text3); font-size: 16px; border: none; background: transparent; position: relative;
  }
  .hos-nav-btn:hover { background: var(--bg3); color: var(--text1); }
  .hos-nav-btn.active { background: var(--amber-glow); color: var(--amber); }
  .hos-nav-btn.active::before {
    content: ''; position: absolute; left: 0; top: 25%; bottom: 25%;
    width: 2px; background: var(--amber); border-radius: 0 2px 2px 0; margin-left: -1px;
  }
  .hos-nav-spacer { flex: 1; }

  /* MAIN */
  .hos-main { display: flex; flex-direction: column; background: var(--bg1); overflow: hidden; }
  .hos-metrics {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 1px; background: var(--border); border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .hos-metric { background: var(--bg2); padding: 10px 14px; }
  .hos-metric-label { font-size: 10px; font-family: var(--mono); color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 3px; }
  .hos-metric-value { font-size: 20px; font-family: var(--mono); font-weight: 700; color: var(--text1); line-height: 1; }
  .hos-metric-sub { font-size: 10px; margin-top: 2px; }

  /* FEED */
  .hos-feed-header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .hos-feed-title { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text2); }
  .hos-filter-pill {
    font-family: var(--mono); font-size: 10px; padding: 2px 8px; border-radius: 3px; cursor: pointer; border: none; transition: opacity 0.15s;
  }
  .hos-filter-pill:hover { opacity: 0.75; }
  .hos-feed-live { display: flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 10px; color: var(--green); margin-left: auto; }
  .live-ring { width: 8px; height: 8px; border-radius: 50%; background: var(--green); position: relative; }
  .live-ring::after {
    content: ''; position: absolute; inset: -3px; border-radius: 50%;
    border: 1px solid var(--green); animation: ring-pulse 2s ease-out infinite; opacity: 0;
  }
  @keyframes ring-pulse {
    0%   { opacity:0.8; transform:scale(0.8); }
    100% { opacity:0;   transform:scale(1.6); }
  }
  .hos-feed { flex: 1; overflow-y: auto; padding: 8px 0; scrollbar-width: thin; scrollbar-color: var(--bg4) transparent; }
  .hos-feed::-webkit-scrollbar { width: 4px; }
  .hos-feed::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }

  .hos-event {
    display: flex; gap: 10px; padding: 7px 14px;
    border-left: 2px solid transparent; transition: background 0.2s; cursor: default;
    animation: slide-in 0.35s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes slide-in {
    from { opacity:0; transform:translateX(-12px); }
    to   { opacity:1; transform:translateX(0); }
  }
  .hos-event:hover        { background: var(--bg2); }
  .hos-event.thought      { border-left-color: var(--purple); }
  .hos-event.action       { border-left-color: var(--amber); }
  .hos-event.alert        { border-left-color: var(--red); }
  .hos-event.success      { border-left-color: var(--green); }
  .hos-event.info         { border-left-color: var(--blue); }

  .hos-event-icon {
    width: 22px; height: 22px; border-radius: 5px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 11px; margin-top: 1px;
  }
  .hos-event-icon.thought { background: rgba(167,139,250,0.15); color: var(--purple); }
  .hos-event-icon.action  { background: var(--amber-glow);       color: var(--amber); }
  .hos-event-icon.alert   { background: var(--red-dim);          color: var(--red); }
  .hos-event-icon.success { background: var(--green-dim);        color: var(--green); }
  .hos-event-icon.info    { background: var(--blue-dim);         color: var(--blue); }

  .hos-event-body { flex: 1; min-width: 0; }
  .hos-event-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
  .hos-event-time { font-size: 10px; color: var(--text3); font-family: var(--mono); margin-left: auto; }
  .hos-event-text { font-size: 12px; color: var(--text2); line-height: 1.45; }
  .hos-event-tag  { display: inline-block; font-size: 10px; font-family: var(--mono); padding: 1px 6px; border-radius: 3px; margin-left: 6px; vertical-align: middle; }
  .tag-room  { background: var(--teal-dim); color: var(--teal); }
  .tag-guest { background: var(--blue-dim); color: var(--blue); }

  /* RIGHT PANEL */
  .hos-right {
    background: var(--bg2); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .hos-panel-header {
    padding: 10px 14px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  }
  .hos-panel-title { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text2); }
  .hos-rooms-scroll { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--bg4) transparent; }
  .hos-rooms-scroll::-webkit-scrollbar { width: 4px; }
  .hos-rooms-scroll::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
  .hos-section-label { font-family: var(--mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text3); padding: 10px 14px 5px; }

  /* ROOM GRID */
  .hos-room-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; padding: 0 10px 10px; }
  .hos-room {
    aspect-ratio: 1; border-radius: 5px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; cursor: pointer;
    transition: transform 0.15s; position: relative;
    font-family: var(--mono); font-size: 10px; font-weight: 700;
  }
  .hos-room:hover { transform: scale(1.08); z-index: 2; }
  .hos-room.vacant      { background: var(--bg3); color: var(--text3); border: 1px solid var(--border); }
  .hos-room.occupied    { background: #1a2535; color: var(--blue);  border: 1px solid rgba(96,165,250,0.25); }
  .hos-room.checkout    { background: #251a12; color: var(--amber); border: 1px solid rgba(245,166,35,0.25); }
  .hos-room.maintenance { background: #1e1220; color: var(--red);   border: 1px solid rgba(248,113,113,0.2); }
  .hos-room.occupied::after, .hos-room.checkout::after, .hos-room.maintenance::after {
    content: ''; position: absolute; top: 4px; right: 4px; width: 4px; height: 4px; border-radius: 50%;
  }
  .hos-room.occupied::after    { background: var(--blue); }
  .hos-room.checkout::after    { background: var(--amber); }
  .hos-room.maintenance::after { background: var(--red); }

  /* GUEST CARDS */
  .hos-guests { padding: 0 10px 10px; display: flex; flex-direction: column; gap: 3px; }
  .hos-guest {
    background: var(--bg3); border-radius: 6px; padding: 7px 10px;
    display: flex; align-items: center; gap: 8px;
    border: 1px solid var(--border); transition: border-color 0.15s; cursor: pointer;
  }
  .hos-guest:hover { border-color: var(--border-hi); }
  .hos-guest-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; flex-shrink: 0;
  }
  .hos-guest-name { font-size: 12px; font-weight: 500; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hos-guest-room { font-size: 10px; font-family: var(--mono); color: var(--text3); }
  .hos-guest-status { font-size: 10px; font-family: var(--mono); padding: 2px 7px; border-radius: 3px; }

  /* AGENT CARDS */
  .hos-agents { padding: 0 10px 10px; display: flex; flex-direction: column; gap: 3px; }
  .hos-agent {
    background: var(--bg3); border-radius: 6px; padding: 7px 10px;
    display: flex; align-items: center; gap: 8px; border: 1px solid var(--border);
  }
  .hos-agent-icon { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
  .hos-agent-name { font-size: 11px; font-weight: 500; color: var(--text1); }
  .hos-agent-task { font-size: 10px; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hos-agent-dot  { width: 7px; height: 7px; border-radius: 50%; margin-left: auto; flex-shrink: 0; }
  .hos-agent-dot.busy  { background: var(--amber); box-shadow: 0 0 6px var(--amber); animation: pulse-dot 1.5s ease-in-out infinite; }
  .hos-agent-dot.idle  { background: var(--text3); }
  .hos-agent-dot.alert { background: var(--red); animation: pulse-dot 1s ease-in-out infinite; }
`;

// ── DATA ───────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { id: "map", label: "Map", icon: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  )},
  { id: "agents", label: "Agents", icon: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )},
  { id: "events", label: "Events", icon: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )},
  { id: "controls", label: "Controls", icon: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  )},
];

const ROOM_STATES = [
  "occupied","occupied","checkout","occupied","vacant","maintenance",
  "occupied","occupied","vacant","occupied","occupied","checkout",
  "occupied","vacant","occupied","occupied",
];

const GUESTS = [
  { name: "James Harrington", room: "204", status: "checked-in", initials: "JH", accentBg: "var(--blue-dim)", accentColor: "var(--blue)", statusBg: "#1a2535" },
  { name: "Amara Diallo",     room: "208", status: "VIP",        initials: "AD", accentBg: "var(--teal-dim)", accentColor: "var(--teal)", statusBg: "#1a2020" },
  { name: "Chen Wei",         room: "211", status: "checkout",   initials: "CW", accentBg: "var(--amber-glow)", accentColor: "var(--amber)", statusBg: "#251a12" },
  { name: "Sofia Rossi",      room: "203", status: "checked-in", initials: "SR", accentBg: "var(--blue-dim)", accentColor: "var(--blue)", statusBg: "#1a2535" },
];

const AGENTS = [
  { name: "Concierge AI",    task: "Handling room upgrade request",  emoji: "🤖", bg: "rgba(96,165,250,0.12)",   status: "busy" },
  { name: "Housekeeping AI", task: "Scheduling 6 cleanings",         emoji: "🧹", bg: "rgba(74,222,128,0.10)",   status: "busy" },
  { name: "Revenue AI",      task: "Idle — analysis complete",       emoji: "📊", bg: "rgba(245,166,35,0.10)",   status: "idle" },
  { name: "Maintenance AI",  task: "ALERT: Room 206 AC fault",       emoji: "⚙️", bg: "rgba(248,113,113,0.12)",  status: "alert" },
  { name: "F&B AI",          task: "Processing dinner orders",        emoji: "🍽️", bg: "rgba(167,139,250,0.10)", status: "busy" },
];

const BASE_FEED = [
  { type:"alert",   icon:"!", agent:"Maintenance AI",  agentColor:"var(--red)",    text:"AC unit failure detected in Room 206. Temperature threshold exceeded. Dispatching technician.",                           tag:"206",       tagClass:"tag-room",  ts:"14s ago" },
  { type:"thought", icon:"◆", agent:"Revenue AI",      agentColor:"var(--purple)", text:"Analyzing occupancy patterns. Weekend demand 23% above average — considering rate adjustment for Fri–Sun.",              ts:"41s ago" },
  { type:"action",  icon:"→", agent:"Concierge AI",    agentColor:"var(--amber)",  text:"Guest Amara Diallo (VIP) requested suite upgrade. Checking availability on floors 5–7.",                                 tag:"Amara D.",  tagClass:"tag-guest", ts:"1m ago" },
  { type:"success", icon:"✓", agent:"Housekeeping AI", agentColor:"var(--green)",  text:"Rooms 201, 207, 212 marked clean and ready for check-in. Linens restocked.",                                              tag:"3 rooms",   tagClass:"tag-room",  ts:"2m ago" },
  { type:"info",    icon:"i", agent:"F&B AI",           agentColor:"var(--blue)",   text:"Room service orders 18% higher than Tuesday baseline. Kitchen load balancing initiated.",                                 ts:"3m ago" },
  { type:"thought", icon:"◆", agent:"Concierge AI",    agentColor:"var(--purple)", text:"Room 507 available and matches guest preferences: high floor, city view, king bed. Preparing upgrade offer.",             tag:"507",       tagClass:"tag-room",  ts:"4m ago" },
  { type:"action",  icon:"→", agent:"Maintenance AI",  agentColor:"var(--amber)",  text:"Preventive check scheduled for elevator B. Routine 90-day maintenance cycle triggered.",                                  ts:"6m ago" },
  { type:"success", icon:"✓", agent:"Revenue AI",      agentColor:"var(--green)",  text:"Dynamic pricing applied. Rates for Fri–Sun increased by $22 avg. Projected uplift: +$1,840.",                            ts:"8m ago" },
  { type:"alert",   icon:"!", agent:"Housekeeping AI", agentColor:"var(--red)",    text:"Room 211 checkout overdue by 40 min. Guest Chen Wei has not vacated. Sending courtesy notice.",                           tag:"211",       tagClass:"tag-room",  ts:"10m ago" },
  { type:"info",    icon:"i", agent:"Concierge AI",    agentColor:"var(--blue)",   text:"3 new reservations confirmed for tonight. Pre-arrival preferences collected for all guests.",                             ts:"13m ago" },
];

const LIVE_EVENTS = [
  { type:"action",  icon:"→", agent:"Concierge AI",    agentColor:"var(--amber)",  text:"Upgrade offer sent to Amara Diallo. Suite 507 at +$80/night. Awaiting guest confirmation.", tag:"507", tagClass:"tag-room",  ts:"now" },
  { type:"thought", icon:"◆", agent:"Maintenance AI",  agentColor:"var(--purple)", text:"Reviewing sensor history for Room 206 AC. Last fault logged 47 days ago — possible compressor issue.", tag:"206", tagClass:"tag-room", ts:"now" },
  { type:"success", icon:"✓", agent:"Housekeeping AI", agentColor:"var(--green)",  text:"Technician dispatched to Room 206. ETA 8 minutes. Guest notified via in-room tablet.", ts:"now" },
  { type:"info",    icon:"i", agent:"F&B AI",           agentColor:"var(--blue)",   text:"Bar closing in 25 min. Automated last-orders notification sent to all occupied rooms.", ts:"now" },
];

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────
function TopBar({ clock }) {
  return (
    <div className="hos-topbar">
      <div className="hos-logo"><div className="hos-logo-mark" /></div>
      <div className="hos-title">HotelOS</div>
      <div className="hos-indicators">
        <span className="hos-ind"><span className="hos-dot green" />AGENTS ONLINE</span>
        <div className="hos-sep" />
        <span className="hos-ind"><span className="hos-dot amber" />2 ALERTS</span>
        <div className="hos-sep" />
        <span className="hos-ind"><span className="hos-dot blue" />NETWORK OK</span>
        <div className="hos-sep" />
        <span className="hos-ind"><span className="hos-dot green" />PMS SYNC</span>
      </div>
      <span className="hos-badge" style={{ marginLeft: 8 }}>v2.4.1</span>
      <div className="hos-clock">{clock}</div>
    </div>
  );
}

function Sidebar({ active, onSelect }) {
  return (
    <div className="hos-sidebar">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`hos-nav-btn${active === item.id ? " active" : ""}`}
          title={item.label}
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
        </button>
      ))}
      <div className="hos-nav-spacer" />
      <button className="hos-nav-btn" title="Settings">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
=======
import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
>>>>>>> feature/homepage-routing
    </div>
  );
}

<<<<<<< HEAD
function MetricCard({ label, value, sub, valueStyle, subStyle }) {
  return (
    <div className="hos-metric">
      <div className="hos-metric-label">{label}</div>
      <div className="hos-metric-value" style={valueStyle}>{value}</div>
      <div className="hos-metric-sub" style={subStyle}>{sub}</div>
    </div>
  );
}

function FilterPill({ label, bg, color, onClick }) {
  return (
    <button className="hos-filter-pill" style={{ background: bg, color }} onClick={onClick}>
      {label}
    </button>
  );
}

function FeedEvent({ event, index }) {
  return (
    <div
      className={`hos-event ${event.type}`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className={`hos-event-icon ${event.type}`}>{event.icon}</div>
      <div className="hos-event-body">
        <div className="hos-event-meta">
          <span
            className="hos-event-agent"
            style={{ fontFamily: "var(--mono)", color: event.agentColor }}
          >
            {event.agent}
          </span>
          {event.tag && (
            <span className={`hos-event-tag ${event.tagClass}`}>{event.tag}</span>
          )}
          <span className="hos-event-time">{event.ts}</span>
        </div>
        <div className="hos-event-text">{event.text}</div>
      </div>
    </div>
  );
}

function ActivityFeed({ events, filter, onFilter }) {
  const feedRef = useRef(null);

  const filtered = filter ? events.filter(e => e.type === filter) : events;

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [events]);

  return (
    <div className="hos-main">
      <div className="hos-metrics">
        <MetricCard
          label="Occupancy"
          value={<>78<span style={{ fontSize: 13, color: "var(--text2)" }}>%</span></>}
          sub="↑ 3% vs yesterday"
          valueStyle={{ color: "var(--teal)" }}
          subStyle={{ color: "var(--green)" }}
        />
        <MetricCard
          label="Revenue / Night"
          value={<>$14,820</>}
          sub="ADR $189"
          valueStyle={{ color: "var(--amber)" }}
          subStyle={{ color: "var(--text2)" }}
        />
        <MetricCard
          label="Active Agents"
          value={<>5<span style={{ fontSize: 13, color: "var(--text2)" }}>/6</span></>}
          sub="1 resolving alert"
          valueStyle={{}}
          subStyle={{ color: "var(--amber)" }}
        />
        <MetricCard
          label="Pending Tasks"
          value={events.filter(e => e.type === "alert" || e.type === "action").length}
          sub="3 high priority"
          valueStyle={{ color: "var(--red)" }}
          subStyle={{ color: "var(--text2)" }}
        />
      </div>

      <div className="hos-feed-header">
        <svg width="14" height="14" fill="none" stroke="var(--amber)" strokeWidth="1.5" viewBox="0 0 24 24">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span className="hos-feed-title">Agent Activity Feed</span>
        <div style={{ marginLeft: 8, display: "flex", gap: 6 }}>
          <FilterPill label="ALL"      bg={!filter ? "var(--bg4)" : "transparent"} color="var(--text2)" onClick={() => onFilter(null)} />
          <FilterPill label="THOUGHTS" bg="rgba(167,139,250,0.12)" color="var(--purple)" onClick={() => onFilter("thought")} />
          <FilterPill label="ACTIONS"  bg="var(--amber-glow)"      color="var(--amber)"  onClick={() => onFilter("action")} />
          <FilterPill label="ALERTS"   bg="var(--red-dim)"          color="var(--red)"    onClick={() => onFilter("alert")} />
        </div>
        <div className="hos-feed-live">
          <div className="live-ring" />
          LIVE
        </div>
      </div>

      <div className="hos-feed" ref={feedRef}>
        {filtered.map((event, i) => (
          <FeedEvent key={`${event.ts}-${i}`} event={event} index={i} />
        ))}
      </div>
    </div>
  );
}

function RoomGrid({ rooms }) {
  return (
    <div className="hos-room-grid">
      {rooms.map((state, i) => (
        <div key={i} className={`hos-room ${state}`}>
          {201 + i}
        </div>
      ))}
    </div>
  );
}

function GuestCard({ guest }) {
  return (
    <div className="hos-guest">
      <div
        className="hos-guest-avatar"
        style={{ background: guest.accentBg, color: guest.accentColor }}
      >
        {guest.initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="hos-guest-name">{guest.name}</div>
        <div className="hos-guest-room">Room {guest.room}</div>
      </div>
      <span
        className="hos-guest-status"
        style={{ background: guest.statusBg, color: guest.accentColor }}
      >
        {guest.status}
      </span>
    </div>
  );
}

function AgentCard({ agent }) {
  return (
    <div className="hos-agent">
      <div className="hos-agent-icon" style={{ background: agent.bg }}>
        {agent.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="hos-agent-name">{agent.name}</div>
        <div className="hos-agent-task">{agent.task}</div>
      </div>
      <div className={`hos-agent-dot ${agent.status}`} />
    </div>
  );
}

function RightPanel() {
  return (
    <div className="hos-right">
      <div className="hos-panel-header">
        <svg width="12" height="12" fill="none" stroke="var(--amber)" strokeWidth="1.5" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        <span className="hos-panel-title">Hotel State</span>
      </div>
      <div className="hos-rooms-scroll">
        <div className="hos-section-label">Rooms — Floor 2</div>
        <RoomGrid rooms={ROOM_STATES} />
        <div className="hos-section-label">Active Guests</div>
        <div className="hos-guests">
          {GUESTS.map((g, i) => <GuestCard key={i} guest={g} />)}
        </div>
        <div className="hos-section-label">Agent Status</div>
        <div className="hos-agents">
          {AGENTS.map((a, i) => <AgentCard key={i} agent={a} />)}
        </div>
      </div>
    </div>
  );
}

// ── ROOT COMPONENT ─────────────────────────────────────────────────────────
export default function HotelOS() {
  const [showHomepage, setShowHomepage] = useState(true);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [clock, setClock] = useState("");
  const [feedEvents, setFeedEvents] = useState(BASE_FEED);
  const [filter, setFilter] = useState(null);
  const liveIdxRef = useRef(0);

  // Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(
        String(n.getHours()).padStart(2,"0") + ":" +
        String(n.getMinutes()).padStart(2,"0") + ":" +
        String(n.getSeconds()).padStart(2,"0")
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Live feed injection
  useEffect(() => {
    const id = setInterval(() => {
      const next = LIVE_EVENTS[liveIdxRef.current % LIVE_EVENTS.length];
      liveIdxRef.current++;
      setFeedEvents(prev => [{ ...next, ts: "now" }, ...prev.slice(0, 9)]);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{css}</style>
      {showHomepage ? (
        <Homepage onLaunch={() => setShowHomepage(false)} />
      ) : (
        <div className="hos-root">
          <TopBar clock={clock} />
          <Sidebar active={activeNav} onSelect={setActiveNav} />
          {activeNav === "map" ? (
            <div className="hos-main">
              <HotelMap embedded />
            </div>
          ) : activeNav === "agents" ? (
            <div className="hos-main">
              <AgentFeed />
            </div>
          ) : (
            <ActivityFeed events={feedEvents} filter={filter} onFilter={setFilter} />
          )}
          <RightPanel />
        </div>
      )}
    </>
  );
}
=======
export default App;
>>>>>>> feature/homepage-routing
