// app/api/clashroyale/stats/route.js (PROXY NEXT.JS SERVER)

import { NextResponse } from 'next/server';

// La clé API doit être dans votre .env (CLASH_ROYALE_API_KEY)
const API_KEY = process.env.CLASH_ROYALE_API_KEY; 

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');

    if (!tag) {
        return NextResponse.json({ error: 'Missing player tag' }, { status: 400 });
    }

    const formattedTag = tag.replace('#', '%23');
    const url = `https://api.clashroyale.com/v1/players/${formattedTag}`;

    if (!API_KEY) {
        return NextResponse.json({ error: 'API Key not configured on the server.' }, { status: 500 });
    }

    try {
        // L'appel se fait ici, CÔTÉ SERVEUR, où le CORS n'est pas un problème.
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.status === 404) {
            return NextResponse.json({ error: 'Player Not Found' }, { status: 404 });
        }
        
        // Retourne les données brutes au client
        return NextResponse.json(data, { status: response.status });

    } catch (error) {
        console.error("Clash Royale API Proxy Error:", error);
        return NextResponse.json({ error: 'Internal Server Error during API call.' }, { status: 500 });
    }
}