import {NextRequest,NextResponse} from "next/server";
import {hashIdentifier} from "@/lib/test-security";

async function query(sql:string,params:any[]=[]){
  const {Client}=await import("pg");
  const c=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("neon.tech")?{rejectUnauthorized:false}:undefined});
  await c.connect();
  try{return await c.query(sql,params)}finally{await c.end()}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}));
    const sessionId=String(body.sessionId||"").trim();
    if(!sessionId||!process.env.DATABASE_URL)return NextResponse.json({success:true});
    const deviceId=String(body.deviceId||"").trim();
    const deviceHash=deviceId?hashIdentifier("device:"+deviceId):"";
    await query("update chat_sessions set updated_at=now(),device_hash=case when $2<>'' then $2 else device_hash end where session_id=$1",[sessionId,deviceHash]);
    return NextResponse.json({success:true});
  }catch(error){
    console.error("chat-heartbeat error",error);
    return NextResponse.json({success:false},{status:200});
  }
}
