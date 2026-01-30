document.addEventListener('DOMContentLoaded', () => {
    const defaultSize = 6;
    const game = new Game(defaultSize);
    const history = new SolveHistory();
    const ui = new UI(game, history);

    // Initial Start
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('g'); // Seed-based format: size:seed
    const legacyParam = urlParams.get('l'); // Old compact format
    const oldLegacyParam = urlParams.get('level'); // Very old JSON format
    let levelData = null;

    if (gameParam) {
        // New seed-based format: ?g=6:abc12345
        try {
            const [sizeStr, seed] = gameParam.split(':');
            levelData = {
                size: parseInt(sizeStr),
                seed: seed
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
