import React, { useState, useEffect, useRef } from 'react';
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

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const generateBoard = () => {
    let selectedLetters = DICE.map(die => die.faces[Math.floor(Math.random() * 6)]);
    return shuffleArray(selectedLetters);
};

const App = () => {
    const [board, setBoard] = useState(generateBoard());
    const [wordSet, setWordSet] = useState(new Set());
    const [foundWords, setFoundWords] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [timeLeft, setTimeLeft] = useState(120);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [allPossibleWords, setAllPossibleWords] = useState(new Set());
    const [activeTab, setActiveTab] = useState('found');
    const inputRef = useRef(null);
    const wordListRef = useRef(null);

    useEffect(() => {
        fetch('/words.txt')
            .then(response => response.text())
            .then(text => {
                const words = new Set(text.split('\n').map(word => word.trim().toUpperCase()));
                setWordSet(words);
            });
    }, []);

    useEffect(() => {
        if (gameStarted && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && gameStarted) {
            setGameOver(true);
            findAllPossibleWords();
        }
    }, [timeLeft, gameStarted]);

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

    const findWords = (path, currentWord, found) => {
        const lastIndex = path[path.length - 1];
        const letter = board[lastIndex].toUpperCase();
        currentWord += letter;

        if (currentWord.length >= 3 && wordSet.has(currentWord)) {
            found.add(currentWord);
        }

        const neighbors = getNeighbors(lastIndex);
        for (const neighbor of neighbors) {
            if (!path.includes(neighbor)) {
                findWords([...path, neighbor], currentWord, found);
            }
        }
    };

    const findAllPossibleWords = () => {
        const found = new Set();
        for (let i = 0; i < board.length; i++) {
            findWords([i], '', found);
        }
        setAllPossibleWords(found);
    };

    const isValidBoggleWord = (word) => {
        const search = (word, index, visited) => {
            const tileLetter = board[index].toUpperCase();
            if (!word.startsWith(tileLetter)) {
                return false;
            }
            if (word.length === tileLetter.length) {
                return true;
            }

            const remainingWord = word.substring(tileLetter.length);
            visited.add(index);

            const neighbors = getNeighbors(index);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (search(remainingWord, neighbor, visited)) {
                        visited.delete(index);
                        return true;
                    }
                }
            }

            visited.delete(index);
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
        <div className="App">
            <div className="game-area">
                <h1>Boggle</h1>
                <div className="board-container">
                    <div className={`board ${!gameStarted ? 'blurred' : ''}`}>
                        {board.map((letter, index) => (
                            <div key={index} className="tile">{letter}</div>
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
