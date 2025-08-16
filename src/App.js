import React, { useState, useEffect, useRef } from "react";
// import { createBrowserInspector } from "@statelyai/inspect";
import { useMachine } from "@xstate/react";
import ConfettiExplosion from "react-confetti-explosion";
import "./App.css";
import { gameMachine } from "./gameMachine";
import { BOARD_SIZE } from "./utils";
import { calculatePoints } from "./wordLogic";

// const inspector = createBrowserInspector();

const App = () => {
    const [state, send] = useMachine(gameMachine);

    const {
        seed,
        date,
        board,
        foundWords,
        timeLeft,
        allPossibleWords,
        bonusTiles,
        harlequin,
        isDebug,
        lastFoundWord,
    } = state.context;

    const gameStarted = state.matches("playing");
    const gameOver = state.matches("gameOver");
    const isLoading = state.matches("loading");
    const isError = state.matches("loadingError");

    // --- UI STATE MANAGEMENT ---
    const [inputValue, setInputValue] = useState("");
    const [activeTab, setActiveTab] = useState("found");
    const [selection, setSelection] = useState([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [showAllWordsModal, setShowAllWordsModal] = useState(false);
    const [modalActiveTab, setModalActiveTab] = useState("found");
    const [isExploding, setIsExploding] = useState(false);
    const [toastWord, setToastWord] = useState(null);

    // --- REFS ---
    const inputRef = useRef(null);
    const wordListRef = useRef(null);

    // --- GAME LIFECYCLE ---

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
                wordListRef.current.scrollTop =
                    wordListRef.current.scrollHeight;
            } else {
                wordListRef.current.scrollTop = 0;
            }
        }
    }, [foundWords, activeTab]);

    // Show a toast message for the last found word.
    useEffect(() => {
        if (lastFoundWord) {
            setToastWord(lastFoundWord);
            const timer = setTimeout(() => {
                setToastWord(null);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [lastFoundWord]);

    const handleStartGame = () => {
        send({ type: "START_GAME" });
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    const checkWord = (word) => {
        send({ type: "CHECK_WORD", word });
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
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.classList.contains("drag-target")) {
            const parentTile = element.closest(".tile");
            if (parentTile) {
                const index = parseInt(parentTile.dataset.index, 10);
                if (
                    selection.length > 0 &&
                    index !== selection[selection.length - 1]
                ) {
                    handleMouseEnter(index);
                }
            }
        }
    };

    const handleTouchEnd = (e) => {
        if (!isSelecting) return;
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
        return (
            calculatePoints(b, pathB, bonusTiles, harlequin) -
            calculatePoints(a, pathA, bonusTiles, harlequin)
        );
    });
    const totalScore = foundWords.reduce((sum, { points }) => sum + points, 0);

    // Determine the current bonus message to display.
    let bonusMessage = "";
    if (state.matches("playing")) {
        const activeTimedTile = bonusTiles.find(
            (t) => t.type === "TW" || (t.type === "ST" && !t.used)
        );
        if (harlequin.isActive) {
            bonusMessage = `Lengthy Challenge: Find a word connecting the two tiles! (${harlequin.timer}s)`;
        } else if (activeTimedTile) {
            if (activeTimedTile.type === "TW") {
                bonusMessage = `Triple Word Score Active (${activeTimedTile.timer}s)`;
            } else if (activeTimedTile.type === "ST") {
                bonusMessage = `10x Silver Tile Active (${activeTimedTile.timer}s)`;
            }
        }
    }

    return (
        <div
            className="App"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {isLoading && (
                <div className="scrim">
                    <h2>Loading...</h2>
                </div>
            )}
            {isError && (
                <div className="scrim">
                    <h2>Error loading words</h2>
                </div>
            )}

            {!isLoading && !isError && (
                <>
                    <div className="game-area">
                        <h1>Nomoggle - {date ? date : `#${seed}`}</h1>
                        <div className="bonus-message">{bonusMessage}</div>
                        <div className="game-stats">
                            <h2
                                className={`timer ${
                                    timeLeft <= 10 ? "urgent" : ""
                                }`}
                            >
                                {formatTime(timeLeft)}
                            </h2>
                            <h2 className="score">Score: {totalScore}</h2>
                        </div>
                        {toastWord && (
                            <div className="word-toast">
                                {toastWord.word}{" "}
                                {formatPoints(toastWord.points)}
                            </div>
                        )}
                        <div
                            className="board-container"
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <div
                                className={`board ${
                                    state.matches("ready") ? "blurred" : ""
                                }`}
                            >
                                {board.map((letter, index) => {
                                    const bonusTile = bonusTiles?.find(
                                        (t) => t.index === index
                                    );
                                    const harlequinTile =
                                        harlequin?.positions.find(
                                            (p) => p.index === index
                                        );
                                    const isHarlequin = !!harlequinTile;

                                    const classes = ["tile"];
                                    if (state.matches("ready")) {
                                        classes.push("shaking");
                                    }
                                    if (selection.includes(index)) {
                                        classes.push("selected");
                                    }

                                    if (isHarlequin) {
                                        classes.push(
                                            "harlequin-tile"
                                        );
                                        if (harlequin.isActive) {
                                            classes.push("lit");
                                        }
                                    } else if (bonusTile) {
                                        if (
                                            !(
                                                bonusTile.type === "ST" &&
                                                bonusTile.used
                                            )
                                        ) {
                                            classes.push(
                                                `${bonusTile.type.toLowerCase()}-tile`
                                            );
                                        }
                                    }

                                    const tileClasses = classes.join(" ");

                                    if (isDebug && isHarlequin) {
                                        console.log(
                                            `[Render] Tile ${index} (Harlequin): type=${harlequinTile.type}, active=${harlequin.isActive}, classes="${tileClasses}"`
                                        );
                                    }

                                    let chip = null;
                                    if (bonusTile && !isHarlequin) {
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
                                        else if (
                                            bonusTile.type === "ST" &&
                                            !bonusTile.used
                                        )
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
                                            style={{
                                                animationDelay: `${
                                                    Math.random() * 0.5
                                                }s`,
                                            }}
                                        >
                                            <div
                                                className="tile-content"
                                                data-letter={letter}
                                            >
                                                {isExploding &&
                                                    bonusTile &&
                                                    bonusTile.type === "ST" && (
                                                        <ConfettiExplosion
                                                            onComplete={() =>
                                                                setIsExploding(
                                                                    false
                                                                )
                                                            }
                                                            colors={[
                                                                "#C0C0C0",
                                                                "#D3D3D3",
                                                                "#E0E0E0",
                                                            ]}
                                                        />
                                                    )}
                                                {chip}
                                                {isHarlequin ? (
                                                    <>
                                                        <div className="harlequin-letter">
                                                            {letter}
                                                        </div>
                                                        <div className="harlequin-arrow">
                                                            {harlequinTile.type ===
                                                            "harlequin-1"
                                                                ? "→"
                                                                : "←"}
                                                        </div>
                                                    </>
                                                ) : (
                                                    letter
                                                )}
                                                <div
                                                    className="drag-target"
                                                    onMouseDown={() =>
                                                        handleMouseDown(index)
                                                    }
                                                    onMouseEnter={() =>
                                                        handleMouseEnter(index)
                                                    }
                                                    onTouchStart={
                                                        handleTouchStart
                                                    }
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {state.matches("ready") && (
                                <div
                                    className="start-scrim"
                                    onClick={handleStartGame}
                                >
                                    <h2>Click to Start</h2>
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
                                        onClick={() =>
                                            setShowAllWordsModal(true)
                                        }
                                    >
                                        All Words ({allPossibleWords.size})
                                    </button>
                                    <button
                                        className="share-button"
                                        onClick={handleShare}
                                    >
                                        Share Score
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="sidebar">
                        <div className="tab-container">
                            <button
                                className={`tab ${
                                    activeTab === "found" ? "active" : ""
                                }`}
                                onClick={() => handleTabClick("found")}
                            >
                                Found Words ({foundWords.length})
                            </button>
                            <button
                                className={`tab ${
                                    activeTab === "all" ? "active" : ""
                                }`}
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
                                                calculatePoints(
                                                    word,
                                                    allPossibleWords.get(word),
                                                    bonusTiles,
                                                    harlequin
                                                )
                                            )}
                                        </li>
                                    ))}
                            </ul>
                        </div>
                        {activeTab === "found" && !gameOver && (
                            <button
                                className="share-button"
                                onClick={handleShare}
                            >
                                Share Score
                            </button>
                        )}
                    </div>
                </>
            )}
            {showAllWordsModal && (
                <div className="modal-overlay">
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                    >
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
                            <div className="total-score">
                                Total Score: {totalScore}
                            </div>
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
                                                    allPossibleWords.get(word),
                                                    bonusTiles,
                                                    harlequin
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
