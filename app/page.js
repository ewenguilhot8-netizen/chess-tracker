"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { getPlayerStats, getPlayerDetailedStats, getYearlyActivity, getBadges, getMonthlyPgn } from "../utils/chessApi";
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { 
  Search, Trophy, Save, Trash2, Share2, LogOut, 
  Lock, Globe, Activity, X, TrendingUp, History, 
  Plus, Layout, Link as LinkIcon, Swords, MessageSquare, Send,
  DownloadCloud
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getPlayerStatsCR } from "../utils/clashRoyaleApi";

export default function Home() {
  const [session, setSession] = useState(null);
  const [viewMode, setViewMode] = useState("loading");
  
  const [myProfile, setMyProfile] = useState(null);
  const [leaderboards, setLeaderboards] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);

  const [inputUser, setInputUser] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const chatScrollRef = useRef(null);

  const [detailedProfile, setDetailedProfile] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activityMap, setActivityMap] = useState(null);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    const initApp = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        await loadUserData(session.user.id);
        setViewMode("app");
      } else {
        setViewMode("auth");
      }
    };
    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
        setViewMode("app");
      } else {
        setViewMode("auth");
        setLeaderboards([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) setMyProfile(profile);

    const { data: boards } = await supabase.from('leaderboards').select('*').eq('owner_id', userId).order('created_at', { ascending: true });
    if (boards && boards.length > 0) {
      setLeaderboards(boards);
      switchBoard(boards[0]);
    } else {
      createLeaderboard("Mon Premier Classement", userId);
    }
  };

  const createLeaderboard = async (name, userId = session?.user?.id) => {
    if (!name) return;
    const { data } = await supabase.from('leaderboards').insert([{ name: name, owner_id: userId }]).select().single();
    if (data) {
      setLeaderboards(prev => [...prev, data]);
      switchBoard(data);
      setShowNewBoardModal(false);
      setNewBoardName("");
    }
  };

  const switchBoard = async (board) => {
    setActiveBoard(board);
    setMembers([]);
    setMessages([]);
    
    const { data: mems } = await supabase.from('board_members').select('*').eq('leaderboard_id', board.id).order('rapid', { ascending: false });
    setMembers(mems || []);

    fetchMessages(board.id);
  };

  const deleteBoard = async (e, boardId) => {
    e.stopPropagation();
    if(!confirm("Supprimer définitivement ce classement ?")) return;
    
    await supabase.from('leaderboards').delete().eq('id', boardId);
    const newBoards = leaderboards.filter(b => b.id !== boardId);
    setLeaderboards(newBoards);
    if (activeBoard?.id === boardId) {
        if (newBoards.length > 0) switchBoard(newBoards[0]);
        else setActiveBoard(null);
    }
  };

  const togglePublic = async () => {
    const newVal = !activeBoard.is_public;
    await supabase.from('leaderboards').update({ is_public: newVal }).eq('id', activeBoard.id);
    setActiveBoard({ ...activeBoard, is_public: newVal });
    setLeaderboards(leaderboards.map(b => b.id === activeBoard.id ? { ...b, is_public: newVal } : b));
  };

  const fetchMessages = async (boardId) => {
    const { data } = await supabase.from('board_messages').select('*').eq('leaderboard_id', boardId).order('created_at', { ascending: true }).limit(50);
    setMessages(data || []);
    setTimeout(() => chatScrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if(!chatInput.trim() || !activeBoard) return;
    
    const pseudo = myProfile?.chess_username || session.user.email.split('@')[0];
    
    await supabase.from('board_messages').insert({
        leaderboard_id: activeBoard.id,
        user_id: session.user.id,
        username: pseudo,
        content: chatInput
    });
    setChatInput("");
    fetchMessages(activeBoard.id); 
  };

  const linkChessAccount = async () => {
    const username = prompt("Ton pseudo Chess.com ?");
    if (!username) return;
    const stats = await getPlayerStats(username);
    if (!stats) { alert("Introuvable !"); return; }
    await supabase.from('profiles').upsert({ id: session.user.id, chess_username: stats.username, avatar_url: stats.avatar });
    setMyProfile({ chess_username: stats.username, avatar_url: stats.avatar });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if(!inputUser) return;
    setLoading(true);
    
    // Détection du format : si l'input commence par # ou %23, on suppose CR
    const isClashRoyale = inputUser.startsWith('#') || inputUser.startsWith('%23');
    
    let data = null;
    
    if (isClashRoyale) {
        // Recherche Clash Royale (Tag CR)
        data = await getPlayerStatsCR(inputUser);
        if (data) {
            // Stocker les données Clash Royale
            setPlayerData({
                username: data.username,
                avatar: data.clanName ? `Clan: ${data.clanName}` : 'CR Player', // Utilisation simple du clan comme avatar/info
                metrics: { trophies: data.trophies, winRate: data.winRate, bestTrophies: data.bestTrophies },
                type: 'clash_royale'
            });
        }
    } else {
        // Recherche Chess.com (Pseudo)
        data = await getPlayerStats(inputUser);
        if (data) {
            // Stocker les données Chess.com
            setPlayerData({
                username: data.username,
                avatar: data.avatar,
                metrics: { rapid: data.rapid, blitz: data.blitz, bullet: data.bullet },
                type: 'chess_com'
            });
        }
    }

    if (!data) alert("Profil introuvable !");
    setLoading(false);
};

  const addPlayer = async () => {
    if (!playerData || !activeBoard) return;
    const exists = members.find(m => m.username === playerData.username);
    if (exists) { alert("Déjà présent !"); return; }
    
    // Déterminer les colonnes à insérer (on utilise les colonnes ELO comme génériques pour l'exemple)
    let metricsToInsert = {};
    if (playerData.type === 'clash_royale') {
        // Insérer les métriques CR dans les colonnes Chess (simplification)
        metricsToInsert = {
            rapid: playerData.metrics.trophies, // Trophées dans Rapid
            blitz: playerData.metrics.winRate,  // Win Rate dans Blitz
            // On pourrait ajouter un champ 'game_type' dans Supabase pour mieux séparer
        };
    } else {
        metricsToInsert = {
            rapid: playerData.metrics.rapid,
            blitz: playerData.metrics.blitz
        };
    }
    
    await supabase.from('board_members').insert({ 
        leaderboard_id: activeBoard.id, 
        username: playerData.username, 
        avatar: playerData.avatar, 
        ...metricsToInsert // Spread des métriques
    });
    switchBoard(activeBoard);
    setPlayerData(null); setInputUser("");
};

  const deletePlayer = async (e, id) => {
    e.stopPropagation();
    if(!confirm("Supprimer ?")) return;
    await supabase.from('board_members').delete().eq('id', id);
    switchBoard(activeBoard);
  };

  const openPlayerDetails = async (username) => {
    setLoadingDetails(true);
    setDetailedProfile(null);
    setActivityMap(null);
    setBadges([]);

    const details = await getPlayerDetailedStats(username);
    setDetailedProfile(details);

    if (details) {
        const earnedBadges = getBadges(details, details.recentGames);
        setBadges(earnedBadges);
        const activity = await getYearlyActivity(username);
        setActivityMap(activity);
    }
    setLoadingDetails(false);
  };

  // --- ACTION : TÉLÉCHARGER PGN ---
  const handleDownloadPgn = async () => {
    if (!detailedProfile) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; 

    const btn = document.getElementById('pgn-btn-text');
    if(btn) btn.innerText = "Téléchargement...";

    const pgnData = await getMonthlyPgn(detailedProfile.username, year, month);

    if (pgnData) {
      const blob = new Blob([pgnData], { type: 'application/x-chess-pgn' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detailedProfile.username}_${year}_${month}.pgn`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      alert("Aucune partie trouvée pour ce mois-ci.");
    }
    
    if(btn) btn.innerText = "PGN du mois";
  };

  const renderHeatmap = () => {
    if(!activityMap) return <div className="text-center text-xs text-slate-500 py-4">Chargement de l'activité...</div>;
    const days = [];
    for(let i=29; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = activityMap[dateStr] || 0;
        let color = "bg-slate-800";
        if(count > 0) color = "bg-green-900"; if(count > 3) color = "bg-green-700"; if(count > 6) color = "bg-green-500";
        days.push(<div key={dateStr} title={`${dateStr}: ${count} games`} className={`w-3 h-3 rounded-sm ${color}`}></div>);
    }
    return <div className="flex flex-col gap-2"><h4 className="text-xs font-bold uppercase text-slate-500">Activité (30j)</h4><div className="flex gap-1 flex-wrap">{days}</div></div>;
  };

  if (viewMode === "loading") return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Activity className="animate-spin mr-2"/> Chargement...</div>;
  
  if (viewMode === "auth") return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text mb-8">Chess Tracker</h1>
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
            <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} theme="dark" providers={['google']} redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/`} />
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans">
      
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex z-20">
        <div className="p-6">
          <h1 className="text-2xl font-black italic tracking-tighter text-green-500 flex items-center gap-2">
            <Trophy size={28}/> CHESS<span className="text-white">TRACKER</span>
          </h1>
        </div>
        
        <div className="px-4 mb-4">
            <a href="/versus" className="flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-500 p-3 rounded-xl font-bold text-white hover:scale-105 transition shadow-lg text-sm">
                <Swords size={18}/> MODE VERSUS
            </a>
        </div>

        <div className="px-4 mb-6">
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3 shadow-sm">
             {myProfile ? (
               <>
                 <img src={myProfile.avatar_url} className="w-10 h-10 rounded-full border-2 border-green-500"/>
                 <div className="overflow-hidden">
                   <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Compte Lié</div>
                   <div className="font-bold truncate text-sm">{myProfile.chess_username}</div>
                 </div>
               </>
             ) : (
               <button onClick={linkChessAccount} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 w-full font-semibold">
                 <LinkIcon size={16}/> Lier compte Chess.com
               </button>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
           <div className="text-xs font-bold text-slate-500 uppercase px-2 mb-2 tracking-wider">Mes classements</div>
           {leaderboards.map(board => (
             <div key={board.id} className={`group w-full flex items-center gap-2 p-2 rounded-lg transition ${activeBoard?.id === board.id ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <button onClick={() => switchBoard(board)} className="flex-1 flex items-center gap-3 text-left overflow-hidden">
                    <Layout size={18} className="shrink-0"/> <span className="truncate text-sm font-medium">{board.name}</span>
                </button>
                <button onClick={(e) => deleteBoard(e, board.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-300 p-1 transition"><Trash2 size={14}/></button>
             </div>
           ))}
           <button onClick={() => setShowNewBoardModal(true)} className="w-full text-left p-3 rounded-lg flex items-center gap-3 text-slate-500 hover:bg-slate-800 hover:text-green-400 border border-dashed border-slate-700 hover:border-green-500 transition mt-4 text-sm font-bold">
             <Plus size={18}/> Nouveau classement
           </button>
        </div>

        <div className="p-4 border-t border-slate-800">
           <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition w-full p-2 rounded hover:bg-red-900/10 text-sm font-bold">
             <LogOut size={18}/> Déconnexion
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative bg-slate-950">
        
        <header className="md:hidden p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
            <span className="font-bold text-green-500 flex items-center gap-2"><Trophy size={20}/> ChessTracker</span>
            <button onClick={() => supabase.auth.signOut()}><LogOut size={20}/></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <div>
                   <h2 className="text-3xl font-bold flex items-center gap-3 text-white">{activeBoard?.name}</h2>
                   <p className="text-slate-400 text-sm mt-1 font-medium">{members.length} joueurs suivis</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={togglePublic} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition ${activeBoard?.is_public ? 'bg-green-500/10 text-green-400 border-green-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {activeBoard?.is_public ? <Globe size={16}/> : <Lock size={16}/>} {activeBoard?.is_public ? "Public" : "Privé"}
                    </button>
                    {activeBoard?.is_public && (
                        <button onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/share/${activeBoard.id}`); alert("Lien copié !")}} className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg shadow-lg">
                            <Share2 size={18}/>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-green-400 uppercase tracking-wide text-sm"><Search size={18}/> Ajouter un joueur</h3>
                        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                            <input value={inputUser} onChange={e=>setInputUser(e.target.value)} placeholder="Pseudo..." className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:border-green-500 transition text-sm"/>
                            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white p-3 rounded-lg shadow-lg">{loading ? "..." : <Search size={20}/>}</button>
                        </form>
                        {playerData && (
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center animate-in fade-in">
                                <img src={playerData.avatar} className="w-16 h-16 rounded-full mx-auto border-4 border-slate-800 mb-2"/>
                                <div className="font-bold text-lg text-white">{playerData.username}</div>
                                <button onClick={addPlayer} className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold flex justify-center gap-2 text-sm mt-2"><Save size={16}/> Ajouter au tableau</button>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col h-[400px] shadow-xl overflow-hidden">
                        <div className="p-3 border-b border-slate-800 bg-slate-900/50 text-sm font-bold flex items-center gap-2 text-slate-400">
                            <MessageSquare size={16}/> Mur du Trash-Talk
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50 custom-scrollbar">
                            {messages.length === 0 && <div className="text-center text-xs text-slate-600 mt-10">Sois le premier à parler !</div>}
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.user_id === session.user.id ? 'items-end' : 'items-start'}`}>
                                    <div className="text-[10px] text-slate-500 mb-1 px-1">{msg.username}</div>
                                    <div className={`px-3 py-2 rounded-lg text-sm max-w-[90%] ${msg.user_id === session.user.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatScrollRef}/>
                        </div>
                        <form onSubmit={sendMessage} className="p-2 border-t border-slate-800 flex gap-2 bg-slate-900">
                            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Un petit mot..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-white"/>
                            <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-500"><Send size={16}/></button>
                        </form>
                    </div>
                </div>

                <div className="xl:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl min-h-[500px]">
                    <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
    <thead className="text-slate-500 text-xs font-bold uppercase border-b border-slate-800 tracking-wider">
        <tr>
            <th className="pb-4 pl-2">#</th>
            <th className="pb-4">Joueur</th>
            {/* Colonnes adaptées pour le contexte général */}
            <th className="pb-4 text-center">Score 1</th> 
            <th className="pb-4 text-center">Score 2</th>
            <th className="pb-4 text-right"></th>
        </tr>
    </thead>
    <tbody className="divide-y divide-slate-800/50">
        {/* ... (logique membres.map) ... */}
        {members.map((m, i) => (
            <tr key={m.id} onClick={() => openPlayerDetails(m.username)} className={`hover:bg-slate-800/80 cursor-pointer group transition`}>
                <td className="py-4 pl-2 font-bold text-slate-500 text-sm">{i+1}</td>
                <td className="py-4 flex items-center gap-3">
                    {/* Logique d'affichage simple d'avatar ou d'icône CR */}
                    <img src={m.avatar.includes('http') ? m.avatar : 'https://cdn-icons-png.flaticon.com/512/1054/1054944.png'} 
                         className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 object-cover"/>
                    <div className="flex flex-col">
                        <span className="font-bold text-base text-white">{m.username}</span>
                    </div>
                </td>
                
                {/* Score 1 (Trophées CR ou Rapid ELO) */}
                <td className="py-4 text-center font-mono font-bold text-green-400 text-lg">
                    {m.rapid} 
                </td>
                
                {/* Score 2 (Win Rate CR ou Blitz ELO) */}
                <td className="py-4 text-center font-mono text-yellow-400 text-lg">
                    {m.blitz} {m.blitz > 1000 ? '' : '%'} 
                </td>

                <td className="py-4 text-right pr-2">
                    <button onClick={(e)=>deletePlayer(e, m.id)} className="text-slate-600 hover:text-red-500 hover:bg-red-500/10 p-2 rounded transition opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                </td>
            </tr>
        ))}
    </tbody>
</table>
                    </div>
                </div>

            </div>
        </div>
      </main>

      {showNewBoardModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-full max-w-sm">
                  <h3 className="text-xl font-bold mb-4 text-white">Nouveau Classement</h3>
                  <input autoFocus value={newBoardName} onChange={e=>setNewBoardName(e.target.value)} placeholder="Nom (ex: Amis du Lycée)" className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg mb-6 outline-none focus:border-green-500 text-white"/>
                  <div className="flex gap-3 justify-end">
                      <button onClick={()=>setShowNewBoardModal(false)} className="text-slate-400 hover:text-white px-4 py-2">Annuler</button>
                      <button onClick={()=>createLeaderboard(newBoardName)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">Créer</button>
                  </div>
              </div>
          </div>
      )}

      {(loadingDetails || detailedProfile) && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col relative">
                
                {loadingDetails ? (
                    <div className="flex flex-col items-center justify-center h-96">
                        <Activity className="animate-spin text-green-500 w-12 h-12 mb-4"/>
                        <p className="text-xl font-bold text-slate-300">Analyse complète...</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-slate-800 p-6 flex justify-between items-start border-b border-slate-700 shrink-0">
                            <div className="flex items-center gap-6">
                                <img src={detailedProfile.avatar} className="w-24 h-24 rounded-full border-4 border-green-500 shadow-lg bg-slate-700"/>
                                <div>
                                    <h2 className="text-4xl font-black text-white tracking-tight">{detailedProfile.username}</h2>
                                    <a href={detailedProfile.url} target="_blank" className="text-blue-400 hover:underline text-sm flex items-center gap-1">Voir profil officiel <LinkIcon size={12}/></a>
                                    
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {badges.map((b, i) => (
                                            <div key={i} className={`bg-slate-950 px-3 py-1 rounded-full border border-slate-700 flex items-center gap-2 text-sm font-bold ${b.color}`} title={b.desc}>
                                                <span>{b.icon}</span> {b.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setDetailedProfile(null)} className="bg-slate-700 hover:bg-red-500 p-2 rounded-full transition text-white"><X size={24}/></button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                
                                <div className="space-y-6">
                                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 shadow-lg">
                                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white"><TrendingUp className="text-blue-400"/> Évolution Elo</h3>
                                        <div className="h-48 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={detailedProfile.graphData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="date" hide />
                                                    <YAxis domain={['auto', 'auto']} stroke="#94a3b8" width={40} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                                                    <Line type="monotone" dataKey="rating" stroke="#4ade80" strokeWidth={3} dot={{ r: 3 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 shadow-lg">
                                        {renderHeatmap()}
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 max-h-[400px] overflow-y-auto custom-scrollbar shadow-lg">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                                            <History className="text-orange-400"/> Historique récent
                                        </h3>
                                        <button 
                                            onClick={handleDownloadPgn}
                                            className="flex items-center gap-2 bg-slate-700 hover:bg-green-600 border border-slate-600 text-xs font-bold py-1.5 px-3 rounded-lg transition text-white shadow-sm"
                                            title="Télécharger toutes les parties de ce mois"
                                        >
                                            <DownloadCloud size={14}/> <span id="pgn-btn-text">PGN du mois</span>
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {detailedProfile.recentGames.map((game, idx) => {
                                            const gameId = game.url.split('/').pop();
                                            // Calcul dynamique de la date depuis le timestamp
                                            const dateObj = new Date(game.timestamp * 1000);
                                            const year = dateObj.getFullYear();
                                            const month = String(dateObj.getMonth() + 1).padStart(2, '0');

                                            return (
                                                <a 
                                                    key={idx} 
                                                    href={`/game/${gameId}?user=${detailedProfile.username}&year=${year}&month=${month}`} 
                                                    className="block bg-slate-900 p-3 rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-green-500 transition flex justify-between items-center group" 
                                                    title="Lancer l'analyse Stockfish"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-10 rounded-full ${game.result === 'win' ? 'bg-green-500 shadow-green-500/50 shadow-lg' : game.result === 'loss' ? 'bg-red-500' : 'bg-slate-500'}`}></div>
                                                        <div>
                                                            <div className="font-bold flex items-center gap-2 text-white">Vs {game.opponent} <span className="text-xs font-normal text-slate-500">({game.opponentRating})</span></div>
                                                            <div className="text-xs text-slate-400">{game.mode} • {game.date}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <div className={`font-mono font-bold text-lg ${game.result === 'win' ? 'text-green-400' : game.result === 'loss' ? 'text-red-400' : 'text-slate-400'}`}>{game.result === 'win' ? '+W' : game.result === 'loss' ? '-L' : '=D'}</div>
                                                        <div className="text-[10px] text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition">ANALYSER ➜</div>
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}
    </div>
  );
}