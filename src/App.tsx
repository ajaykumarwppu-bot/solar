import { useEffect, useRef, useState } from "react";
import { SolarSystem } from "./scene/SolarSystem";
import type { FlightMode, CameraRig, Telemetry } from "./scene/SolarSystem";
import { PLANETS } from "./scene/bodies";
import type { BodyInfo } from "./scene/bodies";
import { audio } from "./audio";

const CHIP_LIST: { id: string; label: string }[] = [
  { id: "sun", label: "SOL" },
  ...PLANETS.map((p) => ({ id: p.info.id, label: p.info.name.slice(0, 2) })),
  { id: "moon", label: "LU" },
];

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="4.2" fill="#f5a942" />
      <circle cx="16" cy="16" r="6.5" stroke="#f5a942" strokeOpacity="0.35" strokeWidth="1" />
      <ellipse cx="16" cy="16" rx="13.5" ry="5.5" stroke="#5fe0c4" strokeOpacity="0.8" strokeWidth="1.1" transform="rotate(-18 16 16)" />
      <circle cx="26.4" cy="10.6" r="1.6" fill="#5fe0c4" />
    </svg>
  );
}

function ShipGlyph() {
  return (
    <svg width="110" height="64" viewBox="0 0 110 64" fill="none" aria-hidden>
      <path d="M55 4 L62 30 L88 46 L62 42 L60 58 L55 50 L50 58 L48 42 L22 46 L48 30 Z" fill="#d7dde3" />
      <path d="M55 10 L58 30 L55 44 L52 30 Z" fill="#262d36" />
      <circle cx="55" cy="26" r="3" fill="#0d4a44" stroke="#5fe0c4" strokeWidth="1" />
      <path d="M50 58 L55 50 L60 58" stroke="#f5a942" strokeWidth="2" />
    </svg>
  );
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SolarSystem | null>(null);
  const [launched, setLaunched] = useState(false);
  const [mode, setMode] = useState<FlightMode>("flight");
  const [rig, setRig] = useState<CameraRig>("chase");
  const [timeScale, setTimeScale] = useState(1);
  const [muted, setMuted] = useState(false);
  const [sel, setSel] = useState<BodyInfo | null>(null);
  const [tel, setTel] = useState<Telemetry | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const sys = new SolarSystem(mountRef.current, {
      onTelemetry: setTel,
      onSelect: setSel,
    });
    sceneRef.current = sys;
    return () => {
      sys.dispose();
      sceneRef.current = null;
    };
  }, []);

  const blip = (f = 720) => audio.blip(f, 0.06, 0.045);

  const launch = () => {
    audio.init();
    audio.blip(880, 0.16, 0.07);
    setTimeout(() => audio.blip(1320, 0.14, 0.06), 140);
    setLaunched(true);
  };

  const changeMode = (m: FlightMode) => {
    sceneRef.current?.setMode(m);
    setMode(m);
    blip(m === "flight" ? 760 : 560);
  };
  const changeRig = (r: CameraRig) => {
    sceneRef.current?.setRig(r);
    setRig(r);
    blip(r === "cockpit" ? 900 : 640);
  };
  const changeTime = (v: number) => {
    setTimeScale(v);
    sceneRef.current?.setTimeScale(v);
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    audio.setMuted(m);
    if (!m) blip(820);
  };
  const pick = (id: string) => {
    sceneRef.current?.selectBody(id);
    blip(860);
  };
  const track = () => {
    if (!sel) return;
    sceneRef.current?.focusBody(sel.id);
    sceneRef.current?.setMode("orbit");
    setMode("orbit");
    blip(1040);
  };

  const fmtM = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} Gm` : `${v.toFixed(1)} M km`);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#04070d] text-[#dbe6f0]">
      {/* 3D viewport */}
      <div ref={mountRef} className="absolute inset-0" />
      <div className="vignette pointer-events-none absolute inset-0 z-10" />
      <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-60" />

      {/* crosshair */}
      {launched && mode === "flight" && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 opacity-70">
          <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
            <circle cx="23" cy="23" r="1.6" fill="#5fe0c4" />
            <path d="M23 6v8M23 32v8M6 23h8M32 23h8" stroke="#5fe0c4" strokeOpacity="0.75" strokeWidth="1.2" />
            <circle cx="23" cy="23" r="16" stroke="#5fe0c4" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 5" />
          </svg>
        </div>
      )}

      {/* ============ TOP BAR ============ */}
      {launched && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4">
          {/* identity + nav chips */}
          <div className="pointer-events-auto flex flex-col gap-3">
            <div className="hud-panel flex items-center gap-3 px-4 py-2.5">
              <Logo />
              <div>
                <div className="font-display text-[15px] font-bold tracking-[0.28em] text-[#ffd489]">HELIOS-9</div>
                <div className="font-mono2 text-[9px] tracking-[0.3em] text-[#8b98a9]">SOLAR SURVEY · N=9 BODIES</div>
              </div>
            </div>
            <div className="flex max-w-[420px] flex-wrap gap-1.5">
              {CHIP_LIST.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(c.id)}
                  className={`hud-chip font-mono2 px-2.5 py-1 text-[10px] ${sel?.id === c.id ? "active" : "text-[#aebccb]"}`}
                  title={c.id.toUpperCase()}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* controls cluster */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="hud-panel flex items-center gap-2 px-3 py-2">
              <div className="flex gap-1">
                <button onClick={() => changeMode("flight")} className={`hud-chip font-mono2 px-3 py-1 text-[10px] ${mode === "flight" ? "active" : "text-[#aebccb]"}`}>
                  FLIGHT
                </button>
                <button onClick={() => changeMode("orbit")} className={`hud-chip font-mono2 px-3 py-1 text-[10px] ${mode === "orbit" ? "active" : "text-[#aebccb]"}`}>
                  ORBIT CAM
                </button>
              </div>
              {mode === "flight" && (
                <div className="flex gap-1 border-l border-[rgba(214,230,245,0.14)] pl-2">
                  <button onClick={() => changeRig("chase")} className={`hud-chip font-mono2 px-2.5 py-1 text-[10px] ${rig === "chase" ? "active" : "text-[#aebccb]"}`}>
                    CHASE
                  </button>
                  <button onClick={() => changeRig("cockpit")} className={`hud-chip font-mono2 px-2.5 py-1 text-[10px] ${rig === "cockpit" ? "active" : "text-[#aebccb]"}`}>
                    COCKPIT
                  </button>
                </div>
              )}
              <button
                onClick={() => { sceneRef.current?.resetShipPosition(); blip(500); }}
                className="hud-btn font-mono2 ml-1 px-2.5 py-1 text-[10px] text-[#aebccb]"
                title="Reset ship (R)"
              >
                ⟲ RESET
              </button>
              <button onClick={toggleMute} className="hud-btn font-mono2 px-2.5 py-1 text-[10px] text-[#aebccb]" title="Toggle audio">
                {muted ? "MUTED" : "AUDIO"}
              </button>
            </div>

            <div className="hud-panel flex items-center gap-3 px-3 py-2">
              <span className="font-mono2 text-[9px] tracking-[0.2em] text-[#8b98a9]">TIME WARP</span>
              <input
                type="range" min={0} max={12} step={0.1} value={timeScale}
                onChange={(e) => changeTime(parseFloat(e.target.value))}
                className="hud-range w-36"
              />
              <span className="font-mono2 w-20 text-right text-[10px] text-[#ffd489]">
                {timeScale === 0 ? "HOLD" : `${timeScale.toFixed(1)}× · ${(timeScale * 5.23).toFixed(0)}d/s`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============ TELEMETRY ============ */}
      {launched && tel && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20">
          <div className="hud-panel px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-6">
              <span className="font-mono2 text-[9px] tracking-[0.28em] text-[#8b98a9]">
                {mode === "flight" ? "FLIGHT TELEMETRY" : "ORBITAL OBSERVATION"}
              </span>
              {tel.boost && <span className="pulse-soft font-mono2 text-[9px] tracking-[0.2em] text-[#ffd489]">▲ AFTERBURNER</span>}
            </div>
            <div className="flex items-end gap-6">
              <div>
                <div className="font-display text-3xl font-bold leading-none text-[#f0f6fb]">
                  {mode === "flight" ? tel.speed.toFixed(1) : "—"}
                  <span className="ml-1 text-[11px] font-medium text-[#8b98a9]">km/s</span>
                </div>
                <div className="mt-2 h-[3px] w-40 bg-[rgba(214,230,245,0.12)]">
                  <div className="throttle-bar h-full" style={{ width: `${Math.round(tel.throttle * 100)}%` }} />
                </div>
                <div className="font-mono2 mt-1 text-[9px] tracking-[0.2em] text-[#8b98a9]">
                  THROTTLE {Math.round(tel.throttle * 100)}%
                </div>
              </div>
              <div className="font-mono2 grid grid-cols-1 gap-1 text-[10px] text-[#aebccb]">
                <div><span className="text-[#8b98a9]">RANGE·SOL&nbsp;&nbsp;</span><span className="text-[#ffd489]">{tel.distSunAU.toFixed(2)} AU</span></div>
                <div><span className="text-[#8b98a9]">NEAREST&nbsp;&nbsp;&nbsp;&nbsp;</span>{tel.nearestName} · {fmtM(tel.nearestDistM)}</div>
                <div><span className="text-[#8b98a9]">SIM RATE&nbsp;&nbsp;&nbsp;&nbsp;</span>{tel.simDaysPerSec.toFixed(1)} d/s</div>
                <div><span className="text-[#8b98a9]">RENDER&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>{Math.round(tel.fps)} FPS</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ BODY DOSSIER ============ */}
      {launched && sel && (
        <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-72">
          <div className="hud-panel px-4 py-3">
            <div className="mb-1 flex items-start justify-between">
              <div>
                <div className="font-display text-lg font-bold tracking-[0.18em]" style={{ color: sel.accent }}>
                  {sel.name}
                </div>
                <div className="font-mono2 text-[9px] tracking-[0.22em] text-[#8b98a9]">{sel.type}</div>
              </div>
              <button onClick={() => { sceneRef.current?.selectBody(null); blip(420); }} className="hud-btn font-mono2 px-2 py-0.5 text-[10px] text-[#aebccb]">
                ✕
              </button>
            </div>
            <div className="my-2 h-px" style={{ background: `linear-gradient(90deg, ${sel.accent}, transparent)` }} />
            <div className="font-mono2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[#aebccb]">
              <div><span className="text-[#8b98a9]">RADIUS </span>{sel.radiusKm.toLocaleString()} km</div>
              <div><span className="text-[#8b98a9]">ORBIT </span>{sel.distAU} AU</div>
              <div><span className="text-[#8b98a9]">DAY </span>{sel.dayLength}</div>
              <div><span className="text-[#8b98a9]">YEAR </span>{sel.yearLength}</div>
              <div><span className="text-[#8b98a9]">TEMP </span>{sel.temp}</div>
              <div><span className="text-[#8b98a9]">MOONS </span>{sel.moons}</div>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-[#c4d0dc]">{sel.blurb}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={track}
                className="font-mono2 flex-1 border border-[#f5a942] bg-[rgba(245,169,66,0.12)] px-3 py-1.5 text-[10px] tracking-[0.2em] text-[#ffd489] transition hover:bg-[rgba(245,169,66,0.25)]"
              >
                ◎ TRACK IN ORBIT CAM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ KEY HINTS ============ */}
      {launched && mode === "flight" && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 md:block">
          <div className="font-mono2 flex gap-4 text-[9px] tracking-[0.18em] text-[#6d7a8a]">
            <span><b className="text-[#aebccb]">DRAG</b> STEER</span>
            <span><b className="text-[#aebccb]">W/S</b> THROTTLE</span>
            <span><b className="text-[#aebccb]">SHIFT</b> BOOST</span>
            <span><b className="text-[#aebccb]">A/D</b> ROLL</span>
            <span><b className="text-[#aebccb]">SPACE</b> BRAKE</span>
            <span><b className="text-[#aebccb]">R</b> RESET</span>
            <span><b className="text-[#aebccb]">CLICK</b> SCAN BODY</span>
          </div>
        </div>
      )}

      {/* ============ LAUNCH OVERLAY ============ */}
      {!launched && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(3,5,10,0.72)] backdrop-blur-[3px]">
          <div className="relative flex max-w-xl flex-col items-center px-6 text-center">
            <div className="pointer-events-none absolute -inset-24 -z-10" style={{ background: "radial-gradient(circle, rgba(245,169,66,0.10), transparent 65%)" }} />
            <div className="launch-in launch-in-1"><ShipGlyph /></div>
            <div className="font-mono2 launch-in launch-in-1 mt-5 text-[10px] tracking-[0.5em] text-[#5fe0c4]">
              DEEP SYSTEM SURVEY · SOL-3 DEPARTURE
            </div>
            <h1 className="font-display launch-in launch-in-2 mt-3 text-5xl font-extrabold tracking-[0.14em] text-[#f4f8fc]">
              HELIOS<span className="text-[#f5a942]">-9</span>
            </h1>
            <p className="launch-in launch-in-3 mt-4 max-w-md text-[14px] leading-relaxed text-[#9fadbd]">
              A single-seat survey vessel holding station near Earth. Chart all nine bodies of the solar
              system — fly the ship yourself, or observe from orbit while time flows at your command.
            </p>
            <div className="font-mono2 launch-in launch-in-3 mt-6 grid grid-cols-2 gap-x-8 gap-y-1.5 text-left text-[10px] tracking-[0.14em] text-[#8b98a9] sm:grid-cols-3">
              <span><b className="text-[#dbe6f0]">DRAG</b> — steer</span>
              <span><b className="text-[#dbe6f0]">W / S</b> — throttle</span>
              <span><b className="text-[#dbe6f0]">SHIFT</b> — boost</span>
              <span><b className="text-[#dbe6f0]">SPACE</b> — brake</span>
              <span><b className="text-[#dbe6f0]">CLICK</b> — scan body</span>
              <span><b className="text-[#dbe6f0]">0–8</b> — jump select</span>
            </div>
            <button
              onClick={launch}
              className="font-display launch-in launch-in-4 group mt-8 border border-[#f5a942] bg-[rgba(245,169,66,0.14)] px-12 py-3.5 text-sm font-bold tracking-[0.4em] text-[#ffd489] transition-all hover:bg-[#f5a942] hover:text-[#0a0d12] hover:shadow-[0_0_40px_rgba(245,169,66,0.45)]"
            >
              INITIATE LAUNCH
            </button>
            <div className="font-mono2 launch-in launch-in-4 mt-4 text-[9px] tracking-[0.3em] text-[#6d7a8a]">
              AUDIO FEEDBACK ENGAGES ON LAUNCH
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
