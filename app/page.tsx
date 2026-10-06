'use client';

import {useEffect,useMemo,useState} from "react";

type Msg={from:"bot"|"user";text:string};
type Step="welcome"|"help"|"name"|"surname"|"email"|"whatsapp"|"confirm"|"test"|"install"|"offer";
type LeadData={name:string;surname:string;email:string;whatsapp:string;utm_source:string;utm_medium:string;utm_content:string};
const progress:Record<Step,number>={welcome:1,help:1,name:1,surname:2,email:3,whatsapp:4,confirm:5,test:5,install:5,offer:5};
const initial:LeadData={name:"",surname:"",email:"",whatsapp:"",utm_source:"",utm_medium:"",utm_content:""};

export default function Home(){
 const [step,setStep]=useState<Step>("welcome");
 const [msgs,setMsgs]=useState<Msg[]>([{from:"bot",text:"Oi! 👋 Eu sou o assistente da UnyFlick."},{from:"bot",text:"Quer assistir filmes, séries e canais ao vivo agora, de graça?"}]);
 const [input,setInput]=useState("");const [typing,setTyping]=useState(false);const [data,setData]=useState(initial);const [leadId,setLeadId]=useState("");const [error,setError]=useState("");
 const [test,setTest]=useState<{username:string;password:string;expiresAt:string;mock:boolean;playlist?:string}|null>(null);

 useEffect(()=>{const p=new URLSearchParams(window.location.search);setData(d=>({...d,utm_source:p.get("utm_source")||"",utm_medium:p.get("utm_medium")||"",utm_content:p.get("utm_content")||""}))},[]);
 useEffect(()=>{const saved=localStorage.getItem("unyflick_lead_id");if(saved)setLeadId(saved)},[]);
 const save=async(p:Partial<LeadData>&Record<string,unknown>={})=>{const id=leadId||crypto.randomUUID();if(!leadId){setLeadId(id);localStorage.setItem("unyflick_lead_id",id)}const payload={...data,...p,id};await fetch("/api/leads",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).catch(()=>{})};
 const bot=(text:string,next?:()=>void)=>{setTyping(true);setTimeout(()=>{setMsgs(m=>[...m,{from:"bot",text}]);setTyping(false);next?.()},900)};
 const answer=(text:string,nextStep:Step,reply=text)=>{setMsgs(m=>[...m,{from:"user",text:reply}]);setInput("");setError("");setStep(nextStep)};
 const start=()=>{answer("Quero testar","name");bot("Perfeito. Qual é o seu nome?")};
 const how=()=>{answer("Como funciona?","help");bot("É simples: você recebe um acesso de teste para assistir ao catálogo no celular ou na TV. Sem compromisso. 😉")};
 const validate=(s:string)=>{if(step==="name"||step==="surname")return s.trim().length>=2;if(step==="email")return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());if(step==="whatsapp")return /^\d{10,11}$/.test(s.replace(/\D/g,""));return true};

 const submit=async()=>{
  const v=input.trim();if(!validate(v)){setError(step==="email"?"Digite um e-mail válido.":step==="whatsapp"?"Digite seu WhatsApp com DDD.":"Digite pelo menos 2 caracteres.");return}
  if(step==="name"){const next={...data,name:v};setData(next);answer(v,"surname");await save({name:v,stage:"surname"});bot(`Prazer, ${v}! E seu sobrenome?`)}
  else if(step==="surname"){const next={...data,surname:v};setData(next);answer(v,"email");await save({surname:v,stage:"email"});bot("Agora, qual é o seu melhor e-mail?")}
  else if(step==="email"){const next={...data,email:v};setData(next);answer(v,"whatsapp");await save({email:v,stage:"whatsapp"});bot("E qual é seu WhatsApp com DDD?")}
  else if(step==="whatsapp"){
   const w=v.replace(/\D/g,"");const r=await fetch("/api/leads",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"check-whatsapp",whatsapp:w})}).then(x=>x.json()).catch(()=>({allowed:true}));
   if(!r.allowed){setError("Esse WhatsApp já utilizou um teste. Vamos direto para os planos?");return}
   const next={...data,whatsapp:w};setData(next);answer(w,"confirm",w);await save({whatsapp:w,stage:"confirm"});bot("Confira seus dados:",()=>bot(`${next.name} ${next.surname}\n📧 ${next.email}\n📱 ${next.whatsapp}\n\nEstá tudo certo?`));
  }
 };

 const generate=async()=>{
  setMsgs(m=>[...m,{from:"user",text:"Sim, está correto!"}]);setStep("test");setTyping(true);
  try{
   const r=await fetch("/api/test",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
   const t=await r.json();if(!r.ok||!t.success)throw new Error();
   setTest({username:t.username||"",password:t.password||"",expiresAt:t.expiresAt||"",mock:false,playlist:t.playlist||""});
   await save({stage:"install",testGenerated:true,testUsername:t.username,testPassword:t.password,testPlaylist:t.playlist});
   setTyping(false);
   bot(t.playlist?"Seu teste está pronto!\n\n📺 Playlist: "+t.playlist:"Seu teste está pronto!\n\n👤 Usuário: "+(t.username||"gerado")+"\n🔑 Senha: "+(t.password||"gerada"),()=>setStep("install"))
  }catch{setTyping(false);setError("Não foi possível gerar agora. Tente novamente.");setStep("confirm")}
 };

 const install=(where:string)=>{setMsgs(m=>[...m,{from:"user",text:where}]);setStep("offer");bot(where==="Instalar no celular"?"Perfeito. Vou te passar o passo a passo para instalar no celular.":"Perfeito. Vou te passar o passo a passo para instalar na TV.",()=>bot("E se quiser continuar depois do teste, temos planos a partir de R$ 29,90/mês, em até 12x + 50 canais de esporte bônus."))};
 const click=(label:string)=>{
  if(label==="Quero testar")start();
  else if(label==="Como funciona?")how();
  else if(label==="Bora"){answer("Bora","name");bot("Então vamos! Qual é o seu nome?")}
  else if(label==="Sim, está correto!")generate();
  else if(label==="Corrigir"){setStep("name");bot("Sem problema. Vamos corrigir. Qual é o seu nome?")}
  else if(label==="Instalar no celular"||label==="Instalar na TV")install(label);
  else if(label==="Ver planos"){setMsgs(m=>[...m,{from:"user",text:label}]);bot("Perfeito! Vamos te mostrar os planos disponíveis.");setStep("offer");save({stage:"offer"})}
 };
 const quick=useMemo(()=>step==="welcome"?["Quero testar","Como funciona?"]:step==="help"?["Bora"]:step==="confirm"?["Sim, está correto!","Corrigir"]:step==="install"?["Instalar no celular","Instalar na TV"]:step==="offer"?["Ver planos"]:[],[step]);

 return <main className="app"><div className="chat">
  <header className="topbar"><div className="brand">Uny<span>Flick</span></div><div className="secure">● acesso seguro</div></header>
  <div className="progress"><div className="progressTop"><span>Seu teste grátis</span><span>passo {progress[step]} de 5</span></div><div className="track"><div className="fill" style={{width:`${progress[step]/5*100}%`}}/></div></div>
  <section className="messages">{msgs.map((m,i)=><div className={`row ${m.from}`} key={i}><div className="bubble">{m.text}</div></div>)}{typing&&<div className="row bot"><div className="typing"><i className="dot"/><i className="dot"/><i className="dot"/></div></div>}{test&&step==="install"&&!typing&&<div className="row bot"><div className="bubble">Onde você vai assistir?</div></div>}{quick.length>0&&!typing&&<div className="quick">{quick.map(q=><button key={q} onClick={()=>click(q)}>{q}</button>)}</div>}</section>
  {!["welcome","help","confirm","test","install","offer"].includes(step)&&<div className="composer"><div className="composerInner"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit()}} placeholder={step==="name"?"Seu nome...":step==="surname"?"Seu sobrenome...":step==="email"?"seu@email.com":"(00) 00000-0000"} autoFocus/><button disabled={!input.trim()||typing} onClick={submit}>Enviar</button></div>{error&&<div className="error">{error}</div>}</div>}
 </div></main>
}