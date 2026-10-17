const ALLOWED_ORIGINS = new Set(['https://spinoutclub.cc']);
const HOSTNAMES = new Set(['spinoutclub.cc']);
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
export const validChallenge = (v,action) => v?.success === true && v.action === action && HOSTNAMES.has(v.hostname);

// The service client is server-only. Every public action proves its own identity.
export function createHandler({admin,client,fetcher=fetch}) {
 return async request => {
  const origin=request.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin&&ALLOWED_ORIGINS.has(origin))headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods']='POST, OPTIONS';
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!ALLOWED_ORIGINS.has(origin))return reply(403,{error:'Origin not allowed'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  try {
   if(Number(request.headers.get('content-length')||0)>8192)return reply(413,{error:'Request too large'});
   const text=await request.text();if(text.length>8192)return reply(413,{error:'Request too large'});
   let body;try{body=JSON.parse(text);}catch{return reply(400,{error:'Invalid request'});}
   if(!body||!['login','application'].includes(body.action))return reply(400,{error:'Invalid action'});
   if(body.website)return reply(400,{error:'Invalid request'});
   let user=null;
   if(body.action==='application'){
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if(!token)return reply(401,{error:'Sign in and verify your email first'});
    const auth=await admin.auth.getUser(token);
    if(auth.error||!auth.data?.user?.email_confirmed_at)return reply(401,{error:'Sign in and verify your email first'});
    user=auth.data.user;
   }
   if(typeof body.captcha!=='string'||!body.captcha||body.captcha.length>2048)return reply(403,{error:'Complete the bot verification'});
   const {data:config,error:configError}=await admin.rpc('spinout_security_config');
   if(configError||!config?.turnstile_secret)return reply(503,{error:'Sign-in protection is being configured. Please try later.'});
   // Identity limits also apply, so spoofing an address cannot bypass application quotas.
   const address=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
   const ip=await hash(address);
   const rate=async(key,limit,seconds)=>{const r=await admin.rpc('spinout_rate_limit',{p_key:key,p_limit:limit,p_seconds:seconds});return !r.error&&r.data===true;};
   if(!await rate('request:'+ip,40,3600))return reply(429,{error:'Too many attempts. Please try again later.'});
   let challenge;
   try{
    const r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:config.turnstile_secret,response:body.captcha,remoteip:address}),signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('verification unavailable');challenge=await r.json();
   }catch{return reply(403,{error:'Bot verification failed. Please try again.'});}
   if(!validChallenge(challenge,body.action))return reply(403,{error:'Bot verification expired or failed. Please try again.'});
   if(body.action==='application'){
    if(!await rate('application-user:'+user.id,1,86400)||!await rate('application-ip:'+ip,5,86400))return reply(429,{error:'An application was already submitted. Please wait before trying again.'});
    const args={p_auth_id:user.id,p_username:String(body.username||'').trim().toLowerCase(),p_nickname:String(body.nickname||'').trim(),p_reason:String(body.reason||'').trim()};
    if(!/^[a-z0-9_]{3,24}$/.test(args.p_username)||args.p_nickname.length<1||args.p_nickname.length>60||args.p_reason.length<10||args.p_reason.length>1000)return reply(400,{error:'Use a 3–24 character username, a display name and a short reason (10–1,000 characters).'});
    const r=await admin.rpc('spinout_submit_application',args);
    if(r.error)return reply(409,{error:'This account or username already has a membership or application. Contact an admin if you need help.'});
    return reply(200,{ok:true});
   }
   const username=String(body.username||'').trim().toLowerCase(),password=body.password;
   if(!/^[a-z0-9_]{1,40}$/.test(username)||typeof password!=='string'||!password||password.length>200)return reply(401,{error:'Username or password is incorrect'});
   if(!await rate('login:'+await hash(username),6,900))return reply(429,{error:'Too many attempts. Please wait 15 minutes before trying again.'});
   const {data:profile,error}=await admin.rpc('spinout_verify_legacy',{p_username:username,p_password:password});
   if(error||!profile)return reply(401,{error:'Username or password is incorrect'});
   let authUser;
   if(profile.auth_user_id){
    const r=await admin.auth.admin.getUserById(profile.auth_user_id);if(r.error)throw new Error('account unavailable');authUser=r.data.user;
   }else{
    const r=await admin.auth.admin.createUser({email:crypto.randomUUID()+'@members.spinoutclub.cc',password:crypto.randomUUID()+crypto.randomUUID(),email_confirm:true});
    if(r.error)throw new Error('account unavailable');authUser=r.data.user;
    const attached=await admin.rpc('spinout_attach_auth',{p_username:username,p_auth_id:authUser.id});
    if(attached.error)throw new Error('account linking interrupted; try again');
   }
   const link=await admin.auth.admin.generateLink({type:'magiclink',email:authUser.email});
   if(link.error||!link.data?.properties?.hashed_token)throw new Error('session unavailable');
   const signed=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'email'});
   if(signed.error||!signed.data.session)throw new Error('session unavailable');
   const {access_token,refresh_token}=signed.data.session;
   return reply(200,{access_token,refresh_token});
  }catch{return reply(503,{error:'Unable to complete this request. Please try again shortly.'});}
 };
}
