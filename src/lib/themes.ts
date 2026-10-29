export type ThemeId =
  | "ember" | "cryo" | "toxic" | "sakura" | "sunset" | "void" | "phosphor" | "paper" | "royal"
  | "abyss" | "bloodmoon" | "ambercrt" | "matcha" | "bubblegum" | "obsidian" | "arctic";

export interface Theme {
  id: ThemeId;
  name: string;
  blurb: string;
  light?: boolean;
  vars: Record<string, string>;
  shader: string;
}

const dark = (o: Partial<Record<string, string>>): Record<string, string> => ({
  "--bg": "#07080c",
  "--panel": "#101219",
  "--panel-2": "#171a23",
  "--line": "rgba(255,255,255,0.09)",
  "--line-2": "rgba(255,255,255,0.17)",
  "--txt": "#eef0f6",
  "--dim": "rgba(238,240,246,0.56)",
  "--faint": "rgba(238,240,246,0.3)",
  "--ok": "#9ef01a",
  "--warn": "#ffd166",
  "--bad": "#ff4d6d",
  ...o,
});

const light = (o: Partial<Record<string, string>>): Record<string, string> => ({
  "--bg": "#eceef3",
  "--panel": "#ffffff",
  "--panel-2": "#f3f4f8",
  "--line": "rgba(10,12,20,0.12)",
  "--line-2": "rgba(10,12,20,0.22)",
  "--txt": "#12141c",
  "--dim": "rgba(18,20,28,0.62)",
  "--faint": "rgba(18,20,28,0.38)",
  "--ok": "#1a9e4b",
  "--warn": "#c98a00",
  "--bad": "#d92d4f",
  ...o,
});

export const THEMES: Theme[] = [
  {
    id: "ember", name: "Ember", blurb: "Graphite · amber · ice", shader: "blackhole",
    vars: dark({ "--accent": "#ff9f45", "--accent-2": "#6ee7ff", "--panel": "#101219", "--panel-2": "#191c26" }),
  },
  {
    id: "cryo", name: "Cryo", blurb: "Deep navy · glacier", shader: "aurora",
    vars: dark({ "--bg": "#050a14", "--panel": "#0b1424", "--panel-2": "#122036", "--accent": "#6ee7ff", "--accent-2": "#a5b4fc" }),
  },
  {
    id: "toxic", name: "Toxic", blurb: "Bio-lab · lime · teal", shader: "cells",
    vars: dark({ "--bg": "#050a07", "--panel": "#0b1410", "--panel-2": "#12211a", "--accent": "#9ef01a", "--accent-2": "#2dd4bf" }),
  },
  {
    id: "sakura", name: "Sakura", blurb: "Plum · blossom · kawaii", shader: "nebula",
    vars: dark({ "--bg": "#0d0710", "--panel": "#180f1e", "--panel-2": "#241630", "--accent": "#ff8fc4", "--accent-2": "#c4b5fd" }),
  },
  {
    id: "sunset", name: "Sunset", blurb: "Maroon · coral · gold", shader: "grid",
    vars: dark({ "--bg": "#0f0608", "--panel": "#1c0d11", "--panel-2": "#2a141a", "--accent": "#ff6b6b", "--accent-2": "#ffd166" }),
  },
  {
    id: "void", name: "Void", blurb: "Monochrome · steel", shader: "warp",
    vars: dark({ "--bg": "#000000", "--panel": "#0c0c0e", "--panel-2": "#161619", "--accent": "#f4f4f5", "--accent-2": "#a1a1aa" }),
  },
  {
    id: "phosphor", name: "Phosphor", blurb: "CRT terminal green", shader: "matrix",
    vars: dark({ "--bg": "#000600", "--panel": "#031004", "--panel-2": "#06190a", "--accent": "#39ff88", "--accent-2": "#b6ff3d", "--txt": "#d8ffe6", "--dim": "rgba(216,255,230,0.55)", "--faint": "rgba(216,255,230,0.3)" }),
  },
  {
    id: "royal", name: "Royal", blurb: "Indigo · gold leaf", shader: "fractal",
    vars: dark({ "--bg": "#07061a", "--panel": "#111031", "--panel-2": "#1a1846", "--accent": "#ffd166", "--accent-2": "#8b7bff" }),
  },
  {
    id: "abyss", name: "Abyss", blurb: "Deep sea · bioluminescence", shader: "ocean",
    vars: dark({ "--bg": "#02070d", "--panel": "#07131f", "--panel-2": "#0d1e2f", "--accent": "#2ee6c5", "--accent-2": "#4d9fff", "--txt": "#e2f6ff", "--dim": "rgba(226,246,255,0.56)", "--faint": "rgba(226,246,255,0.3)" }),
  },
  {
    id: "bloodmoon", name: "Bloodmoon", blurb: "Crimson eclipse · ash", shader: "storm",
    vars: dark({ "--bg": "#0a0304", "--panel": "#170709", "--panel-2": "#230d11", "--accent": "#ff3b5c", "--accent-2": "#ff9f45", "--txt": "#ffe9ec", "--dim": "rgba(255,233,236,0.56)", "--faint": "rgba(255,233,236,0.3)" }),
  },
  {
    id: "ambercrt", name: "Amber CRT", blurb: "1979 monochrome monitor", shader: "circuit",
    vars: dark({ "--bg": "#080500", "--panel": "#140d02", "--panel-2": "#1e1405", "--accent": "#ffb000", "--accent-2": "#ff7a00", "--txt": "#ffe4b0", "--dim": "rgba(255,228,176,0.58)", "--faint": "rgba(255,228,176,0.32)" }),
  },
  {
    id: "obsidian", name: "Obsidian", blurb: "Black glass · platinum", shader: "ribbons",
    vars: dark({ "--bg": "#030305", "--panel": "#0b0b10", "--panel-2": "#14141b", "--accent": "#e8d9a0", "--accent-2": "#8fa3b8", "--line": "rgba(255,255,255,0.07)" }),
  },
  {
    id: "paper", name: "Paper", blurb: "Daylight · ink · cobalt", light: true, shader: "fireflies",
    vars: light({ "--accent": "#e0620d", "--accent-2": "#1d6ff2" }),
  },
  {
    id: "matcha", name: "Matcha", blurb: "Soft daylight · moss", light: true, shader: "cells",
    vars: light({ "--bg": "#eef2e9", "--panel": "#fbfdf8", "--panel-2": "#f1f5ec", "--accent": "#4a7c30", "--accent-2": "#0f7d78" }),
  },
  {
    id: "bubblegum", name: "Bubblegum", blurb: "Daylight pop · grape", light: true, shader: "plasma",
    vars: light({ "--bg": "#fdeef6", "--panel": "#fffbfd", "--panel-2": "#fbe9f3", "--accent": "#d61f7c", "--accent-2": "#6d3bd6" }),
  },
  {
    id: "arctic", name: "Arctic", blurb: "Frost white · steel blue", light: true, shader: "snowfall",
    vars: light({ "--bg": "#eef3f8", "--panel": "#ffffff", "--panel-2": "#f2f6fb", "--accent": "#0b6ea8", "--accent-2": "#0f8f8f" }),
  },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) || THEMES[0];

