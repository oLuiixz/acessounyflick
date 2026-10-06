export type SigmaTest={username:string;password:string;expiresAt:string;mock:boolean};
export async function generateSigmaTest(input:{name:string;whatsapp:string}):Promise<SigmaTest>{
  const base=process.env.SIGMA_API_URL;
  const key=process.env.SIGMA_API_KEY;
  if(base&&key){
    // Adapter isolado: preencher o contrato da API Sigma quando a credencial/documentação estiver disponível.
    // Nunca exponha SIGMA_API_KEY ao cliente.
    const res=await fetch(base,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({name:input.name,whatsapp:input.whatsapp,durationHours:2})});
    if(!res.ok) throw new Error("Falha ao gerar teste no Sigma");
    const data=await res.json();
    return {username:data.username,password:data.password,expiresAt:data.expiresAt,mock:false};
  }
  const suffix=Math.floor(1000+Math.random()*9000);
  return {username:`uny${suffix}`,password:`teste${suffix}`,expiresAt:new Date(Date.now()+2*60*60*1000).toISOString(),mock:true};
}