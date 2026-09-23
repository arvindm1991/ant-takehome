// Shared look for demo widgets. Generated widgets are asked to follow the same palette.
export const WIDGET_PALETTE = {
  bg: "#262624",
  panel: "#1f1f1e",
  border: "#3a3936",
  text: "#ecebe6",
  muted: "#9c9a92",
  accent: "#9aa1fb",
  ok: "#6ee7b7",
  bad: "#f09a8a",
  warn: "#d9b458",
};

const p = WIDGET_PALETTE;

export const BASE_CSS = `
*{box-sizing:border-box}
body{margin:0;padding:14px;background:${p.bg};color:${p.text};font:13.5px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
h1{font-size:14px;margin:0 0 2px}
.sub{color:${p.muted};font-size:12px;margin:0 0 12px}
.panel{background:${p.panel};border:1px solid ${p.border};border-radius:10px;padding:10px 12px;margin:0 0 10px}
.label{color:${p.muted};font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0}
input[type=range]{flex:1;accent-color:${p.accent}}
input[type=text],select{background:${p.bg};color:${p.text};border:1px solid ${p.border};border-radius:6px;padding:4px 8px;font:inherit}
button,.seg label{background:${p.bg};color:${p.text};border:1px solid ${p.border};border-radius:7px;padding:4px 10px;font:inherit;cursor:pointer}
button:hover{border-color:${p.accent}}
.seg{display:flex;gap:6px;flex-wrap:wrap}
.seg input{display:none}
.seg input:checked+span{color:${p.accent}}
.seg label:has(input:checked){border-color:${p.accent};background:rgba(154,161,251,.12)}
.ok{color:${p.ok}}.bad{color:${p.bad}}.warn{color:${p.warn}}.muted{color:${p.muted}}
.check{display:flex;gap:8px;margin:3px 0}
.verdict{font-weight:600;margin-top:6px}
`;
