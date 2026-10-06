import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {getClientIp,hashIdentifier} from "@/lib/test-security";

async function query(sql:string,params:any[]=[]){
  const {Client}=await import("pg");
  const c=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("neon.tech")?{rejectUnauthorized:false}:undefined});
  await c.connect();
  try{return await c.query(sql,params)}finally{await c.end()}
}

async function ensureTable(){
  await query(`create table if not exists chat_sessions (
    id uuid primary key default gen_random_uuid(),
    session_id text not null unique,
    lead_id text,
    stage text not null default 'welcome',
    utm_source text not null default '',
    utm_medium text not null default '',
    utm_content text not null default '',
    ip_hash text not null default '',
    device_hash text not null default '',
    user_agent text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await query("create index if not exists chat_sessions_created_idx on chat_sessions(created_at desc)");
  await query("create index if not exists chat_sessions_stage_idx on chat_sessions(stage)");
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}));
    const sessionId=String(body.sessionId||"").trim()||randomUUID();
    const utmSource=String(body.utm_source||"").trim();
    const utmMedium=String(body.utm_medium||"").trim();
    const utmContent=String(body.utm_content||"").trim();
    const ipHash=hashIdentifier("ip:"+getClientIp(req));
    const userAgent=req.headers.get("user-agent")||"";
    const deviceId=String(body.deviceId||"").trim();
    const deviceHash=deviceId?hashIdentifier("device:"+deviceId):"";

    if(!process.env.DATABASE_URL){
      return NextResponse.json({success:true,sessionId,stored:false});
    }

    await ensureTable();
    await query(
      `insert into chat_sessions(session_id,utm_source,utm_medium,utm_content,ip_hash,device_hash,user_agent)
       values($1,$2,$3,$4,$5,$6,$7)
       on conflict(session_id) do update set updated_at=now(),utm_source=excluded.utm_source,utm_medium=excluded.utm_medium,utm_content=excluded.utm_content`,
      [sessionId,utmSource,utmMedium,utmContent,ipHash,deviceHash,userAgent]
    );

    const pushcut=process.env.PUSHCUT_WEBHOOK_URL;
    let pushcutSent=false;
    if(pushcut){
      try{
        const response=await fetch(pushcut,{
          method:"POST",
          headers:{"content-type":"application/json"},
          cache:"no-store",
          body:JSON.stringify({title:"Acesso UnyFlick",text:"💬 Um novo chat foi iniciado!"})
        });
        pushcutSent=response.ok;
      }catch{}
    }

    return NextResponse.json({success:true,sessionId,stored:true,pushcutSent});
  }catch(error){
    console.error("chat-start error",error);
    return NextResponse.json({success:false,error:"Não foi possível registrar o início do chat."},{status:500});
  }
}
