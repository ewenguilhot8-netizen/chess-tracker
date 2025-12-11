from flask import Flask, request, jsonify
from flask_cors import CORS
import chess
import chess.engine
import chess.pgn
import io
import math
import csv

app = Flask(__name__)
CORS(app) # Autorise ton site Next.js à parler au serveur

# CONFIGURATION
STOCKFISH_PATH = "./stockfish.exe" # <-- METS LE BON CHEMIN ICI
OPENINGS_FILE = "openings_master.csv"

# 1. CHARGEMENT OUVERTURES
openings_db = []
try:
    with open(OPENINGS_FILE, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader) # Skip header
        for row in reader:
            if len(row) >= 3:
                openings_db.append({"name": row[1], "moves": row[2]})
except Exception as e:
    print(f"Warning: Pas d'ouvertures chargées ({e})")

# 2. MATHS (Win Chance)
def to_win_chance(cp):
    if cp is None: return 50
    # Formule Sigmoïde Lichess
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * min(max(cp, -1000), 1000))) - 1)

def get_material(board):
    vals = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
    w, b = 0, 0
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p:
            if p.color == chess.WHITE: w += vals.get(p.piece_type, 0)
            else: b += vals.get(p.piece_type, 0)
    return w, b

# 3. ROUTE D'ANALYSE
@app.route('/analyze', methods=['POST'])
def analyze_game():
    data = request.json
    pgn_text = data.get('pgn')
    
    if not pgn_text: return jsonify({"error": "No PGN"}), 400

    print("🔍 Analyse commencée...")
    pgn_io = io.StringIO(pgn_text)
    game = chess.pgn.read_game(pgn_io)
    board = game.board()
    
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    
    results = []
    w_acc_points = []
    b_acc_points = []
    
    pgn_moves = ""
    is_book = True
    opening_name = "Début"

    # Boucle sur les coups
    move_count = 0
    for node in game.mainline():
        move = node.move
        move_count += 1
        
        # Gestion Ouverture
        san = board.san(move)
        num = (move_count + 1) // 2
        pgn_moves += (f"{num}. {san} " if move_count % 2 != 0 else f"{san} ")
        
        if is_book:
            match = next((o for o in openings_db if o["moves"].startswith(pgn_moves.strip())), None)
            if match: opening_name = match["name"]
            else: is_book = False

        # --- ANALYSE STOCKFISH ---
        # 1. Avant le coup (Ce qu'il fallait jouer)
        info_before = engine.analyse(board, chess.engine.Limit(depth=14)) # Profondeur 14 (rapide)
        score_before = info_before["score"].white() # Toujours vue blanche
        best_move_uci = info_before["pv"][0].uci() if "pv" in info_before else str(move)
        
        cp_before = score_before.score(mate_score=2000)
        
        # 2. On joue le coup
        mat_before_w, mat_before_b = get_material(board)
        board.push(move)
        mat_after_w, mat_after_b = get_material(board)

        # 3. Après le coup (Ce qu'on a obtenu)
        info_after = engine.analyse(board, chess.engine.Limit(depth=12))
        score_after = info_after["score"].white()
        cp_after = score_after.score(mate_score=2000)

        # --- CLASSIFICATION ---
        turn = not board.turn # C'est le tour de celui qui vient de jouer
        
        # Win Chance Delta
        # Si Blanc joue : Delta = WinChance(Avant) - WinChance(Après)
        # Si Noir joue : Delta = WinChance(-Avant) - WinChance(-Après) (car Noir veut score négatif)
        
        wc_before = to_win_chance(cp_before if turn == chess.WHITE else -cp_before)
        wc_after = to_win_chance(cp_after if turn == chess.WHITE else -cp_after)
        delta = wc_before - wc_after

        cat = "good"
        
        if str(move) == best_move_uci:
            cat = "best"
            # Détection Brillant (Sacrifice matériel + Maintien avantage)
            mat_delta = (mat_before_w - mat_after_w) if turn == chess.WHITE else (mat_before_b - mat_after_b)
            if mat_delta > 0 and wc_after > 80 and delta < 2:
                cat = "brillant"
            elif delta < 1 and wc_before < 50 and wc_after > 50:
                cat = "great"
        else:
            if delta <= 2: cat = "best" # Quasi parfait
            elif delta <= 5: cat = "excellent"
            elif delta <= 10: cat = "good"
            elif delta <= 20: cat = "inaccuracy"
            elif delta <= 35: cat = "mistake"
            else: cat = "blunder"

        if is_book and cat not in ['blunder', 'mistake']: cat = "book"

        # Précision
        acc = max(0, 100 - (delta * 1.5))
        if turn == chess.WHITE: w_acc_points.append(acc)
        else: b_acc_points.append(acc)

        # --- JSON RESPONSE ---
        results.append({
            "fen": board.fen(),
            "san": san,
            "uci": str(move),
            "eval": cp_before, # Score avant le coup (pour la barre)
            "bestMove": best_move_uci,
            "category": cat,
            "opening": opening_name,
            "winDelta": round(delta, 1),
            "pv": [m.uci() for m in info_before.get("pv", [])[:5]] # 5 premiers coups de la suite idéale
        })

    engine.quit()
    
    # Moyennes Précision
    w_acc = round(sum(w_acc_points)/len(w_acc_points)) if w_acc_points else 0
    b_acc = round(sum(b_acc_points)/len(b_acc_points)) if b_acc_points else 0

    return jsonify({
        "moves": results,
        "accuracy": {"w": w_acc, "b": b_acc},
        "opening": opening_name
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)