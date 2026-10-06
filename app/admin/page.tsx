'use client';

import {useCallback,useEffect,useState} from "react";

type Stats={chats:number;leads:number;tests:number;chat24h:number;test24h:number;conversion:number};
type Row={session_id:string;stage:string;utm_source:string;utm_medium:string;utm_content:string;created_at:string;updated_at:string;lead_id?:string|null;name?:string|null;surname?:string|null;email?:string|null;whatsapp?:string|null;test_generated?:boolean|null};

export default function Admin(){
 const [token,setToken]=useState("");
 const [authed,setAuthed]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [stats,setStats]=useState<Stats>({chats:0,leads:0,tests:0,chat24h:0,test24h:0,conversion:0});
 const [recent,setRecent]=useState<Row[]>([]);

 const load=useCallback(async()=>{
   setLoading(true);setError("");
   const r=await fetch("/api/admin/data",{cache:"no-store"});
   if(r.status===401){setAuthed(false);setLoading(false);return}
   const data=await r.json().catch(()=>null);
   if(!r.ok){setError(data?.error||"Não foi possível carregar o painel.");setLoading(false);return}
   setAuthed(true);setStats(data.stats);setRecent(data.recent||[]);setLoading(false);
 },[]);

 useEffect(()=>{load()},[load]);

 const login=async(e:React.FormEvent)=>{
   e.preventDefault();setError("");
   const r=await fetch("/api/admin/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok){setError(data.error||"Senha inválida.");return}
   setToken("");await load();
 };

 const logout=async()=>{await fetch("/api/admin/auth",{method:"DELETE"});setAuthed(false);setRecent([])};

 if(loading&&!authed)return <main className="admin"><div className="adminLogin"><h1>UnyFlick</h1><p className="adminSub">Carregando painel...</p></div></main>;

 if(!authed)return <main className="admin"><div className="adminLogin"><div className="adminLogo">UF</div><h1>Painel UnyFlick</h1><p className="adminSub">Acesso administrativo</p><form onSubmit={login}><input className="adminInput" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Senha do painel" autoFocus/><button className="adminButton" disabled={!token.trim()}>Entrar</button></form>{error&&<div className="adminError">{error}</div>}</div></main>;

 return <main className="admin">
  <div className="adminHeader"><div><div className="adminKicker">UNYFLICK • LIVE</div><h1>Painel de conversão</h1><p className="adminSub">Acompanhe chats, leads e testes em tempo real.</p></div><div className="adminActions"><button className="adminButton secondary" onClick={load}>Atualizar</button><button className="adminButton ghost" onClick={logout}>Sair</button></div></div>
  <div className="stats">
   <div className="stat"><b>{stats.chat24h}</b><span>Chats nas últimas 24h</span><small>{stats.chats} no total</small></div>
   <div className="stat"><b>{stats.leads}</b><span>Leads capturados</span><small>Nome + contato</small></div>
   <div className="stat"><b>{stats.test24h}</b><span>Testes nas últimas 24h</span><small>{stats.tests} no total</small></div>
   <div className="stat"><b>{stats.conversion}%</b><span>Conversão chat → teste</span><small>Baseado nos registros</small></div>
  </div>
  <div className="adminSection"><div className="sectionTitle"><h2>Últimos chats</h2><span>{recent.length} registros</span></div>
   <div className="tableWrap"><table className="table"><thead><tr><th>Início</th><th>Lead</th><th>Contato</th><th>Etapa</th><th>Teste</th><th>Origem</th></tr></thead><tbody>
    {recent.map((r,i)=><tr key={r.session_id||i}><td>{new Date(r.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</td><td><strong>{[r.name,r.surname].filter(Boolean).join(" ")||"Visitante"}</strong><small>{r.email||"—"}</small></td><td>{r.whatsapp||"—"}</td><td><span className="badge">{r.stage}</span></td><td className={r.test_generated?"yes":"no"}>{r.test_generated?"Sim":"Não"}</td><td>{[r.utm_source,r.utm_medium,r.utm_content].filter(Boolean).join(" / ")||"Direto"}</td></tr>)}
    {!recent.length&&<tr><td colSpan={6} className="empty">Nenhum chat registrado ainda.</td></tr>}
   </tbody></table></div>
  </div>
 </main>
}