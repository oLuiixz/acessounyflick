import {NextRequest,NextResponse} from "next/server";

async function query(sql:string,params:any[]=[]){
  const {Client}=await import("pg");
  const c=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("neon.tech")?{rejectUnauthorized:false}:undefined});
  await c.connect();
  try{return await c.query(sql,params)}finally{await c.end()}
}

async function ensureEventsTable(){
  await query(`create table if not exists funnel_events (
    id uuid primary key default gen_random_uuid(),
    event text not null,
    session_id text,
    utm_source text not null default '',
    utm_medium text not null default '',
    utm_content text not null default '',
    created_at timestamptz not null default now()
  )`);
  await query("create index if not exists funnel_events_created_idx on funnel_events(created_at desc)");
  await query("create index if not exists funnel_events_event_idx on funnel_events(event)");
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}));
    const event=String(body.event||"chat").trim();
    const messages:Record<string,{title:string;text:string}>={
      test:{title:"Acesso UnyFlick",text:"🚀 Alguém clicou em Quero Testar!"},
      how:{title:"Acesso UnyFlick",text:"👀 Alguém clicou em Como funciona!"},
      chat:{title:"Acesso UnyFlick",text:"💬 Um novo chat foi iniciado!"}
    };
    const message=messages[event]||messages.chat;
    const sessionId=String(body.sessionId||"").trim()||null;
    if(process.env.DATABASE_URL){
      try{
        await ensureEventsTable();
        await query("insert into funnel_events(event,session_id,utm_source,utm_medium,utm_content) values($1,$2,$3,$4,$5)",[event,sessionId,String(body.utm_source||"").trim(),String(body.utm_medium||"").trim(),String(body.utm_content||"").trim()]);
      }catch(error){console.error("funnel event error",error)}
    }
    const webhook=process.env.PUSHCUT_WEBHOOK_URL;
    if(!webhook)return NextResponse.json({success:true,sent:false});
    const response=await fetch(webhook,{
      method:"POST",
      headers:{"content-type":"application/json"},
      cache:"no-store",
      body:JSON.stringify({title:message.title,text:message.text})
    });
    return NextResponse.json({success:true,sent:response.ok});
  }catch(error){
    console.error("pushcut error",error);
    return NextResponse.json({success:false,sent:false},{status:200});
  }
}
