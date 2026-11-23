import {kalas,localYMD,hm,KEYS,NAMES} from './kala.js';
import {newVapid,sendPush} from './webpush.js';
import {SCRIPT_T} from './scripts.js';
const Lx=(k,sc)=>(sc&&sc!=='en'&&SCRIPT_T[k])?SCRIPT_T[k][sc]:k;
const scOf=u=>{try{return JSON.parse(u.prefs||'{}').script||'en'}catch{return 'en'}};
const ORIGIN='https://mahesh-iitm.github.io';
const MIN=6e4,DAY=864e5;
const cors={'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'};
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json',...cors}});
const okId=id=>/^[a-f0-9-]{36}$/.test(id||'');
const KL={uttama:'Uttama',madhyama:'Madhyama',adhama:'Adhama'};

async function vapid(env){const r=await env.DB.prepare("SELECT v FROM kv WHERE k='vapid'").first();if(r)return JSON.parse(r.v);
 const v=await newVapid();await env.DB.prepare("INSERT OR IGNORE INTO kv(k,v) VALUES('vapid',?)").bind(JSON.stringify(v)).run();
 return JSON.parse((await env.DB.prepare("SELECT v FROM kv WHERE k='vapid'").first()).v)}

// all alert events for local day offset (0=today)
function dayEvents(u,offset,now=Date.now()){const [y,m,d]=localYMD(now,u.tz);const dt=new Date(Date.UTC(y,m,d)+offset*DAY);
 const K=kalas(dt.getUTCFullYear(),dt.getUTCMonth(),dt.getUTCDate(),u.lat,u.lng,u.el);if(!K)return [];
 const p=JSON.parse(u.prefs||'{}'),on=p.n||[1,1,1],lead=+p.lead||0,ds=dt.toISOString().slice(0,10);
 return KEYS.map((k,i)=>({k,i,ds,on:!!on[i],K:K[k],at:K[k].start-lead*MIN}))}
function body(u,K,k){const ord=k==='madhyahnika'?['madhyama','uttama','adhama']:['uttama','madhyama','adhama'];
 const sc=scOf(u);return ord.map(x=>`${Lx(KL[x],sc)} ${hm(K[x][0],u.tz)} – ${hm(K[x][1],u.tz)}`).join('\n')}
function nextAlert(u,after){for(let o=0;o<3;o++)for(const e of dayEvents(u,o,after))if(e.on&&e.at>after)return e;return null}

async function upsert(env,b){const id=b.id;if(!okId(id))return json({error:'bad id'},400);
 const lat=+b.lat,lng=+b.lng;if(!(Math.abs(lat)<=90&&Math.abs(lng)<=180))return json({error:'bad location'},400);
 const u={id,lat:Math.round(lat*1e3)/1e3,lng:Math.round(lng*1e3)/1e3,el:Math.max(0,Math.min(6000,+b.el||0)),place:String(b.place||'').slice(0,60),tz:String(b.tz||'UTC').slice(0,64),
  prefs:JSON.stringify({n:(b.prefs?.n||[1,1,1]).map(x=>x?1:0),lead:[0,5,10,15].includes(+b.prefs?.lead)?+b.prefs.lead:0,script:['en','sa','te','ta'].includes(b.prefs?.script)?b.prefs.script:'en'})};
 try{new Intl.DateTimeFormat('en',{timeZone:u.tz})}catch{u.tz='UTC'}
 const old=await env.DB.prepare('SELECT sub FROM users WHERE id=?').bind(id).first();
 const sub=b.sub===undefined?(old?.sub??null):(b.sub?JSON.stringify(b.sub):null);
 const nx=sub?nextAlert(u,Date.now()):null;
 await env.DB.prepare(`INSERT INTO users(id,lat,lng,el,place,tz,prefs,sub,next_at,next_k,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,el=excluded.el,place=excluded.place,tz=excluded.tz,prefs=excluded.prefs,sub=excluded.sub,next_at=excluded.next_at,next_k=excluded.next_k,updated=excluded.updated`)
  .bind(id,u.lat,u.lng,u.el,u.place,u.tz,u.prefs,sub,nx?.at??null,nx?`${nx.ds}:${nx.k}`:null,Date.now()).run();
 return json({ok:true,push:!!sub,next:nx?.at??null})}

