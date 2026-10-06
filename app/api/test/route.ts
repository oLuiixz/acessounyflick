import {NextRequest,NextResponse} from "next/server";
import {finishTest,getClientIp,reserveTest} from "@/lib/test-security";

function firstMatch(text:string,patterns:RegExp[]){
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match?.[1]) return match[1].trim();
  }
  return "";
}

export async function POST(req:NextRequest){
  let attemptId="";
  try{
    const apiUrl=process.env.TEST_API_URL;
    if(!apiUrl) return NextResponse.json({error:"API de teste não configurada."},{status:503});

    const body=await req.json();
    const name=String(body.name||"").trim();
    const surname=String(body.surname||"").trim();
    const email=String(body.email||"").trim();
    const whatsapp=String(body.whatsapp||"").replace(/\D/g,"");
    const deviceId=String(body.deviceId||"").trim();
    const fingerprint=String(body.fingerprint||"").trim();

    if(!name||!whatsapp) return NextResponse.json({error:"Nome e WhatsApp são obrigatórios."},{status:400});
    if(!deviceId) return NextResponse.json({error:"Identificador do aparelho não encontrado. Recarregue a página e tente novamente."},{status:400});
    if(!fingerprint) return NextResponse.json({error:"Não foi possível validar este dispositivo. Recarregue a página e tente novamente."},{status:400});

    const ip=getClientIp(req);
    const userAgent=req.headers.get("user-agent")||"";
    const reservation=await reserveTest({whatsapp,deviceId,fingerprint,ip,userAgent,leadId:String(body.leadId||"")||undefined});
    if(!reservation.allowed){
      return NextResponse.json({error:reservation.message,blocked:true,reason:reservation.reason},{status:429});
    }
    attemptId=reservation.attemptId;

    const upstream=await fetch(apiUrl,{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json, text/plain"},
      body:JSON.stringify({name,nome:name,surname,sobrenome:surname,email,whatsapp,phone:whatsapp,telefone:whatsapp}),
      cache:"no-store"
    });

    const raw=await upstream.text();
    if(!upstream.ok){
      await finishTest(attemptId,false);
      return NextResponse.json({error:"O servidor não conseguiu gerar o teste.",upstreamStatus:upstream.status},{status:502});
    }

    let message=raw;
    let apiJson:any=null;
    try{
      apiJson=JSON.parse(raw);
      if(typeof apiJson==="string") message=apiJson;
      else if(apiJson && typeof apiJson.reply==="string") message=apiJson.reply;
      else if(apiJson && Array.isArray(apiJson.data) && typeof apiJson.data[0]?.message==="string") message=apiJson.data[0].message;
      else if(apiJson && typeof apiJson.message==="string") message=apiJson.message;
      else if(apiJson && typeof apiJson.text==="string") message=apiJson.text;
      message=String(message).replace(/\\\//g,"/").replace(/TESTE COMPLETO 2HR/gi,"ACESSO BONUS");
    }catch{
      message=raw;
    }

    const username=firstMatch(message,[/🌐?\s*USUÁRIO:\s*([\w.-]+)/i,/👤\s*USUÁRIO:\s*([\w.-]+)/i]);
    const password=firstMatch(message,[/🔑\s*SENHA:\s*([\w.-]+)/i]);
    const playlist=firstMatch(message,[/M3U\s*\(MPEG-TS\):\s*(https?:\/\/\S+)/i,/🔑\s*(https?:\/\/\S*get\.php\?username=\S+)/i]);
    const hls=firstMatch(message,[/HLS\s*PRINCIPAL:\s*(https?:\/\/\S+)/i]);
    const expiresAt=firstMatch(message,[/📅\s*VENCIMENTO:\s*(.+)/i]);
    const payUrl=typeof apiJson?.payUrl==="string"?apiJson.payUrl:"";
    const iboCode=firstMatch(message,[/🎈\s*C[óo]digo:\s*(\d+)/i]);
    const xstartProCode=firstMatch(message,[/XSTART PRO[\s\S]*?C[óo]digo:\s*(\d+)/i]);

    await finishTest(attemptId,true,username);

    return NextResponse.json({success:true,message,username,password,playlist,hls,expiresAt,payUrl,iboCode,xstartProCode});
  }catch(error){
    if(attemptId) await finishTest(attemptId,false).catch(()=>{});
    return NextResponse.json({error:"Falha ao conectar ao servidor de testes."},{status:502});
  }
}
