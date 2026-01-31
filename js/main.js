document.addEventListener('DOMContentLoaded', () => {
    const defaultSize = 6;
    const defaultDifficulty = 'medium';
    
    // Check URL for difficulty param
    const urlParams = new URLSearchParams(window.location.search);
    const difficultyParam = urlParams.get('d');
    const initialDifficulty = difficultyParam || defaultDifficulty;
    
    const game = new Game(defaultSize, initialDifficulty);
    const history = new SolveHistory();
    const ui = new UI(game, history);

    // Initial Start
    const gameParam = urlParams.get('g'); // Seed-based format: size:seed
    const legacyParam = urlParams.get('l'); // Old compact format
    const oldLegacyParam = urlParams.get('level'); // Very old JSON format
    let levelData = null;

    if (gameParam) {
        // New seed-based format: ?g=6:abc12345 or ?g=6:abc12345:hard
        try {
            const parts = gameParam.split(':');
            const sizeStr = parts[0];
            const seed = parts[1];
            const difficulty = parts[2] || difficultyParam || defaultDifficulty;
            levelData = {
                size: parseInt(sizeStr),
                seed: seed,
                difficulty: difficulty
            };
        } catch (e) {
            console.error("Failed to parse seed-based level", e);
        }
    } else if (legacyParam) {
        // Try to decode old compact format
        try {
            const base64 = legacyParam.replace(/-/g, '+').replace(/_/g, '/') + '==';
            const decoded = atob(base64);
            const [size, boardStr, hStr, vStr] = decoded.split('|');
            
            const s = parseInt(size);
            const board = [];
            for (let i = 0; i < s; i++) {
                board.push(boardStr.slice(i * s, (i + 1) * s).split('').map(Number));
            }
            
            const decodeConstraints = (str) => str.split(',').map(row => 
                row.split('').map(c => c === 'e' ? '=' : c === 'x' ? 'x' : null)
            );
            
            levelData = {
                size: s,
                initialBoard: board,
                constraints: {
                    h: decodeConstraints(hStr),
                    v: decodeConstraints(vStr)
                }
            };
        } catch (e) {
            console.error("Failed to parse compact level", e);
        }
    } else if (oldLegacyParam) {
        // Very old JSON format
        try {
            levelData = JSON.parse(atob(oldLegacyParam));
        } catch (e) {
            console.error("Failed to parse legacy level", e);
        }
    }

    ui.startNewGame(levelData);
});
