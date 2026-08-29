export interface BodyInfo {
  id: string;
  name: string;
  type: string;
  radiusKm: number;
  dayLength: string;
  yearLength: string;
  distAU: number;
  temp: string;
  moons: number;
  blurb: string;
  accent: string;
}

export interface BodySceneParams {
  id: string;
  radius: number; // scene units
  orbitR: number; // scene units
  periodY: number; // orbital period in Earth years
  inclination: number; // degrees
  axialTilt: number; // degrees
  rotSpeed: number; // rad/s at 1x time scale
  phase: number; // initial orbital angle
  kind: "rocky" | "earth" | "gas" | "sun";
}

export const SUN_INFO: BodyInfo = {
  id: "sun",
  name: "SUN",
  type: "G2V MAIN-SEQUENCE STAR",
  radiusKm: 696340,
  dayLength: "25.4 d (equator)",
  yearLength: "—",
  distAU: 0,
  temp: "5 772 K surface",
  moons: 0,
  blurb:
    "The gravitational anchor of the system. Its core fuses ~600 million tons of hydrogen every second, driving the weather of every world you will survey.",
  accent: "#f5a942",
};

export const PLANETS: { scene: BodySceneParams; info: BodyInfo }[] = [
  {
    scene: { id: "mercury", radius: 0.55, orbitR: 19, periodY: 0.24, inclination: 7.0, axialTilt: 0.03, rotSpeed: 0.12, phase: 0.8, kind: "rocky" },
    info: {
      id: "mercury", name: "MERCURY", type: "TERRESTRIAL WORLD", radiusKm: 2440,
      dayLength: "58.6 d", yearLength: "88 d", distAU: 0.39, temp: "−173 / 427 °C", moons: 0,
      blurb: "A scorched iron relic, cratered like the Moon. One solar day here outlasts its entire year.",
      accent: "#b0a496",
    },
  },
  {
    scene: { id: "venus", radius: 0.95, orbitR: 24, periodY: 0.615, inclination: 3.39, axialTilt: 177.4, rotSpeed: -0.05, phase: 2.4, kind: "gas" },
    info: {
      id: "venus", name: "VENUS", type: "TERRESTRIAL · GREENHOUSE", radiusKm: 6052,
      dayLength: "243 d (retro)", yearLength: "225 d", distAU: 0.72, temp: "464 °C mean", moons: 0,
      blurb: "Crushing CO₂ atmosphere, sulfuric acid clouds, surface hot enough to melt lead. Spins backwards, twice a day longer than its year.",
      accent: "#e8cda2",
    },
  },
  {
    scene: { id: "earth", radius: 1.0, orbitR: 28, periodY: 1.0, inclination: 0.0, axialTilt: 23.4, rotSpeed: 0.6, phase: 4.4, kind: "earth" },
    info: {
      id: "earth", name: "EARTH", type: "TERRESTRIAL · HOME PORT", radiusKm: 6371,
      dayLength: "23.9 h", yearLength: "365.25 d", distAU: 1.0, temp: "15 °C mean", moons: 1,
      blurb: "The only confirmed harbor of life. Oceans cover 71% of the surface; city lights trace the night side.",
      accent: "#6fd3ff",
    },
  },
  {
    scene: { id: "mars", radius: 0.7, orbitR: 33, periodY: 1.88, inclination: 1.85, axialTilt: 25.2, rotSpeed: 0.58, phase: 1.7, kind: "rocky" },
    info: {
      id: "mars", name: "MARS", type: "TERRESTRIAL · DESERT", radiusKm: 3390,
      dayLength: "24.6 h", yearLength: "687 d", distAU: 1.52, temp: "−63 °C mean", moons: 2,
      blurb: "Rust-stained plains, the tallest volcano in the system (Olympus Mons) and polar CO₂ ice caps that breathe with the seasons.",
      accent: "#e0754a",
    },
  },
  {
    scene: { id: "jupiter", radius: 3.1, orbitR: 52, periodY: 11.86, inclination: 1.3, axialTilt: 3.1, rotSpeed: 1.35, phase: 5.6, kind: "gas" },
    info: {
      id: "jupiter", name: "JUPITER", type: "GAS GIANT", radiusKm: 69911,
      dayLength: "9.9 h", yearLength: "11.9 y", distAU: 5.2, temp: "−108 °C cloud-top", moons: 95,
      blurb: "Two and a half times the mass of all other planets combined. The Great Red Spot is a storm wider than Earth, raging for centuries.",
      accent: "#d9b98a",
    },
  },
  {
    scene: { id: "saturn", radius: 2.6, orbitR: 70, periodY: 29.4, inclination: 2.49, axialTilt: 26.7, rotSpeed: 1.25, phase: 3.1, kind: "gas" },
    info: {
      id: "saturn", name: "SATURN", type: "GAS GIANT · RINGED", radiusKm: 58232,
      dayLength: "10.7 h", yearLength: "29.4 y", distAU: 9.5, temp: "−139 °C cloud-top", moons: 146,
      blurb: "Its rings span 280 000 km yet average only ~10 metres thick — countless shards of water ice shepherded by moonlets.",
      accent: "#e8dcb8",
    },
  },
  {
    scene: { id: "uranus", radius: 1.6, orbitR: 92, periodY: 84.0, inclination: 0.77, axialTilt: 97.8, rotSpeed: -0.9, phase: 0.4, kind: "gas" },
    info: {
      id: "uranus", name: "URANUS", type: "ICE GIANT", radiusKm: 25362,
      dayLength: "17.2 h (retro)", yearLength: "84 y", distAU: 19.2, temp: "−197 °C", moons: 28,
      blurb: "Knocked onto its side long ago, it rolls around the Sun — each pole gets 42 years of daylight, then 42 of night.",
      accent: "#9fd6d9",
    },
  },
  {
    scene: { id: "neptune", radius: 1.55, orbitR: 112, periodY: 164.8, inclination: 1.77, axialTilt: 28.3, rotSpeed: 0.95, phase: 5.0, kind: "gas" },
    info: {
      id: "neptune", name: "NEPTUNE", type: "ICE GIANT", radiusKm: 24622,
      dayLength: "16.1 h", yearLength: "164.8 y", distAU: 30.1, temp: "−201 °C", moons: 16,
      blurb: "The windiest world known — supersonic gusts near 2 100 km/h tear across its methane-blue cloud decks.",
      accent: "#7fa8e8",
    },
  },
];

export const MOON_INFO: BodyInfo = {
  id: "moon",
  name: "LUNA",
  type: "NATURAL SATELLITE · EARTH",
  radiusKm: 1737,
  dayLength: "27.3 d (locked)",
  yearLength: "27.3 d",
  distAU: 1.0,
  temp: "−173 / 127 °C",
  moons: 0,
  blurb: "Earth's ancient companion, carved by impacts. Its tidal pull steadies Earth's axial tilt — and its climate.",
  accent: "#c8ccd2",
};

export const ALL_INFO: Record<string, BodyInfo> = {
  sun: SUN_INFO,
  moon: MOON_INFO,
  ...Object.fromEntries(PLANETS.map((p) => [p.info.id, p.info])),
};
