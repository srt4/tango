/**
 * SolveHistory - Manages puzzle solve history using localStorage
 */
class SolveHistory {
    constructor() {
        this.storageKey = 'tango_solve_history';
        this.maxEntries = 100; // Keep last 100 solves
    }

    /**
     * Save a completed puzzle solve
     * @param {Object} solveData - The solve data
     * @param {number} solveData.size - Grid size (4, 6, 8)
     * @param {string} solveData.seed - Puzzle seed
     * @param {number} solveData.timeSeconds - Time taken in seconds
     * @param {number} solveData.moveCount - Number of moves made
     * @returns {Object} The saved solve entry
     */
    saveSolve(solveData) {
        const solves = this.getAllSolves();
        
        const entry = {
            id: this.generateId(),
            size: solveData.size,
            seed: solveData.seed,
            timeSeconds: solveData.timeSeconds,
            moveCount: solveData.moveCount,
            completedAt: new Date().toISOString(),
            timestamp: Date.now()
        };

        // Add to beginning (most recent first)
        solves.unshift(entry);
        
        // Limit entries
        if (solves.length > this.maxEntries) {
            solves.length = this.maxEntries;
        }

        this.saveToStorage(solves);
        return entry;
    }

    /**
     * Get all solve history entries
     * @returns {Array} Array of solve entries
     */
    getAllSolves() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load solve history:', e);
            return [];
        }
    }

    /**
     * Get solves for a specific puzzle (by seed and size)
     * @param {number} size - Grid size
     * @param {string} seed - Puzzle seed
     * @returns {Array} Array of solve entries for this puzzle
     */
    getSolvesForPuzzle(size, seed) {
        return this.getAllSolves().filter(s => s.size === size && s.seed === seed);
    }

    /**
     * Get best time for a specific puzzle
     * @param {number} size - Grid size
     * @param {string} seed - Puzzle seed
     * @returns {number|null} Best time in seconds or null
     */
    getBestTime(size, seed) {
        const solves = this.getSolvesForPuzzle(size, seed);
        if (solves.length === 0) return null;
        return Math.min(...solves.map(s => s.timeSeconds));
    }

    /**
     * Get statistics for a specific puzzle
     * @param {number} size - Grid size
     * @param {string} seed - Puzzle seed
     * @returns {Object} Statistics object
     */
    getPuzzleStats(size, seed) {
        const solves = this.getSolvesForPuzzle(size, seed);
        
        if (solves.length === 0) {
            return {
                solveCount: 0,
                bestTime: null,
                averageTime: null,
                averageMoves: null
            };
        }

        const times = solves.map(s => s.timeSeconds);
        const moves = solves.map(s => s.moveCount);

        return {
            solveCount: solves.length,
            bestTime: Math.min(...times),
            averageTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
            averageMoves: Math.round(moves.reduce((a, b) => a + b, 0) / moves.length)
        };
    }

    /**
     * Get overall player statistics
     * @returns {Object} Overall statistics
     */
    getOverallStats() {
        const solves = this.getAllSolves();
        
        if (solves.length === 0) {
            return {
                totalSolves: 0,
                totalTime: 0,
                bySize: {}
            };
        }

        const bySize = {};
        [4, 6, 8].forEach(size => {
            const sizeSolves = solves.filter(s => s.size === size);
            if (sizeSolves.length > 0) {
                const times = sizeSolves.map(s => s.timeSeconds);
                bySize[size] = {
                    count: sizeSolves.length,
                    bestTime: Math.min(...times),
                    averageTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length)
                };
            }
        });

        return {
            totalSolves: solves.length,
            totalTime: solves.reduce((sum, s) => sum + s.timeSeconds, 0),
            bySize
        };
    }

    /**
     * Check if a puzzle has been solved before
     * @param {number} size - Grid size
     * @param {string} seed - Puzzle seed
     * @returns {boolean}
     */
    hasSolved(size, seed) {
        return this.getSolvesForPuzzle(size, seed).length > 0;
    }

    /**
     * Clear all history
     */
    clearHistory() {
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Generate a unique ID for each solve
     * @returns {string}
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save solves array to localStorage
     * @param {Array} solves
     */
    saveToStorage(solves) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(solves));
        } catch (e) {
            console.error('Failed to save solve history:', e);
        }
    }

    /**
     * Format seconds as MM:SS
     * @param {number} seconds
     * @returns {string}
     */
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    /**
     * Format date for display
     * @param {string} isoDate
     * @returns {string}
     */
    static formatDate(isoDate) {
        const date = new Date(isoDate);
        const now = new Date();
        const diff = now - date;
        
        // Less than 24 hours ago
        if (diff < 24 * 60 * 60 * 1000) {
            if (diff < 60 * 60 * 1000) {
                const mins = Math.floor(diff / (60 * 1000));
                return mins < 1 ? 'Just now' : `${mins}m ago`;
            }
            const hours = Math.floor(diff / (60 * 60 * 1000));
            return `${hours}h ago`;
        }
        
        // Less than 7 days ago
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return `${days}d ago`;
        }
        
        // Otherwise show date
        return date.toLocaleDateString();
    }
}
