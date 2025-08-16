import {
    createMachine,
    assign,
    raise,
    fromPromise,
    fromCallback,
} from "xstate";
import {
    getSeed,
    getTime,
    DICE,
    BOARD_SIZE,
    findValidBonusTileIndex,
    HARLEQUIN_DURATION,
    SILVER_TILE_DURATION,
    TRIPLE_WORD_DURATION,
} from "./utils";
import { isValidBoggleWord, calculatePoints } from "./wordLogic";
import seedrandom from "seedrandom";

const generateBoard = (context) => {
    const rand = seedrandom(context.seed);
    const shuffledDice = [...DICE];
    for (let i = shuffledDice.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffledDice[i], shuffledDice[j]] = [shuffledDice[j], shuffledDice[i]];
    }
    const selectedLetters = shuffledDice.map(
        (die) => die.faces[Math.floor(rand() * 6)]
    );

    let dw = -1,
        dl = -1;
    while (dw === dl) {
        dw = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
        dl = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
    }

    return {
        board: selectedLetters,
        bonusTiles: [
            { index: dw, type: "DW" },
            { index: dl, type: "DL" },
        ],
    };
};

const findAllPossibleWords = (context) => {
    const found = new Map();
    if (
        !context.board ||
        context.board.length === 0 ||
        !context.wordSet ||
        context.wordSet.size === 0
    )
        return found;

    const getNeighbors = (index) => {
        const neighbors = [];
        const x = index % BOARD_SIZE;
        const y = Math.floor(index / BOARD_SIZE);

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const newY = y + i;
                const newX = x + j;
                if (
                    newX >= 0 &&
                    newX < BOARD_SIZE &&
                    newY >= 0 &&
                    newY < BOARD_SIZE
                ) {
                    neighbors.push(newY * BOARD_SIZE + newX);
                }
            }
        }
        return neighbors;
    };

    const findWords = (path, currentWord) => {
        const lastIndex = path[path.length - 1];
        const letter = context.board[lastIndex].toUpperCase();
        currentWord += letter;

        if (currentWord.length >= 3 && context.wordSet.has(currentWord)) {
            if (!found.has(currentWord)) {
                found.set(currentWord, path);
            }
        }

        const neighbors = getNeighbors(lastIndex);
        for (const neighbor of neighbors) {
            if (!path.includes(neighbor)) {
                findWords([...path, neighbor], currentWord);
            }
        }
    };

    for (let i = 0; i < context.board.length; i++) {
        findWords([i], "");
    }
    return found;
};

