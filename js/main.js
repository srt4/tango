document.addEventListener('DOMContentLoaded', () => {
    const defaultSize = 6;
    const game = new Game(defaultSize);
    const ui = new UI(game);

    // Initial Start
    const urlParams = new URLSearchParams(window.location.search);
    const levelStr = urlParams.get('level');
    let levelData = null;

    if (levelStr) {
        try {
            levelData = JSON.parse(atob(levelStr));
        } catch (e) {
            console.error("Failed to parse shared level", e);
        }
    }

    ui.startNewGame(levelData); // Modified ui.startNewGame to pass data to game.startNewGame
});
