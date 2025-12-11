"use client";
import { useState } from "react";
import { getPlayerStats } from "../../utils/chessApi";
import { Search, Swords, Trophy, AlertTriangle } from "lucide-react";

export default function VersusPage() {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFight = async (e) => {
    e.preventDefault();
    if(!p1 || !p2) return;
    setLoading(true);
    const [d1, d2] = await Promise.all([getPlayerStats(p1), getPlayerStats(p2)]);
    setData1(d1);
    setData2(d2);
    setLoading(false);
  };

  const getWinProb = (elo1, elo2) => {
    // Formule ELO simplifiée pour la proba de victoire
    const diff = elo2 - elo1;
    const chance = 1 / (1 + Math.pow(10, diff / 400));
    return Math.round(chance * 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center">
      <h1 className="text-5xl font-black mb-8 italic flex items-center gap-4">
        <span className="text-red-500">VERSUS</span> <Swords size={48}/> <span className="text-blue-500">MODE</span>
      </h1>

      <form onSubmit={handleFight} className="flex flex-col md:flex-row gap-4 mb-10 w-full max-w-2xl">
        <input value={p1} onChange={e=>setP1(e.target.value)} placeholder="Joueur 1 (ex: Hikaru)" className="flex-1 bg-slate-900 border border-red-900 p-4 rounded-xl text-center font-bold text-red-100 outline-none focus:border-red-500 transition"/>
        <div className="flex items-center justify-center font-black text-2xl text-slate-600">VS</div>
        <input value={p2} onChange={e=>setP2(e.target.value)} placeholder="Joueur 2 (ex: MagnusCarlsen)" className="flex-1 bg-slate-900 border border-blue-900 p-4 rounded-xl text-center font-bold text-blue-100 outline-none focus:border-blue-500 transition"/>
        <button type="submit" className="bg-white text-black font-black px-6 rounded-xl hover:scale-105 transition">{loading ? "..." : "FIGHT!"}</button>
      </form>

      {data1 && data2 && (
        <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            
            {/* BACKGROUND VS */}
            <div className="absolute inset-0 flex">
                <div className="w-1/2 bg-gradient-to-r from-red-900/20 to-transparent"></div>
                <div className="w-1/2 bg-gradient-to-l from-blue-900/20 to-transparent"></div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-center items-center">
                
                {/* JOUEUR 1 */}
                <div className="flex flex-col items-center">
                    <img src={data1.avatar} className="w-32 h-32 rounded-full border-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]"/>
                    <h2 className="text-3xl font-black mt-4 text-red-500">{data1.username}</h2>
                    <div className="text-4xl font-mono font-bold mt-2">{data1.rapid}</div>
                    <div className="text-xs uppercase text-slate-500">Rapid Elo</div>
                </div>

                {/* STATS CENTRALES */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="text-xs uppercase text-slate-400 mb-1">Prédiction</div>
                        <div className="flex justify-between font-bold text-lg mb-1">
                            <span className="text-red-400">{getWinProb(data1.rapid, data2.rapid)}%</span>
                            <span className="text-blue-400">{getWinProb(data2.rapid, data1.rapid)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500" style={{width: `${getWinProb(data1.rapid, data2.rapid)}%`}}></div>
                        </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className={data1.blitz > data2.blitz ? "text-green-400 font-bold" : "text-slate-400"}>{data1.blitz}</span>
                            <span className="text-slate-600">BLITZ</span>
                            <span className={data2.blitz > data1.blitz ? "text-green-400 font-bold" : "text-slate-400"}>{data2.blitz}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className={data1.bullet > data2.bullet ? "text-green-400 font-bold" : "text-slate-400"}>{data1.bullet}</span>
                            <span className="text-slate-600">BULLET</span>
                            <span className={data2.bullet > data1.bullet ? "text-green-400 font-bold" : "text-slate-400"}>{data2.bullet}</span>
                        </div>
                    </div>
                </div>

                {/* JOUEUR 2 */}
                <div className="flex flex-col items-center">
                    <img src={data2.avatar} className="w-32 h-32 rounded-full border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)]"/>
                    <h2 className="text-3xl font-black mt-4 text-blue-500">{data2.username}</h2>
                    <div className="text-4xl font-mono font-bold mt-2">{data2.rapid}</div>
                    <div className="text-xs uppercase text-slate-500">Rapid Elo</div>
                </div>

            </div>
        </div>
      )}
      
      <a href="/" className="mt-12 text-slate-500 hover:text-white underline">Retour au Dashboard</a>
    </div>
  );
}