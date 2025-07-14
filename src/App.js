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


const App = () => {
    const [seed, setSeed] = useState(getSeed());
    const [board, setBoard] = useState([]);
    const [wordSet, setWordSet] = useState(new Set());
    const [foundWords, setFoundWords] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [timeLeft, setTimeLeft] = useState(120);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [allPossibleWords, setAllPossibleWords] = useState(new Set());
    const [activeTab, setActiveTab] = useState('found');
    const [selection, setSelection] = useState([]);
    const [isSelecting, setIsSelecting] = useState(false);
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
        const found = new Set();
        if (board.length === 0 || wordSet.size === 0) return;

        const findWords = (path, currentWord) => {
            const lastIndex = path[path.length - 1];
            const letter = board[lastIndex].toUpperCase();
            currentWord += letter;

            if (currentWord.length >= 3 && wordSet.has(currentWord)) {
                found.add(currentWord);
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
    }, [board, wordSet]);


    useEffect(() => {
        if (gameStarted && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && gameStarted) {
            setGameOver(true);
            findAllPossibleWords();
        }
    }, [timeLeft, gameStarted, findAllPossibleWords]);

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

    const handleStartGame = () => {
        setGameStarted(true);
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
                return false;
            }
            if (currentWord.length === tileLetter.length) {
                return true;
            }

            const remainingWord = currentWord.substring(tileLetter.length);
            visited.add(index);

            const neighbors = getNeighbors(index);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (search(remainingWord, neighbor, new Set(visited))) {
                        return true;
                    }
                }
            }
            return false;
        };

        for (let i = 0; i < board.length; i++) {
            if (search(word, i, new Set())) {
                return true;
            }
        }
        return false;
    };

    const calculatePoints = (word) => {
        if (word.length <= 2) return 0;
        if (word.length <= 4) return 1;
        return word.length - 3;
    };

    const checkWord = (word) => {
        const upperCaseWord = word.toUpperCase();
        if (
            upperCaseWord.length >= 3 &&
            !foundWords.some(item => item.word === upperCaseWord) &&
            wordSet.has(upperCaseWord) &&
            isValidBoggleWord(upperCaseWord)
        ) {
             const points = calculatePoints(upperCaseWord);
             setFoundWords(prev => [...prev, { word: upperCaseWord, points }]);
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
        const index = parseInt(e.currentTarget.dataset.index, 10);
        handleMouseDown(index);
    };

    const handleTouchMove = (e) => {
        if (!isSelecting) return;
        e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.classList.contains('tile')) {
            const index = parseInt(element.dataset.index, 10);
            if (selection.length > 0 && index !== selection[selection.length - 1]) {
                handleMouseEnter(index);
            }
        }
    };

    const handleTouchEnd = (e) => {
        if (!isSelecting) return;
        e.preventDefault();
        handleMouseUp();
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
    const sortedAllWords = [...allPossibleWords].sort((a, b) => calculatePoints(b) - calculatePoints(a));

    return (
        <div className="App" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="game-area">
                <h1>Noggle #{seed}</h1>
                <div
                    className="board-container"
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div className={`board ${!gameStarted ? 'blurred' : ''}`}>
                        {board.map((letter, index) => (
                            <div
                                key={index}
                                data-index={index}
                                className={`tile ${selection.includes(index) ? 'selected' : ''}`}
                                onMouseDown={() => handleMouseDown(index)}
                                onMouseEnter={() => handleMouseEnter(index)}
                                onTouchStart={handleTouchStart}
                            >
                                {letter}
                            </div>
                        ))}
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
            </div>
            <div className="sidebar">
                <div className="timer">{formatTime(timeLeft)}</div>
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
                                {word} {formatPoints(calculatePoints(word))}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default App;

