// Tic Tac Toe Game Logic
(function() {
    'use strict';

    // Game state
    let currentPlayer = 'X';
    let board = ['', '', '', '', '', '', '', '', ''];
    let gameActive = true;
    let scores = { X: 0, O: 0, draw: 0 };

    // Winning combinations
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    // DOM elements
    let cells;
    let statusText;
    let currentPlayerText;
    let resetBtn;
    let scoreX;
    let scoreO;
    let scoreDraw;

    // Initialize
    function init() {
        cells = document.querySelectorAll('.game-cell');
        statusText = document.getElementById('game-status');
        currentPlayerText = document.getElementById('current-player');
        resetBtn = document.getElementById('reset-btn');
        scoreX = document.getElementById('score-x');
        scoreO = document.getElementById('score-o');
        scoreDraw = document.getElementById('score-draw');

        loadScores();
        setupEventListeners();
    }

    // Load scores from localStorage
    function loadScores() {
        try {
            const saved = localStorage.getItem('tictactoe_scores');
            if (saved) {
                scores = JSON.parse(saved);
                updateScoreDisplay();
            }
        } catch (e) {
            console.error('Error loading scores:', e);
        }
    }

    // Save scores to localStorage
    function saveScores() {
        try {
            localStorage.setItem('tictactoe_scores', JSON.stringify(scores));
        } catch (e) {
            console.error('Error saving scores:', e);
        }
    }

    // Update score display
    function updateScoreDisplay() {
        if (scoreX) scoreX.textContent = scores.X;
        if (scoreO) scoreO.textContent = scores.O;
        if (scoreDraw) scoreDraw.textContent = scores.draw;
    }

    // Setup event listeners
    function setupEventListeners() {
        cells.forEach(function(cell) {
            cell.addEventListener('click', handleCellClick);
        });

        if (resetBtn) {
            resetBtn.addEventListener('click', resetGame);
        }
    }

    // Handle cell click
    function handleCellClick(e) {
        const cell = e.target;
        const index = parseInt(cell.getAttribute('data-index'));

        if (board[index] !== '' || !gameActive) return;

        board[index] = currentPlayer;
        cell.textContent = currentPlayer;
        cell.classList.add('taken', currentPlayer.toLowerCase());

        if (checkWin()) {
            gameActive = false;
            statusText.textContent = '🎉 ' + currentPlayer + ' thắng!';
            statusText.className = currentPlayer === 'X' ? 'text-blue-600 font-bold' : 'text-red-500 font-bold';
            scores[currentPlayer]++;
            saveScores();
            updateScoreDisplay();
            highlightWinningCells();
        } else if (board.every(function(cell) { return cell !== ''; })) {
            gameActive = false;
            statusText.textContent = '🤝 Hòa!';
            statusText.className = 'text-slate-600 font-bold';
            scores.draw++;
            saveScores();
            updateScoreDisplay();
        } else {
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            currentPlayerText.textContent = currentPlayer;
            statusText.textContent = 'Đang chơi';
        }
    }

    // Check for win
    function checkWin() {
        return winningCombinations.some(function(combination) {
            const a = combination[0];
            const b = combination[1];
            const c = combination[2];
            return board[a] !== '' && 
                   board[a] === board[b] && 
                   board[a] === board[c];
        });
    }

    // Highlight winning cells
    function highlightWinningCells() {
        winningCombinations.forEach(function(combination) {
            const a = combination[0];
            const b = combination[1];
            const c = combination[2];
            if (board[a] !== '' && board[a] === board[b] && board[a] === board[c]) {
                cells[a].classList.add('winner-line');
                cells[b].classList.add('winner-line');
                cells[c].classList.add('winner-line');
            }
        });
    }

    // Reset game
    function resetGame() {
        board = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        currentPlayer = 'X';
        currentPlayerText.textContent = 'X';
        statusText.textContent = 'Đang chơi';
        statusText.className = '';

        cells.forEach(function(cell) {
            cell.textContent = '';
            cell.className = 'game-cell';
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
