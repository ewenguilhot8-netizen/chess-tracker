"use client";

import { useEffect, useState, use, useRef } from 'react';
import { ChevronLeft, Activity, Trophy, Swords, ExternalLink } from 'lucide-react';
import { Chess } from 'chess.js';

export default function LichessLauncher({ params }) {
  const { id: gameId } = use(params);
  
  const [pgn, setPgn] = useState(null);
  const [headers, setHeaders] = useState(null);
  const [loading, setLoading] = useState(true);
  const formRef = useRef(null);

  // 1. Récupération de la partie
  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const res = await fetch(`/api/game/${gameId}?user=${urlParams.get('user')}&year=${urlParams.get('year')}&month=${urlParams.get('month')}`);
        const data = await res.json();
        
        if (data?.game?.pgn) {
          setPgn(data.game.pgn);
          
          // On parse juste les entêtes pour l'affichage joli
          const tempGame = new Chess();
          tempGame.loadPgn(data.game.pgn);
          const h = tempGame.header();
          
          // Nettoyage des données manquantes
          if(!h.WhiteElo) h.WhiteElo = "?";
          if(!h.BlackElo) h.BlackElo = "?";
          setHeaders(h);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId]);

  // Fonction pour lancer l'analyse
  const openLichess = () => {
    if(formRef.current) formRef.current.submit();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#302e2b] flex items-center justify-center text-white flex-col gap-4">
      <Activity className="animate-spin text-[#81b64c]" size={48}/>
      <p className="text-slate-400 font-mono">Préparation de la salle d'analyse...</p>
    </div>
  );

  if (!headers) return <div className="text-white p-10">Erreur de chargement.</div>;

  return (
    <div className="min-h-screen bg-[#262421] flex flex-col font-sans text-white">
      
      {/* HEADER */}
      <div className="bg-[#21201d] border-b border-[#3d3b39] p-4 flex items-center px-6 shadow-md">
        <a href="/" className="text-sm font-bold text-slate-400 hover:text-white flex items-center gap-2 transition">
           <ChevronLeft size={18}/> Retour
        </a>
      </div>

      {/* CONTENU CENTRAL */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[url('https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/SamCopeland/phpmeLoV8.png')] bg-cover bg-center relative">
        {/* Overlay sombre pour lisibilité */}
        <div className="absolute inset-0 bg-[#262421]/90 backdrop-blur-sm"></div>

        <div className="relative z-10 w-full max-w-4xl bg-[#302e2b] border border-[#3d3b39] rounded-2xl shadow-2xl p-8 md:p-12 flex flex-col items-center">
            
            <h1 className="text-3xl md:text-4xl font-black italic text-slate-200 mb-2 flex items-center gap-3">
                <Swords className="text-[#81b64c]" size={40}/> RAPPORT DE PARTIE
            </h1>
            <p className="text-slate-400 mb-10 text-center">Analyse approfondie par Stockfish 16+ (via Lichess)</p>

            {/* CARTES JOUEURS */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-center mb-10">
                
                {/* BLANC */}
                <div className={`flex flex-col items-center p-6 rounded-xl border-2 transition ${headers.Result === '1-0' ? 'bg-[#81b64c]/10 border-[#81b64c] shadow-[0_0_20px_rgba(129,182,76,0.3)]' : 'bg-[#262421] border-[#3d3b39]'}`}>
                    <div className="relative">
                        <img src="https://www.chess.com/bundles/web/images/user-image.svg" className="w-20 h-20 rounded-full border-4 border-slate-500 mb-4"/>
                        {headers.Result === '1-0' && <Trophy className="absolute -top-2 -right-2 text-yellow-400 fill-yellow-400 drop-shadow-lg" size={32}/>}
                    </div>
                    <div className="text-2xl font-bold">{headers.White}</div>
                    <div className="font-mono text-slate-400 text-lg">{headers.WhiteElo}</div>
                </div>

                {/* VS */}
                <div className="text-center">
                    <div className="text-4xl font-black text-slate-600 italic">VS</div>
                    <div className="text-sm font-bold text-slate-500 mt-2">{headers.Date}</div>
                    <div className="text-xs text-slate-600 mt-1 uppercase tracking-widest">{headers.Termination || "Partie terminée"}</div>
                </div>

                {/* NOIR */}
                <div className={`flex flex-col items-center p-6 rounded-xl border-2 transition ${headers.Result === '0-1' ? 'bg-[#81b64c]/10 border-[#81b64c] shadow-[0_0_20px_rgba(129,182,76,0.3)]' : 'bg-[#262421] border-[#3d3b39]'}`}>
                    <div className="relative">
                        <img src="https://www.chess.com/bundles/web/images/user-image.svg" className="w-20 h-20 rounded-full border-4 border-slate-500 mb-4 bg-black"/>
                        {headers.Result === '0-1' && <Trophy className="absolute -top-2 -right-2 text-yellow-400 fill-yellow-400 drop-shadow-lg" size={32}/>}
                    </div>
                    <div className="text-2xl font-bold">{headers.Black}</div>
                    <div className="font-mono text-slate-400 text-lg">{headers.BlackElo}</div>
                </div>

            </div>

            {/* BOUTON ACTION */}
            <button 
                onClick={openLichess}
                className="group relative bg-gradient-to-b from-[#81b64c] to-[#66913a] hover:from-[#92c95a] hover:to-[#73a341] text-white text-xl font-bold py-5 px-12 rounded-xl shadow-xl transition-all transform hover:scale-105 active:scale-95 w-full md:w-auto"
            >
                <div className="flex items-center gap-3">
                    <Activity size={28} className="animate-pulse"/>
                    OUVRIR L'ANALYSE COMPLÈTE
                    <ExternalLink size={20} className="opacity-70 group-hover:opacity-100"/>
                </div>
                <div className="text-[10px] font-normal opacity-80 mt-1 uppercase tracking-wide">Moteur Stockfish • Erreurs • Gaffes • Bilan</div>
            </button>

            {/* FORMULAIRE CACHÉ POUR LICHESS */}
            <form 
                ref={formRef}
                method="POST" 
                action="https://lichess.org/api/import" 
                target="_blank" // Ouvre un nouvel onglet
                className="hidden"
            >
                <input type="hidden" name="pgn" value={pgn} />
                <input type="hidden" name="analyse" value="on" />
                <input type="hidden" name="eval" value="on" />
            </form>

        </div>
      </div>
    </div>
  );
}