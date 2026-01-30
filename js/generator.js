class LevelGenerator {
    constructor() {
        this.symbols = {
            EQUAL: '=',
            CROSS: 'x',
            NONE: null
        };
        this.pieces = {
            EMPTY: 0,
            SUN: 1,
            MOON: 2
        };
    }

    generate(size) {
        // 1. Generate a valid full solution
        const solution = this.createEmptyBoard(size);
        if (!this.fillBoard(solution, 0, 0, size)) {
            console.error("Failed to generate valid board");
            return null;
        }

        // 2. Start with Maximum Constraints (All matching symbols)
        const constraints = { h: [], v: [] };
        // Horizontal
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size - 1; c++) {
                if (solution[r][c] === solution[r][c + 1]) row.push(this.symbols.EQUAL);
                else row.push(this.symbols.CROSS);
            }
            constraints.h.push(row);
        }
        // Vertical
        for (let r = 0; r < size - 1; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                if (solution[r][c] === solution[r + 1][c]) row.push(this.symbols.EQUAL);
                else row.push(this.symbols.CROSS);
            }
            constraints.v.push(row);
        }

        // 3. Initialize Puzzle as Full Board
        const puzzle = solution.map(row => [...row]);

        // 4. Create a list of all removable items (Constraints and Cells)
        // Order matters for "minimal clues" preference.
        const items = [];

        // Add Constraints first to prioritize removing them
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size - 1; c++) {
                items.push({ type: 'h', r, c });
            }
        }
        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size; c++) {
                items.push({ type: 'v', r, c });
            }
        }
        this.shuffle(items);

        // Add Cells last (so they are removed only after constraints are minimized)
        // Wait, if we process sequentially, early items are removed while board is FULL.
        // Removing a constraint from a full board is ALWAYS valid (solver has full info).
        // So this will strip ALL constraints.
        // Then it will start removing cells.
        // This results in: 0 constraints, and minimal pieces.
        // Perfect for "Minimal x or = hints".

        const cells = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                cells.push({ type: 'cell', r, c });
            }
        }
        this.shuffle(cells);

        const reductionQueue = [...items, ...cells];
        // Shuffle everything together to ensure a natural mix of constraints and pieces
        this.shuffle(reductionQueue);

        // 5. Reduction Loop
        for (const item of reductionQueue) {
            let originalValue;
            if (item.type === 'cell') {
                originalValue = puzzle[item.r][item.c];
                puzzle[item.r][item.c] = 0;
            } else if (item.type === 'h') {
                originalValue = constraints.h[item.r][item.c];
                constraints.h[item.r][item.c] = this.symbols.NONE;
            } else if (item.type === 'v') {
                originalValue = constraints.v[item.r][item.c];
                constraints.v[item.r][item.c] = this.symbols.NONE;
            }

            const solverBoard = puzzle.map(row => [...row]);
            const solvable = this.solveLogically(solverBoard, size, constraints);

            if (!solvable) {
                if (item.type === 'cell') {
                    puzzle[item.r][item.c] = originalValue;
                } else if (item.type === 'h') {
                    constraints.h[item.r][item.c] = originalValue;
                } else if (item.type === 'v') {
                    constraints.v[item.r][item.c] = originalValue;
                }
            }
        }

        return {
            solution: solution,
            initialBoard: puzzle,
            constraints: constraints
        };
    }

    createEmptyBoard(size) {
        return Array(size).fill().map(() => Array(size).fill(0));
    }

    fillBoard(board, row, col, size) {
        if (row === size) return true;

        const nextRow = col === size - 1 ? row + 1 : row;
        const nextCol = col === size - 1 ? 0 : col + 1;

        const pieces = [this.pieces.SUN, this.pieces.MOON];
        this.shuffle(pieces);

        for (const piece of pieces) {
            if (this.isValidPlacement(board, row, col, size, piece)) {
                board[row][col] = piece;
                if (this.fillBoard(board, nextRow, nextCol, size)) return true;
                board[row][col] = 0;
            }
        }
        return false;
    }

    isValidPlacement(board, row, col, size, piece) {
        if (col >= 2) {
            if (board[row][col - 1] === piece && board[row][col - 2] === piece) return false;
        }
        if (row >= 2) {
            if (board[row - 1][col] === piece && board[row - 2][col] === piece) return false;
        }

        let rowCount = 0;
        for (let c = 0; c < col; c++) {
            if (board[row][c] === piece) rowCount++;
        }
        if (rowCount >= size / 2) return false;

        let colCount = 0;
        for (let r = 0; r < row; r++) {
            if (board[r][col] === piece) colCount++;
        }
        if (colCount >= size / 2) return false;

        return true;
    }

    solveLogically(board, size, constraints) {
        let changed = true;
        while (changed) {
            changed = false;
            const move = this.findLogicalMove(board, size, constraints);
            if (move) {
                board[move.r][move.c] = move.val;
                changed = true;
            }
        }

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === 0) return false;
            }
        }
        return true;
    }

    findLogicalMove(board, size, constraints) {
        const getOpposite = (val) => val === 1 ? 2 : 1;
        const isValidPos = (r, c) => r >= 0 && r < size && c >= 0 && c < size;

        const checkLine = (r, c, dr1, dc1, dr2, dc2) => {
            if (!isValidPos(r + dr1, c + dc1) || !isValidPos(r + dr2, c + dc2)) return null;
            const v1 = board[r + dr1][c + dc1];
            const v2 = board[r + dr2][c + dc2];
            if (v1 !== 0 && v1 === v2) return getOpposite(v1);
            return null;
        };

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] !== 0) continue;

                let val = checkLine(r, c, 0, -1, 0, -2);
                if (val) return { r, c, val };
                val = checkLine(r, c, 0, 1, 0, 2);
                if (val) return { r, c, val };
                val = checkLine(r, c, 0, -1, 0, 1);
                if (val) return { r, c, val };

                val = checkLine(r, c, -1, 0, -2, 0);
                if (val) return { r, c, val };
                val = checkLine(r, c, 1, 0, 2, 0);
                if (val) return { r, c, val };
                val = checkLine(r, c, -1, 0, 1, 0);
                if (val) return { r, c, val };
            }
        }

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size - 1; c++) {
                const sym = constraints.h[r][c];
                if (!sym || sym === this.symbols.NONE) continue;
                const v1 = board[r][c];
                const v2 = board[r][c + 1];

                if (v1 !== 0 && v2 === 0) {
                    if (sym === this.symbols.EQUAL) return { r, c: c + 1, val: v1 };
                    if (sym === this.symbols.CROSS) return { r, c: c + 1, val: getOpposite(v1) };
                } else if (v1 === 0 && v2 !== 0) {
                    if (sym === this.symbols.EQUAL) return { r, c, val: v2 };
                    if (sym === this.symbols.CROSS) return { r, c, val: getOpposite(v2) };
                }
            }
        }
        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size; c++) {
                const sym = constraints.v[r][c];
                if (!sym || sym === this.symbols.NONE) continue;
                const v1 = board[r][c];
                const v2 = board[r + 1][c];

                if (v1 !== 0 && v2 === 0) {
                    if (sym === this.symbols.EQUAL) return { r: r + 1, c, val: v1 };
                    if (sym === this.symbols.CROSS) return { r: r + 1, c, val: getOpposite(v1) };
                } else if (v1 === 0 && v2 !== 0) {
                    if (sym === this.symbols.EQUAL) return { r, c, val: v2 };
                    if (sym === this.symbols.CROSS) return { r, c, val: getOpposite(v2) };
                }
            }
        }

        for (let r = 0; r < size; r++) {
            let suns = 0, moons = 0, empties = [];
            for (let c = 0; c < size; c++) {
                if (board[r][c] === 1) suns++;
                else if (board[r][c] === 2) moons++;
                else empties.push(c);
            }
            if (empties.length > 0) {
                if (suns === size / 2) return { r, c: empties[0], val: 2 };
                if (moons === size / 2) return { r, c: empties[0], val: 1 };
            }
        }
        for (let c = 0; c < size; c++) {
            let suns = 0, moons = 0, empties = [];
            for (let r = 0; r < size; r++) {
                if (board[r][c] === 1) suns++;
                else if (board[r][c] === 2) moons++;
                else empties.push(r);
            }
            if (empties.length > 0) {
                if (suns === size / 2) return { r: empties[0], c, val: 2 };
                if (moons === size / 2) return { r: empties[0], c, val: 1 };
            }
        }

        return null;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