export const gameMachine = createMachine(
    {
        id: "boggler",
        initial: "loading",
        context: {
            seed: null,
            date: null,
            board: [],
            wordSet: new Set(),
            allPossibleWords: new Map(),
            foundWords: [],
            timeLeft: getTime(),
            isDebug:
                new URLSearchParams(window.location.search).get("debug") ===
                "true",
            bonusTiles: [],
            harlequin: {
                word: null,
                positions: [],
                isActive: false,
                timer: 0,
                startTime: 0,
                hasAppeared: false,
            },
            tripleWordStartTime: 0,
            silverTileStartTime: 0,
            timedTileHistory: new Set(),
            lastFoundWord: null,
        },
        states: {
            loading: {
                invoke: {
                    id: "load-game-data",
                    src: fromPromise(async () => {
                        const response = await fetch(
                            `${process.env.PUBLIC_URL}/words.txt`
                        );
                        if (!response.ok) {
                            throw new Error(
                                `Failed to fetch words: ${response.status} ${response.statusText}`
                            );
                        }
                        const text = await response.text();
                        const lines = text.split(/\r?\n/);
                        const nonEmptyLines = lines.filter(
                            (line) => line.trim() !== ""
                        );
                        const words = new Set(
                            nonEmptyLines.map((word) =>
                                word.trim().toUpperCase()
                            )
                        );
                        return { words };
                    }),
                    onDone: {
                        target: "setup",
                        actions: assign({
                            wordSet: ({ event }) => event.output.words,
                        }),
                    },
                    onError: {
                        target: "loadingError",
                        actions: [
                            ({ event }) =>
                                console.error(
                                    "Error loading words:",
                                    event.data
                                ),
                        ],
                    },
                },
                entry: assign(getSeed()),
            },
            loadingError: {
                // Final state for loading failure
            },
            setup: {
                entry: assign(({ context }) => {
                    const { board, bonusTiles } = generateBoard(context);
                    const allPossibleWords = findAllPossibleWords({
                        ...context,
                        board,
                    });
                    return {
                        board,
                        bonusTiles,
                        allPossibleWords,
                        timedTileHistory: new Set(),
                    };
                }),
                always: { target: "ready" },
            },
            ready: {
                on: {
                    START_GAME: "playing",
                },
            },
            playing: {
                entry: assign(({ context }) => {
                    const { seed, isDebug } = context;
                    let twStartTime, stStartTime, hqStartTime;

                    if (seed === "debug") {
                        hqStartTime = 1;
                        stStartTime = hqStartTime + HARLEQUIN_DURATION + 1;
                        twStartTime = stStartTime + SILVER_TILE_DURATION + 1;
                    } else {
                        const rand = seedrandom(seed + 1);
                        const gameDuration = getTime();
                        twStartTime =
                            Math.floor(rand() * (gameDuration / 2)) +
                            gameDuration / 2;
                        stStartTime = Math.floor(rand() * (gameDuration / 2));
                        hqStartTime =
                            Math.floor(rand() * (gameDuration / 3)) +
                            Math.floor(gameDuration / 3);
                    }

                    if (isDebug) {
                        console.log(
                            `Bonus schedule:\n- TW at: ${twStartTime}s\n- ST at: ${stStartTime}s\n- HQ at: ${hqStartTime}s`
                        );
                    }

                    return {
                        tripleWordStartTime: twStartTime,
                        silverTileStartTime: stStartTime,
                        harlequin: {
                            ...context.harlequin,
                            startTime: hqStartTime,
                        },
                    };
                }),
                invoke: [
                    {
                        id: "game-timer-normal",
                        src: fromCallback(({ sendBack }) => {
                            const interval = setInterval(() => {
                                sendBack({ type: "TICK" });
                            }, 1000);
                            return () => clearInterval(interval);
                        }),
                        guard: ({ context }) => !context.isDebug,
                    },
                    {
                        id: "game-timer-debug",
                        src: fromCallback(({ sendBack }) => {
                            const interval = setInterval(() => {
                                sendBack({ type: "TICK" });
                            }, 100);
                            return () => clearInterval(interval);
                        }),
                        guard: ({ context }) => context.isDebug,
                    },
                ],
                on: {
                    TICK: [
                        {
                            target: "gameOver",
                            guard: ({ context }) => context.timeLeft <= 1,
                        },
                        {
                            actions: [
                                assign({
                                    timeLeft: ({ context }) =>
                                        context.timeLeft - 1,
                                }),
                                raise({ type: "UPDATE_TIMED_TILES" }),
                            ],
                        },
                    ],
                    UPDATE_TIMED_TILES: {
                        actions: [
                            assign(({ context }) => {
                                const {
                                    timeLeft,
                                    tripleWordStartTime,
                                    silverTileStartTime,
                                    harlequin,
                                    timedTileHistory,
                                    board,
                                    allPossibleWords,
                                } = context;
                                let newBonusTiles = [...context.bonusTiles];
                                let newHarlequin = { ...harlequin };

                                // --- Tile Activation ---
                                if (timeLeft === tripleWordStartTime) {
                                    const occupiedIndices = newBonusTiles.map(
                                        (t) => t.index
                                    );
                                    const rand = seedrandom(timeLeft);
                                    const index = findValidBonusTileIndex(
                                        allPossibleWords,
                                        context.foundWords,
                                        rand,
                                        occupiedIndices,
                                        timedTileHistory
                                    );
                                    if (index !== -1) {
                                        newBonusTiles.push({
                                            type: "TW",
                                            index,
                                            timer: TRIPLE_WORD_DURATION,
                                        });
                                        timedTileHistory.add(index);
                                    }
                                }

                                if (timeLeft === silverTileStartTime) {
                                    const occupiedIndices = newBonusTiles.map(
                                        (t) => t.index
                                    );
                                    const rand = seedrandom(timeLeft);
                                    const index = findValidBonusTileIndex(
                                        allPossibleWords,
                                        context.foundWords,
                                        rand,
                                        occupiedIndices,
                                        timedTileHistory
                                    );
                                    if (index !== -1) {
                                        newBonusTiles.push({
                                            type: "ST",
                                            index,
                                            timer: SILVER_TILE_DURATION,
                                            used: false,
                                        });
                                        timedTileHistory.add(index);
                                    }
                                }

                                if (
                                    context.isDebug &&
                                    timeLeft === harlequin.startTime
                                ) {
                                    console.log(
                                        `[Harlequin Check] Time: ${timeLeft}. Attempting to activate.`
                                    );
                                    console.log(
                                        `[Harlequin Check] hasAppeared: ${harlequin.hasAppeared}`
                                    );
                                }

                                if (
                                    timeLeft === harlequin.startTime &&
                                    !harlequin.hasAppeared
                                ) {
                                    if (context.isDebug)
                                        console.log(
                                            "[Harlequin Check] Conditions met. Searching for long word."
                                        );
                                    const longWords = Array.from(
                                        allPossibleWords.keys()
                                    )
                                        .filter((w) => w.length >= 6)
                                        .sort((a, b) => b.length - a.length);

                                    if (context.isDebug)
                                        console.log(
                                            `[Harlequin Check] Found ${longWords.length} words with length >= 7.`
                                        );

                                    if (longWords.length > 0) {
                                        const word = longWords[0];
                                        const path = allPossibleWords.get(word);
                                        if (path && path.length >= 2) {
                                            if (context.isDebug)
                                                console.log(
                                                    `[Harlequin Check] Activating with word: ${word}`
                                                );
                                            newHarlequin = {
                                                ...newHarlequin,
                                                word: word,
                                                positions: [
                                                    {
                                                        index: path[0],
                                                        type: "harlequin-1",
                                                    },
                                                    {
                                                        index: path[
                                                            path.length - 1
                                                        ],
                                                        type: "harlequin-2",
                                                    },
                                                ],
                                                isActive: true,
                                                timer: HARLEQUIN_DURATION,
                                                hasAppeared: true,
                                            };
                                        }
                                    } else {
                                        if (context.isDebug)
                                            console.log(
                                                "[Harlequin Check] No long words found. Harlequin will not appear."
                                            );
                                    }
                                }

                                // --- Timer Decrementation ---
                                newBonusTiles = newBonusTiles
                                    .map((tile) => {
                                        if (tile.timer > 0) {
                                            return {
                                                ...tile,
                                                timer: tile.timer - 1,
                                            };
                                        }
                                        return tile;
                                    })
                                    .filter((tile) => tile.timer !== 0);

                                if (newHarlequin.isActive) {
                                    if (newHarlequin.timer > 1) {
                                        newHarlequin.timer--;
                                    } else {
                                        newHarlequin.isActive = false;
                                        newHarlequin.word = null;
                                        newHarlequin.positions = [];
                                    }
                                }

                                return {
                                    bonusTiles: newBonusTiles,
                                    harlequin: newHarlequin,
                                };
                            }),
                        ],
                    },
                    CHECK_WORD: {
                        actions: [
                            assign(({ context, event }) => {
                                const {
                                    board,
                                    wordSet,
                                    foundWords,
                                    bonusTiles,
                                    harlequin,
                                } = context;
                                const upperCaseWord = event.word.toUpperCase();

                                if (
                                    upperCaseWord.length < 3 ||
                                    foundWords.some(
                                        (item) => item.word === upperCaseWord
                                    ) ||
                                    !wordSet.has(upperCaseWord)
                                ) {
                                    return {};
                                }

                                const path = isValidBoggleWord(
                                    board,
                                    upperCaseWord
                                );

                                if (path) {
                                    const points = calculatePoints(
                                        upperCaseWord,
                                        path,
                                        bonusTiles,
                                        harlequin
                                    );
                                    const newFoundWord = {
                                        word: upperCaseWord,
                                        points,
                                    };
                                    return {
                                        foundWords: [
                                            ...foundWords,
                                            newFoundWord,
                                        ],
                                        lastFoundWord: newFoundWord,
                                    };
                                }
                                return {};
                            }),
                            raise(({ context, event }) => {
                                const { harlequin, bonusTiles, board } =
                                    context;
                                const upperCaseWord = event.word.toUpperCase();
                                const path = isValidBoggleWord(
                                    board,
                                    upperCaseWord
                                );
                                const silverTile = bonusTiles.find(
                                    (t) => t.type === "ST" && !t.used
                                );

                                const events = [];
                                if (
                                    harlequin.isActive &&
                                    harlequin.word === upperCaseWord
                                ) {
                                    events.push({ type: "HARLEQUIN_SUCCESS" });
                                }
                                if (
                                    silverTile &&
                                    path &&
                                    path.includes(silverTile.index)
                                ) {
                                    events.push({
                                        type: "USE_SILVER_TILE",
                                        index: silverTile.index,
                                    });
                                }
                                return events;
                            }),
                        ],
                    },
                    HARLEQUIN_SUCCESS: {
                        actions: assign({
                            harlequin: ({ context }) => ({
                                ...context.harlequin,
                                isActive: false,
                                word: null,
                                positions: [],
                            }),
                        }),
                    },
                    USE_SILVER_TILE: {
                        actions: assign({
                            bonusTiles: ({ context, event }) =>
                                context.bonusTiles.map((t) =>
                                    t.index === event.index
                                        ? { ...t, used: true }
                                        : t
                                ),
                        }),
                    },
                },
            },
            gameOver: {
                type: "final",
                entry: assign({ timeLeft: 0 }),
            },
        },
    },
    {
        actions: {},
        guards: {},
    }
);
