// Solar times using the SunCalc formulas (V. Agafonkin), as used by sandhyakala.sringeri.net
const SUN=(()=>{const PI=Math.PI,rad=PI/180,dayMs=864e5,J1970=2440588,J2000=2451545,e=rad*23.4397,J0=0.0009;
const toDays=d=>d.valueOf()/dayMs-0.5+J1970-J2000, fromJ=j=>new Date((j+0.5-J1970)*dayMs);
const M=d=>rad*(357.5291+0.98560028*d);
const L=m=>m+rad*(1.9148*Math.sin(m)+0.02*Math.sin(2*m)+0.0003*Math.sin(3*m))+rad*102.9372+PI;
const transit=(ds,m,l)=>J2000+ds+0.0053*Math.sin(m)-0.0069*Math.sin(2*l);
const approx=(Ht,lw,n)=>J0+(Ht+lw)/(2*PI)+n;
// date: local noon of the wanted day; h: elevation in metres
function times(date,lat,lng,h=0){const lw=rad*-lng,phi=rad*lat,d=toDays(date),n=Math.round(d-J0-lw/(2*PI)),ds=approx(0,lw,n),m=M(ds),l=L(m),dc=Math.asin(Math.sin(e)*Math.sin(l)),Jn=transit(ds,m,l);
 const dh=-2.076*Math.sqrt(Math.max(0,h))/60;
 const at=deg=>{const c=(Math.sin((deg+dh)*rad)-Math.sin(phi)*Math.sin(dc))/(Math.cos(phi)*Math.cos(dc));if(c<-1||c>1)return [null,null];const Js=transit(approx(Math.acos(c),lw,n),m,l);return [fromJ(Jn-(Js-Jn)),fromJ(Js)]};
 const [rise,set]=at(-0.833),[geoRise,geoSet]=at(0),[dawn]=at(-6),[,nauticalDusk]=at(-12);
 return {noon:fromJ(Jn),rise,set,geoRise,geoSet,dawn,nauticalDusk}}
return {times}})();
if(typeof module!=='undefined')module.exports=SUN;
