class Game {
    constructor(size) {
        this.size = size;
        this.board = []; // Current state
        this.initialBoard = []; // Starting state (immutable)
        this.solution = []; // Solution (for hints/debugging)
        this.constraints = { h: [], v: [] };
        this.generator = new LevelGenerator();
        this.history = []; // For undo
    }

    startNewGame(levelData = null) {
        if (levelData) {
            this.size = levelData.size; // Ensure size matches
            this.initialBoard = JSON.parse(JSON.stringify(levelData.initialBoard));
            this.board = JSON.parse(JSON.stringify(levelData.initialBoard));
            this.constraints = levelData.constraints;

            // We need to solve it to populate this.solution for hints
            // The generator has a solver, but it modifies the board. 
            // We can use generator's solveLogically if we expose it or copy.
            // Actually, we can just assume the generator instance has it.
            const solverBoard = this.board.map(r => [...r]);
            this.generator.solveLogically(solverBoard, this.size, this.constraints);
            this.solution = solverBoard;
        } else {
            const level = this.generator.generate(this.size);
            this.solution = level.solution;
            this.constraints = level.constraints;

            // Deep copy for initial board
            this.initialBoard = JSON.parse(JSON.stringify(level.initialBoard));
            this.board = JSON.parse(JSON.stringify(level.initialBoard));
        }

        this.history = [];
    }

    getCell(row, col) {
        return this.board[row][col];
    }

    setCell(row, col, value) {
        // Don't allow changing fixed initial cells
        if (this.initialBoard[row][col] !== 0) return false;

        // Save state for undo
        this.history.push(JSON.parse(JSON.stringify(this.board)));

        this.board[row][col] = value;
        return true;
    }

    cycleCell(row, col) {
        if (this.initialBoard[row][col] !== 0) return false;

        // 0 -> 1 (Sun) -> 2 (Moon) -> 0
        let current = this.board[row][col];
        let next = (current + 1) % 3;

        return this.setCell(row, col, next);
    }

    undo() {
        if (this.history.length > 0) {
            this.board = this.history.pop();
            return true;
        }
        return false;
    }

