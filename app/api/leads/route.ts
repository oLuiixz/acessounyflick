import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {Lead} from "@/lib/types";
import {hashIdentifier} from "@/lib/test-security";
import {isAdminAuthenticated} from "@/lib/admin";

const memory:Lead[]=[];
function dbEnabled(){return Boolean(process.env.DATABASE_URL)};
async function query(sql:string,params:any[]=[]){const {Client}=await import("pg");const c=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("neon.tech")?{rejectUnauthorized:false}:undefined});await c.connect();try{return await c.query(sql,params)}finally{await c.end()}}

export async function GET(){
 if(!(await isAdminAuthenticated())) return NextResponse.json({error:"Não autorizado."},{status:401});
 if(!dbEnabled()) return NextResponse.json(memory);
 const r=await query("select * from leads order by created_at desc");
 return NextResponse.json(r.rows);
}

export async function POST(req:NextRequest){
 const body=await req.json();const now=new Date().toISOString();
 if(body.action==="check-whatsapp"){
   const whatsapp=String(body.whatsapp||"").replace(/\D/g,"");
   if(!whatsapp)return NextResponse.json({allowed:false});
   if(!dbEnabled()){
     const lead=memory.find(x=>x.whatsapp===whatsapp&&x.testGenerated);
     return NextResponse.json({allowed:!lead});
   }
   const whatsappHash=hashIdentifier("whatsapp:"+whatsapp);
   const r=await query("select count(*)::int as count,max(completed_at) as last_generated from test_attempts where whatsapp_hash=$1 and status='generated'",[whatsappHash]);
   const count=Number(r.rows[0]?.count||0);
   const last=r.rows[0]?.last_generated?new Date(r.rows[0].last_generated):null;
   const nextAllowedAt=last?new Date(last.getTime()+4*60*60*1000):null;
   const allowed=count<3 && (!nextAllowedAt||Date.now()>=nextAllowedAt.getTime());
   return NextResponse.json({allowed,testsUsed:count,testsRemaining:Math.max(0,3-count),nextAllowedAt:nextAllowedAt?.toISOString()||null});
 }
 let lead:Lead={id:body.id||randomUUID(),name:body.name||"",surname:body.surname||"",email:body.email||"",whatsapp:body.whatsapp||"",stage:body.stage||"welcome",utm_source:body.utm_source||"",utm_medium:body.utm_medium||"",utm_content:body.utm_content||"",testGenerated:Boolean(body.testGenerated),testUsername:body.testUsername,testPassword:body.testPassword,testPlaylist:body.testPlaylist,createdAt:body.createdAt||now,updatedAt:now};
 if(!dbEnabled()){const i=memory.findIndex(x=>x.id===lead.id);if(i>=0)memory[i]=lead;else memory.push(lead);return NextResponse.json(lead)}
 const hasTestGenerated=Object.prototype.hasOwnProperty.call(body,"testGenerated");
 if(hasTestGenerated&&Boolean(body.testGenerated)){const existing=await query("select id from leads where whatsapp=$1 and test_generated=true limit 1",[lead.whatsapp]);if(existing.rows[0]?.id)lead={...lead,id:existing.rows[0].id};}
 const generatedValue=hasTestGenerated?Boolean(body.testGenerated):null;
 await query(`insert into leads(id,name,surname,email,whatsapp,stage,utm_source,utm_medium,utm_content,test_generated,test_username,test_password,test_playlist,created_at,updated_at,test_generated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,false),$11,$12,$13,$14,$15,case when coalesce($10,false) then now() else null end) on conflict(id) do update set name=excluded.name,surname=excluded.surname,email=excluded.email,whatsapp=excluded.whatsapp,stage=excluded.stage,utm_source=excluded.utm_source,utm_medium=excluded.utm_medium,utm_content=excluded.utm_content,test_generated=case when $10 is null then leads.test_generated else excluded.test_generated end,test_username=coalesce(excluded.test_username,leads.test_username),test_password=coalesce(excluded.test_password,leads.test_password),test_playlist=coalesce(excluded.test_playlist,leads.test_playlist),test_generated_at=case when $10=true then coalesce(leads.test_generated_at,now()) else leads.test_generated_at end,updated_at=excluded.updated_at`,[lead.id,lead.name,lead.surname,lead.email,lead.whatsapp,lead.stage,lead.utm_source,lead.utm_medium,lead.utm_content,generatedValue,lead.testUsername||null,lead.testPassword||null,lead.testPlaylist||null,lead.createdAt,lead.updatedAt]);
 const chatSessionId=String(body.chatSessionId||"").trim();
 if(chatSessionId){
   await query(`update chat_sessions set lead_id=$1,stage=$2,updated_at=now() where session_id=$3`,[lead.id,lead.stage,chatSessionId]).catch(()=>{});
 }
 return NextResponse.json(lead);
}
