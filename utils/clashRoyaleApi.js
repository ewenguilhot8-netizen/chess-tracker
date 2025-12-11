// utils/clashRoyaleApi.js (Version CORRIGÉE pour utiliser le Proxy)

// Note: API_KEY n'est plus nécessaire ici, car la clé est gérée par le proxy
// const API_KEY = process.env.CLASH_ROYALE_API_KEY; 


// 1. Obtenir les statistiques du joueur par son Tag
export async function getPlayerStatsCR(tag) {
    // Appel à votre propre API Proxy pour contourner le CORS
    const url = `/api/clashroyale/stats?tag=${tag}`; 

    try {
        // La requête va vers votre serveur Next.js
        const response = await fetch(url);

        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);

        const data = await response.json();

        // Extraire les métriques clés pour les classements
        return {
            tag: data.tag,
            username: data.name,
            trophies: data.trophies,
            bestTrophies: data.bestTrophies,
            level: data.expLevel,
            wins: data.wins,
            losses: data.losses,
            threeCrownWins: data.threeCrownWins,
            favoriteCard: data.favoriteCard?.name || 'N/A',
            winRate: data.wins + data.losses > 0 ? ((data.wins / (data.wins + data.losses)) * 100).toFixed(1) : '0.0',
            clanName: data.clan?.name || 'Aucun Clan'
        };

    } catch (error) {
        // L'erreur "Failed to fetch" sera désormais capturée ici
        console.error("Erreur de communication avec le Proxy:", error);
        return null;
    }
}

// 2. (Les autres fonctions CR comme getBattleLog devront aussi utiliser le même proxy /api/clashroyale/battlelog)
// ... (omitted for brevity)