"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabaseClient";
import { Trophy, Lock } from "lucide-react";

export default function SharedLeaderboard({ params }) {
  const [board, setBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Il faut unwrapper les params dans Next.js récent
    // Mais pour l'instant on fait simple
    if(params.id) loadData(params.id);
  }, [params.id]);

  const loadData = async (id) => {
    // 1. Récupérer le board (vérifie s'il est public automatiquement via RLS)
    const { data: boardData, error: boardError } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('id', id)
        .single();

    if (boardError || !boardData) {
        setError(true);
        return;
    }

    setBoard(boardData);

    // 2. Récupérer les membres
    const { data: membersData } = await supabase
        .from('board_members')
        .select('*')
        .eq('leaderboard_id', id)
        .order('rapid', { ascending: false });
    
    setMembers(membersData || []);
  };

  if (error) return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
        <Lock size={48} className="text-red-500 mb-4"/>
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <p className="text-slate-400">Ce classement n'existe pas ou est privé.</p>
    </div>
  );

  if (!board) return <div className="bg-slate-900 min-h-screen text-white p-10">Chargement...</div>;

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center">
        <div className="max-w-4xl w-full mt-10">
            <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">
                {board.name}
            </h1>
            <p className="text-center text-slate-400 mb-10">Classement partagé</p>

            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-2xl">
                <table className="w-full text-left">
                    <thead className="text-slate-500 text-sm uppercase border-b border-slate-700">
                        <tr>
                            <th className="pb-3 pl-4">#</th>
                            <th className="pb-3">Joueur</th>
                            <th className="pb-3 text-center">Rapid</th>
                            <th className="pb-3 text-center">Blitz</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {members.map((m, i) => (
                            <tr key={m.id} className="hover:bg-white/5 transition">
                                <td className="py-4 pl-4 font-bold text-slate-500">{i+1}</td>
                                <td className="py-4 flex items-center gap-3">
                                    <img src={m.avatar} className="w-10 h-10 rounded-full border border-slate-600" />
                                    <span className="font-bold text-lg">{m.username}</span>
                                </td>
                                <td className="py-4 text-center font-mono text-green-400 text-xl font-bold">{m.rapid}</td>
                                <td className="py-4 text-center font-mono text-yellow-400 text-lg">{m.blitz}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="text-center mt-8">
                <a href="/" className="text-blue-400 hover:text-blue-300 underline">Créer mon propre classement Chess Tracker</a>
            </div>
        </div>
    </main>
  );
}