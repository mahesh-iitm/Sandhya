// Web Push (RFC 8291 aes128gcm) and VAPID (RFC 8292) using WebCrypto only.
const enc=new TextEncoder();
export const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const unb64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length}return o};
async function hkdf(salt,ikm,info,bits){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,bits))}
export async function newVapid(){const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',kp.privateKey);const pub=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey));return {jwk,pub:b64u(pub)}}
const jwtCache=new Map();
async function vapidHeader(endpoint,v,subject){const aud=new URL(endpoint).origin,now=Math.floor(Date.now()/1000),c=jwtCache.get(aud);
 if(c&&c.exp-now>3600)return c.h;
 const key=await crypto.subtle.importKey('jwk',v.jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const exp=now+12*3600,body=b64u(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64u(enc.encode(JSON.stringify({aud,exp,sub:subject})));
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(body));
 const h=`vapid t=${body}.${b64u(sig)}, k=${v.pub}`;jwtCache.set(aud,{h,exp});return h}
export async function encrypt(sub,payload){const ua=unb64u(sub.keys.p256dh),auth=unb64u(sub.keys.auth);
 const eph=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const asPub=new Uint8Array(await crypto.subtle.exportKey('raw',eph.publicKey));
 const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},eph.privateKey,256));
 const ikm=await hkdf(auth,shared,cat(enc.encode('WebPush: info\0'),ua,asPub),256);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const cek=await hkdf(salt,ikm,enc.encode('Content-Encoding: aes128gcm\0'),128),nonce=await hkdf(salt,ikm,enc.encode('Content-Encoding: nonce\0'),96);
 const k=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},k,cat(enc.encode(payload),new Uint8Array([2]))));
 const rs=new Uint8Array([0,0,16,0]);return cat(salt,rs,new Uint8Array([asPub.length]),asPub,ct)}
export async function sendPush(sub,payload,v,subject='https://mahesh-iitm.github.io/Sandhya/',ttl=1800){
 const body=await encrypt(sub,payload);
 return fetch(sub.endpoint,{method:'POST',headers:{Authorization:await vapidHeader(sub.endpoint,v,subject),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:String(ttl),Urgency:'high'},body})}
