class UI {
    constructor(game, history) {
        this.game = game;
        this.history = history || new SolveHistory();
        this.boardElement = document.getElementById('game-board');
        this.messageArea = document.getElementById('message-area');
        this.timerElement = document.getElementById('timer');
        this.wrapper = document.querySelector('.app-container');

        this.timerInterval = null;
        this.seconds = 0;
        this.moveCount = 0;

        this.validationTimeout = null;

        // Keyboard selection
        this.selected = { r: 0, c: 0 };

        this.initEventListeners();
    }

    initEventListeners() {
        // Theme Toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
        });

        // Size Select
        document.getElementById('size-select').addEventListener('change', (e) => {
            this.game.size = parseInt(e.target.value);
            this.startNewGame();
        });

        // Controls
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.startNewGame();
        });

        document.getElementById('undo-btn').addEventListener('click', () => {
            if (this.game.undo()) {
                this.updateBoard();
                this.triggerDelayedValidation();
            }
        });

        document.getElementById('check-btn').addEventListener('click', () => {
            this.validateAndHighlight(true);
        });

        document.getElementById('hint-btn').addEventListener('click', () => {
            const hint = this.game.getHint();
            if (hint) {
                this.updateBoard();
                this.validateAndHighlight();

                // Maybe flash the hinted cell?
                const cell = this.getCellElement(hint.r, hint.c);
                if (cell) {
                    cell.classList.add('hint-flash');
                    setTimeout(() => cell.classList.remove('hint-flash'), 1000);
                }

                // Show Reason
                if (hint.reason) {
                    this.messageArea.textContent = `Hint: ${hint.reason}`;
                    this.messageArea.className = 'message-area'; // visible
                    // Hide after few seconds?
                    setTimeout(() => {
                        if (this.messageArea.textContent.startsWith("Hint:")) {
                            this.messageArea.className = 'message-area hidden';
                        }
                    }, 4000);
                }
            }
        });

        document.getElementById('share-btn').addEventListener('click', () => {
            this.handleShare();
        });

        document.getElementById('stats-btn').addEventListener('click', () => {
            this.showStats();
        });

        document.getElementById('close-stats').addEventListener('click', () => {
            this.hideStats();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchStatsTab(tab);
            });
        });

        // Close modal on backdrop click
        document.getElementById('stats-modal').addEventListener('click', (e) => {
            if (e.target.id === 'stats-modal') {
                this.hideStats();
            }
        });

        // Check for shared level on load
        // This is called once on init.
        // We delay startNewGame in constructor or handle it here?
        // best to check params here or in a separate init method.
        // but the constructor calls startNewGame immediately... 
        // We really should check params first.
        // Let's rely on the fact that initEventListeners is called at the end of constructor.
        // Wait, constructor calls selected initEventListeners, THEN nothing else. 
        // Code:
        // this.initEventListeners();
        // }
        // So we should do the check in constructor or right after.
        // Or we can just startNewGame() in constructor, then if param exists, override it immediately?
        // A bit wasteful but fine.

        // Actually, let's look at constructor. It doesn't call startNewGame?
        // view_file earlier:
        // document.getElementById('size-select').addEventListener... this.startNewGame();
        // It DOES NOT seem to call startNewGame from constructor in the file I viewed?
        // Wait, let me check the file content again.

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }

    handleShare() {
        // Seed-based URL: just size and seed
        const size = this.game.size;
        const seed = this.game.seed;
        
        const url = new URL(window.location);
        url.searchParams.set('g', `${size}:${seed}`);
        const urlString = url.toString();

        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(urlString).then(() => {
                this.showShareSuccess();
            }).catch((err) => {
                console.error('Clipboard API failed:', err);
                this.fallbackCopyToClipboard(urlString);
            });
        } else {
            this.fallbackCopyToClipboard(urlString);
        }
    }

    handleKeydown(e) {
        const size = this.game.size;
        let moved = false;
        let action = false;

        switch (e.key) {
            case 'ArrowUp':
                this.selected.r = (this.selected.r - 1 + size) % size;
                moved = true;
                break;
            case 'ArrowDown':
                this.selected.r = (this.selected.r + 1) % size;
                moved = true;
                break;
            case 'ArrowLeft':
                this.selected.c = (this.selected.c - 1 + size) % size;
                moved = true;
                break;
            case 'ArrowRight':
                this.selected.c = (this.selected.c + 1) % size;
                moved = true;
                break;
            case 'Enter': // Sun
                if (this.game.setCell(this.selected.r, this.selected.c, 1)) {
                    action = true;
                }
                break;
            case 'Shift':
                // Only right shift places moon (location 2 = right)
                if (e.location === 2 && this.game.setCell(this.selected.r, this.selected.c, 2)) {
                    action = true;
                }
                break;
            case ' ': // Spacebar - Cycle
                if (this.game.cycleCell(this.selected.r, this.selected.c)) {
                    action = true;
                }
                break;
            case 'Backspace':
            case 'Delete':
                if (this.game.setCell(this.selected.r, this.selected.c, 0)) {
                    action = true;
                }
                break;
        }

        if (moved) {
            e.preventDefault();
            this.updateSelection();
        }

        if (action) {
            e.preventDefault();
            this.handleMove();
        }
    }

    handleMove() {
        this.moveCount++;
        this.updateBoard();
        const result = this.game.checkWinCondition();
        if (result.won) {
            this.handleWin();
        } else {
            this.triggerDelayedValidation();
        }
    }

    startNewGame(levelData = null) {
        this.game.startNewGame(levelData);
        this.selected = { r: 0, c: 0 }; // Reset selection
        this.moveCount = 0;
        this.resetTimer();
        this.startTimer();
        this.initializeBoard();
        this.messageArea.className = 'message-area hidden';
        this.messageArea.textContent = '';
        this.updateUrlForCurrentPuzzle();
    }

    updateUrlForCurrentPuzzle() {
        const url = new URL(window.location);
        url.searchParams.set('g', `${this.game.size}:${this.game.seed}`);
        window.history.replaceState({}, '', url);
    }

    resetTimer() {
        clearInterval(this.timerInterval);
        this.seconds = 0;
        this.timerElement.textContent = "00:00";
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.seconds++;
            const mins = Math.floor(this.seconds / 60).toString().padStart(2, '0');
            const secs = (this.seconds % 60).toString().padStart(2, '0');
            this.timerElement.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.timerInterval);
    }

    initializeBoard() {
        this.boardElement.innerHTML = '';
        const size = this.game.size;

        this.boardElement.style.gridTemplateColumns = `repeat(${size}, auto)`;
        this.boardElement.dataset.size = size;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cellWrapper = document.createElement('div');
                cellWrapper.className = 'cell-wrapper';
                cellWrapper.style.padding = '8px';

                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                cell.addEventListener('click', () => {
                    this.selected = { r, c };
                    this.updateSelection(); // Visually update selection immediately
                    this.handleCellClick(r, c);
                });

                cellWrapper.appendChild(cell);

                // Add symbols
                if (c < size - 1) {
                    const sym = this.game.constraints.h[r][c];
                    if (sym) {
                        const hSym = document.createElement('div');
                        hSym.className = 'h-symbol';
                        if (sym === '=') hSym.classList.add('symbol-equal');
                        if (sym === 'x') hSym.classList.add('symbol-cross');
                        cellWrapper.appendChild(hSym);
                    }
                }

                if (r < size - 1) {
                    const sym = this.game.constraints.v[r][c];
                    if (sym) {
                        const vSym = document.createElement('div');
                        vSym.className = 'v-symbol';
                        if (sym === '=') vSym.classList.add('symbol-equal');
                        if (sym === 'x') vSym.classList.add('symbol-cross');
                        cellWrapper.appendChild(vSym);
                    }
                }

                this.boardElement.appendChild(cellWrapper);
            }
        }
        this.updateBoard(); // Initial population
    }

    updateSelection() {
        // Remove existing selection
        const prev = this.boardElement.querySelector('.cell.selected');
        if (prev) prev.classList.remove('selected');

        // Add to new
        const current = this.getCellElement(this.selected.r, this.selected.c);
        if (current) current.classList.add('selected');
    }

    updateBoard() {
        const size = this.game.size;

        this.updateSelection();

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = this.getCellElement(r, c);
                const val = this.game.getCell(r, c);

                // Update fixed status
                if (this.game.initialBoard[r][c] !== 0) {
                    cell.classList.add('fixed');
                    cell.style.cursor = 'default';
                } else {
                    cell.classList.remove('fixed');
                    cell.style.cursor = 'pointer';
                }

                // Clear validation errors (they will be re-applied if needed by validator)
                // Actually, delayed validation handles errors. 
                // But if we move, we should clear errors immediately?
                // The prompt says "Delay validation when a wrong thing is placed".
                // Usually this means: Don't show red immediately.
                // It implies errors should be cleared on move? 
                // Yes, visual feedback usually resets on new input.
                cell.classList.remove('error');

                // Update content - reuse existing piece element when possible
                let currentPiece = cell.querySelector('.piece');

                if (val === 0) {
                    // Remove piece if exists
                    if (currentPiece) {
                        currentPiece.remove();
                    }
                } else {
                    // Need a piece (sun or moon)
                    const needsSun = val === 1;
                    const needsMoon = val === 2;

                    if (!currentPiece) {
                        // No piece exists, create one
                        currentPiece = document.createElement('div');
                        currentPiece.className = 'piece ' + (needsSun ? 'sun' : 'moon');
                        cell.appendChild(currentPiece);
                    } else {
                        // Piece exists, update class if needed
                        const isSun = currentPiece.classList.contains('sun');
                        const isMoon = currentPiece.classList.contains('moon');

                        if (needsSun && !isSun) {
                            currentPiece.classList.remove('moon');
                            currentPiece.classList.add('sun');
                        } else if (needsMoon && !isMoon) {
                            currentPiece.classList.remove('sun');
                            currentPiece.classList.add('moon');
                        }
                        // If already correct type, do nothing
                    }
                }
            }
        }

        // Clear symbol errors too
        document.querySelectorAll('.symbol-error').forEach(el => el.classList.remove('symbol-error'));
    }

    handleCellClick(row, col) {
        if (this.game.cycleCell(row, col)) {
            this.handleMove();
        }
    }

    triggerDelayedValidation() {
        if (this.validationTimeout) {
            clearTimeout(this.validationTimeout);
        }
        this.validationTimeout = setTimeout(() => {
            this.validateAndHighlight();
        }, 1200);
    }

    validateAndHighlight(showAllErrors = false) {
        // Clear previous errors first? 
        // updateBoard clears them on move.
        // If this is called after delay, valid.

        document.querySelectorAll('.cell.error').forEach(el => el.classList.remove('error'));
        document.querySelectorAll('.symbol-equal.symbol-error, .symbol-cross.symbol-error').forEach(el => el.classList.remove('symbol-error'));

        const errors = this.game.validateBoard();

        errors.forEach(err => {
            if (err.type === 'row_consecutive') {
                for (let i = 0; i < 3; i++) {
                    const cell = this.getCellElement(err.r, err.c + i);
                    if (cell) cell.classList.add('error');
                }
            }
            if (err.type === 'col_consecutive') {
                for (let i = 0; i < 3; i++) {
                    const cell = this.getCellElement(err.r + i, err.c);
                    if (cell) cell.classList.add('error');
                }
            }

            if (err.type === 'h_constraint') {
                const wrapper = this.getCellElement(err.r, err.c).parentElement;
                const sym = wrapper.querySelector('.h-symbol');
                if (sym) sym.classList.add('symbol-error');

                this.getCellElement(err.r, err.c).classList.add('error');
                this.getCellElement(err.r, err.c + 1).classList.add('error');
            }

            if (err.type === 'v_constraint') {
                const wrapper = this.getCellElement(err.r, err.c).parentElement;
                const sym = wrapper.querySelector('.v-symbol');
                if (sym) sym.classList.add('symbol-error');

                this.getCellElement(err.r, err.c).classList.add('error');
                this.getCellElement(err.r + 1, err.c).classList.add('error');
            }
        });
    }

    getCellElement(r, c) {
        return document.querySelector(`.cell[data-row='${r}'][data-col='${c}']`);
    }

    handleWin() {
        this.stopTimer();
        this.validateAndHighlight(); // Ensure clean
        
        // Save solve to history
        const solveData = {
            size: this.game.size,
            seed: this.game.seed,
            timeSeconds: this.seconds,
            moveCount: this.moveCount
        };
        this.history.saveSolve(solveData);
        
        // Get stats for this puzzle
        const stats = this.history.getPuzzleStats(this.game.size, this.game.seed);
        let message = "Puzzle Solved!";
        
        if (stats.solveCount > 1) {
            message += ` (Solve #${stats.solveCount}`;
            if (this.seconds === stats.bestTime) {
                message += " - New Best Time!";
            }
            message += ")";
        }
        
        this.messageArea.textContent = message;
        this.messageArea.className = 'message-area success';
    }

    showStats() {
        const modal = document.getElementById('stats-modal');
        modal.classList.remove('hidden');
        this.updateStatsDisplay();
    }

    hideStats() {
        const modal = document.getElementById('stats-modal');
        modal.classList.add('hidden');
    }

    switchStatsTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tab}`);
        });
        
        // Refresh display
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        
        if (activeTab === 'overview') {
            this.updateOverviewTab();
        } else if (activeTab === 'current') {
            this.updateCurrentTab();
        } else if (activeTab === 'history') {
            this.updateHistoryTab();
        }
    }

    updateOverviewTab() {
        const stats = this.history.getOverallStats();
        
        document.getElementById('stat-total-solves').textContent = stats.totalSolves;
        document.getElementById('stat-total-time').textContent = SolveHistory.formatTime(stats.totalTime);
        
        const bySizeContainer = document.getElementById('stats-by-size');
        if (Object.keys(stats.bySize).length === 0) {
            bySizeContainer.innerHTML = '<div class="no-history">No puzzles solved yet</div>';
        } else {
            bySizeContainer.innerHTML = Object.entries(stats.bySize).map(([size, data]) => `
                <div class="size-stat">
                    <span class="size-label">${size}x${size}</span>
                    <div class="size-details">
                        <div>${data.count} solved</div>
                        <div>Best: ${SolveHistory.formatTime(data.bestTime)}</div>
                        <div>Avg: ${SolveHistory.formatTime(data.averageTime)}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    updateCurrentTab() {
        const stats = this.history.getPuzzleStats(this.game.size, this.game.seed);
        
        document.getElementById('current-size').textContent = `${this.game.size}x${this.game.size}`;
        document.getElementById('current-seed').textContent = this.game.seed;
        document.getElementById('current-solve-count').textContent = stats.solveCount;
        document.getElementById('current-best-time').textContent = stats.bestTime ? 
            SolveHistory.formatTime(stats.bestTime) : '-';
    }

    updateHistoryTab() {
        const solves = this.history.getAllSolves();
        const list = document.getElementById('history-list');
        
        if (solves.length === 0) {
            list.innerHTML = '<div class="no-history">No solve history yet</div>';
        } else {
            list.innerHTML = solves.slice(0, 20).map(solve => `
                <div class="history-item" data-size="${solve.size}" data-seed="${solve.seed}">
                    <div class="history-info">
                        <span class="history-puzzle">${solve.size}x${solve.size} • ${solve.seed}</span>
                        <span class="history-date">${SolveHistory.formatDate(solve.completedAt)}</span>
                    </div>
                    <div class="history-actions">
                        <button class="history-btn share-history-btn" title="Share puzzle" data-size="${solve.size}" data-seed="${solve.seed}">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                        </button>
                        <button class="history-btn view-history-btn" title="View puzzle" data-size="${solve.size}" data-seed="${solve.seed}">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                    <div class="history-stats">
                        <div class="history-time">${SolveHistory.formatTime(solve.timeSeconds)}</div>
                        <div>${solve.moveCount} moves</div>
                    </div>
                </div>
            `).join('');
            
            // Attach event listeners to the buttons
            list.querySelectorAll('.share-history-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const size = parseInt(btn.dataset.size);
                    const seed = btn.dataset.seed;
                    this.sharePuzzle(size, seed);
                });
            });
            
            list.querySelectorAll('.view-history-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const size = parseInt(btn.dataset.size);
                    const seed = btn.dataset.seed;
                    this.viewPuzzle(size, seed);
                });
            });
        }
    }

    sharePuzzle(size, seed) {
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('g', `${size}:${seed}`);
        const urlString = url.toString();
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(urlString).then(() => {
                this.showShareSuccess();
            }).catch((err) => {
                console.error('Clipboard API failed:', err);
                // Fallback to textarea method
                this.fallbackCopyToClipboard(urlString);
            });
        } else {
            // Use fallback for browsers without clipboard API
            this.fallbackCopyToClipboard(urlString);
        }
    }

    fallbackCopyToClipboard(text) {
        // Create temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        
        try {
            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            
            const successful = document.execCommand('copy');
            if (successful) {
                this.showShareSuccess();
            } else {
                this.showShareError();
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.showShareError();
        } finally {
            document.body.removeChild(textarea);
        }
    }

    showShareSuccess() {
        this.messageArea.textContent = "Puzzle link copied to clipboard!";
        this.messageArea.className = 'message-area success';
        setTimeout(() => {
            this.messageArea.className = 'message-area hidden';
        }, 3000);
    }

    showShareError() {
        this.messageArea.textContent = "Failed to copy link. Please copy manually.";
        this.messageArea.className = 'message-area';
        setTimeout(() => {
            this.messageArea.className = 'message-area hidden';
        }, 3000);
    }

    viewPuzzle(size, seed) {
        // Hide stats modal
        this.hideStats();
        
        // Load the puzzle
        this.startNewGame({ size, seed });
    }
}
