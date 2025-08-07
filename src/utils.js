import seedrandom from "seedrandom";
import ordinal from "ordinal";

// --- CONSTANTS ---
export const BOARD_SIZE = 4;
export const TRIPLE_WORD_DURATION = 15;
export const SILVER_TILE_DURATION = 15;
export const HARLEQUIN_DURATION = 15;

export const DICE = [
    { faces: ["A", "A", "E", "E", "G", "N"] },
    { faces: ["A", "B", "B", "J", "O", "O"] },
    { faces: ["A", "C", "H", "O", "P", "S"] },
    { faces: ["A", "F", "F", "K", "P", "S"] },
    { faces: ["A", "O", "O", "T", "T", "W"] },
    { faces: ["C", "I", "M", "O", "T", "U"] },
    { faces: ["D", "E", "I", "L", "R", "X"] },
    { faces: ["D", "E", "L", "R", "V", "Y"] },
    { faces: ["D", "I", "S", "T", "T", "Y"] },
    { faces: ["E", "E", "G", "H", "N", "W"] },
    { faces: ["E", "E", "I", "N", "S", "U"] },
    { faces: ["E", "H", "R", "T", "V", "W"] },
    { faces: ["E", "I", "O", "S", "S", "T"] },
    { faces: ["E", "L", "R", "T", "T", "Y"] },
    { faces: ["H", "I", "M", "N", "U", "Qu"] },
    { faces: ["H", "L", "N", "N", "R", "Z"] },
];

// Utility function to get the game seed from the URL, or generate one from the current date.
export const getSeed = () => {
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get("seed");

    if (seedParam === 'debug') {
        return { seed: 'debug', date: 'DEBUG MODE' };
    }

    let seed = parseInt(seedParam, 10);
    let date = null;
    if (isNaN(seed) || seed < 1000 || seed > 9999) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        seed = year * 10000 + month * 100 + day;

        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        date = `${monthNames[today.getMonth()]} ${ordinal(day)}`;
    }
    return { seed, date };
};

// Utility function to get the game duration from the URL, or return a default value.
export const getTime = () => {
    const params = new URLSearchParams(window.location.search);
    let time = parseInt(params.get("time"), 10);
    if (isNaN(time) || time <= 0) {
        return 120;
    }
    return time;
};

// Helper function for the bonus reducer to find a valid tile index for a new timed bonus.
// It prioritizes tiles that are part of unfound words and haven't been used for a timed bonus before.
export function findValidBonusTileIndex(allPossibleWords, foundWords, rand, occupiedIndices, history) {
    const foundWordsSet = new Set(foundWords.map(item => item.word));
    // Find all paths for words that have not been found yet.
    const unfoundWordPaths = [];
    for (const [word, path] of allPossibleWords.entries()) {
        if (!foundWordsSet.has(word)) {
            unfoundWordPaths.push(path);
        }
    }
    // Collect all unique indices from the paths of unfound words.
    const unfoundWordIndices = new Set();
    for (const path of unfoundWordPaths) {
        for (const index of path) {
            unfoundWordIndices.add(index);
        }
    }
    // Filter for indices that are not currently occupied by another bonus and have not been used for a timed bonus in the past.
    const candidateIndices = [...unfoundWordIndices].filter(index => !occupiedIndices.includes(index) && !history.has(index));
    if (candidateIndices.length > 0) {
        // Return a random index from the valid candidates.
        return candidateIndices[Math.floor(rand() * candidateIndices.length)];
    }
    // Return -1 if no valid index is found.
    return -1;
}
