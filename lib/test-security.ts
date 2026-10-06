import {createHash} from "crypto";
import {Client} from "pg";

const WINDOW_4H_MS=4*60*60*1000;
const WINDOW_24H_MS=24*60*60*1000;
const WINDOW_1H_MS=60*60*1000;
const MAX_IDENTITY_TESTS=3;
const MAX_IP_TESTS_24H=5;
const MAX_IP_ATTEMPTS_1H=5;

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

export async function reserveTest(params:{leadId?:string;whatsapp:string;deviceId:string;fingerprint:string;ip:string;userAgent:string}):Promise<Reservation>{
  if(!dbEnabled()) return {allowed:false,reason:"database_unavailable",message:"O sistema de testes ainda não está conectado ao banco de controle."};

  const whatsapp=normalizeWhatsapp(params.whatsapp);
  const whatsappHash=hashIdentifier("whatsapp:"+whatsapp);
  const ipHash=hashIdentifier("ip:"+params.ip);
  const deviceHash=hashIdentifier("device:"+params.deviceId);
  const fingerprintHash=hashIdentifier("fingerprint:"+params.fingerprint);
  const client=await queryClient();

  try{
    await client.query("begin");
    // Serialize reservations for all signals so two different WhatsApps cannot race
    // through the same device/fingerprint at the same time.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[deviceHash]);

    const identity=await client.query(
      `select
        (select count(*)::int from test_attempts where device_hash=$1 and status='generated') as device_count,
        (select count(*)::int from test_attempts where fingerprint_hash=$2 and status='generated') as fingerprint_count,
        (select count(*)::int from test_attempts where whatsapp_hash=$3 and status='generated') as whatsapp_count,
        (select max(completed_at) from test_attempts where device_hash=$1 and status='generated') as device_last,
        (select max(completed_at) from test_attempts where fingerprint_hash=$2 and status='generated') as fingerprint_last,
        (select max(completed_at) from test_attempts where whatsapp_hash=$3 and status='generated') as whatsapp_last`,
      [deviceHash,fingerprintHash,whatsappHash]
    );
    const row=identity.rows[0]||{};
    const deviceCount=Number(row.device_count||0);
    const fingerprintCount=Number(row.fingerprint_count||0);
    const whatsappCount=Number(row.whatsapp_count||0);
    const lastGenerated=[row.device_last,row.fingerprint_last,row.whatsapp_last]
      .filter(Boolean)
      .map((v:string)=>new Date(v).getTime())
      .reduce((max:number,v:number)=>Math.max(max,v),0);

    const since24h=new Date(Date.now()-WINDOW_24H_MS).toISOString();
    const since1h=new Date(Date.now()-WINDOW_1H_MS).toISOString();
    const ipStats=await client.query(
      `select
        count(*) filter (where status='generated')::int as generated_24h,
        count(*) filter (where created_at >= $2)::int as attempts_1h
       from test_attempts
       where ip_hash=$1 and created_at >= $3`,
      [ipHash,since1h,since24h]
    );
    const ipGenerated24h=Number(ipStats.rows[0]?.generated_24h||0);
    const ipAttempts1h=Number(ipStats.rows[0]?.attempts_1h||0);

    let reason="";
    let message="";
    if(whatsappCount>=MAX_IDENTITY_TESTS){
      reason="whatsapp_test_limit_reached";
      message="Este WhatsApp já utilizou os 3 testes disponíveis. Agora é só escolher um plano para continuar. 😉";
    }else if(deviceCount>=MAX_IDENTITY_TESTS){
      reason="device_test_limit_reached";
      message="Este aparelho já utilizou os 3 testes disponíveis. Para continuar, escolha um plano. 😉";
    }else if(fingerprintCount>=MAX_IDENTITY_TESTS){
      reason="fingerprint_test_limit_reached";
      message="Este dispositivo já utilizou os 3 testes disponíveis. Para continuar, escolha um plano. 😉";
    }else if(lastGenerated && Date.now()-lastGenerated<WINDOW_4H_MS){
      const nextAt=new Date(lastGenerated+WINDOW_4H_MS);
      reason="identity_cooldown";
      message="Você já utilizou um teste recentemente. Seu próximo teste estará disponível às "+nextAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+".";
    }else if(ipGenerated24h>=MAX_IP_TESTS_24H){
      reason="ip_daily_limit";
      message="O limite de testes para esta conexão foi atingido. Tente novamente mais tarde.";
    }else if(ipAttempts1h>=MAX_IP_ATTEMPTS_1H){
      reason="ip_hourly_limit";
      message="Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    }

    if(reason){
      await client.query(
        "insert into test_attempts(lead_id,whatsapp_hash,ip_hash,device_hash,fingerprint_hash,user_agent,status,block_reason) values($1,$2,$3,$4,$5,$6,'blocked',$7)",
        [params.leadId||null,whatsappHash,ipHash,deviceHash,fingerprintHash,params.userAgent||"",reason]
      );
      await client.query("commit");
      return {allowed:false,reason,message};
    }

    const inserted=await client.query(
      "insert into test_attempts(lead_id,whatsapp_hash,ip_hash,device_hash,fingerprint_hash,user_agent,status) values($1,$2,$3,$4,$5,$6,'pending') returning id",
      [params.leadId||null,whatsappHash,ipHash,deviceHash,fingerprintHash,params.userAgent||""]
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
      "update test_attempts set status=$2,upstream_username=$3,completed_at=case when $2='generated' then now() else completed_at end where id=$1",
      [attemptId,success?"generated":"failed",username||null]
    );
  }finally{await client.end()}
}
