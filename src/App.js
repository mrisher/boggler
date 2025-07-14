import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const DICE = [
    { faces: ["A", "A", "C", "I", "O", "T"] },
    { faces: ["A", "B", "I", "L", "T", "Y"] },
    { faces: ["A", "B", "J", "M", "O", "Qu"] },
    { faces: ["A", "C", "D", "E", "M", "P"] },
    { faces: ["A", "C", "E", "L", "R", "S"] },
    { faces: ["A", "D", "E", "N", "V", "Z"] },
    { faces: ["A", "H", "M", "O", "R", "S"] },
    { faces: ["B", "I", "F", "O", "R", "X"] },
    { faces: ["D", "E", "N", "O", "S", "W"] },
    { faces: ["D", "K", "N", "O", "T", "U"] },
    { faces: ["E", "E", "F", "I", "I", "Y"] },
    { faces: ["E", "G", "K", "L", "U", "Y"] },
    { faces: ["E", "G", "I", "N", "T", "V"] },
    { faces: ["E", "H", "I", "N", "P", "S"] },
    { faces: ["E", "L", "P", "S", "T", "U"] },
    { faces: ["G", "I", "L", "R", "U", "W"] }
];
const BOARD_SIZE = 4;

// Seedable random number generator
const createRand = (seed) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const getSeed = () => {
    const params = new URLSearchParams(window.location.search);
    let seed = parseInt(params.get('seed'), 10);
    if (isNaN(seed) || seed < 1000 || seed > 9999) {
        seed = Math.floor(Math.random() * 9000) + 1000;
        window.history.replaceState(null, '', `?seed=${seed}`);
    }
    return seed;
};

const getTime = () => {
    const params = new URLSearchParams(window.location.search);
    let time = parseInt(params.get('time'), 10);
    if (isNaN(time) || time <= 0) {
        return 120;
    }
    return time;
};