    getHint() {
        // Try to find a logical move first
        const logicMove = this.findLogicalMove();
        if (logicMove) {
            this.setCell(logicMove.r, logicMove.c, logicMove.val);
            return logicMove;
        }

        // Fallback: Find a random correct move if logic fails
        const candidates = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] !== this.solution[r][c]) {
                    // Prioritize empty cells
                    if (this.board[r][c] === 0) {
                        candidates.push({ r, c, val: this.solution[r][c] });
                    }
                }
            }
        }

        // If only incorrect cells remain
        if (candidates.length === 0) {
            for (let r = 0; r < this.size; r++) {
                for (let c = 0; c < this.size; c++) {
                    if (this.board[r][c] !== this.solution[r][c]) {
                        candidates.push({ r, c, val: this.solution[r][c] });
                    }
                }
            }
        }

        if (candidates.length === 0) return null; // Already solved?

        const hint = candidates[Math.floor(Math.random() * candidates.length)];
        this.setCell(hint.r, hint.c, hint.val);

        return { ...hint, reason: "Revealed by solution (complex logic needed)." };
    }

    findLogicalMove() {
        // Priority 1: 3-in-a-row rules (Immediate neighbors)
        // Check Rows
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] === 0) {
                    // Check XX_ or _XX or X_X
                    // Horizontal
                    if (this.checkLine(r, c, 0, -1, 0, -2)) return { r, c, val: this.getOpposite(this.board[r][c - 1]), reason: "Avoids three identical pieces in a row" };
                    if (this.checkLine(r, c, 0, 1, 0, 2)) return { r, c, val: this.getOpposite(this.board[r][c + 1]), reason: "Avoids three identical pieces in a row" };
                    if (this.checkLine(r, c, 0, -1, 0, 1)) return { r, c, val: this.getOpposite(this.board[r][c - 1]), reason: "Avoids three identical pieces in a row" };

                    // Vertical
                    if (this.checkLine(r, c, -1, 0, -2, 0)) return { r, c, val: this.getOpposite(this.board[r - 1][c]), reason: "Avoids three identical pieces in a column" };
                    if (this.checkLine(r, c, 1, 0, 2, 0)) return { r, c, val: this.getOpposite(this.board[r + 1][c]), reason: "Avoids three identical pieces in a column" };
                    if (this.checkLine(r, c, -1, 0, 1, 0)) return { r, c, val: this.getOpposite(this.board[r - 1][c]), reason: "Avoids three identical pieces in a column" };
                }
            }
        }

        // Priority 2: Constraints
        // Horizontal
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size - 1; c++) {
                const sym = this.constraints.h[r][c];
                if (!sym) continue;
                const v1 = this.board[r][c];
                const v2 = this.board[r][c + 1];

                if (v1 !== 0 && v2 === 0) {
                    if (sym === '=') return { r, c: c + 1, val: v1, reason: "Must be equal to neighbor" };
                    if (sym === 'x') return { r, c: c + 1, val: this.getOpposite(v1), reason: "Must be different from neighbor" };
                } else if (v1 === 0 && v2 !== 0) {
                    if (sym === '=') return { r, c, val: v2, reason: "Must be equal to neighbor" };
                    if (sym === 'x') return { r, c, val: this.getOpposite(v2), reason: "Must be different from neighbor" };
                }
            }
        }
        // Vertical
        for (let r = 0; r < this.size - 1; r++) {
            for (let c = 0; c < this.size; c++) {
                const sym = this.constraints.v[r][c];
                if (!sym) continue;
                const v1 = this.board[r][c];
                const v2 = this.board[r + 1][c];

                if (v1 !== 0 && v2 === 0) {
                    if (sym === '=') return { r: r + 1, c, val: v1, reason: "Must be equal to neighbor" };
                    if (sym === 'x') return { r: r + 1, c, val: this.getOpposite(v1), reason: "Must be different from neighbor" };
                } else if (v1 === 0 && v2 !== 0) {
                    if (sym === '=') return { r, c, val: v2, reason: "Must be equal to neighbor" };
                    if (sym === 'x') return { r, c, val: this.getOpposite(v2), reason: "Must be different from neighbor" };
                }
            }
        }

        // Priority 3: Balance (Row/Col full of one type)
        // Row
        for (let r = 0; r < this.size; r++) {
            let suns = 0, moons = 0, empties = [];
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] === 1) suns++;
                else if (this.board[r][c] === 2) moons++;
                else empties.push(c);
            }
            if (empties.length > 0) {
                if (suns === this.size / 2) return { r, c: empties[0], val: 2, reason: "Row has maximum Suns, filling remaining with Moons" };
                if (moons === this.size / 2) return { r, c: empties[0], val: 1, reason: "Row has maximum Moons, filling remaining with Suns" };
            }
        }
        // Col
        for (let c = 0; c < this.size; c++) {
            let suns = 0, moons = 0, empties = [];
            for (let r = 0; r < this.size; r++) {
                if (this.board[r][c] === 1) suns++;
                else if (this.board[r][c] === 2) moons++;
                else empties.push(r);
            }
            if (empties.length > 0) {
                if (suns === this.size / 2) return { r: empties[0], c, val: 2, reason: "Column has maximum Suns, filling remaining with Moons" };
                if (moons === this.size / 2) return { r: empties[0], c, val: 1, reason: "Column has maximum Moons, filling remaining with Suns" };
            }
        }

        return null;
    }

    checkLine(r, c, dr1, dc1, dr2, dc2) {
        // Bounds check
        if (!this.isValidPos(r + dr1, c + dc1) || !this.isValidPos(r + dr2, c + dc2)) return false;

        const v1 = this.board[r + dr1][c + dc1];
        const v2 = this.board[r + dr2][c + dc2];

        return v1 !== 0 && v1 === v2;
    }

    isValidPos(r, c) {
        return r >= 0 && r < this.size && c >= 0 && c < this.size;
    }

    getOpposite(val) {
        return val === 1 ? 2 : 1;
    }

    checkWinCondition() {
        // 1. Board must be full
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] === 0) return { won: false, reason: 'incomplete' };
            }
        }

        // 2. Validate all rules
        const errors = this.validateBoard();
        if (errors.length === 0) {
            return { won: true };
        } else {
            return { won: false, errors: errors };
        }
    }

    // Returns array of error objects: { type: 'row'|'col'|'constraint', index: number, cells: [[r,c],...] }
    validateBoard() {
        const errors = [];

        // Check Rows
        for (let r = 0; r < this.size; r++) {
            // Balance check
            let suns = 0, moons = 0;
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] === 1) suns++;
                if (this.board[r][c] === 2) moons++;
            }
            if (suns > this.size / 2 || moons > this.size / 2) {
                // Mark whole row as error if unbalanced (and full enough to tell)
                errors.push({ type: 'row_balance', index: r });
            }

            // 3-consecutive check
            for (let c = 0; c < this.size - 2; c++) {
                const v1 = this.board[r][c];
                const v2 = this.board[r][c + 1];
                const v3 = this.board[r][c + 2];
                if (v1 !== 0 && v1 === v2 && v2 === v3) {
                    errors.push({ type: 'row_consecutive', r: r, c: c }); // c is start index
                }
            }
        }

        // Check Cols
        for (let c = 0; c < this.size; c++) {
            // Balance check
            let suns = 0, moons = 0;
            for (let r = 0; r < this.size; r++) {
                if (this.board[r][c] === 1) suns++;
                if (this.board[r][c] === 2) moons++;
            }
            if (suns > this.size / 2 || moons > this.size / 2) {
                errors.push({ type: 'col_balance', index: c });
            }

            // 3-consecutive check
            for (let r = 0; r < this.size - 2; r++) {
                const v1 = this.board[r][c];
                const v2 = this.board[r + 1][c];
                const v3 = this.board[r + 2][c];
                if (v1 !== 0 && v1 === v2 && v2 === v3) {
                    errors.push({ type: 'col_consecutive', r: r, c: c });
                }
            }
        }

        // Check Constraints
        // Horizontal
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size - 1; c++) {
                const symbol = this.constraints.h[r][c];
                const v1 = this.board[r][c];
                const v2 = this.board[r][c + 1];

                if (symbol && v1 !== 0 && v2 !== 0) {
                    if (symbol === '=') {
                        if (v1 !== v2) errors.push({ type: 'h_constraint', r: r, c: c });
                    } else if (symbol === 'x') {
                        if (v1 === v2) errors.push({ type: 'h_constraint', r: r, c: c });
                    }
                }
            }
        }

        // Vertical
        for (let r = 0; r < this.size - 1; r++) {
            for (let c = 0; c < this.size; c++) {
                const symbol = this.constraints.v[r][c];
                const v1 = this.board[r][c];
                const v2 = this.board[r + 1][c];

                if (symbol && v1 !== 0 && v2 !== 0) {
                    if (symbol === '=') {
                        if (v1 !== v2) errors.push({ type: 'v_constraint', r: r, c: c });
                    } else if (symbol === 'x') {
                        if (v1 === v2) errors.push({ type: 'v_constraint', r: r, c: c });
                    }
                }
            }
        }

        return errors;
    }
}
