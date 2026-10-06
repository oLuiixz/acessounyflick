'use client';

import {useEffect,useMemo,useState} from "react";

type Msg={from:"bot"|"user";text:string};
type Step="welcome"|"help"|"name"|"surname"|"email"|"whatsapp"|"confirm"|"test"|"install"|"offer";
type InstallChoice="Smart TV"|"Celular / Tablet"|"Computador"|"Fire Stick / TV Box / Android TV";
type LeadData={name:string;surname:string;email:string;whatsapp:string;utm_source:string;utm_medium:string;utm_content:string};
async function buildFingerprint(){
 const canvas=document.createElement("canvas");
 canvas.width=280;canvas.height=60;
 const ctx=canvas.getContext("2d");
 if(ctx){ctx.textBaseline="top";ctx.font="16px Arial";ctx.fillText("unyflick-device-check",8,8);ctx.fillStyle="rgba(92,38,180,.45)";ctx.fillRect(18,28,120,18);}
 let canvasHash="";
 try{const raw=canvas.toDataURL();const bytes=new TextEncoder().encode(raw);const digest=await crypto.subtle.digest("SHA-256",bytes);canvasHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");}catch{}
 let webgl="";
 try{const gl=canvas.getContext("webgl") as WebGLRenderingContext|null;const ext=gl?.getExtension("WEBGL_debug_renderer_info");if(gl&&ext)webgl=String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)||"");}catch{}
 const nav=navigator as Navigator&{deviceMemory?:number};
 return JSON.stringify({
  canvasHash,webgl,platform:navigator.platform||"",language:navigator.language||"",languages:Array.from(navigator.languages||[]),
  timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"",screen:[screen.width,screen.height,screen.colorDepth,window.devicePixelRatio],
  cores:navigator.hardwareConcurrency||0,memory:nav.deviceMemory||0,touch:navigator.maxTouchPoints||0
 });
}

const progress:Record<Step,number>={welcome:1,help:1,name:1,surname:2,email:3,whatsapp:4,confirm:5,test:5,install:5,offer:5};
const initial:LeadData={name:"",surname:"",email:"",whatsapp:"",utm_source:"",utm_medium:"",utm_content:""};

