import {NextRequest,NextResponse} from "next/server";
import {adminConfigured,setAdminCookie,validAdminToken,clearAdminCookie} from "@/lib/admin";

export async function POST(req:NextRequest){
  if(!adminConfigured()) return NextResponse.json({error:"Painel administrativo não configurado."},{status:503});
  const body=await req.json().catch(()=>({}));
  const token=String(body.token||"");
  if(!validAdminToken(token)) return NextResponse.json({error:"Senha do painel inválida."},{status:401});
  await setAdminCookie();
  return NextResponse.json({success:true});
}

export async function DELETE(){
  await clearAdminCookie();
  return NextResponse.json({success:true});
}
