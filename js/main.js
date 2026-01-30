document.addEventListener('DOMContentLoaded', () => {
    const defaultSize = 6;
    const game = new Game(defaultSize);
    const ui = new UI(game);

    // Initial Start
    const urlParams = new URLSearchParams(window.location.search);
    const levelStr = urlParams.get('l'); // New compact format
    const legacyStr = urlParams.get('level'); // Old format for backwards compat
    let levelData = null;

    if (levelStr) {
        try {
            // Decode base64url back to base64
            const base64 = levelStr.replace(/-/g, '+').replace(/_/g, '/') + '==';
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
    } else if (legacyStr) {
        try {
            levelData = JSON.parse(atob(legacyStr));
        } catch (e) {
            console.error("Failed to parse legacy level", e);
        }
    }

    ui.startNewGame(levelData);
});