export default function Home(){
 const [step,setStep]=useState<Step>("welcome");
 const [msgs,setMsgs]=useState<Msg[]>([{from:"bot",text:"Oi! 👋 Eu sou o assistente da UnyFlick."},{from:"bot",text:"Quer assistir filmes, séries e canais ao vivo agora, de graça?"}]);
 const [input,setInput]=useState("");const [typing,setTyping]=useState(false);const [data,setData]=useState(initial);const [leadId,setLeadId]=useState("");const [deviceId,setDeviceId]=useState("");const [fingerprint,setFingerprint]=useState("");const [error,setError]=useState("");
 const [test,setTest]=useState<{username:string;password:string;expiresAt:string;mock:boolean;playlist?:string;hls?:string;message?:string;payUrl?:string;iboCode?:string;xstartProCode?:string}|null>(null);

 useEffect(()=>{const p=new URLSearchParams(window.location.search);setData(d=>({...d,utm_source:p.get("utm_source")||"",utm_medium:p.get("utm_medium")||"",utm_content:p.get("utm_content")||""}))},[]);
 useEffect(()=>{const saved=localStorage.getItem("unyflick_lead_id");if(saved)setLeadId(saved);let device=localStorage.getItem("unyflick_device_id");if(!device){device=crypto.randomUUID();localStorage.setItem("unyflick_device_id",device)}setDeviceId(device);buildFingerprint().then(setFingerprint).catch(()=>{})},[]);
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
  if(!fingerprint){const fp=await buildFingerprint().catch(()=>"");if(fp)setFingerprint(fp);}
  setMsgs(m=>[...m,{from:"user",text:"Sim, está correto!"}]);setStep("test");setTyping(true);
  try{
   const r=await fetch("/api/test",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...data,leadId,deviceId,fingerprint:fingerprint||await buildFingerprint().catch(()=>"")})});
   const t=await r.json();if(!r.ok||!t.success)throw new Error(t.error||"Não foi possível gerar o teste.");
   setTest({username:t.username||"",password:t.password||"",expiresAt:t.expiresAt||"",mock:false,playlist:t.playlist||"",hls:t.hls||"",message:t.message||"",payUrl:t.payUrl||"",iboCode:t.iboCode||"",xstartProCode:t.xstartProCode||""});
   await save({stage:"install",testGenerated:true,testUsername:t.username,testPassword:t.password,testPlaylist:t.playlist});
   setTyping(false);
   bot(t.message||("Seu teste está pronto!\n\n👤 Usuário: "+(t.username||"gerado")+"\n🔑 Senha: "+(t.password||"gerada")),()=>setStep("install"))
  }catch(e){setTyping(false);setError(e instanceof Error&&e.message?e.message:"Não foi possível gerar agora. Tente novamente.");setStep("confirm")}
 };

 const install=(where:InstallChoice)=>{
  setMsgs(m=>[...m,{from:"user",text:where}]);
  const u=test?.username||"{USUARIO}",p=test?.password||"{SENHA}",renew=test?.payUrl||"{LINK_RENOVAR}",ibo=test?.iboCode||"{CODIGO_IBO}",xp=test?.xstartProCode||"{CODIGO_XSTART_PRO}";
  const m3u="http://xmrs2.top/get.php?username="+u+"&password="+p+"&type=m3u_plus&output=mpegts";
  const tutorials:Record<InstallChoice,string>={
   "Fire Stick / TV Box / Android TV":`🔥 TUTORIAL DE INSTALAÇÃO
FIRE STICK • TV BOX • ANDROID TV

━━━━━━━━━━ ✦ ━━━━━━━━━━

🔐 SEUS DADOS DE ACESSO
👤 USUÁRIO: ${u}
🔑 SENHA: ${p}
🌐 DNS: http://xmrs2.top

━━━━━━━━━━ ✦ ━━━━━━━━━━

📥 PASSO 1: INSTALAR O DOWNLOADER

🔥 FIRE STICK:
1️⃣ Na tela inicial, clique na LUPA (Buscar)
2️⃣ Digite: Downloader
3️⃣ Selecione o app (ícone laranja) e clique em BAIXAR / OBTER
4️⃣ Aguarde instalar

📺 TV BOX / ANDROID TV:
1️⃣ Abra a Play Store
2️⃣ Pesquise: Downloader
3️⃣ Clique em INSTALAR

(Se não achar o Downloader, use o NTDOWN, o processo é igual.)

━━━━━━━━━━ ✦ ━━━━━━━━━━

⚙️ PASSO 2: PERMITIR INSTALAÇÃO DE APPS

🔥 FIRE STICK:
1️⃣ Vá em CONFIGURAÇÕES (ícone de engrenagem)
2️⃣ Entre em MINHA FIRE TV
3️⃣ Clique em OPÇÕES DO DESENVOLVEDOR
4️⃣ Clique em INSTALAR APPS DESCONHECIDOS
5️⃣ Ative a opção para o DOWNLOADER

⚠️ Se "Opções do desenvolvedor" não aparecer:
Vá em Minha Fire TV > Sobre e clique 7 vezes
seguidas em cima do nome do aparelho. Depois volte
e a opção vai aparecer.

📺 TV BOX / ANDROID TV:
1️⃣ Abra o DOWNLOADER
2️⃣ Quando pedir, clique em CONFIGURAÇÕES
3️⃣ Ative "Permitir desta fonte"
(ou: Configurações > Segurança > Fontes desconhecidas > Downloader)

━━━━━━━━━━ ✦ ━━━━━━━━━━

📲 PASSO 3: BAIXAR O APLICATIVO

1️⃣ Abra o DOWNLOADER
2️⃣ Se pedir permissão de arquivos, clique em PERMITIR
3️⃣ Na tela inicial, clique na caixa de endereço (campo URL/código)
4️⃣ Digite o CÓDIGO do app escolhido:

📥 XSTART MAX → 8007324
📥 XSTART PRO → 6198609
📥 XSTART TIVI → 8491505
📥 XSTART IBO → 4094706
📥 XSTART PLUS → 8351185

5️⃣ Clique em IR (GO) e aguarde o download
6️⃣ Clique em INSTALAR
7️⃣ Quando terminar, clique em ABRIR
8️⃣ Se perguntar sobre apagar o arquivo, clique em APAGAR (libera espaço no aparelho)

━━━━━━━━━━ ✦ ━━━━━━━━━━

🔑 PASSO 4: FAZER LOGIN

1️⃣ Abra o app instalado
2️⃣ Digite:
   👤 Usuário: ${u}
   🔑 Senha: ${p}
3️⃣ Clique em ENTRAR e aguarde carregar os canais

📌 XSTART PRO: informe também o código ${xp}

━━━━━━━━━━ ✦ ━━━━━━━━━━

🔄 ALTERNATIVA: USANDO O NTDOWN

Mesmo processo, só muda o código:
📥 XSTART MAX → 91764
📥 XSTART PRO → 34873
📥 XSTART TIVI → 32232
📥 XSTART IBO → 71764
📥 XSTART PLUS → 75737

Ou digite o link direto, ex.: https://dl.ntdev.in/91764

━━━━━━━━━━ ✦ ━━━━━━━━━━

🛠️ DEU PROBLEMA?

❌ Não instala → confira se ativou o Passo 2
❌ Código não abre → digite só os números, sem espaço
❌ Não carrega os canais → reinicie o app e a internet
❌ Usuário inválido → digite à mão, sem espaço no fim
❌ App travando → desligue o aparelho da tomada por 1 minuto
❌ Teste expirou → renove: ${renew}

🎧 Qualquer dúvida, chame o suporte!`,
   "Smart TV":`📺 TUTORIAL DE INSTALAÇÃO
SMART TV LG • SAMSUNG • ROKU

━━━━━━━━━━ ✦ ━━━━━━━━━━

🔐 SEUS DADOS DE ACESSO
👤 USUÁRIO: ${u}
🔑 SENHA: ${p}
🌐 DNS: http://xmrs2.top
🔢 CÓDIGO IBO: ${ibo}

━━━━━━━━━━ ✦ ━━━━━━━━━━

✅ OPÇÃO 1: IBO SMARTERS (RECOMENDADO)

📥 PASSO 1: INSTALAR O APP
🔵 LG: abra a LG Content Store > Buscar > IBO SMARTERS > Instalar
🔷 SAMSUNG: abra a Smart Hub/Apps > Lupa > IBO SMARTERS > Instalar
🟣 ROKU: abra o Roku Channel Store > Buscar canais > IBO SMARTERS > Adicionar canal

▶️ PASSO 2: ABRIR E ATIVAR
1️⃣ Abra o app IBO SMARTERS
2️⃣ Aguarde a tela de ativação carregar
3️⃣ Digite o código: ${ibo}
4️⃣ Informe o usuário: ${u}
5️⃣ Informe a senha: ${p}
6️⃣ Clique em ENTRAR e aguarde a lista carregar

━━━━━━━━━━ ✦ ━━━━━━━━━━

✅ OPÇÃO 2: MAX PLUS (ATIVAÇÃO POR MAC)

📥 PASSO 1: INSTALAR O APP
1️⃣ Abra a loja de apps da sua TV
2️⃣ Pesquise: MAX PLUS
3️⃣ Instale e abra o app

🔎 PASSO 2: ANOTAR O MAC
1️⃣ Na tela inicial do app vai aparecer o MAC do aparelho
2️⃣ Anote ou tire uma foto da tela (ex.: 00:1A:2B:3C:4D:5E)

🌐 PASSO 3: ATIVAR PELO CELULAR OU PC
1️⃣ Envie uma mensagem para 19 9 2013-3193
2️⃣ Envie o MAC da TV
3️⃣ Envie o link M3U abaixo:
${m3u}
4️⃣Após isso nossa equipe ativará o seu app

🔄 PASSO 4: FINALIZAR
1️⃣ Feche o app na TV completamente
2️⃣ Abra de novo e aguarde carregar os canais

━━━━━━━━━━ ✦ ━━━━━━━━━━

🛠️ DEU PROBLEMA?

❌ Não acha o app na loja → reinicie a TV e atualize o sistema
❌ Código não funciona → digite só os números, sem espaço
❌ Lista não carrega → troque o DNS para http://newx2.top
❌ Canais travando → reinicie a TV e o roteador
❌ Usuário inválido → digite à mão, sem espaço no fim
❌ Teste expirou → renove: ${renew}

🎧 Qualquer dúvida, chame o suporte!`,
   "Celular / Tablet":`📱 TUTORIAL DE INSTALAÇÃO
CELULAR ANDROID • IPHONE (iOS)

━━━━━━━━━━ ✦ ━━━━━━━━━━

🔐 SEUS DADOS DE ACESSO
👤 USUÁRIO: ${u}
🔑 SENHA: ${p}
🌐 DNS: http://xmrs2.top

━━━━━━━━━━ ✦ ━━━━━━━━━━

🤖 ANDROID: PELA PLAY STORE (MAIS FÁCIL)

✅ OPÇÃO 1: XSTART PLAYER
1️⃣ Abra o link no celular e toque em INSTALAR:
https://play.google.com/store/apps/details?id=com.xstart.com
2️⃣ Abra o app
3️⃣ Digite:
   👤 Usuário: ${u}
   🔑 Senha: ${p}
4️⃣ Toque em ENTRAR e aguarde carregar

✅ OPÇÃO 2: UNIBOX +
1️⃣ Abra o link e toque em INSTALAR:
https://play.google.com/store/apps/details?id=com.neonstream.player&hl=pt-BR
2️⃣ Abra o app
3️⃣ Código do fornecedor: 935523
4️⃣ Digite:
   👤 Usuário: ${u}
   🔑 Senha: ${p}
5️⃣ Toque em ENTRAR

━━━━━━━━━━ ✦ ━━━━━━━━━━

🤖 ANDROID: PELO APK (SE NÃO ACHAR NA PLAY STORE)

⚙️ PASSO 1: PERMITIR INSTALAÇÃO
1️⃣ Abra o link do app no navegador do celular
2️⃣ Quando o Android avisar, toque em CONFIGURAÇÕES
3️⃣ Ative "Permitir desta fonte"
(ou: Configurações > Segurança > Instalar apps desconhecidos > Navegador)

📲 PASSO 2: BAIXAR E INSTALAR
🔗 XSTART MAX: https://dl.ntdev.in/91764
🔗 XSTART PRO: https://dl.ntdev.in/34873
1️⃣ Toque no link e baixe o arquivo
2️⃣ Abra o arquivo baixado e toque em INSTALAR
3️⃣ Toque em ABRIR

🔑 PASSO 3: LOGIN
👤 Usuário: ${u}
🔑 Senha: ${p}
📌 XSTART PRO: informe também o código ${xp}

━━━━━━━━━━ ✦ ━━━━━━━━━━

🍎 IPHONE / IPAD (iOS)

✅ OPÇÃO 1: SEM INSTALAR NADA (WEB PLAYER)
1️⃣ Abra o SAFARI
2️⃣ Acesse: https://comboflix.com.br
3️⃣ Entre com usuário e senha
4️⃣ Dica: toque em COMPARTILHAR > ADICIONAR À TELA DE INÍCIO para criar um atalho igual a um app

✅ OPÇÃO 2: APP DA APP STORE
1️⃣ Abra a App Store
2️⃣ Pesquise: IPTV Smarters Pro e instale
3️⃣ Abra e escolha "Xtream Codes API"
4️⃣ Preencha:
   📝 Nome: qualquer um
   👤 Usuário: ${u}
   🔑 Senha: ${p}
   🌐 URL: http://xmrs2.top
5️⃣ Toque em ADICIONAR e aguarde carregar

━━━━━━━━━━ ✦ ━━━━━━━━━━

🛠️ DEU PROBLEMA?

❌ Não instala o APK → confira se permitiu "fontes desconhecidas"
❌ Play Protect bloqueou → toque em "Instalar mesmo assim"
❌ Lista não carrega → troque o DNS para http://newx2.top
❌ Canais travando → troque de Wi-Fi para dados (ou o contrário)
❌ Usuário inválido → digite à mão, sem espaço no fim
❌ Teste expirou → renove: ${renew}

🎧 Qualquer dúvida, chame o suporte!`,
   "Computador":`💻 TUTORIAL DE INSTALAÇÃO
COMPUTADOR WINDOWS

━━━━━━━━━━ ✦ ━━━━━━━━━━

🔐 SEUS DADOS DE ACESSO
👤 USUÁRIO: ${u}
🔑 SENHA: ${p}

━━━━━━━━━━ ✦ ━━━━━━━━━━

✅ OPÇÃO 1: APLICATIVO MAX PRO

📥 PASSO 1: BAIXAR
1️⃣ Abra o navegador (Chrome, Edge...)
2️⃣ Acesse e baixe:
https://painel.appmax.top/download/MaxPro-Setup.exe
3️⃣ Se o navegador perguntar se quer manter o arquivo, clique em MANTER

⚙️ PASSO 2: INSTALAR
1️⃣ Abra o arquivo MaxPro-Setup.exe (pasta Downloads)
2️⃣ Se aparecer "O Windows protegeu o computador":
   👉 clique em MAIS INFORMAÇÕES
   👉 depois em EXECUTAR ASSIM MESMO
3️⃣ Clique em SIM se o Windows pedir permissão
4️⃣ Siga o instalador (Avançar > Instalar > Concluir)

🔑 PASSO 3: FAZER LOGIN
1️⃣ Abra o MAX PRO (atalho na área de trabalho)
2️⃣ Preencha:
   🖥️ Provedor: xstart
   👤 Usuário: ${u}
   🔑 Senha: ${p}
3️⃣ Clique em ENTRAR e aguarde carregar os canais

━━━━━━━━━━ ✦ ━━━━━━━━━━

🌐 OPÇÃO 2: WEB PLAYER (SEM INSTALAR NADA)

1️⃣ Abra o navegador
2️⃣ Acesse: https://comboflix.com.br
3️⃣ Digite usuário e senha
4️⃣ Clique em ENTRAR e escolha o canal

━━━━━━━━━━ ✦ ━━━━━━━━━━

🎬 OPÇÃO 3: VLC (PLAYER GRATUITO)

1️⃣ Baixe e instale o VLC: https://www.videolan.org
2️⃣ Abra o VLC e clique em MÍDIA > ABRIR FLUXO DE REDE
   (atalho: Ctrl + N)
3️⃣ Cole o link abaixo:
${m3u}
4️⃣ Clique em REPRODUZIR
5️⃣ Para ver a lista de canais: VISUALIZAR > LISTA DE REPRODUÇÃO

━━━━━━━━━━ ✦ ━━━━━━━━━━

🛠️ DEU PROBLEMA?

❌ Windows bloqueou o instalador → use "Mais informações > Executar assim mesmo"
❌ Antivírus apagou o arquivo → libere o arquivo e baixe de novo
❌ Lista não carrega → troque o DNS para http://newx2.top
❌ Canais travando → feche outros programas e teste o cabo de rede
❌ Usuário inválido → digite à mão, sem espaço no fim
❌ Teste expirou → renove: ${renew}

🎧 Qualquer dúvida, chame o suporte!`
  };
  const tutorial=tutorials[where];
  setStep("offer");
  bot(tutorial,()=>bot("E se quiser continuar depois do acesso bônus, temos planos a partir de R$ 29,90/mês, em até 12x + 50 canais de esporte bônus.",()=>save({stage:"offer"})));
 };
 const click=(label:string)=>{
  if(label==="Quero testar")start();
  else if(label==="Como funciona?")how();
  else if(label==="Bora"){answer("Bora","name");bot("Então vamos! Qual é o seu nome?")}
  else if(label==="Sim, está correto!")generate();
  else if(label==="Corrigir"){setStep("name");bot("Sem problema. Vamos corrigir. Qual é o seu nome?")}
  else if(["Smart TV","Celular / Tablet","Computador","Fire Stick / TV Box / Android TV"].includes(label))install(label as InstallChoice);
  else if(label==="Ver planos"){setMsgs(m=>[...m,{from:"user",text:label}]);bot("Perfeito! Vamos te mostrar os planos disponíveis.");setStep("offer");save({stage:"offer"})}
 };
 const quick=useMemo(()=>step==="welcome"?["Quero testar","Como funciona?"]:step==="help"?["Bora"]:step==="confirm"?["Sim, está correto!","Corrigir"]:step==="install"?["Smart TV","Celular / Tablet","Computador","Fire Stick / TV Box / Android TV"]:step==="offer"?["Ver planos"]:[],[step]);

 return <main className="app"><div className="chat">
  <header className="topbar"><div className="brand"><img src="/images/logounyflick.webp" alt="UnyFlick" /></div></header>
  <div className="progress"><div className="progressTop"><span>Acesso Bonus</span><span>passo {progress[step]} de 5</span></div><div className="track"><div className="fill" style={{width:`${progress[step]/5*100}%`}}/></div></div>
  <section className="messages">{msgs.map((m,i)=><div className={`row ${m.from}`} key={i}><div className="bubble">{m.text}</div></div>)}{typing&&<div className="row bot"><div className="typing"><i className="dot"/><i className="dot"/><i className="dot"/></div></div>}{test&&step==="install"&&!typing&&<div className="row bot"><div className="bubble">Onde você vai assistir?</div></div>}{quick.length>0&&!typing&&<div className="quick">{quick.map(q=><button key={q} onClick={()=>click(q)}>{q}</button>)}</div>}</section>
  {!["welcome","help","confirm","test","install","offer"].includes(step)&&<div className="composer"><div className="composerInner"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit()}} placeholder={step==="name"?"Seu nome...":step==="surname"?"Seu sobrenome...":step==="email"?"seu@email.com":"(00) 00000-0000"} autoFocus/><button disabled={!input.trim()||typing} onClick={submit}>Enviar</button></div>{error&&<div className="error">{error}</div>}</div>}
 </div></main>
}