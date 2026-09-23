// Hardening + auto-resize for widget HTML rendered in a sandboxed iframe
// (sandbox="allow-scripts", no same-origin). The CSP blocks all network access.

const BASE_STYLE = `<style>html,body{height:auto!important;min-height:0!important}</style>`;

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:">`;

const BRIDGE = `<script>(function(){
  var last=0,engaged=false;
  function post(m){try{parent.postMessage(m,"*")}catch(e){}}
  // Measure the body's content box, not documentElement.scrollHeight (which never
  // shrinks below the iframe's own height and would feed back into itself).
  function size(){var b=document.body;if(!b)return;var cs=getComputedStyle(b);var h=Math.ceil(b.getBoundingClientRect().height+parseFloat(cs.marginTop)+parseFloat(cs.marginBottom));if(Math.abs(h-last)>1){last=h;post({__widget:true,type:"resize",height:h})}}
  function start(){new ResizeObserver(size).observe(document.body);size()}
  if(document.body)start();else document.addEventListener("DOMContentLoaded",start);window.addEventListener("load",size);
  ["input","click","change"].forEach(function(t){document.addEventListener(t,function(){if(!engaged){engaged=true;post({__widget:true,type:"engaged"})}},true)});
})();</script>`;

export function frameWidgetHtml(html: string): string {
  let out = html.trim();
  if (!/<html[\s>]/i.test(out)) out = `<!doctype html><html><head><meta charset="utf-8"></head><body>${out}</body></html>`;
  out = /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => `${m}${CSP}${BASE_STYLE}`) : out.replace(/<html[^>]*>/i, (m) => `${m}<head>${CSP}${BASE_STYLE}</head>`);
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${BRIDGE}</body>`) : `${out}${BRIDGE}`;
  return out;
}

/** Strip markdown fences / prose around a generated HTML document. */
export function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/<!doctype html|<html[\s>]/i);
  return start > 0 ? body.slice(start) : body;
}