const App = () => {
    const [seed, setSeed] = useState(getSeed());
    const [board, setBoard] = useState([]);
    const [wordSet, setWordSet] = useState(new Set());
    const [foundWords, setFoundWords] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [timeLeft, setTimeLeft] = useState(getTime());
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [allPossibleWords, setAllPossibleWords] = useState(new Set());
    const [activeTab, setActiveTab] = useState('found');
    const [selection, setSelection] = useState([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [lastFoundWord, setLastFoundWord] = useState(null);
    const [showAllWordsModal, setShowAllWordsModal] = useState(false);
    const [modalActiveTab, setModalActiveTab] = useState('found');
    const [doubleWordIndex, setDoubleWordIndex] = useState(-1);
    const [doubleLetterIndex, setDoubleLetterIndex] = useState(-1);
    const [isCalculating, setIsCalculating] = useState(false);
    const inputRef = useRef(null);
    const wordListRef = useRef(null);

    const generateBoard = useCallback(() => {
        const rand = createRand(seed);
        const shuffledDice = [...DICE];
        for (let i = shuffledDice.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffledDice[i], shuffledDice[j]] = [shuffledDice[j], shuffledDice[i]];
        }
        const selectedLetters = shuffledDice.map(die => die.faces[Math.floor(rand() * 6)]);
        setBoard(selectedLetters);

        let dw = -1, dl = -1;
        while (dw === dl) {
            dw = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
            dl = Math.floor(rand() * (BOARD_SIZE * BOARD_SIZE));
        }
        setDoubleWordIndex(dw);
        setDoubleLetterIndex(dl);
    }, [seed]);

    useEffect(() => {
        generateBoard();
    }, [generateBoard]);

    useEffect(() => {
        fetch('/words.txt')
            .then(response => response.text())
            .then(text => {
                const words = new Set(text.split('\n').map(word => word.trim().toUpperCase()));
                setWordSet(words);
            });
    }, []);

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
            findWords([i], '');
        }
        setAllPossibleWords(found);
        setIsCalculating(false);
    }, [board, wordSet]);


    useEffect(() => {
        if (gameStarted && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && gameStarted) {
            setGameOver(true);
        }
    }, [timeLeft, gameStarted]);

    useEffect(() => {
        if (gameOver) {
            setIsCalculating(true);
            setTimeout(() => {
                findAllPossibleWords();
            }, 10);
        }
    }, [gameOver, findAllPossibleWords]);

    useEffect(() => {
        if (gameStarted) {
            inputRef.current.focus();
        }
    }, [gameStarted]);

    useEffect(() => {
        if (wordListRef.current) {
            if (activeTab === 'found') {
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
        setGameStarted(true);
    };

    const handleNewGame = () => {
        const newSeed = Math.floor(Math.random() * 9000) + 1000;
        window.location.search = `seed=${newSeed}`;
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
        if (path && path.includes(doubleLetterIndex)) {
            points += 1;
        }
        if (path && path.includes(doubleWordIndex)) {
            points *= 2;
        }
        return points;
    };

    const checkWord = (word) => {
        const upperCaseWord = word.toUpperCase();
        if (
            upperCaseWord.length >= 3 &&
            !foundWords.some(item => item.word === upperCaseWord) &&
            wordSet.has(upperCaseWord)
        ) {
            const path = isValidBoggleWord(upperCaseWord);
            if (path) {
                const points = calculatePoints(upperCaseWord, path);
                setFoundWords(prev => [...prev, { word: upperCaseWord, points }]);
                setLastFoundWord({ word: upperCaseWord, points });
            }
        }
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            checkWord(inputValue);
            setInputValue('');
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

        const word = selection.map(index => board[index]).join('');
        checkWord(word);

        setIsSelecting(false);
        setSelection([]);
    };

    const handleTouchStart = (e) => {
        const target = e.target;
        if (target.classList.contains('tile-content')) {
            const parentTile = target.closest('.tile');
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
        if (element && element.classList.contains('tile-content')) {
            const parentTile = element.closest('.tile');
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
            navigator.share({
                title: 'Nomoggle Score',
                text: text,
            })
            .catch(error => console.log('Error sharing', error));
        }
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const formatPoints = (points) => {
        if (points > 1) {
            return `(${points})`;
        }
        return '';
    };

    const foundWordsSet = new Set(foundWords.map(item => item.word));
    const sortedAllWords = [...allPossibleWords.keys()].sort((a, b) => {
        const pathA = allPossibleWords.get(a);
        const pathB = allPossibleWords.get(b);
        return calculatePoints(b, pathB) - calculatePoints(a, pathA);
    });
    const totalScore = foundWords.reduce((sum, { points }) => sum + points, 0);

    return (
        <div className="App" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="game-area">
                <h1>Nomoggle #{seed}</h1>
                <h2 className="timer">{formatTime(timeLeft)}</h2>
                {lastFoundWord && <div className="word-toast">{lastFoundWord.word} {formatPoints(lastFoundWord.points)}</div>}
                <div
                    className="board-container"
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div className={`board ${!gameStarted ? 'blurred' : ''}`}>
                        {board.map((letter, index) => {
                            const isDoubleWord = index === doubleWordIndex;
                            const isDoubleLetter = index === doubleLetterIndex;
                            const tileClasses = `tile ${selection.includes(index) ? 'selected' : ''} ${isDoubleWord ? 'double-word' : ''} ${isDoubleLetter ? 'double-letter' : ''}`;
                            return (
                                <div
                                    key={index}
                                    data-index={index}
                                    className={tileClasses}
                                    onMouseDown={() => handleMouseDown(index)}
                                    onMouseEnter={() => handleMouseEnter(index)}
                                    onTouchStart={handleTouchStart}
                                >
                                    <div className="tile-content">{letter}</div>
                                </div>
                            );
                        })}
                    </div>
                    {!gameStarted && (
                        <div className="start-scrim" onClick={handleStartGame}>
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
                    placeholder={!gameStarted ? "Click start to play" : (gameOver ? "Game Over" : "Enter word...")}
                />
                <div className="mobile-button-container">
                    {gameOver && (
                        <>
                            {isCalculating ? (
                                <div className="spinner-container">
                                    <div className="spinner"></div>
                                </div>
                            ) : (
                                <button className="view-words-button" onClick={() => setShowAllWordsModal(true)}>
                                    All Words ({allPossibleWords.size})
                                </button>
                            )}
                            <button className="share-button" onClick={handleShare}>Share Score</button>
                        </>
                    )}
                    <button className="new-game-button" onClick={handleNewGame}>New Game</button>
                </div>
            </div>
            <div className="sidebar">
                <div className="tab-container">
                    <button className={`tab ${activeTab === 'found' ? 'active' : ''}`} onClick={() => handleTabClick('found')}>
                        Found Words ({foundWords.length})
                    </button>
                    <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => handleTabClick('all')} disabled={!gameOver}>
                        All Words ({allPossibleWords.size})
                    </button>
                </div>
                <div className="word-list-container" ref={wordListRef}>
                    <ul className="word-list">
                        {activeTab === 'found' && foundWords.map(({ word, points }) => (
                            <li key={word}>{word} {formatPoints(points)}</li>
                        ))}
                        {activeTab === 'all' && sortedAllWords.map(word => (
                            <li key={word} className={foundWordsSet.has(word) ? 'found-in-all' : 'missed'}>
                                {word} {formatPoints(calculatePoints(word, allPossibleWords.get(word)))}
                            </li>
                        ))}
                    </ul>
                </div>
                {activeTab === 'found' && !gameOver && (
                    <button className="share-button" onClick={handleShare}>Share Score</button>
                )}
            </div>
            {showAllWordsModal && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modalActiveTab === 'found' ? `You found ${foundWords.length} words` : `All Words (${allPossibleWords.size})`}</h2>
                            <button className="close-button" onClick={() => setShowAllWordsModal(false)}>&times;</button>
                        </div>
                        <div className="tab-container">
                            <button className={`tab ${modalActiveTab === 'found' ? 'active' : ''}`} onClick={() => setModalActiveTab('found')}>
                                Found Words ({foundWords.length})
                            </button>
                            <button className={`tab ${modalActiveTab === 'all' ? 'active' : ''}`} onClick={() => setModalActiveTab('all')}>
                                All Words ({allPossibleWords.size})
                            </button>
                        </div>
                        {modalActiveTab === 'found' && (
                            <div className="total-score">
                                Total Score: {totalScore}
                            </div>
                        )}
                        <div className="word-list-container">
                            <ul className="word-list">
                                {modalActiveTab === 'found' && foundWords.map(({ word, points }) => (
                                    <li key={word}>{word} {formatPoints(points)}</li>
                                ))}
                                {modalActiveTab === 'all' && sortedAllWords.map(word => (
                                    <li key={word} className={foundWordsSet.has(word) ? 'found-in-all' : 'missed'}>
                                        {word} {formatPoints(calculatePoints(word, allPossibleWords.get(word)))}
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

