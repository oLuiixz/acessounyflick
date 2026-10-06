import {createHash} from "crypto";
import {Client} from "pg";

const WINDOW_24H_MS=24*60*60*1000;
const WINDOW_1H_MS=60*60*1000;
const MAX_IP_TESTS_24H=1;
const MAX_IP_ATTEMPTS_1H=3;

function dbEnabled(){return Boolean(process.env.DATABASE_URL)}
function secret(){return process.env.TEST_HASH_SECRET||"dev-only-change-me"}

export function normalizeWhatsapp(value:string){return value.replace(/\D/g,"")}
export function getClientIp(req:{headers:{get(name:string):string|null}}){
  const forwarded=req.headers.get("x-forwarded-for");
  if(forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")||"unknown";
}
export function hashIdentifier(value:string){return createHash("sha256").update(secret()+"|"+value).digest("hex")}

async function queryClient(){
  const client=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("neon.tech")?{rejectUnauthorized:false}:undefined});
  await client.connect();
  return client;
}

export type Reservation={allowed:true;attemptId:string}|{allowed:false;message:string;reason:string};

export async function reserveTest(params:{leadId?:string;whatsapp:string;deviceId:string;ip:string;userAgent:string}):Promise<Reservation>{
  if(!dbEnabled()) return {allowed:false,reason:"database_unavailable",message:"O sistema de testes ainda não está conectado ao banco de controle."};

  const whatsapp=normalizeWhatsapp(params.whatsapp);
  const whatsappHash=hashIdentifier("whatsapp:"+whatsapp);
  const ipHash=hashIdentifier("ip:"+params.ip);
  const client=await queryClient();

  try{
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[whatsappHash]);

    const generated=await client.query(
      "select count(*)::int as count,max(completed_at) as last_generated from test_attempts where whatsapp_hash=$1 and status='generated'",
      [whatsappHash]
    );
    const total=Number(generated.rows[0]?.count||0);
    const lastGenerated=generated.rows[0]?.last_generated?new Date(generated.rows[0].last_generated):null;

    const since1h=new Date(Date.now()-WINDOW_1H_MS).toISOString();
    const ipAttempts=await client.query(
      "select count(*)::int as count from test_attempts where ip_hash=$1 and created_at >= $2",
      [ipHash,since1h]
    );

    let reason="";
    let message="";
    if(total>=3){
      reason="user_test_limit_reached";
      message="Você já utilizou os 3 testes disponíveis para este WhatsApp. Agora é só escolher um plano para continuar. 😉";
    }else if(lastGenerated && Date.now()-lastGenerated.getTime()<4*60*60*1000){
      const nextAt=new Date(lastGenerated.getTime()+4*60*60*1000);
      reason="user_cooldown";
      message="Você já utilizou um teste recentemente. Seu próximo teste estará disponível às "+nextAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+".";
    }else if(Number(ipAttempts.rows[0]?.count||0)>=MAX_IP_ATTEMPTS_1H){
      reason="ip_hourly_limit";
      message="Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    }

    if(reason){
      await client.query(
        "insert into test_attempts(lead_id,whatsapp_hash,ip_hash,device_hash,user_agent,status,block_reason) values($1,$2,$3,$4,$5,'blocked',$6)",
        [params.leadId||null,whatsappHash,ipHash,hashIdentifier("device:"+params.deviceId),params.userAgent||"",reason]
      );
      await client.query("commit");
      return {allowed:false,reason,message};
    }

    const inserted=await client.query(
      "insert into test_attempts(lead_id,whatsapp_hash,ip_hash,device_hash,user_agent,status) values($1,$2,$3,$4,$5,'pending') returning id",
      [params.leadId||null,whatsappHash,ipHash,hashIdentifier("device:"+params.deviceId),params.userAgent||""]
    );
    await client.query("commit");
    return {allowed:true,attemptId:inserted.rows[0].id};
  }catch(error){
    await client.query("rollback").catch(()=>{});
    throw error;
  }finally{
    await client.end();
  }
}

export async function finishTest(attemptId:string,success:boolean,username?:string){
  if(!dbEnabled()) return;
  const client=await queryClient();
  try{
    await client.query(
      "update test_attempts set status=$2,upstream_username=$3,completed_at=now() where id=$1",
      [attemptId,success?"generated":"failed",username||null]
    );
  }finally{await client.end()}
}
