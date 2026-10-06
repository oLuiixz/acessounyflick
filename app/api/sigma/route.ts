import {NextRequest,NextResponse} from "next/server";
import {generateSigmaTest} from "@/lib/sigma";
export async function POST(req:NextRequest){try{const body=await req.json();const test=await generateSigmaTest({name:body.name||"",whatsapp:body.whatsapp||""});return NextResponse.json(test)}catch(e){return NextResponse.json({error:"SIGMA_ERROR"},{status:502})}}