import {NextRequest,NextResponse} from "next/server";

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
