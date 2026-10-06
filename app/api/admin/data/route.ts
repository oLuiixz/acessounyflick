import {NextResponse} from "next/server";
import {isAdminAuthenticated} from "@/lib/admin";

async function query(sql:string,params:any[]=[]){
  const {Client}=await import("pg");
  const c=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("neon.tech")?{rejectUnauthorized:false}:undefined});
  await c.connect();
  try{return await c.query(sql,params)}finally{await c.end()}
}

async function ensureChatTable(){
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
}

export async function GET(){
  if(!(await isAdminAuthenticated())) return NextResponse.json({error:"Não autorizado."},{status:401});
  if(!process.env.DATABASE_URL) return NextResponse.json({stats:{chats:0,leads:0,tests:0,chat24h:0,test24h:0,conversion:0},recent:[]});

  await ensureChatTable();
  await query(`create table if not exists funnel_events (id uuid primary key default gen_random_uuid(),event text not null,session_id text,utm_source text not null default '',utm_medium text not null default '',utm_content text not null default '',created_at timestamptz not null default now())`);
  const [stats,leads,tests,chats24h,tests24h,testClicks,howClicks,recent,events] = await Promise.all([
    query("select count(*)::int as count from chat_sessions"),
    query("select count(*)::int as count from leads"),
    query("select count(*)::int as count from test_attempts where status='generated'"),
    query("select count(*)::int as count from chat_sessions where created_at>=now()-interval '24 hours'"),
    query("select count(*)::int as count from test_attempts where status='generated' and completed_at>=now()-interval '24 hours'"),
    query("select count(*)::int as count from funnel_events where event='test' and created_at>=now()-interval '24 hours'"),
    query("select count(*)::int as count from funnel_events where event='how' and created_at>=now()-interval '24 hours'"),
    query(`select c.session_id,c.stage,c.utm_source,c.utm_medium,c.utm_content,c.created_at,c.updated_at,c.lead_id,
      l.name,l.surname,l.email,l.whatsapp,l.test_generated
      from chat_sessions c
      left join leads l on l.id=c.lead_id
      order by c.created_at desc limit 50`),
    query(`select event,session_id,utm_source,utm_medium,utm_content,created_at from funnel_events order by created_at desc limit 30`)
  ]);
  const chatCount=Number(stats.rows[0]?.count||0);
  const leadCount=Number(leads.rows[0]?.count||0);
  const testCount=Number(tests.rows[0]?.count||0);
  return NextResponse.json({
    stats:{
      chats:chatCount,
      leads:leadCount,
      tests:testCount,
      chat24h:Number(chats24h.rows[0]?.count||0),
      test24h:Number(tests24h.rows[0]?.count||0),
      testClicks24h:Number(testClicks.rows[0]?.count||0),
      howClicks24h:Number(howClicks.rows[0]?.count||0),
      conversion:chatCount?Math.round((testCount/chatCount)*100):0
    },
    recent:recent.rows,
    events:events.rows
  });
}