function ics(u,origin){const z=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d+/,''),now=z(Date.now()),esc=s=>s.replace(/[\\,;]/g,m=>'\\'+m).replace(/\n/g,'\\n');
 const p=JSON.parse(u.prefs||'{}'),lead=+p.lead||0;
 const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sandhya Kala//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Sandhyā Kāla','X-WR-CALDESC:Sandhyāvandanam times for '+esc(u.place||'your location'),'REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H'];
 for(let o=-1;o<=30;o++)for(const e of dayEvents(u,o)){if(!e.on)continue;
  L.push('BEGIN:VEVENT',`UID:${e.ds}-${e.k}@sandhya-kala`,`DTSTAMP:${now}`,`DTSTART:${z(e.K.start)}`,`DTEND:${z(e.K.end)}`,`SUMMARY:${NAMES[e.k]}`,
   `DESCRIPTION:${esc(body(u,e.K,e.k)+'\n\n'+origin+'/Sandhya/')}`,`LOCATION:${esc(u.place||'')}`,'TRANSP:TRANSPARENT',
   'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${NAMES[e.k]}`,`TRIGGER:-PT${lead}M`,'END:VALARM','END:VEVENT')}
 L.push('END:VCALENDAR');const te=new TextEncoder();
 const fold=l=>{const out=[];let cur='',n=0;for(const ch of l){const b=te.encode(ch).length;if(n+b>73){out.push(cur);cur=' ';n=1}cur+=ch;n+=b}out.push(cur);return out.join('\r\n')};
 return L.map(fold).join('\r\n')+'\r\n'}

async function tick(env){const now=Date.now();
 const due=(await env.DB.prepare('SELECT * FROM users WHERE sub IS NOT NULL AND next_at IS NOT NULL AND next_at<=? ORDER BY next_at LIMIT 900').bind(now+20e3).all()).results;
 if(!due.length)return;const v=await vapid(env);
 const stmts=await Promise.all(due.map(async u=>{const [ds,k]=(u.next_k||':').split(':');let res=null;
  if(now-u.next_at<30*MIN){const e=dayEvents(u,0,u.next_at+1).concat(dayEvents(u,1,u.next_at+1)).find(x=>x.ds===ds&&x.k===k);
   if(e){const payload=JSON.stringify({title:Lx(NAMES[k],scOf(u)),body:body(u,e.K,k),tag:`${ds}-${k}`,url:'/Sandhya/'});
    try{res=await sendPush(JSON.parse(u.sub),payload,v)}catch(err){res=null}}}
  if(res&&(res.status===404||res.status===410))return env.DB.prepare('UPDATE users SET sub=NULL,next_at=NULL,next_k=NULL WHERE id=?').bind(u.id);
  const nx=nextAlert(u,Math.max(u.next_at,now-60e3)+1000);
  return env.DB.prepare('UPDATE users SET next_at=?,next_k=?,last_push=?,last_status=? WHERE id=?').bind(nx?.at??null,nx?`${nx.ds}:${nx.k}`:null,now,res?res.status:null,u.id)}));
 for(let i=0;i<stmts.length;i+=100)await env.DB.batch(stmts.slice(i,i+100))}

export default {
 async fetch(req,env){const url=new URL(req.url),p=url.pathname,o=req.headers.get('Origin')||'';
  cors['Access-Control-Allow-Origin']=/^http:\/\/localhost:\d+$/.test(o)?o:ORIGIN;
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(p==='/vapid')return json({key:(await vapid(env)).pub});
  if(p==='/user'&&req.method==='POST'){let b;try{b=await req.json()}catch{return json({error:'bad json'},400)}return upsert(env,b)}
  let m=p.match(/^\/user\/([a-f0-9-]{36})$/);
  if(m&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM users WHERE id=?').bind(m[1]).run();return json({ok:true})}
  if(m&&req.method==='GET'){const u=await env.DB.prepare('SELECT id,place,next_at,last_push,last_status,sub IS NOT NULL AS push FROM users WHERE id=?').bind(m[1]).first();return u?json(u):json({error:'not found'},404)}
  m=p.match(/^\/log\/([a-f0-9-]{36})$/);
  if(m&&req.method==='GET'){const r=await env.DB.prepare('SELECT data,updated FROM logs WHERE id=?').bind(m[1]).first();return json(r?{log:JSON.parse(r.data),updated:r.updated}:{log:{},updated:0})}
  if(m&&req.method==='POST'){const t=await req.text();if(t.length>300000)return json({error:'too large'},413);let b;try{b=JSON.parse(t)}catch{return json({error:'bad json'},400)}
   const L=b&&b.log;if(!L||typeof L!=='object'||Array.isArray(L))return json({error:'bad log'},400);
   const clean={};for(const [d,v] of Object.entries(L)){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||typeof v!=='object')continue;const o={};
    for(const k of ['pratah','madhyahnika','sayam'])if(v[k]&&typeof v[k].t==='string'&&typeof v[k].kala==='string')o[k]={t:v[k].t.slice(0,30),kala:v[k].kala.slice(0,15)};
    if(Object.keys(o).length)clean[d]=o}
   const now=Date.now();await env.DB.prepare('INSERT INTO logs(id,data,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(m[1],JSON.stringify(clean),now).run();
   return json({ok:true,days:Object.keys(clean).length,updated:now})}
  m=p.match(/^\/cal\/([a-f0-9-]{36})\.ics$/);
  if(m){const u=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(m[1]).first();if(!u)return new Response('Not found',{status:404});
   return new Response(ics(u,ORIGIN),{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'max-age=300','Content-Disposition':'inline; filename="sandhya.ics"'}})}
  if(p==='/')return new Response('Sandhyā Kāla server is running.',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
  return new Response('Not found',{status:404})},
 async scheduled(ev,env,ctx){ctx.waitUntil(tick(env))}
};
