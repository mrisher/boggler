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
    { faces: ["E", "E", "F", "H", "I", "Y"] },
    { faces: ["E", "G", "K", "L", "U", "Y"] },
    { faces: ["E", "G", "I", "N", "T", "V"] },
    { faces: ["E", "H", "I", "N", "P", "S"] },
    { faces: ["E", "L", "P", "S", "T", "U"] },
    { faces: ["G", "I", "L", "R", "U", "W"] },
];

const BOARD_SIZE = 4;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function generateBoard() {
    const board = [];
    let selectedLetters = [];

    // Pick one letter from each die
    for (let die of DICE) {
        const randomFaceIndex = Math.floor(Math.random() * 6);
        selectedLetters.push(die.faces[randomFaceIndex]);
    }

    // Shuffle the selected letters
    shuffleArray(selectedLetters);

    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        board.push(selectedLetters[i]);
    }

    return board;
}

document.getElementById("wordListFileInput").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const wordListContent = e.target.result;
            loadWordList(wordListContent);
        };
        reader.readAsText(file);
    }
});

function renderBoard() {
    const boardElement = document.getElementById("board");
    boardElement.innerHTML = "";
    const board = generateBoard();
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.innerText = board[i];
        boardElement.appendChild(tile);
    }
}

function startTimer(duration, display) {
    let time = duration;
    timerInterval = setInterval(() => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        display.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
        if (time === 0) {
            clearInterval(timerInterval);
            document.getElementById("word-input").disabled = true;
        }
        time--;
    }, 1000);
}

function loadWordList(wordListContent) {
    const wordList = new Set(
        wordListContent.split("\n").map((word) => word.trim().toUpperCase())
    );
    window.wordSet = wordList; // Store the set globally
}

function isValidBoggleWord(word) {
    const board = document.querySelectorAll(".tile");
    for (let tile of board) {
        if (checkWordFromPosition(tile, word.toUpperCase(), [])) {
            return window.wordSet.has(word.toUpperCase());
        }
    }
    return false;
}

function checkWordFromPosition(tile, word, visited) {
    if (tile.innerText !== word[0]) return false;
    if (word.length === 1) return true;

    visited.push(tile);

    const neighbors = getNeighbors(tile, visited);
    for (let neighbor of neighbors) {
        if (checkWordFromPosition(neighbor, word.slice(1), visited)) {
            return true;
        }
    }

    visited.pop();
    return false;
}

// Get neighboring tiles
function getNeighbors(tile, visited) {
    const index = Array.prototype.indexOf.call(tile.parentNode.children, tile);
    const neighbors = [];
    const directions = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
    ];

    for (let [dx, dy] of directions) {
        const x = (index % BOARD_SIZE) + dx;
        const y = Math.floor(index / BOARD_SIZE) + dy;
        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            const neighborIndex = y * BOARD_SIZE + x;
            neighbors.push(tile.parentNode.children[neighborIndex]);
        }
    }

    return neighbors.filter((neighbor) => !visited.includes(neighbor));
}

function addWord(word) {
    const wordList = document.getElementById("word-list");
    const li = document.createElement("li");
    li.innerText = word;
    wordList.appendChild(li);
}

function checkWord() {
    const wordInput = document.getElementById("word-input");
    const word = wordInput.value.trim().toUpperCase();
    if (isValidBoggleWord(word)) {
        addWord(word);
    }
    wordInput.value = "";
}

document.getElementById("word-input").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
        checkWord();
    }
});

document.getElementById("word-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        checkWord();
        e.preventDefault(); // Prevents the form from submitting
    }
});

// Initialize the board and start the timer
renderBoard();
startTimer(120, document.getElementById("timer"));