export const SHADERS = [
  { id: "blackhole", name: "Event Horizon", desc: "Lensed accretion disk" },
  { id: "nebula", name: "Nebula", desc: "Volumetric gas clouds" },
  { id: "aurora", name: "Aurora", desc: "Polar light curtains" },
  { id: "matrix", name: "Digital Rain", desc: "Falling glyph columns" },
  { id: "warp", name: "Warp Tunnel", desc: "Hyperspace starfield" },
  { id: "plasma", name: "Plasma", desc: "Classic demo-scene waves" },
  { id: "grid", name: "Synth Grid", desc: "Retro horizon + sun" },
  { id: "ocean", name: "Caustics", desc: "Refracted light water" },
  { id: "cells", name: "Voronoi", desc: "Living organic cells" },
  { id: "fractal", name: "Kaleido", desc: "Morphing julia fractal" },
  { id: "ribbons", name: "Silk", desc: "Flowing interference bands" },
  { id: "storm", name: "Ion Storm", desc: "Electric lightning field" },
  { id: "fireflies", name: "Fireflies", desc: "Drifting warm motes" },
  { id: "hexfield", name: "Hex Field", desc: "Pulsing hex lattice" },
  { id: "lava", name: "Magma", desc: "Molten crust flow" },
  { id: "snowfall", name: "Snowfall", desc: "Layered depth flurries" },
  { id: "vortex", name: "Galaxy", desc: "Spiral arm star cluster" },
  { id: "circuit", name: "Circuitry", desc: "Data traces & pulses" },
] as const;

export type ShaderId = (typeof SHADERS)[number]["id"];

export const CLOAKS = [
  { id: "none", name: "Off", title: "SINGULARITY OS", icon: "" },
  { id: "classroom", name: "Classroom", title: "Home - Classroom", icon: "https://ssl.gstatic.com/classroom/favicon.png" },
  { id: "docs", name: "Docs", title: "Untitled document - Google Docs", icon: "https://ssl.gstatic.com/docs/documents/images/kix-favicon-2023q4.ico" },
  { id: "drive", name: "Drive", title: "My Drive - Google Drive", icon: "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" },
  { id: "slides", name: "Slides", title: "Untitled presentation - Google Slides", icon: "https://ssl.gstatic.com/docs/presentations/images/favicon5.ico" },
  { id: "sheets", name: "Sheets", title: "Untitled spreadsheet - Google Sheets", icon: "https://ssl.gstatic.com/sheets/favicon.ico" },
  { id: "gmail", name: "Gmail", title: "Inbox - Gmail", icon: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico" },
  { id: "desmos", name: "Desmos", title: "Desmos | Graphing Calculator", icon: "https://www.desmos.com/favicon.ico" },
  { id: "wiki", name: "Wikipedia", title: "Wikipedia, the free encyclopedia", icon: "https://en.wikipedia.org/static/favicon/wikipedia.ico" },
  { id: "canvas", name: "Canvas", title: "Dashboard", icon: "https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico" },
  { id: "schoology", name: "Schoology", title: "Home | Schoology", icon: "https://app.schoology.com/sites/all/themes/schoology_theme/favicon.ico" },
  { id: "khan", name: "Khan Academy", title: "Khan Academy", icon: "https://cdn.kastatic.org/images/favicon.ico" },
  { id: "ixl", name: "IXL", title: "IXL | Math, Language Arts, Science, Social Studies, and Spanish", icon: "https://www.ixl.com/favicon.ico" },
  { id: "quizlet", name: "Quizlet", title: "Flashcards, learning tools and textbook solutions | Quizlet", icon: "https://assets.quizlet.com/cdn-cgi/image/width=48/assets/2iJf-favicon.ico" },
  { id: "newtab", name: "New Tab", title: "New Tab", icon: "" },
] as const;

export type CloakId = (typeof CLOAKS)[number]["id"];
