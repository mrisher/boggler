const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BOARD_SIZE = 4;

// Generate a random board
function generateBoard() {
  const board = [];
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    board.push(ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length)));
  }
  return board;
}

// Render the board
function renderBoard() {
  const boardElement = document.getElementById('board');
  boardElement.innerHTML = '';
  const board = generateBoard();
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerText = board[i];
    boardElement.appendChild(tile);
  }
}

// Check if word exists on the board
function isValidBoggleWord(word) {
  const board = document.querySelectorAll('.tile');
  for (let tile of board) {
    if (checkWordFromPosition(tile, word.toUpperCase(), [])) {
      return true;
    }
  }
  return false;
}

// Helper function to check word from a specific position
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
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],         [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1]
  ];

  for (let [dx, dy] of directions) {
    const x = index % BOARD_SIZE + dx;
    const y = Math.floor(index / BOARD_SIZE) + dy;
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      const neighborIndex = y * BOARD_SIZE + x;
      neighbors.push(tile.parentNode.children[neighborIndex]);
    }
  }

  return neighbors.filter(neighbor => !visited.includes(neighbor));
}

// Add word to the list
function addWord(word) {
  const wordList = document.getElementById('word-list');
  const li = document.createElement('li');
  li.innerText = word;
  wordList.appendChild(li);
}

// Check the word on input
function checkWord() {
  const wordInput = document.getElementById('word-input');
  const word = wordInput.value.trim().toUpperCase();
  if (isValidBoggleWord(word)) {
    addWord(word);
  }
  wordInput.value = '';
}

// Initialize the board
renderBoard();
