// NOAA solar calculator (Meeus-based), iterated for each event
const SUN=(()=>{const r=Math.PI/180,d=1/r;
function pos(jd){const T=(jd-2451545)/36525;
 const L0=((280.46646+T*(36000.76983+T*0.0003032))%360+360)%360,M=357.52911+T*(35999.05029-0.0001537*T),ec=0.016708634-T*(0.000042037+0.0000001267*T);
 const C=Math.sin(M*r)*(1.914602-T*(0.004817+0.000014*T))+Math.sin(2*M*r)*(0.019993-0.000101*T)+Math.sin(3*M*r)*0.000289;
 const om=125.04-1934.136*T,lam=L0+C-0.00569-0.00478*Math.sin(om*r);
 const eps=23+(26+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60)/60+0.00256*Math.cos(om*r);
 const dec=Math.asin(Math.sin(eps*r)*Math.sin(lam*r)),y=Math.tan(eps*r/2)**2;
 const eqt=4*d*(y*Math.sin(2*L0*r)-2*ec*Math.sin(M*r)+4*ec*y*Math.sin(M*r)*Math.cos(2*L0*r)-0.5*y*y*Math.sin(4*L0*r)-1.25*ec*ec*Math.sin(2*M*r));
 return {dec,eqt}}
// date: any Date on the wanted local day; tzOff: minutes east of UTC for that day
function times(date,lat,lng,h=0){
 const y=date.getFullYear(),mo=date.getMonth(),da=date.getDate();
 const jd0=Date.UTC(y,mo,da)/864e5+2440587.5; // 0h UTC of that calendar date
 const ev=(alt,sign)=>{let m=720-4*lng; // minutes after 0h UTC
  for(let i=0;i<3;i++){const p=pos(jd0+m/1440);
   if(sign===0){m=720-4*lng-p.eqt;continue}
   const c=(Math.sin(alt*r)-Math.sin(lat*r)*Math.sin(p.dec))/(Math.cos(lat*r)*Math.cos(p.dec));
   if(c<-1||c>1)return null;
   m=720-4*lng-p.eqt+sign*4*d*Math.acos(c)}
  // keep event on the local calendar day
  let ms=Date.UTC(y,mo,da)+m*6e4;const local=new Date(ms);
  if(local.getDate()!==da){ms+= (local<new Date(y,mo,da)?1:-1)*864e5}
  return new Date(ms)};
 const dip=-2.076*Math.sqrt(Math.max(0,h))/60,a=-0.833+dip;
 return {noon:ev(0,0),rise:ev(a,-1),set:ev(a,1),geoRise:ev(0,-1),geoSet:ev(0,1)}}
return {times}})();
if(typeof module!=='undefined')module.exports=SUN;
