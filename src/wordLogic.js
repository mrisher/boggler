import { BOARD_SIZE } from "./utils";

// Helper function to get the 8 neighbors of a tile.
export const getNeighbors = (index) => {
    const neighbors = [];
    const x = index % BOARD_SIZE;
    const y = Math.floor(index / BOARD_SIZE);

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const newY = y + i;
            const newX = x + j;
            if (newX >= 0 && newX < BOARD_SIZE && newY >= 0 && newY < BOARD_SIZE) {
                neighbors.push(newY * BOARD_SIZE + newX);
            }
        }
    }
    return neighbors;
};

// Checks if a word is valid on the Boggle board and returns its path if so.
export const isValidBoggleWord = (board, word) => {
    // Recursive search function to find the word path.
    const search = (currentWord, index, visited) => {
        const tileLetter = board[index].toUpperCase();
        if (!currentWord.startsWith(tileLetter)) {
            return null;
        }
        if (currentWord.length === tileLetter.length) {
            return [index];
        }

        const remainingWord = currentWord.substring(tileLetter.length);
        visited.add(index);

        const neighbors = getNeighbors(index);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                const path = search(remainingWord, neighbor, new Set(visited));
                if (path) {
                    return [index, ...path];
                }
            }
        }
        return null;
    };

    // Start a search from every tile on the board.
    for (let i = 0; i < board.length; i++) {
        const path = search(word, i, new Set());
        if (path) {
            return path;
        }
    }
    return null;
};

// Calculates the point value of a word, including any bonuses.
export const calculatePoints = (word, path, bonusTiles, harlequin) => {
    if (word.length <= 2) return 0;

    // 1. Get base points from word length (Boggle standard scoring)
    let points;
    const len = word.length;
    if (len <= 4) { // 3 or 4 letters
        points = 1;
    } else if (len === 5) {
        points = 2;
    } else if (len === 6) {
        points = 3;
    } else if (len === 7) {
        points = 5;
    } else { // 8+ letters
        points = 11;
    }

    let wordMultiplier = 1;

    // 2. Check for tile bonuses
    for (const tile of bonusTiles) {
        if (path.includes(tile.index)) {
            if (tile.type === "DL") {
                points += 1; // Double Letter adds 1 point
            } else if (tile.type === "DW") {
                wordMultiplier *= 2;
            } else if (tile.type === "TW") {
                wordMultiplier *= 3;
            } else if (tile.type === "ST") {
                wordMultiplier *= 10;
            }
        }
    }

    // 3. Apply word multipliers
    points *= wordMultiplier;

    // 4. Check for Harlequin bonus
    if (harlequin.isActive && word === harlequin.word) {
        points += 50; // Harlequin bonus
    }

    return points;
};
