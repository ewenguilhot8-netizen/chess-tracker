import { NextResponse } from "next/server";
// On importe puppeteer (attention, c'est lourd, ça peut ramer sur des petits serveurs gratuits)
import puppeteer from "puppeteer";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) return NextResponse.json({ error: "No username" });

  try {
    console.log(`🕵️‍♂️ Scraping lancé pour : ${username}`);

    // 1. Lancer le navigateur fantôme
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox'] // Nécessaire pour certains serveurs
    });
    const page = await browser.newPage();

    // 2. Aller sur le profil du joueur
    // On met un User-Agent pour faire croire qu'on est un vrai humain sur PC
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36');
    
    await page.goto(`https://www.chess.com/member/${username}`, { 
        waitUntil: 'domcontentloaded' // On attend que le HTML soit là
    });

    // 3. Chercher l'élément qui contient le lien de la partie
    // Sur Chess.com, quand on joue, un lien apparait souvent avec la classe "live-game-link" ou dans la section présence.
    // Cette partie est "fragile" : si Chess.com change son code HTML, ça casse.
    
    // On cherche un lien qui contient "/game/live/"
    const gameLink = await page.evaluate(() => {
      // On cherche tous les liens de la page
      const anchors = Array.from(document.querySelectorAll('a'));
      // On trouve celui qui ressemble à une game live
      const liveGame = anchors.find(a => a.href.includes('/game/live/') || a.href.includes('/play/online/'));
      return liveGame ? liveGame.href : null;
    });

    await browser.close();

    if (gameLink) {
        console.log("✅ Game trouvée :", gameLink);
        // On extrait l'ID de la game (ex: https://chess.com/game/live/12345 -> 12345)
        const gameId = gameLink.split('/').pop();
        return NextResponse.json({ status: "playing", gameId: gameId, url: gameLink });
    } else {
        console.log("❌ Pas de game live trouvée sur le profil.");
        return NextResponse.json({ status: "idle" });
    }

  } catch (error) {
    console.error("Erreur Puppeteer:", error);
    return NextResponse.json({ error: "Scraping failed" });
  }
}