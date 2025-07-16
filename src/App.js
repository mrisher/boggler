import React, { useState, useEffect, useRef, useCallback, useReducer } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import ordinal from "ordinal";
import seedrandom from "seedrandom";
import "./App.css";

const DICE = [
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
const BOARD_SIZE = 4;
const TRIPLE_WORD_DURATION = 15;
const SILVER_TILE_DURATION = 15;
const HARLEQUIN_DURATION = 15;

const getSeed = () => {
    const params = new URLSearchParams(window.location.search);
    let seed = parseInt(params.get("seed"), 10);
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

const getTime = () => {
    const params = new URLSearchParams(window.location.search);
    let time = parseInt(params.get("time"), 10);
    if (isNaN(time) || time <= 0) {
        return 120;
    }
    return time;
};

const initialState = {
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

function findValidBonusTileIndex(allPossibleWords, foundWords, rand, occupiedIndices, history) {
    const foundWordsSet = new Set(foundWords.map(item => item.word));
    const unfoundWordPaths = [];
    for (const [word, path] of allPossibleWords.entries()) {
        if (!foundWordsSet.has(word)) {
            unfoundWordPaths.push(path);
        }
    }
    const unfoundWordIndices = new Set();
    for (const path of unfoundWordPaths) {
        for (const index of path) {
            unfoundWordIndices.add(index);
        }
    }
    const candidateIndices = [...unfoundWordIndices].filter(index => !occupiedIndices.includes(index) && !history.has(index));
    if (candidateIndices.length > 0) {
        return candidateIndices[Math.floor(rand() * candidateIndices.length)];
    }
    return -1;
}

function bonusReducer(state, action) {
    switch (action.type) {
        case 'START_GAME': {
            const { seed, isDebug } = action.payload;
            const rand = seedrandom(seed + 1);
            const gameDuration = getTime();
            const twStartTime = Math.floor(rand() * (gameDuration / 2)) + gameDuration / 2;
            const stStartTime = Math.floor(rand() * (gameDuration / 2));
            const hqStartTime = Math.floor(rand() * (gameDuration / 3)) + Math.floor(gameDuration / 3);

            if (isDebug) {
                console.log(`Game started. Bonus schedule:\n- Triple Word at: ${getTime() - twStartTime}s\n- Silver Tile at: ${getTime() - stStartTime}s\n- Harlequin at: ${getTime() - hqStartTime}s`);
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
        case 'TICK': {

            const { allPossibleWords, foundWords, seed, timeLeft } = action.payload;
            const now = getTime() - timeLeft;
            let newState = { ...state };

            // 1. Decrement all active timers
            newState.bonusTiles = state.bonusTiles.map(tile => 
                tile.timer > 0 ? { ...tile, timer: tile.timer - 1 } : tile
            ).filter(tile => tile.timer !== 0);

            if (state.harlequin.isActive) {
                const newTimer = state.harlequin.timer - 1;
                newState.harlequin = { 
                    ...state.harlequin, 
                    isActive: newTimer > 0, 
                    timer: newTimer 
                };
            }

            // 2. Check if a new bonus should activate
            const isBonusCurrentlyActive = newState.harlequin.isActive || newState.bonusTiles.some(t => t.type === 'TW' || t.type === 'ST');
            if (!isBonusCurrentlyActive) {
                const rand = seedrandom(seed + timeLeft);
                if (now === state.tripleWordStartTime && !state.tripleWordHasAppeared) {
                    const occupiedIndices = newState.bonusTiles.map(t => t.index);
                    const twIndex = findValidBonusTileIndex(allPossibleWords, foundWords, rand, occupiedIndices, newState.timedTileHistory);
                    if (twIndex !== -1) {
                        newState.bonusTiles.push({ index: twIndex, type: 'TW', timer: TRIPLE_WORD_DURATION });
                        newState.timedTileHistory = new Set(newState.timedTileHistory).add(twIndex);
                        newState.tripleWordHasAppeared = true;
                    }
                } else if (now === state.silverTileStartTime && !state.silverTileHasAppeared) {
                    const occupiedIndices = newState.bonusTiles.map(t => t.index);
                    const stIndex = findValidBonusTileIndex(allPossibleWords, foundWords, rand, occupiedIndices, newState.timedTileHistory);
                    if (stIndex !== -1) {
                        newState.bonusTiles.push({ index: stIndex, type: 'ST', used: false, timer: SILVER_TILE_DURATION });
                        newState.timedTileHistory = new Set(newState.timedTileHistory).add(stIndex);
                        newState.silverTileHasAppeared = true;
                    }
                } else if (now === state.harlequin.startTime && !state.harlequin.hasAppeared) {
                    const foundWordsSet = new Set(foundWords.map((item) => item.word));
                    const unfoundWords = [...allPossibleWords.keys()].filter(
                        (word) => !foundWordsSet.has(word)
                    );
                    const longUnfoundWords = unfoundWords.filter(
                        (word) => word.length >= 7
                    );

                    if (longUnfoundWords.length > 0) {
                        const word = longUnfoundWords[Math.floor(rand() * longUnfoundWords.length)];
                        const path = allPossibleWords.get(word);
                        if (path && path.length >= 2) {
                            newState.harlequin = {
                                ...state.harlequin,
                                word: word,
                                positions: [
                                    { index: path[0], type: 1 },
                                    { index: path[path.length - 1], type: 2 },
                                ],
                                isActive: true,
                                timer: HARLEQUIN_DURATION,
                                hasAppeared: true,
                            };
                        }
                    }
                }
            }
            return newState;
        }
        case 'HARLEQUIN_SUCCESS':
            return {
                ...state,
                harlequin: { ...state.harlequin, isActive: false, word: null, positions: [] },
            };
        case 'USE_SILVER_TILE':
            return {
                ...state,
                bonusTiles: state.bonusTiles.map(t => 
                    t.index === action.payload.index ? { ...t, used: true } : t
                ),
            };
        case 'BOARD_GENERATED': {
            const { dw, dl } = action.payload;
            return {
                ...state,
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

const App = () => {
    const [isDebug] = useState(
        () => new URLSearchParams(window.location.search).get("debug") === "true"
    );
    const [{ seed, date }] = useState(getSeed);
    const [board, setBoard] = useState([]);
    const [wordSet, setWordSet] = useState(new Set());
    const [foundWords, setFoundWords] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [timeLeft, setTimeLeft] = useState(getTime());
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [allPossibleWords, setAllPossibleWords] = useState(new Map());
    const [activeTab, setActiveTab] = useState("found");
    const [selection, setSelection] = useState([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [lastFoundWord, setLastFoundWord] = useState(null);
    const [showAllWordsModal, setShowAllWordsModal] = useState(false);
    const [modalActiveTab, setModalActiveTab] = useState("found");
    const [isLoading, setIsLoading] = useState(true);
    const [isExploding, setIsExploding] = useState(false);
    const [
        {
            bonusTiles,
            harlequin,
        },
        dispatch,
    ] = useReducer(bonusReducer, initialState);

    const inputRef = useRef(null);
    const wordListRef = useRef(null);
    const foundWordsRef = useRef(foundWords);
    useEffect(() => {
        foundWordsRef.current = foundWords;
    }, [foundWords]);

    const generateBoard = useCallback(() => {
        const rand = seedrandom(seed);
        const shuffledDice = [...DICE];
        for (let i = shuffledDice.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffledDice[i], shuffledDice[j]] = [shuffledDice[j], shuffledDice[i]];
        }
        const selectedLetters = shuffledDice.map(
            (die) => die.faces[Math.floor(rand() * 6)]
        );
        setBoard(selectedLetters);

        let dw = -1,
            dl = -1;
        while (dw === dl) {
            dw = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
            dl = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
        }

        dispatch({ type: 'BOARD_GENERATED', payload: { dw, dl } });
    }, [seed]);

    useEffect(() => {
        generateBoard();
    }, [generateBoard]);

    const findAllPossibleWords = useCallback(() => {
        const found = new Map();
        if (board.length === 0 || wordSet.size === 0) return;

        const findWords = (path, currentWord) => {
            const lastIndex = path[path.length - 1];
            const letter = board[lastIndex].toUpperCase();
            currentWord += letter;

            if (currentWord.length >= 3 && wordSet.has(currentWord)) {
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

        for (let i = 0; i < board.length; i++) {
            findWords([i], "");
        }
        setAllPossibleWords(found);
    }, [board, wordSet]);

    useEffect(() => {
        fetch("/words.txt")
            .then((response) => response.text())
            .then((text) => {
                const words = new Set(
                    text.split("\n").map((word) => word.trim().toUpperCase())
                );
                setWordSet(words);
            });
    }, []);

    useEffect(() => {
        if (board.length > 0 && wordSet.size > 0) {
            setIsLoading(true);
            setTimeout(() => {
                findAllPossibleWords();
                setIsLoading(false);
            }, 10);
        }
    }, [board, wordSet, findAllPossibleWords]);

    useEffect(() => {
        if (!gameStarted || gameOver) {
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prevTime) => {
                if (prevTime <= 1) {
                    setGameOver(true);
                    return 0;
                }
                return prevTime - 1;
            });
            dispatch({
                type: 'TICK',
                payload: {
                    allPossibleWords,
                    foundWords,
                    seed,
                    timeLeft,
                    isDebug,
                },
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStarted, gameOver, allPossibleWords, foundWords, seed, timeLeft, isDebug, dispatch]);

    useEffect(() => {
        if (timeLeft === 0 && gameStarted && !gameOver) {
            setGameOver(true);
        }
    }, [timeLeft, gameStarted, gameOver]);

    useEffect(() => {
        if (gameStarted) {
            inputRef.current.focus();
        }
    }, [gameStarted]);

    useEffect(() => {
        if (wordListRef.current) {
            if (activeTab === "found") {
                wordListRef.current.scrollTop = wordListRef.current.scrollHeight;
            } else {
                wordListRef.current.scrollTop = 0;
            }
        }
    }, [foundWords, activeTab]);

    useEffect(() => {
        if (lastFoundWord) {
            const timer = setTimeout(() => {
                setLastFoundWord(null);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [lastFoundWord]);

    const handleStartGame = () => {
        if (isLoading) return;
        setGameStarted(true);
        dispatch({ type: 'START_GAME', payload: { seed } });
        if (isDebug) {
            const rand = seedrandom(seed + 1);
            const gameDuration = getTime();
            const twStartTime = Math.floor(rand() * (gameDuration / 2)) + gameDuration / 2;
            const stStartTime = Math.floor(rand() * (gameDuration / 2));
            const hqStartTime = Math.floor(rand() * (gameDuration / 3)) + Math.floor(gameDuration / 3);
            console.log(`Game started. Bonus schedule:\n- Triple Word at: ${getTime() - twStartTime}s\n- Silver Tile at: ${getTime() - stStartTime}s\n- Harlequin at: ${getTime() - hqStartTime}s`);
        }
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    const getNeighbors = (index) => {
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

    const isValidBoggleWord = (word) => {
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

        for (let i = 0; i < board.length; i++) {
            const path = search(word, i, new Set());
            if (path) {
                return path;
            }
        }
        return null;
    };

    const calculatePoints = (word, path) => {
        if (word.length <= 2) return 0;
        let points = word.length - 3;
        let multiplier = 1;

        if (harlequin.isActive && word === harlequin.word) {
            points += 50; // Harlequin bonus
            dispatch({ type: 'HARLEQUIN_SUCCESS' });
        }

        for (const tile of bonusTiles) {
            if (path.includes(tile.index)) {
                if (tile.type === "DL") {
                    points += 1;
                } else if (tile.type === "DW") {
                    multiplier *= 2;
                } else if (tile.type === "TW") {
                    multiplier *= 3;
                } else if (tile.type === "ST" && !tile.used) {
                    multiplier *= 10;
                }
            }
        }
        return points * multiplier;
    };

    const checkWord = (word) => {
        const upperCaseWord = word.toUpperCase();
        if (
            upperCaseWord.length >= 3 &&
            !foundWords.some((item) => item.word === upperCaseWord) &&
            wordSet.has(upperCaseWord)
        ) {
            const path = isValidBoggleWord(upperCaseWord);
            if (path) {
                const points = calculatePoints(upperCaseWord, path);
                setFoundWords((prev) => [...prev, { word: upperCaseWord, points }]);
                setLastFoundWord({ word: upperCaseWord, points });

                const silverTile = bonusTiles.find((t) => t.type === "ST" && !t.used);
                if (silverTile && path.includes(silverTile.index)) {
                    setIsExploding(true);
                    dispatch({ type: 'USE_SILVER_TILE', payload: { index: silverTile.index } });
                }
            }
        }
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            checkWord(inputValue);
            setInputValue("");
        }
    };

    const handleMouseDown = (index) => {
        if (!gameStarted || gameOver) return;
        setIsSelecting(true);
        setSelection([index]);
    };

    const handleMouseEnter = (index) => {
        if (!isSelecting) return;

        const lastSelected = selection[selection.length - 1];
        const neighbors = getNeighbors(lastSelected);

        if (neighbors.includes(index) && !selection.includes(index)) {
            setSelection([...selection, index]);
        }
    };

    const handleMouseUp = () => {
        if (!isSelecting) return;

        const word = selection.map((index) => board[index]).join("");
        checkWord(word);

        setIsSelecting(false);
        setSelection([]);
    };

    const handleTouchStart = (e) => {
        const target = e.target;
        if (target.classList.contains("drag-target")) {
            const parentTile = target.closest(".tile");
            if (parentTile) {
                const index = parseInt(parentTile.dataset.index, 10);
                handleMouseDown(index);
            }
        }
    };

    const handleTouchMove = (e) => {
        if (!isSelecting) return;
        e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.classList.contains("drag-target")) {
            const parentTile = element.closest(".tile");
            if (parentTile) {
                const index = parseInt(parentTile.dataset.index, 10);
                if (selection.length > 0 && index !== selection[selection.length - 1]) {
                    handleMouseEnter(index);
                }
            }
        }
    };

    const handleTouchEnd = (e) => {
        if (!isSelecting) return;
        e.preventDefault();
        handleMouseUp();
    };

    const handleShare = () => {
        if (navigator.share) {
            const text = `I got ${totalScore} points on Nomoggle #${seed}. https://noggle.complicity.co?seed=${seed}`;
            navigator
                .share({
                    title: "Nomoggle Score",
                    text: text,
                })
                .catch((error) => console.log("Error sharing", error));
        }
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    };

    const formatPoints = (points) => {
        if (points > 1) {
            return `(${points})`;
        }
        return "";
    };

    const foundWordsSet = new Set(foundWords.map((item) => item.word));
    const sortedAllWords = [...allPossibleWords.keys()].sort((a, b) => {
        const pathA = allPossibleWords.get(a);
        const pathB = allPossibleWords.get(b);
        return calculatePoints(b, pathB) - calculatePoints(a, pathB);
    });
    const totalScore = foundWords.reduce((sum, { points }) => sum + points, 0);

    let bonusMessage = '';
    const activeTimedTile = bonusTiles.find(t => t.type === 'TW' || t.type === 'ST');
    if (harlequin.isActive) {
        bonusMessage = `Lengthy Challenge: Find a word connecting the two tiles! (${harlequin.timer}s)`;
    } else if (activeTimedTile) {
        if (activeTimedTile.type === 'TW') {
            bonusMessage = `Triple Word Score Active (${activeTimedTile.timer}s)`;
        } else if (activeTimedTile.type === 'ST') {
            bonusMessage = `10x Silver Tile Active (${activeTimedTile.timer}s)`;
        }
    }

    return (
        <div className="App" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="game-area">
                <h1>Nomoggle - {date ? date : `#${seed}`}</h1>
                <div className="bonus-message">{bonusMessage}</div>
                <h2 className={`timer ${timeLeft <= 10 ? "urgent" : ""}`}>
                    {formatTime(timeLeft)}
                </h2>
                {lastFoundWord && (
                    <div className="word-toast">
                        {lastFoundWord.word} {formatPoints(lastFoundWord.points)}
                    </div>
                )}
                <div
                    className="board-container"
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div
                        className={`board ${!gameStarted || isLoading ? "blurred" : ""}`}
                    >
                        {board.map((letter, index) => {
                            const bonusTile = bonusTiles.find((t) => t.index === index);
                            let tileTypeClass = "";
                            if (bonusTile) {
                                if (bonusTile.type === "ST" && bonusTile.used) {
                                    tileTypeClass = "";
                                } else {
                                    tileTypeClass = `${bonusTile.type.toLowerCase()}-tile`;
                                }
                            }
                            const harlequinTile = harlequin.positions.find(
                                (p) => p.index === index
                            );
                            const isHarlequin = !!harlequinTile;
                            const harlequinTypeClass = isHarlequin
                                ? `harlequin-${harlequinTile.type}`
                                : "";
                            const harlequinLitClass =
                                harlequin.isActive && isHarlequin ? "lit" : "";
                            const tileClasses = `tile ${
                                selection.includes(index) ? "selected" : ""
                            } ${tileTypeClass} ${
                                isHarlequin ? "harlequin-tile" : ""
                            } ${harlequinTypeClass} ${harlequinLitClass} ${
                                isLoading ? "shaking" : ""
                            }`;

                            if (isDebug && isHarlequin) {
                                console.log(`Tile ${index} (Harlequin): type=${harlequinTile.type}, active=${harlequin.isActive}, classes="${tileClasses}"`);
                            }

                            let chip = null;
                            if (bonusTile) {
                                if (bonusTile.type === "DW")
                                    chip = (
                                        <div className="bonus-chip double-word-chip">
                                            DW
                                        </div>
                                    );
                                else if (bonusTile.type === "DL")
                                    chip = (
                                        <div className="bonus-chip double-letter-chip">
                                            DL
                                        </div>
                                    );
                                else if (bonusTile.type === "TW")
                                    chip = (
                                        <div className="bonus-chip triple-word-chip">
                                            TW
                                        </div>
                                    );
                                else if (bonusTile.type === "ST" && !bonusTile.used)
                                    chip = (
                                        <div className="bonus-chip silver-tile-chip">
                                            10x
                                        </div>
                                    );
                            }

                            return (
                                <div
                                    key={index}
                                    data-index={index}
                                    className={tileClasses}
                                    style={{ animationDelay: `${Math.random() * 0.5}s` }}
                                >
                                    <div className="tile-content" data-letter={letter}>
                                        {isExploding &&
                                            bonusTile &&
                                            bonusTile.type === "ST" && (
                                                <ConfettiExplosion
                                                    onComplete={() =>
                                                        setIsExploding(false)
                                                    }
                                                    colors={[
                                                        "#C0C0C0",
                                                        "#D3D3D3",
                                                        "#E0E0E0",
                                                    ]}
                                                />
                                            )}
                                        {chip}
                                        {letter}
                                        <div
                                            className="drag-target"
                                            onMouseDown={() => handleMouseDown(index)}
                                            onMouseEnter={() => handleMouseEnter(index)}
                                            onTouchStart={handleTouchStart}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {!gameStarted && (
                        <div
                            className={`start-scrim ${isLoading ? "disabled" : ""}`}
                            onClick={handleStartGame}
                        >
                            <h2>{isLoading ? "Loading..." : "Click to Start"}</h2>
                        </div>
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    className="word-input"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={!gameStarted || gameOver}
                    placeholder={
                        !gameStarted
                            ? "Click start to play"
                            : gameOver
                            ? "Game Over"
                            : "Enter word..."
                    }
                />

                <div className="mobile-button-container">
                    {gameOver && (
                        <>
                            <button
                                className="view-words-button"
                                onClick={() => setShowAllWordsModal(true)}
                            >
                                All Words ({allPossibleWords.size})
                            </button>
                            <button className="share-button" onClick={handleShare}>
                                Share Score
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="sidebar">
                <div className="tab-container">
                    <button
                        className={`tab ${activeTab === "found" ? "active" : ""}`}
                        onClick={() => handleTabClick("found")}
                    >
                        Found Words ({foundWords.length})
                    </button>
                    <button
                        className={`tab ${activeTab === "all" ? "active" : ""}`}
                        onClick={() => handleTabClick("all")}
                        disabled={!gameOver}
                    >
                        All Words ({allPossibleWords.size})
                    </button>
                </div>
                <div className="word-list-container" ref={wordListRef}>
                    <ul className="word-list">
                        {activeTab === "found" &&
                            foundWords.map(({ word, points }) => (
                                <li key={word}>
                                    {word} {formatPoints(points)}
                                </li>
                            ))}
                        {activeTab === "all" &&
                            sortedAllWords.map((word) => (
                                <li
                                    key={word}
                                    className={
                                        foundWordsSet.has(word)
                                            ? "found-in-all"
                                            : "missed"
                                    }
                                >
                                    {word}{" "}
                                    {formatPoints(
                                        calculatePoints(word, allPossibleWords.get(word))
                                    )}
                                </li>
                            ))}
                    </ul>
                </div>
                {activeTab === "found" && !gameOver && (
                    <button className="share-button" onClick={handleShare}>
                        Share Score
                    </button>
                )}
            </div>
            {showAllWordsModal && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                {modalActiveTab === "found"
                                    ? `You found ${foundWords.length} words`
                                    : `All Words (${allPossibleWords.size})`}
                            </h2>
                            <button
                                className="close-button"
                                onClick={() => setShowAllWordsModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="tab-container">
                            <button
                                className={`tab ${
                                    modalActiveTab === "found" ? "active" : ""
                                }`}
                                onClick={() => setModalActiveTab("found")}
                            >
                                Found Words ({foundWords.length})
                            </button>
                            <button
                                className={`tab ${
                                    modalActiveTab === "all" ? "active" : ""
                                }`}
                                onClick={() => setModalActiveTab("all")}
                            >
                                All Words ({allPossibleWords.size})
                            </button>
                        </div>
                        {modalActiveTab === "found" && (
                            <div className="total-score">Total Score: {totalScore}</div>
                        )}
                        <div className="word-list-container">
                            <ul className="word-list">
                                {modalActiveTab === "found" &&
                                    foundWords.map(({ word, points }) => (
                                        <li key={word}>
                                            {word} {formatPoints(points)}
                                        </li>
                                    ))}
                                {modalActiveTab === "all" &&
                                    sortedAllWords.map((word) => (
                                        <li
                                            key={word}
                                            className={
                                                foundWordsSet.has(word)
                                                    ? "found-in-all"
                                                    : "missed"
                                            }
                                        >
                                            {word}{" "}
                                            {formatPoints(
                                                calculatePoints(
                                                    word,
                                                    allPossibleWords.get(word)
                                                )
                                            )}
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
