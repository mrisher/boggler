import React, { useState, useEffect, useRef, useCallback, useReducer } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import seedrandom from "seedrandom";
import "./App.css";
import { getSeed, getTime, DICE, BOARD_SIZE } from "./utils";
import { bonusReducer, initialState } from "./bonusReducer";

const App = () => {
    // --- STATE MANAGEMENT ---
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
    // The bonus state is managed by the bonusReducer.
    const [
        {
            bonusTiles,
            harlequin,
        },
        dispatch,
    ] = useReducer(bonusReducer, initialState);

    // --- REFS ---
    const inputRef = useRef(null);
    const wordListRef = useRef(null);
    // A ref to hold the current foundWords array, to avoid stale closures in the game timer.
    const foundWordsRef = useRef(foundWords);
    useEffect(() => {
        foundWordsRef.current = foundWords;
    }, [foundWords]);

    // --- BOARD AND WORD LOGIC ---

    // Generates the game board by shuffling the dice and selecting a random face from each.
    const generateBoard = useCallback(() => {
        const rand = seedrandom(seed);
        const shuffledDice = [...DICE];
        // Shuffle the dice array.
        for (let i = shuffledDice.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffledDice[i], shuffledDice[j]] = [shuffledDice[j], shuffledDice[i]];
        }
        // Select one random face from each die.
        const selectedLetters = shuffledDice.map(
            (die) => die.faces[Math.floor(rand() * 6)]
        );
        setBoard(selectedLetters);

        // Randomly place the Double Word (DW) and Double Letter (DL) bonus tiles.
        let dw = -1, 
            dl = -1;
        while (dw === dl) {
            dw = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
            dl = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
        }

        dispatch({ type: 'BOARD_GENERATED', payload: { dw, dl } });
    }, [seed]);

    // Generate the board when the component mounts.
    useEffect(() => {
        generateBoard();
    }, [generateBoard]);

    // Finds all possible valid words on the board.
    const findAllPossibleWords = useCallback(() => {
        const found = new Map();
        if (board.length === 0 || wordSet.size === 0) return;

        // Recursive function to find words starting from a given path.
        const findWords = (path, currentWord) => {
            const lastIndex = path[path.length - 1];
            const letter = board[lastIndex].toUpperCase();
            currentWord += letter;

            // If the current word is valid and long enough, add it to the map.
            if (currentWord.length >= 3 && wordSet.has(currentWord)) {
                if (!found.has(currentWord)) {
                    found.set(currentWord, path);
                }
            }

            // Explore neighbors to find longer words.
            const neighbors = getNeighbors(lastIndex);
            for (const neighbor of neighbors) {
                if (!path.includes(neighbor)) {
                    findWords([...path, neighbor], currentWord);
                }
            }
        };

        // Start a search from every tile on the board.
        for (let i = 0; i < board.length; i++) {
            findWords([i], "");
        }
        setAllPossibleWords(found);
    }, [board, wordSet]);

    // Fetches the word list when the component mounts.
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

    // Finds all possible words once the board and word list are ready.
    useEffect(() => {
        if (board.length > 0 && wordSet.size > 0) {
            setIsLoading(true);
            setTimeout(() => {
                findAllPossibleWords();
                setIsLoading(false);
            }, 10);
        }
    }, [board, wordSet, findAllPossibleWords]);

    // --- GAME LIFECYCLE ---

    // Main game timer loop.
    useEffect(() => {
        if (!gameStarted || gameOver) {
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prevTime) => {
                const newTime = prevTime > 0 ? prevTime - 1 : 0;
                if (newTime === 0 && !gameOver) {
                    setGameOver(true);
                }

                // Dispatch a TICK action to the bonus reducer on every second.
                dispatch({
                    type: 'TICK',
                    payload: {
                        allPossibleWords,
                        foundWords: foundWordsRef.current,
                        seed,
                        timeLeft: newTime,
                        isDebug,
                    },
                });

                return newTime;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStarted, gameOver, allPossibleWords, seed, isDebug, dispatch]);

    // Effect to end the game when the timer runs out.
    useEffect(() => {
        if (timeLeft === 0 && gameStarted && !gameOver) {
            setGameOver(true);
        }
    }, [timeLeft, gameStarted, gameOver]);

    // Focus the input field when the game starts.
    useEffect(() => {
        if (gameStarted) {
            inputRef.current.focus();
        }
    }, [gameStarted]);

    // --- UI AND EVENT HANDLERS ---

    // Auto-scroll the word list.
    useEffect(() => {
        if (wordListRef.current) {
            if (activeTab === "found") {
                wordListRef.current.scrollTop = wordListRef.current.scrollHeight;
            } else {
                wordListRef.current.scrollTop = 0;
            }
        }
    }, [foundWords, activeTab]);

    // Show a toast message for the last found word.
    useEffect(() => {
        if (lastFoundWord) {
            const timer = setTimeout(() => {
                setLastFoundWord(null);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [lastFoundWord]);

    // Debug logging for Harlequin state changes.
    useEffect(() => {
        if (isDebug && harlequin.isActive) {
            console.log("Harlequin state is now ACTIVE in component:", harlequin);
        }
    }, [isDebug, harlequin.isActive, harlequin]);

    const handleStartGame = () => {
        if (isLoading || allPossibleWords.size === 0) return;
        setGameStarted(true);
        dispatch({ type: 'START_GAME', payload: { seed, isDebug } });
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    // Helper function to get the 8 neighbors of a tile.
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

    // Checks if a word is valid on the Boggle board and returns its path if so.
    const isValidBoggleWord = (word) => {
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
    const calculatePoints = (word, path) => {
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
                } else if (tile.type === "ST" && !tile.used) {
                    wordMultiplier *= 10;
                }
            }
        }

        // 3. Apply word multipliers
        points *= wordMultiplier;

        // 4. Check for Harlequin bonus
        if (harlequin.isActive && word === harlequin.word) {
            points += 50; // Harlequin bonus
            dispatch({ type: 'HARLEQUIN_SUCCESS' });
        }

        return points;
    };

    // Checks a word submitted by the player.
    const checkWord = (word) => {
        const upperCaseWord = word.toUpperCase();
        // Basic word validation.
        if (
            upperCaseWord.length >= 3 &&
            !foundWords.some((item) => item.word === upperCaseWord) &&
            wordSet.has(upperCaseWord)
        ) {
            const path = isValidBoggleWord(upperCaseWord);
            if (path) {
                // If the word is valid, calculate points and add it to the found words list.
                const points = calculatePoints(upperCaseWord, path);
                setFoundWords((prev) => [...prev, { word: upperCaseWord, points }]);
                setLastFoundWord({ word: upperCaseWord, points });

                // Check if a silver tile was used.
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

    // --- MOUSE/TOUCH DRAG SELECTION ---

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

    // --- UTILITY AND FORMATTING ---

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

    // --- RENDER LOGIC ---

    const foundWordsSet = new Set(foundWords.map((item) => item.word));
    const sortedAllWords = [...allPossibleWords.keys()].sort((a, b) => {
        const pathA = allPossibleWords.get(a);
        const pathB = allPossibleWords.get(b);
        return calculatePoints(b, pathB) - calculatePoints(a, pathB);
    });
    const totalScore = foundWords.reduce((sum, { points }) => sum + points, 0);

    // Determine the current bonus message to display.
    let bonusMessage = '';
    const activeTimedTile = bonusTiles.find(t => t.type === 'TW' || (t.type === 'ST' && !t.used));
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
                <div className="game-stats">
                    <h2 className={`timer ${timeLeft <= 10 ? "urgent" : ""}`}>
                        {formatTime(timeLeft)}
                    </h2>
                    <h2 className="score">Score: {totalScore}</h2>
                </div>
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
                            const harlequinTile = harlequin.positions.find(
                                (p) => p.index === index
                            );
                            const isHarlequin = !!harlequinTile;

                            const classes = ['tile'];
                            if (selection.includes(index)) {
                                classes.push('selected');
                            }
                            if (isLoading) {
                                classes.push('shaking');
                            }

                            if (isHarlequin) {
                                classes.push('harlequin-tile', `harlequin-${harlequinTile.type}`);
                                if (harlequin.isActive) {
                                    classes.push('lit');
                                }
                            } else if (bonusTile) {
                                if (!(bonusTile.type === 'ST' && bonusTile.used)) {
                                    classes.push(`${bonusTile.type.toLowerCase()}-tile`);
                                }
                            }
                            
                            const tileClasses = classes.join(' ');

                            if (isDebug && isHarlequin) {
                                console.log(`[Render] Tile ${index} (Harlequin): type=${harlequinTile.type}, active=${harlequin.isActive}, classes="${tileClasses}"`);
                            }

                            let chip = null;
                            if (bonusTile && !isHarlequin) {
                                if (bonusTile.type === "DW") chip = <div className="bonus-chip double-word-chip">DW</div>;
                                else if (bonusTile.type === "DL") chip = <div className="bonus-chip double-letter-chip">DL</div>;
                                else if (bonusTile.type === "TW") chip = <div className="bonus-chip triple-word-chip">TW</div>;
                                else if (bonusTile.type === "ST" && !bonusTile.used) chip = <div className="bonus-chip silver-tile-chip">10x</div>;
                            }

                            return (
                                <div
                                    key={index}
                                    data-index={index}
                                    className={tileClasses}
                                    style={{ animationDelay: `${Math.random() * 0.5}s` }}
                                >
                                    <div className="tile-content" data-letter={letter}>
                                        {isExploding && bonusTile && bonusTile.type === "ST" && (
                                            <ConfettiExplosion onComplete={() => setIsExploding(false)} colors={['#C0C0C0', '#D3D3D3', '#E0E0E0']} />
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
                            className={`start-scrim ${isLoading || allPossibleWords.size === 0 ? "disabled" : ""}`}
                            onClick={handleStartGame}
                        >
                            <h2>{isLoading || allPossibleWords.size === 0 ? "Loading..." : "Click to Start"}</h2>
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
