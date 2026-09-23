// Pre-built widgets for mock mode (auth demo). In live mode, Opus generates widgets
// from the learning agent's spec instead (SPEC D16).
import { BASE_CSS, WIDGET_PALETTE as P } from "./base";

const doc = (title: string, body: string, script: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${BASE_CSS}</style></head><body>${body}<script>${script}</script></body></html>`;

const JWT_LAB = doc(
  "JWT tamper lab",
  `<h1>JWT tamper lab</h1>
<p class="sub">Runs the same checks as Claude's <span class="mono">verifyToken()</span>: HS256 signature with <span class="mono">JWT_SECRET</span>, pinned algorithm, and <span class="mono">exp</span>.</p>
<div class="panel"><div class="label">Who makes the token?</div>
<div class="seg" id="mode">
<label><input type="radio" name="m" value="server" checked><span>Server (has the secret)</span></label>
<label><input type="radio" name="m" value="edit"><span>Attacker edits payload</span></label>
<label><input type="radio" name="m" value="none"><span>Attacker sets alg: none</span></label>
</div></div>
<div class="panel"><div class="label">Payload</div>
<div class="row"><span class="muted" style="width:70px">email</span><input type="text" id="email" value="alice@acme.com" style="flex:1"></div>
<div class="row"><span class="muted" style="width:70px">role</span><select id="role"><option>user</option><option>admin</option></select></div>
<div class="row"><span class="muted" style="width:70px">expires</span><input type="range" id="exp" min="-30" max="15" value="15"><span id="expl" class="mono" style="width:90px"></span></div>
</div>
<div class="panel"><div class="label">Token</div><div id="tok" class="mono"></div>
<div class="label" style="margin-top:8px">Decoded payload <span class="muted" style="text-transform:none">(anyone can read this; it's base64, not encrypted)</span></div><div id="dec" class="mono muted"></div></div>
<div class="panel"><div class="label">verifyToken() says</div><div id="checks"></div><div id="verdict" class="verdict"></div></div>`,
  `
const SECRET="acme-notes-demo-secret";
const enc=new TextEncoder();
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
const b64uStr=s=>b64u(enc.encode(s));
let keyP;
async function hmac(data){
  if(!crypto.subtle) return "sig-unavailable";
  keyP=keyP||crypto.subtle.importKey("raw",enc.encode(SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64u(await crypto.subtle.sign("HMAC",await keyP,enc.encode(data)));
}
const now=()=>Math.floor(Date.now()/1000);
let original;
async function render(){
  const mode=document.querySelector("input[name=m]:checked").value;
  const mins=+document.getElementById("exp").value;
  document.getElementById("expl").textContent=(mins>=0?"in ":"")+Math.abs(mins)+" min"+(mins<0?" ago":"");
  const payload={sub:"u_1024",email:document.getElementById("email").value,role:document.getElementById("role").value,iat:now()-60,exp:now()+mins*60};
  if(!original){const h=b64uStr(JSON.stringify({alg:"HS256"}));const p=b64uStr(JSON.stringify({sub:"u_1024",email:"alice@acme.com",role:"user",iat:now()-60,exp:now()+900}));original=h+"."+p+"."+await hmac(h+"."+p);}
  const header={alg:mode==="none"?"none":"HS256"};
  const h=b64uStr(JSON.stringify(header)),p=b64uStr(JSON.stringify(payload));
  let sig;
  if(mode==="server") sig=await hmac(h+"."+p);
  else if(mode==="edit") sig=original.split(".")[2];
  else sig="";
  document.getElementById("tok").innerHTML='<span style="color:#f0a3c4">'+h+'</span>.<span style="color:${P.accent}">'+p+'</span>.<span style="color:${P.ok}">'+(sig||"&lt;empty&gt;")+'</span>';
  document.getElementById("dec").textContent=JSON.stringify(payload);
  const algOk=header.alg==="HS256";
  const sigOk=algOk&&sig===await hmac(h+"."+p);
  const expOk=payload.exp>now();
  const c=(ok,t,why)=>'<div class="check"><span class="'+(ok?"ok":"bad")+'">'+(ok?"✓":"✗")+'</span><span>'+t+' <span class="muted">'+why+'</span></span></div>';
  document.getElementById("checks").innerHTML=
    c(algOk,"Algorithm is HS256","(algorithms: [\\"HS256\\"] rejects alg:none)")+
    c(sigOk,"Signature matches",algOk?"(recomputed with JWT_SECRET)":"(not checked)")+
    c(expOk,"Not expired","(exp is "+(expOk?"in the future":"in the past")+")");
  const ok=algOk&&sigOk&&expOk;
  const v=document.getElementById("verdict");
  v.className="verdict "+(ok?"ok":"bad");
  v.textContent=ok?"Accepted: middleware lets the request through":"Rejected: middleware returns 401 / redirects to /login";
}
document.querySelectorAll("input,select").forEach(e=>e.addEventListener("input",render));
render();`,
);

const BCRYPT_LAB = doc(
  "bcrypt cost explorer",
  `<h1>bcrypt cost explorer</h1>
<p class="sub">Claude used <span class="mono">bcrypt.hash(password, 12)</span>. Move the cost factor and compare with a fast hash like SHA-256. <span class="muted">(Illustrative numbers.)</span></p>
<div class="panel"><div class="label">Cost factor</div>
<div class="row"><input type="range" id="cost" min="4" max="16" value="12"><span id="costl" class="mono" style="width:24px"></span></div>
<div class="row muted">Each login on your server takes about <b id="login" class="warn"></b></div></div>
<div class="panel"><div class="label">Attacker has your stolen hashes and a GPU rig</div>
<div class="row"><span class="muted">Password type</span><select id="space">
<option value="10000000">One of the 10M most common passwords</option>
<option value="208827064576" selected>8 random lowercase letters</option>
<option value="839299365868340224">10 random letters + digits</option></select></div>
<div id="bars" style="margin-top:8px"></div></div>`,
  `
const fmt=s=>{if(s<1)return (s*1000).toFixed(0)+" ms";if(s<120)return s.toFixed(1)+" s";if(s<7200)return (s/60).toFixed(0)+" min";if(s<172800)return (s/3600).toFixed(1)+" h";if(s<3.15e7*2)return (s/86400).toFixed(0)+" days";return (s/3.15e7).toExponential(1).replace("e+"," × 10^")+" years"};
function render(){
  const cost=+document.getElementById("cost").value;
  document.getElementById("costl").textContent=cost;
  const perHash=0.25*Math.pow(2,cost-12); // seconds on one server core
  document.getElementById("login").textContent=fmt(perHash);
  const space=+document.getElementById("space").value;
  const rig=10000; // attacker parallelism vs one server core
  const bcryptRate=rig/perHash, shaRate=1e10;
  const t1=space/2/shaRate, t2=space/2/bcryptRate;
  const max=Math.log10(Math.max(t1,t2,10))+1;
  const bar=(label,t,color)=>'<div style="margin:6px 0"><div class="row" style="justify-content:space-between"><span>'+label+'</span><span class="mono">'+fmt(t)+'</span></div><div style="height:8px;background:#1a1a19;border-radius:4px"><div style="height:8px;border-radius:4px;background:'+color+';width:'+Math.max(2,Math.log10(Math.max(t,1)+1)/max*100)+'%"></div></div></div>';
  document.getElementById("bars").innerHTML=bar("sha256(password): ~10 billion guesses/s",t1,"${P.bad}")+bar("bcrypt cost "+cost+": ~"+Math.round(bcryptRate).toLocaleString()+" guesses/s",t2,"${P.ok}")+'<div class="muted" style="font-size:12px;margin-top:6px">Average time to crack one password (log scale). Each +1 cost doubles both the attacker\\'s work and your login time.</div>';
}
document.querySelectorAll("input,select").forEach(e=>e.addEventListener("input",render));
render();`,
);

const STORAGE_LAB = doc(
  "Token storage & XSS",
  `<h1>Where should the token live?</h1>
<p class="sub">Claude's login route sets <span class="mono">session</span> as an <span class="mono">httpOnly, SameSite=Lax</span> cookie. Try an attack against each option.</p>
<div class="panel"><div class="label">Storage</div><div class="seg">
<label><input type="radio" name="s" value="ls"><span>localStorage</span></label>
<label><input type="radio" name="s" value="cookie"><span>cookie (readable)</span></label>
<label><input type="radio" name="s" value="httponly" checked><span>httpOnly cookie (Claude's choice)</span></label></div></div>
<div class="panel"><div class="label">Attacks</div><div class="row">
<button id="xss">Inject a script (XSS)</button><button id="csrf">evil.com posts to /api/notes (CSRF)</button></div>
<div id="log" class="mono" style="margin-top:8px;min-height:60px"></div></div>`,
  `
const tok="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1XzEwMjQifQ.x9f…";
const log=h=>document.getElementById("log").innerHTML=h;
const mode=()=>document.querySelector("input[name=s]:checked").value;
document.getElementById("xss").onclick=()=>{
  const m=mode();
  if(m==="ls") log('&gt; localStorage.getItem("token")<br><span class="bad">"'+tok+'"</span><br><span class="bad">✗ Token stolen: attacker can use it from anywhere until it expires.</span>');
  else if(m==="cookie") log('&gt; document.cookie<br><span class="bad">"session='+tok+'"</span><br><span class="bad">✗ Token stolen: a cookie without httpOnly is readable by scripts.</span>');
  else log('&gt; document.cookie<br><span class="ok">""</span><br><span class="ok">✓ Token not readable by page scripts.</span><br><span class="warn">⚠ The script can still act as the user while the page is open. httpOnly limits theft, not all XSS damage.</span>');
};
document.getElementById("csrf").onclick=()=>{
  const m=mode();
  if(m==="ls") log('POST /api/notes from evil.com<br><span class="ok">✓ No token attached: localStorage isn\\'t sent automatically.</span><br><span class="muted">(But localStorage lost the XSS test.)</span>');
  else log('POST /api/notes from evil.com<br><span class="ok">✓ Cookie not sent: SameSite=Lax blocks cookies on cross-site POSTs.</span><br><span class="muted">Without SameSite, the browser would attach the session cookie and the request would succeed.</span>');
};
document.querySelectorAll("input").forEach(e=>e.addEventListener("input",()=>log('<span class="muted">Pick an attack.</span>')));
log('<span class="muted">Pick an attack.</span>');`,
);

export const MOCK_WIDGETS: Record<string, { title: string; spec: string; html: string }> = {
  jwt: { title: "JWT tamper lab", spec: "jwt", html: JWT_LAB },
  "password-hashing": { title: "bcrypt cost explorer", spec: "password-hashing", html: BCRYPT_LAB },
  "token-storage": { title: "Where should the token live?", spec: "token-storage", html: STORAGE_LAB },
};
