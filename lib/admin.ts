import {createHash,timingSafeEqual} from "crypto";
import {cookies} from "next/headers";

const COOKIE_NAME="unyflick_admin";

function hash(value:string){
  return createHash("sha256").update(value).digest("hex");
}

export function adminConfigured(){
  return Boolean(process.env.ADMIN_PANEL_TOKEN);
}

export function validAdminToken(value:string){
  const configured=process.env.ADMIN_PANEL_TOKEN||"";
  if(!configured||!value)return false;
  const a=Buffer.from(hash(value),"hex");
  const b=Buffer.from(hash(configured),"hex");
  return a.length===b.length&&timingSafeEqual(a,b);
}

export async function setAdminCookie(){
  const store=await cookies();
  store.set(COOKIE_NAME,hash(process.env.ADMIN_PANEL_TOKEN||""),{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"lax",
    path:"/",
    maxAge:60*60*24*30
  });
}

export async function clearAdminCookie(){
  const store=await cookies();
  store.set(COOKIE_NAME,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
}

export async function isAdminAuthenticated(){
  const configured=process.env.ADMIN_PANEL_TOKEN||"";
  if(!configured)return false;
  const store=await cookies();
  const received=store.get(COOKIE_NAME)?.value||"";
  return received===hash(configured);
}
