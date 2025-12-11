import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params; // L'ID de la game (ex: 123456789)
  
  // On récupère les infos passées en paramètres
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("user");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  // Si on a les infos contextuelles, on utilise l'API Archives (Rapide & Fiable)
  if (username && year && month) {
    try {
      console.log(`📥 API Archive: Recherche game ${id} pour ${username} (${month}/${year})`);
      
      const apiUrl = `https://api.chess.com/pub/player/${username}/games/${year}/${month}/pgn`;
      const response = await fetch(apiUrl, { headers: { 'User-Agent': 'ChessTracker/1.0' } });

      if (!response.ok) throw new Error("Archive introuvable");

      const fullPgnText = await response.text();

      // Parsing : On découpe le gros fichier texte
      // Les parties sont séparées par des balises [Event "..."]
      const games = fullPgnText.split('[Event "');

      // On cherche la partie qui contient notre ID dans son lien
      // Le PGN contient un tag [Link ".../game/live/123456789"]
      let foundPgn = null;
      
      for (const fragment of games) {
        if (!fragment.trim()) continue;
        
        // On vérifie si l'ID est dans ce fragment
        if (fragment.includes(`/${id}`)) {
          // On reconstitue le header coupé
          foundPgn = '[Event "' + fragment;
          break;
        }
      }

      if (foundPgn) {
        // Extraction des noms pour l'affichage frontend
        const whiteMatch = foundPgn.match(/\[White "(.*?)"\]/);
        const blackMatch = foundPgn.match(/\[Black "(.*?)"\]/);

        return NextResponse.json({
          game: {
            pgn: foundPgn,
            white: { username: whiteMatch ? whiteMatch[1] : "Blanc" },
            black: { username: blackMatch ? blackMatch[1] : "Noir" }
          }
        });
      }
      
    } catch (error) {
      console.error("Erreur API Archive:", error);
      // On ne retourne pas d'erreur tout de suite, on laisse une chance au plan B ci-dessous
    }
  }

  // PLAN B : Méthode de secours (Callback endpoint - souvent utilisé par l'app mobile)
  // Si on n'avait pas l'année/mois ou si l'archive a échoué
  try {
    console.log(`⚠️ Tentative Endpoint Callback pour ${id}...`);
    const callbackUrl = `https://www.chess.com/callback/live/game/${id}`;
    const cbResp = await fetch(callbackUrl);
    
    if (cbResp.ok) {
        const data = await cbResp.json();
        if (data.game && data.game.pgn) {
             return NextResponse.json({
                game: {
                    pgn: data.game.pgn,
                    white: { username: data.game.white.username },
                    black: { username: data.game.black.username }
                }
            });
        }
    }
  } catch (e) {
      console.error("Callback failed", e);
  }

  return NextResponse.json({ error: "Partie introuvable" }, { status: 404 });
}