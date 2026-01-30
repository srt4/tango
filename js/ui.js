class UI {
    constructor(game) {
        this.game = game;
        this.boardElement = document.getElementById('game-board');
        this.messageArea = document.getElementById('message-area');
        this.timerElement = document.getElementById('timer');
        this.wrapper = document.querySelector('.app-container');

        this.timerInterval = null;
        this.seconds = 0;

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
        // Compact encoding: s|board|hConstraints|vConstraints
        // s = size, board = all cells concatenated, h/v = row/col constraints
        const size = this.game.size;
        const board = this.game.initialBoard.flat().join('');
        
        // Encode constraints: = -> e, x -> x, empty -> 0
        const encodeConstraints = (arr) => arr.map(row => 
            row.map(c => c === '=' ? 'e' : c === 'x' ? 'x' : '0').join('')
        ).join(',');
        
        const hStr = encodeConstraints(this.game.constraints.h);
        const vStr = encodeConstraints(this.game.constraints.v);
        
        const compact = `${size}|${board}|${hStr}|${vStr}`;
        
        // Convert to base64url (shorter than base64)
        const base64 = btoa(compact).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        const url = new URL(window.location);
        url.searchParams.set('l', base64);

        navigator.clipboard.writeText(url.toString()).then(() => {
            this.messageArea.textContent = "Link copied to clipboard!";
            this.messageArea.className = 'message-area success';
            setTimeout(() => {
                this.messageArea.className = 'message-area hidden';
            }, 3000);
        });
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
            case 'Shift': // Moon
                if (this.game.setCell(this.selected.r, this.selected.c, 2)) {
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
        this.resetTimer();
        this.startTimer();
        this.initializeBoard();
        this.messageArea.className = 'message-area hidden';
        this.messageArea.textContent = '';
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
        this.messageArea.textContent = "Puzzle Solved!";
        this.messageArea.className = 'message-area success';
    }
}
