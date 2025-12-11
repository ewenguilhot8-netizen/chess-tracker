import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) return NextResponse.json({ status: "offline" });

  try {
    // 1. On récupère le PROFIL complet (qui contient 'last_online')
    const profileResp = await fetch(`https://api.chess.com/pub/player/${username}`, { 
        cache: 'no-store' 
    });
    
    if (!profileResp.ok) return NextResponse.json({ status: "offline" });
    
    const profileData = await profileResp.json();

    // 2. Calcul intelligent
    const now = Math.floor(Date.now() / 1000); // Heure actuelle (secondes)
    const lastOnline = profileData.last_online || 0;
    const timeDiff = now - lastOnline;

    console.log(`🕒 ${username} vu pour la dernière fois il y a : ${timeDiff} secondes`);

    // SI le joueur a été actif dans les 300 dernières secondes (5 min) OU s'il joue une partie daily
    // On considère qu'il est en ligne.
    if (timeDiff < 300) {
        return NextResponse.json({ status: "online", lastSeen: timeDiff });
    }

    // 3. Double vérification avec l'API is-online (au cas où il ne bouge pas la souris mais joue)
    const statusResp = await fetch(`https://api.chess.com/pub/player/${username}/is-online`, { cache: 'no-store' });
    if(statusResp.ok) {
        const statusData = await statusResp.json();
        if(statusData.status === "online") {
            return NextResponse.json({ status: "online", source: "api_status" });
        }
    }

    return NextResponse.json({ status: "offline" });

  } catch (error) {
    console.error("Erreur API:", error);
    return NextResponse.json({ status: "offline" });
  }
}