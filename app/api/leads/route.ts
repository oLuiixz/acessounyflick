import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {Lead} from "@/lib/types";

const memory:Lead[]=[];
function dbEnabled(){return Boolean(process.env.DATABASE_URL)};
async function query(sql:string,params:any[]=[]){const {Client}=await import("pg");const c=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("neon.tech")?{rejectUnauthorized:false}:undefined});await c.connect();try{return await c.query(sql,params)}finally{await c.end()}}

export async function GET(){if(!dbEnabled()) return NextResponse.json(memory);const r=await query("select * from leads order by created_at desc");return NextResponse.json(r.rows)}
export async function POST(req:NextRequest){const body=await req.json();const now=new Date().toISOString();
 if(body.action==="check-whatsapp"){if(!body.whatsapp)return NextResponse.json({allowed:false});if(!dbEnabled())return NextResponse.json({allowed:!memory.some(x=>x.whatsapp===body.whatsapp&&x.testGenerated)});const r=await query("select 1 from leads where whatsapp=$1 and test_generated=true limit 1",[body.whatsapp]);return NextResponse.json({allowed:r.rowCount===0})}
 const lead:Lead={id:body.id||randomUUID(),name:body.name||"",surname:body.surname||"",email:body.email||"",whatsapp:body.whatsapp||"",stage:body.stage||"welcome",utm_source:body.utm_source||"",utm_medium:body.utm_medium||"",utm_content:body.utm_content||"",testGenerated:Boolean(body.testGenerated),testUsername:body.testUsername,testPassword:body.testPassword,testPlaylist:body.testPlaylist,createdAt:body.createdAt||now,updatedAt:now};
 if(!dbEnabled()){const i=memory.findIndex(x=>x.id===lead.id);if(i>=0)memory[i]=lead;else memory.push(lead);return NextResponse.json(lead)}
 await query(`insert into leads(id,name,surname,email,whatsapp,stage,utm_source,utm_medium,utm_content,test_generated,test_username,test_password,test_playlist,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict(id) do update set name=excluded.name,surname=excluded.surname,email=excluded.email,whatsapp=excluded.whatsapp,stage=excluded.stage,utm_source=excluded.utm_source,utm_medium=excluded.utm_medium,utm_content=excluded.utm_content,test_generated=excluded.test_generated,test_username=excluded.test_username,test_password=excluded.test_password,test_playlist=excluded.test_playlist,updated_at=excluded.updated_at`,[lead.id,lead.name,lead.surname,lead.email,lead.whatsapp,lead.stage,lead.utm_source,lead.utm_medium,lead.utm_content,lead.testGenerated,lead.testUsername||null,lead.testPassword||null,lead.testPlaylist||null,lead.createdAt,lead.updatedAt]);return NextResponse.json(lead)}
