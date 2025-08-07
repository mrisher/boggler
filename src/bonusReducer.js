import seedrandom from "seedrandom";
import { getTime, findValidBonusTileIndex, HARLEQUIN_DURATION, SILVER_TILE_DURATION, TRIPLE_WORD_DURATION } from './utils';

// Initial state for the bonus logic managed by the bonusReducer.
export const initialState = {
    bonusTiles: [],
    harlequin: {
        word: null,
        positions: [],
        isActive: false,
        timer: 0,
        startTime: 0,
        hasAppeared: false,
    },
    bonusMessage: "",
    tripleWordStartTime: 0,
    tripleWordHasAppeared: false,
    silverTileStartTime: 0,
    silverTileHasAppeared: false,
    timedTileHistory: new Set(),
};

// Reducer for managing all bonus-related state changes.
export function bonusReducer(state, action) {
    switch (action.type) {
        // Sets up the bonus schedule at the start of a new game.
        case 'START_GAME': {
            const { seed, isDebug } = action.payload;
            let twStartTime, stStartTime, hqStartTime;

            // Use fixed start times for debugging, otherwise randomize them.
            if (seed === 'debug') {
                hqStartTime = 1;
                stStartTime = hqStartTime + HARLEQUIN_DURATION + 1;
                twStartTime = stStartTime + SILVER_TILE_DURATION + 1;
            } else {
                const rand = seedrandom(seed + 1);
                const gameDuration = getTime();
                // Triple word appears in the second half of the game.
                twStartTime = Math.floor(rand() * (gameDuration / 2)) + gameDuration / 2;
                // Silver tile appears in the first half.
                stStartTime = Math.floor(rand() * (gameDuration / 2));
                // Harlequin appears in the middle third.
                hqStartTime = Math.floor(rand() * (gameDuration / 3)) + Math.floor(gameDuration / 3);
            }

            if (isDebug) {
                console.log(`Game started. Bonus schedule:\n- Triple Word at: ${twStartTime}s\n- Silver Tile at: ${stStartTime}s\n- Harlequin at: ${hqStartTime}s`);
            }

            return {
                ...state,
                tripleWordStartTime: twStartTime,
                tripleWordHasAppeared: false,
                silverTileStartTime: stStartTime,
                silverTileHasAppeared: false,
                harlequin: { ...state.harlequin, startTime: hqStartTime, hasAppeared: false },
            };
        }

        // Handles the game's clock tick, updating timers and activating bonuses.
        case 'TICK': {
            const { allPossibleWords, foundWords, seed, timeLeft, isDebug } = action.payload;
            const now = getTime() - timeLeft;

            // Tick down the timer for the active Harlequin bonus.
            let nextHarlequin = state.harlequin;
            if (state.harlequin.isActive) {
                const newTimer = state.harlequin.timer - 1;
                nextHarlequin = {
                    ...state.harlequin,
                    timer: newTimer,
                    isActive: newTimer > 0,
                };
            }

            // Tick down timers for active bonus tiles and remove them if they expire.
            let nextBonusTiles = state.bonusTiles
                .map(tile => {
                    if (tile.timer > 0) {
                        return { ...tile, timer: tile.timer - 1 };
                    }
                    return tile;
                })
                .filter(tile => tile.timer === undefined || tile.timer > 0);

            let nextTimedTileHistory = state.timedTileHistory;
            let nextTripleWordHasAppeared = state.tripleWordHasAppeared;
            let nextSilverTileHasAppeared = state.silverTileHasAppeared;

            // Check if a new timed bonus should be activated. This only happens if no other timed bonus is currently active.
            const isBonusCurrentlyActive = nextHarlequin.isActive || nextBonusTiles.some(t => t.type === 'TW' || t.type === 'ST');
            if (!isBonusCurrentlyActive) {
                // Activate Triple Word bonus if its start time has been reached.
                if (now === state.tripleWordStartTime && !state.tripleWordHasAppeared) {
                    const rand = seedrandom(seed + timeLeft);
                    const occupiedIndices = nextBonusTiles.map(t => t.index);
                    const twIndex = findValidBonusTileIndex(allPossibleWords, foundWords, rand, occupiedIndices, state.timedTileHistory);
                    if (twIndex !== -1) {
                        if (isDebug) console.log(`TW tile placed at ${twIndex}.`);
                        nextBonusTiles = [...nextBonusTiles, { index: twIndex, type: 'TW', timer: TRIPLE_WORD_DURATION }];
                        nextTimedTileHistory = new Set(nextTimedTileHistory).add(twIndex);
                        nextTripleWordHasAppeared = true;
                    }
                }
                
                // Activate Silver Tile bonus if its start time has been reached.
                if (now === state.silverTileStartTime && !state.silverTileHasAppeared) {
                    const rand = seedrandom(seed + timeLeft);
                    const occupiedIndices = nextBonusTiles.map(t => t.index);
                    const stIndex = findValidBonusTileIndex(allPossibleWords, foundWords, rand, occupiedIndices, state.timedTileHistory);
                    if (stIndex !== -1) {
                        if (isDebug) console.log(`ST tile placed at ${stIndex}.`);
                        nextBonusTiles = [...nextBonusTiles, { index: stIndex, type: 'ST', used: false, timer: SILVER_TILE_DURATION }];
                        nextTimedTileHistory = new Set(nextTimedTileHistory).add(stIndex);
                        nextSilverTileHasAppeared = true;
                    }
                }
                
                // Activate Harlequin bonus if its start time has been reached.
                if (now === state.harlequin.startTime && !state.harlequin.hasAppeared) {
                    const foundWordsSet = new Set(foundWords.map((item) => item.word));
                    const unfoundWords = [...allPossibleWords.keys()].filter(
                        (word) => !foundWordsSet.has(word)
                    );

                    if (unfoundWords.length > 0) {
                        // The Harlequin challenge word is the longest word not yet found by the player.
                        const longestWord = unfoundWords.reduce((a, b) => a.length >= b.length ? a : b, '');
                        const path = allPossibleWords.get(longestWord);

                        if (path && path.length >= 2) {
                            if (isDebug) console.log("Harlequin activating. Word:", longestWord);
                            nextHarlequin = {
                                startTime: state.harlequin.startTime,
                                word: longestWord,
                                positions: [
                                    { index: path[0], type: 1 }, // Start of the word
                                    { index: path[path.length - 1], type: 2 }, // End of the word
                                ],
                                isActive: true,
                                timer: HARLEQUIN_DURATION,
                                hasAppeared: true,
                            };
                        }
                    }
                }
            }

            // Return the updated state.
            return {
                ...state,
                harlequin: nextHarlequin,
                bonusTiles: nextBonusTiles,
                timedTileHistory: nextTimedTileHistory,
                tripleWordHasAppeared: nextTripleWordHasAppeared,
                silverTileHasAppeared: nextSilverTileHasAppeared,
            };
        }
        // Action dispatched when the player successfully finds the Harlequin word.
        case 'HARLEQUIN_SUCCESS':
            return {
                ...state,
                harlequin: { ...state.harlequin, isActive: false, word: null, positions: [] },
            };
        // Marks a silver tile as 'used' after it has been part of a found word.
        case 'USE_SILVER_TILE':
            return {
                ...state,
                bonusTiles: state.bonusTiles.map(t => 
                    t.index === action.payload.index ? { ...t, used: true } : t
                ),
            };
        // Action dispatched when the board is first generated.
        case 'BOARD_GENERATED': {
            const { dw, dl } = action.payload;
            return {
                ...state,
                // Adds the permanent Double Word and Double Letter tiles to the board.
                bonusTiles: [
                    { index: dw, type: 'DW' },
                    { index: dl, type: 'DL' },
                ],
                timedTileHistory: new Set(),
            };
        }
        default:
            return state;
    }
}
