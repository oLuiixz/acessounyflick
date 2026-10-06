import {NextRequest,NextResponse} from "next/server";

function pick(obj:Record<string,unknown>, keys:string[]){
  for(const key of keys){
    const value=obj?.[key];
    if(typeof value==="string" && value.trim()) return value.trim();
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
      headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify({
        name,
        nome:name,
        surname,
        sobrenome:surname,
        email,
        whatsapp,
        phone:whatsapp,
        telefone:whatsapp
      }),
      cache:"no-store"
    });

    const raw=await upstream.text();
    let data:Record<string,unknown>={};
    try{data=JSON.parse(raw)}catch{}

    if(!upstream.ok){
      return NextResponse.json({error:"O servidor não conseguiu gerar o teste.",upstreamStatus:upstream.status},{status:502});
    }

    const playlist=pick(data,["playlist","playlist_url","playlistUrl","m3u","m3u_url","m3uUrl","url","link"]);
    const username=pick(data,["username","user","usuario","login"]);
    const password=pick(data,["password","pass","senha"]);
    const expiresAt=pick(data,["expiresAt","expires_at","expiration","valid_until"]);

    return NextResponse.json({
      success:true,
      playlist,
      username,
      password,
      expiresAt,
      raw:data
    });
  }catch{
    return NextResponse.json({error:"Falha ao conectar ao servidor de testes."},{status:502});
  }
}
