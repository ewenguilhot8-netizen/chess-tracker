// utils/chessApi.js

// Fonction pour obtenir les stats de base du joueur (ELOs, Avatar)
export async function getPlayerStats(username) {
  try {
    // 1. Récupération du profil
    const profileResponse = await fetch(`https://api.chess.com/pub/player/${username}`);
    if (!profileResponse.ok) return null;
    const profileData = await profileResponse.json();

    // 2. Récupération des statistiques
    const statsResponse = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
    const statsData = await statsResponse.json();

    return {
      username: profileData.username,
      avatar: profileData.avatar || "https://www.chess.com/bundles/web/images/user-image.svg",
      country: profileData.country, 
      url: profileData.url, 
      // Récupération sécurisée des ELOs
      rapid: statsData.chess_rapid?.last?.rating || "N/A",
      rapidBest: statsData.chess_rapid?.best?.rating || "N/A",
      blitz: statsData.chess_blitz?.last?.rating || "N/A",
      blitzBest: statsData.chess_blitz?.best?.rating || "N/A",
      bullet: statsData.chess_bullet?.last?.rating || "N/A",
      bulletBest: statsData.chess_bullet?.best?.rating || "N/A",
    };
  } catch (error) {
    console.error("Erreur API Chess.com", error);
    return null;
  }
}

// Fonction pour récupérer l'ajustement ELO d'une seule partie (par ID)
async function getGameDetails(gameUrl, username) {
    try {
        // L'ID de partie est le dernier segment de l'URL Chess.com
        const gameId = gameUrl.split('/').pop();
        
        // Le endpoint standard pour les données JSON complètes d'une partie
        const jsonApiUrl = `https://api.chess.com/pub/game/${gameId}`;
        
        const response = await fetch(jsonApiUrl);
        if (!response.ok) return { adjustment: 0 };
        
        const data = await response.json();
        
        // Déterminer la couleur du joueur pour trouver le bon ajustement ELO
        const isWhite = data.white.username.toLowerCase() === username.toLowerCase();

        const playerInfo = isWhite ? data.white : data.black;
        
        // Le gain/perte d'ELO est dans 'rating_adjustment'
        const adjustment = playerInfo.rating_adjustment || 0;

        return { adjustment: adjustment };

    } catch (error) {
        // console.error("Erreur détails partie:", error);
        return { adjustment: 0 }; 
    }
}


export async function getPlayerDetailedStats(username) {
    const stats = await getPlayerStats(username);
    if (!stats) return null;

    let games = [];
    let graphData = [];
    let recentGames = [];
    let lastArchiveUrl = null;

    try {
        // 1. Récupération des URL des archives
        const archivesResp = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
        const archivesData = await archivesResp.json();
        
        // On prend le DERNIER mois disponible
        lastArchiveUrl = archivesData.archives[archivesData.archives.length - 1];
    } catch(e) {
        console.error("Erreur archives", e);
    }
    
    if (lastArchiveUrl) {
        // 2. Télécharger les parties du mois (PGN data)
        const gamesResp = await fetch(lastArchiveUrl);
        const gamesData = await gamesResp.json();
        
        // On prend les 30 dernières parties pour ne pas surcharger l'API
        games = gamesData.games.reverse().slice(0, 30); 

        // 3. Récupérer l'ajustement ELO pour chaque partie (Requêtes parallèles)
        // ATTENTION: Ceci génère plusieurs requêtes API (1 par partie affichée)
        const detailedGamesPromises = games.map(async (game) => {
            const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
            
            // Récupérer l'ajustement ELO via l'API spécifique à la partie
            const gameDetails = await getGameDetails(game.url, username); 
            const eloChange = gameDetails.adjustment;
            
            const myRating = isWhite ? game.white.rating : game.black.rating;
            const opponentRating = isWhite ? game.black.rating : game.white.rating;
            const result = isWhite ? game.white.result : game.black.result;
            
            let status = "draw";
            if (result === "win") status = "win";
            else if (["checkmated", "resign", "timeout", "abandoned"].includes(result)) status = "loss";

            // Décomposition de la date pour le lien d'analyse
            const endTime = new Date(game.end_time * 1000);

            return {
                date: endTime.toLocaleDateString(),
                timestamp: game.end_time,
                year: endTime.getFullYear(),
                month: endTime.getMonth() + 1, // Janvier = 0, donc +1
                rating: myRating,
                opponent: isWhite ? game.black.username : game.white.username,
                opponentRating: opponentRating,
                result: status,
                url: game.url,
                mode: game.time_class,
                eloChange: eloChange // <-- DONNÉE CLÉ
            };
        });

        // Attendre que toutes les données ELO soient récupérées
        graphData = await Promise.all(detailedGamesPromises);
        
        // Tri et nettoyage
        graphData.reverse(); 
        recentGames = graphData.slice().reverse();
    }

    return {
      ...stats, 
      graphData,
      recentGames
    };
}


// --- Fonctions auxiliaires existantes (à conserver de votre ancien fichier) ---

// Placeholder pour getOnlineStatus (nécessite un endpoint /api/check)
export async function getOnlineStatus(username) {
  try {
    const response = await fetch(`/api/check?username=${username}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === "online";
  } catch (error) {
    return false;
  }
}

// Placeholder pour getYearlyActivity
export async function getYearlyActivity(username) {
    // Implémentation complète non nécessaire ici, retour d'un objet vide
    return {};
}

// Placeholder pour getBadges
export function getBadges(stats, recentGames) {
    // Implémentation complète non nécessaire ici, retour d'un tableau vide
    return [];
}

// Placeholder pour getMonthlyPgn
export async function getMonthlyPgn(username, year, month) {
    // Implémentation non nécessaire ici
    return null;
}