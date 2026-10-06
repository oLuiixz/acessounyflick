import {NextRequest,NextResponse} from "next/server";

function firstMatch(text:string,patterns:RegExp[]){
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match?.[1]) return match[1].trim();
  }
  return "";
}

export async function POST(req:NextRequest){
  try{
    const apiUrl=process.env.TEST_API_URL;
    if(!apiUrl) return NextResponse.json({error:"API de teste não configurada."},{status:503});

    const body=await req.json();
    const name=String(body.name||"").trim();
    const surname=String(body.surname||"").trim();
    const email=String(body.email||"").trim();
    const whatsapp=String(body.whatsapp||"").replace(/\D/g,"");

    if(!name||!whatsapp) return NextResponse.json({error:"Nome e WhatsApp são obrigatórios."},{status:400});

    const upstream=await fetch(apiUrl,{
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json, text/plain"},
      body:JSON.stringify({name,nome:name,surname,sobrenome:surname,email,whatsapp,phone:whatsapp,telefone:whatsapp}),
      cache:"no-store"
    });

    const raw=await upstream.text();
    if(!upstream.ok){
      return NextResponse.json({error:"O servidor não conseguiu gerar o teste.",upstreamStatus:upstream.status},{status:502});
    }

    let message=raw;
    try{
      const json=JSON.parse(raw);

      if(typeof json==="string"){
        message=json;
      }else if(json && typeof json.reply==="string"){
        message=json.reply;
      }else if(json && Array.isArray(json.data) && typeof json.data[0]?.message==="string"){
        message=json.data[0].message;
      }else if(json && typeof json.message==="string"){
        message=json.message;
      }else if(json && typeof json.text==="string"){
        message=json.text;
      }

      // A resposta já vem com \n e URLs escapadas no JSON.
      // JSON.parse acima normaliza esses escapes para o texto original.
      message=String(message).replace(/\\\//g,"/").replace(/TESTE COMPLETO 2HR/gi,"ACESSO BONUS");
    }catch{
      message=raw;
    }

    const username=firstMatch(message,[/🌐?\s*USUÁRIO:\s*([\w.-]+)/i,/👤\s*USUÁRIO:\s*([\w.-]+)/i]);
    const password=firstMatch(message,[/🔑\s*SENHA:\s*([\w.-]+)/i]);
    const playlist=firstMatch(message,[/M3U\s*\(MPEG-TS\):\s*(https?:\/\/\S+)/i,/🔑\s*(https?:\/\/\S*get\.php\?username=\S+)/i]);
    const hls=firstMatch(message,[/HLS\s*PRINCIPAL:\s*(https?:\/\/\S+)/i]);
    const expiresAt=firstMatch(message,[/📅\s*VENCIMENTO:\s*(.+)/i]);

    return NextResponse.json({success:true,message,username,password,playlist,hls,expiresAt});
  }catch{
    return NextResponse.json({error:"Falha ao conectar ao servidor de testes."},{status:502});
  }
}
