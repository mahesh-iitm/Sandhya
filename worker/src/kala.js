// Sun times (SunCalc formulas, as used by sandhyakala.sringeri.net) and kala divisions.
const PI=Math.PI,rad=PI/180,dayMs=864e5,J1970=2440588,J2000=2451545,e=rad*23.4397,J0=0.0009;
const toDays=d=>d/dayMs-0.5+J1970-J2000, fromJ=j=>Math.round((j+0.5-J1970)*dayMs/1000)*1000;
const Mf=d=>rad*(357.5291+0.98560028*d);
const Lf=m=>m+rad*(1.9148*Math.sin(m)+0.02*Math.sin(2*m)+0.0003*Math.sin(3*m))+rad*102.9372+PI;
const transit=(ds,m,l)=>J2000+ds+0.0053*Math.sin(m)-0.0069*Math.sin(2*l);
const approx=(Ht,lw,n)=>J0+(Ht+lw)/(2*PI)+n;
export function sunTimes(ms,lat,lng,h=0){const lw=rad*-lng,phi=rad*lat,d=toDays(ms),n=Math.round(d-J0-lw/(2*PI)),ds=approx(0,lw,n),m=Mf(ds),l=Lf(m),dc=Math.asin(Math.sin(e)*Math.sin(l)),Jn=transit(ds,m,l);
 const dh=-2.076*Math.sqrt(Math.max(0,h))/60;
 const at=deg=>{const c=(Math.sin((deg+dh)*rad)-Math.sin(phi)*Math.sin(dc))/(Math.cos(phi)*Math.cos(dc));if(c<-1||c>1)return [null,null];const Js=transit(approx(Math.acos(c),lw,n),m,l);return [fromJ(Jn-(Js-Jn)),fromJ(Js)]};
 const [rise,set]=at(-0.833),[dawn]=at(-6),[,nd]=at(-12);return {noon:fromJ(Jn),rise,set,dawn,nd}}
const MIN=6e4;
export const KEYS=['pratah','madhyahnika','sayam'];
export const NAMES={pratah:'Prātaḥ Sandhyā',madhyahnika:'Mādhyāhnika',sayam:'Sāyaṁ Sandhyā'};
// y,m(0-11),d = local calendar date at the user's place
export function kalas(y,mo,d,lat,lng,el){const ms=Date.UTC(y,mo,d,12)-lng/15*36e5;const x=sunTimes(ms,lat,lng,el);if(!x.rise||!x.set)return null;
 const r=x.rise,n=x.noon,s=x.set,pe=s+180*MIN,dawn=x.dawn??r,nd=x.nd??s+72*MIN,mm0=((n-48*MIN)-(r+264*MIN))/MIN>=24?r+264*MIN:n-96*MIN;
 const K={pratah:{uttama:[r-48*MIN,dawn],madhyama:[dawn,r],adhama:[r,r+72*MIN],prayaschitta:[r+72*MIN,pe]},
  madhyahnika:{uttama:[n-48*MIN,n],madhyama:[mm0,n-48*MIN],adhama:[n,n+72*MIN],prayaschitta:[n+72*MIN,pe]},
  sayam:{uttama:[s-48*MIN,s],madhyama:[s,nd],adhama:[nd,s+72*MIN],prayaschitta:[s+72*MIN,pe]}};
 for(const k of KEYS){const v=K[k];v.start=Math.min(v.uttama[0],v.madhyama[0]);v.end=v.adhama[1]}return K}
// local Y/M/D for a timestamp in a time zone
export function localYMD(ms,tz){const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));const g=t=>+p.find(x=>x.type===t).value;return [g('year'),g('month')-1,g('day')]}
export function hm(ms,tz){return new Date(ms).toLocaleTimeString('en-IN',{timeZone:tz||'UTC',hour:'2-digit',minute:'2-digit',hour12:true}).replace(/\s?(am|pm)/i,m=>' '+m.trim().toUpperCase())}
