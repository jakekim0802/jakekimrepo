/* ==========================================================================
   SUDOKU PREMIUM ENGINE & CONTROLLER (app.js)
   ========================================================================== */

// --- Web Audio API Synth for Haptic & Interactive Sound Polish ---
class SoundSynth {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('sudoku_sound') !== 'false';
    this.init();
  }

  init() {
    // AudioContext will be initialized on first user interaction to comply with browser policies
    if (this.enabled) {
      document.addEventListener('click', () => this.ensureContext(), { once: true });
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('sudoku_sound', this.enabled);
    if (this.enabled) {
      this.ensureContext();
    }
    return this.enabled;
  }

  play(type) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    switch (type) {
      case 'tap': {
        // iOS keyboard click feel
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'note': {
        // High pitch clean tone for pencil marks
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'erase': {
        // Sweep down
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.12);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case 'error': {
        // Low double-frequency buzz
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(120, now);
        osc2.frequency.setValueAtTime(123, now); // Detuned for chorus buzz
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
        break;
      }
      case 'victory': {
        // Sweet major arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.05, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.3);
        });
        break;
      }
    }
  }
}

const audio = new SoundSynth();

// ==========================================================================
// SUDOKU CORE ALGORITHM ENGINE
// ==========================================================================

const SudokuEngine = {
  // Validate placing a number in a specific position
  isValid(board, row, col, val) {
    for (let i = 0; i < 9; i++) {
      // Row check
      if (board[row][i] === val && i !== col) return false;
      // Col check
      if (board[i][col] === val && i !== row) return false;
      // 3x3 Block check
      const boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
      const boxCol = 3 * Math.floor(col / 3) + (i % 3);
      if (board[boxRow][boxCol] === val && (boxRow !== row || boxCol !== col)) return false;
    }
    return true;
  },

  // Backtracking solver
  solve(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          for (let val = 1; val <= 9; val++) {
            if (this.isValid(board, r, c, val)) {
              board[r][c] = val;
              if (this.solve(board)) return true;
              board[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  },

  // Solution counter to verify unique solution
  countSolutions(board, state) {
    if (state.count >= 2) return; // Cut short if multiple found
    
    let row = -1;
    let col = -1;
    let isEmpty = false;
    
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          row = r;
          col = c;
          isEmpty = true;
          break;
        }
      }
      if (isEmpty) break;
    }

    if (!isEmpty) {
      state.count++;
      return;
    }

    for (let val = 1; val <= 9; val++) {
      if (this.isValid(board, row, col, val)) {
        board[row][col] = val;
        this.countSolutions(board, state);
        board[row][col] = 0;
        if (state.count >= 2) return;
      }
    }
  },

  // Generates a fully solved Sudoku board with randomized backtracking
  generateSolvedBoard() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    
    function solveRandomly(b) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (b[r][c] === 0) {
            const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            for (const val of numbers) {
              if (SudokuEngine.isValid(b, r, c, val)) {
                b[r][c] = val;
                if (solveRandomly(b)) return true;
                b[r][c] = 0;
              }
            }
            return false;
          }
        }
      }
      return true;
    }
    
    solveRandomly(board);
    return board;
  },

  // Removes cells according to difficulty ensuring a unique solution
  generatePuzzle(difficulty) {
    const solution = this.generateSolvedBoard();
    // Deep clone solution to start removing cells
    const puzzle = solution.map(row => [...row]);
    
    // Target remaining clues
    let cluesTarget = 40; // Easy default
    if (difficulty === 'medium') cluesTarget = 32;
    if (difficulty === 'hard') cluesTarget = 26;
    if (difficulty === 'expert') cluesTarget = 21;

    const cells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cells.push({ r, c });
      }
    }
    // Shuffle cells to randomize deletion
    cells.sort(() => Math.random() - 0.5);

    let cluesCount = 81;
    
    for (const cell of cells) {
      if (cluesCount <= cluesTarget) break;
      
      const valBackup = puzzle[cell.r][cell.c];
      puzzle[cell.r][cell.c] = 0;
      
      // Verify uniqueness
      const state = { count: 0 };
      const tempBoard = puzzle.map(row => [...row]);
      this.countSolutions(tempBoard, state);
      
      if (state.count === 1) {
        // Solvable and unique, confirm deletion
        cluesCount--;
      } else {
        // Multi-solution or insolvable, restore cell
        puzzle[cell.r][cell.c] = valBackup;
      }
    }

    return {
      solutionBoard: solution,
      initialBoard: puzzle.map(row => [...row]),
      currentBoard: puzzle.map(row => [...row])
    };
  }
};

// ==========================================================================
// GAME STATS MANAGER
// ==========================================================================

const StatsManager = {
  getStats() {
    let stats = localStorage.getItem('sudoku_stats');
    if (!stats) {
      stats = {
        easy: { played: 0, won: 0, bestTime: null, streak: 0, maxStreak: 0 },
        medium: { played: 0, won: 0, bestTime: null, streak: 0, maxStreak: 0 },
        hard: { played: 0, won: 0, bestTime: null, streak: 0, maxStreak: 0 },
        expert: { played: 0, won: 0, bestTime: null, streak: 0, maxStreak: 0 }
      };
      localStorage.setItem('sudoku_stats', JSON.stringify(stats));
    } else {
      stats = JSON.parse(stats);
    }
    return stats;
  },

  recordPlay(difficulty) {
    const stats = this.getStats();
    stats[difficulty].played++;
    localStorage.setItem('sudoku_stats', JSON.stringify(stats));
  },

  recordWin(difficulty, seconds) {
    const stats = this.getStats();
    const diffStats = stats[difficulty];
    
    diffStats.won++;
    diffStats.streak++;
    if (diffStats.streak > diffStats.maxStreak) {
      diffStats.maxStreak = diffStats.streak;
    }

    let isNewBest = false;
    if (diffStats.bestTime === null || seconds < diffStats.bestTime) {
      diffStats.bestTime = seconds;
      isNewBest = true;
    }

    localStorage.setItem('sudoku_stats', JSON.stringify(stats));
    return { isNewBest, stats };
  },

  recordLoss(difficulty) {
    const stats = this.getStats();
    stats[difficulty].streak = 0;
    localStorage.setItem('sudoku_stats', JSON.stringify(stats));
  },

  reset() {
    localStorage.removeItem('sudoku_stats');
    return this.getStats();
  }
};

// ==========================================================================
// MAIN APP CONTROLLER
// ==========================================================================

const App = {
  // Game state
  solutionBoard: null,
  initialBoard: null,
  currentBoard: null,
  pencilMarks: {}, // keys will be 'r-c', values will be Sets
  
  selectedCell: null, // { r, c }
  mistakes: 0,
  seconds: 0,
  timerInterval: null,
  isPaused: false,
  isNotesMode: false,
  difficulty: 'easy',
  history: [], // Undo stack
  
  // DOM Elements cache
  els: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadTheme();
    this.applyThemeColors(); // Load custom board colors
    this.loadAutosave();
    this.updateSoundButtons();
  },

  cacheElements() {
    // Views
    this.els.welcomeScreen = document.getElementById('welcome-screen');
    this.els.gameScreen = document.getElementById('game-screen');
    
    // Welcome Controls
    this.els.btnResume = document.getElementById('btn-resume');
    this.els.resumeDifficulty = document.getElementById('resume-difficulty');
    this.els.resumeTime = document.getElementById('resume-time');
    this.els.btnShowStats = document.getElementById('btn-show-stats');
    this.els.btnShowHelp = document.getElementById('btn-show-help');
    this.els.btnShowSettings = document.getElementById('btn-show-settings');
    this.els.btnToggleGlobalTheme = document.getElementById('btn-toggle-global-theme');
    this.els.themeLbl = document.getElementById('theme-lbl');
    
    // Game Controls
    this.els.btnBack = document.getElementById('btn-back');
    this.els.difficultyBadge = document.getElementById('game-difficulty-badge');
    this.els.timerDigits = document.querySelector('.timer-digits');
    this.els.btnPauseTimer = document.getElementById('btn-pause-timer');
    this.els.mistakesVal = document.getElementById('mistakes-value');
    this.els.board = document.getElementById('sudoku-board');
    this.els.btnUndo = document.getElementById('btn-undo');
    this.els.btnErase = document.getElementById('btn-erase');
    this.els.btnNotes = document.getElementById('btn-notes');
    this.els.btnHint = document.getElementById('btn-hint');
    this.els.keypadGrid = document.querySelector('.keypad-grid');
    this.els.btnToggleSound = document.getElementById('btn-toggle-sound');
    this.els.btnToggleTheme = document.getElementById('btn-toggle-theme');
    this.els.btnShowGameSettings = document.getElementById('btn-show-game-settings');

    // Dialogs
    this.els.pauseDialog = document.getElementById('pause-dialog');
    this.els.gameOverDialog = document.getElementById('game-over-dialog');
    this.els.victoryDialog = document.getElementById('victory-dialog');
    this.els.statsDialog = document.getElementById('stats-dialog');
    this.els.helpDialog = document.getElementById('help-dialog');
    this.els.settingsDialog = document.getElementById('settings-dialog');
    
    // Pause Dialog elements
    this.els.pauseDiffLbl = document.getElementById('pause-diff-lbl');
    this.els.pauseTimeLbl = document.getElementById('pause-time-lbl');
    this.els.btnResumeGame = document.getElementById('btn-resume-game');
    this.els.btnQuitGame = document.getElementById('btn-quit-game');
    
    // Game Over elements
    this.els.btnRestartFailed = document.getElementById('btn-restart-failed');
    this.els.btnQuitFailed = document.getElementById('btn-quit-failed');
    
    // Victory Dialog elements
    this.els.victoryDiffLbl = document.getElementById('victory-diff-lbl');
    this.els.victoryTimeLbl = document.getElementById('victory-time-lbl');
    this.els.victoryBestContainer = document.getElementById('victory-best-container');
    this.els.btnVictoryNew = document.getElementById('btn-victory-new');
    this.els.btnVictoryQuit = document.getElementById('btn-victory-quit');
    
    // Stats Dialog elements
    this.els.btnCloseStats = document.getElementById('btn-close-stats');
    this.els.btnResetStats = document.getElementById('btn-reset-stats');
    
    // Help Dialog elements
    this.els.btnCloseHelp = document.getElementById('btn-close-help');
    this.els.btnPrevSlide = document.getElementById('btn-prev-slide');
    this.els.btnNextSlide = document.getElementById('btn-next-slide');

    // Settings Dialog elements
    this.els.btnCloseSettings = document.getElementById('btn-close-settings');
    this.els.btnResetTheme = document.getElementById('btn-reset-theme');
    this.els.pickerCellBg = document.getElementById('picker-cell-bg');
    this.els.pickerOuterBorder = document.getElementById('picker-outer-border');
    this.els.pickerInnerBorder = document.getElementById('picker-inner-border');
  },

  bindEvents() {
    // Home Events
    const diffButtons = document.querySelectorAll('.btn-difficulty');
    diffButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const diff = e.currentTarget.getAttribute('data-difficulty');
        audio.play('tap');
        this.startNewGame(diff);
      });
    });

    this.els.btnResume.addEventListener('click', () => {
      audio.play('tap');
      this.resumeAutosavedGame();
    });

    this.els.btnShowStats.addEventListener('click', () => {
      audio.play('tap');
      this.openStats();
    });

    this.els.btnShowHelp.addEventListener('click', () => {
      audio.play('tap');
      this.openHelp();
    });

    // Theme togglers
    const toggleTheme = () => {
      audio.play('tap');
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      this.setTheme(newTheme);
    };
    this.els.btnToggleGlobalTheme.addEventListener('click', toggleTheme);
    this.els.btnToggleTheme.addEventListener('click', toggleTheme);

    // Sound toggler
    this.els.btnToggleSound.addEventListener('click', () => {
      const isEnabled = audio.toggle();
      audio.play('tap');
      this.updateSoundButtons();
    });

    // Game screen Navigation
    this.els.btnBack.addEventListener('click', () => {
      audio.play('tap');
      this.saveGame();
      this.stopTimer();
      this.switchView('welcome-screen');
      this.checkActiveSavedGame();
    });

    // Timer pausing
    this.els.btnPauseTimer.addEventListener('click', () => {
      audio.play('tap');
      this.pauseGame();
    });

    // Game screen Action controls
    this.els.btnUndo.addEventListener('click', () => this.handleUndo());
    this.els.btnErase.addEventListener('click', () => this.handleErase());
    this.els.btnNotes.addEventListener('click', () => this.toggleNotesMode());
    this.els.btnHint.addEventListener('click', () => this.handleHint());

    // Dialog Buttons
    this.els.btnResumeGame.addEventListener('click', () => {
      audio.play('tap');
      this.els.pauseDialog.close();
      this.resumeGameTimer();
    });

    this.els.btnQuitGame.addEventListener('click', () => {
      audio.play('tap');
      this.els.pauseDialog.close();
      this.saveGame();
      this.switchView('welcome-screen');
      this.checkActiveSavedGame();
    });

    this.els.btnRestartFailed.addEventListener('click', () => {
      audio.play('tap');
      this.els.gameOverDialog.close();
      this.startNewGame(this.difficulty);
    });

    this.els.btnQuitFailed.addEventListener('click', () => {
      audio.play('tap');
      this.els.gameOverDialog.close();
      this.switchView('welcome-screen');
      this.checkActiveSavedGame();
    });

    this.els.btnVictoryNew.addEventListener('click', () => {
      audio.play('tap');
      this.els.victoryDialog.close();
      this.startNewGame(this.difficulty);
    });

    this.els.btnVictoryQuit.addEventListener('click', () => {
      audio.play('tap');
      this.els.victoryDialog.close();
      this.switchView('welcome-screen');
      this.checkActiveSavedGame();
    });

    // Stats Dialog
    this.els.btnCloseStats.addEventListener('click', () => {
      audio.play('tap');
      this.els.statsDialog.close();
    });

    this.els.btnResetStats.addEventListener('click', () => {
      if (confirm('모든 통계를 초기화하시겠습니까?')) {
        audio.play('erase');
        StatsManager.reset();
        this.updateStatsTab(document.querySelector('.tab-btn.active').getAttribute('data-tab'));
      }
    });

    // Stats Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        audio.play('tap');
        tabButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.updateStatsTab(e.currentTarget.getAttribute('data-tab'));
      });
    });

    // Help Dialog
    this.els.btnCloseHelp.addEventListener('click', () => {
      audio.play('tap');
      this.els.helpDialog.close();
    });

    this.els.btnPrevSlide.addEventListener('click', () => this.navigateHelpSlide(-1));
    this.els.btnNextSlide.addEventListener('click', () => this.navigateHelpSlide(1));

    // Settings Dialog events
    this.els.btnShowSettings.addEventListener('click', () => {
      audio.play('tap');
      this.openSettings();
    });

    this.els.btnShowGameSettings.addEventListener('click', () => {
      audio.play('tap');
      this.openSettings();
    });

    this.els.btnCloseSettings.addEventListener('click', () => {
      audio.play('tap');
      this.els.settingsDialog.close();
    });

    this.els.btnResetTheme.addEventListener('click', () => {
      audio.play('erase');
      this.resetThemeColors();
    });

    // Toast PWA Close button
    const btnCloseToast = document.getElementById('btn-close-toast');
    if (btnCloseToast) {
      btnCloseToast.addEventListener('click', () => {
        audio.play('tap');
        document.getElementById('ios-install-toast').classList.add('hidden');
      });
    }

    // Keyboard controls for desktop testing
    document.addEventListener('keydown', (e) => {
      if (this.els.gameScreen.classList.contains('active') && !this.isPaused) {
        if (e.key >= '1' && e.key <= '9') {
          this.handleKeypadPress(parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          this.handleErase();
        } else if (e.key === 'n' || e.key === 'N') {
          this.toggleNotesMode();
        } else if (e.key === 'u' || e.key === 'U') {
          this.handleUndo();
        }
      }
    });
  },

  // ==========================================================================
  // VIEW HANDLING & SETUP
  // ==========================================================================

  switchView(viewId) {
    const activeView = document.querySelector('.view.active');
    if (activeView) {
      activeView.classList.remove('active');
    }
    const nextView = document.getElementById(viewId);
    nextView.classList.add('active');
  },

  loadTheme() {
    const savedTheme = localStorage.getItem('sudoku_theme') || 'dark';
    this.setTheme(savedTheme);
  },

  setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('sudoku_theme', theme);
    
    if (theme === 'light') {
      this.els.themeLbl.textContent = '라이트 모드';
      this.els.btnToggleGlobalTheme.querySelector('.sun-icon').classList.add('hidden');
      this.els.btnToggleGlobalTheme.querySelector('.moon-icon').classList.remove('hidden');
    } else {
      this.els.themeLbl.textContent = '다크 모드';
      this.els.btnToggleGlobalTheme.querySelector('.sun-icon').classList.remove('hidden');
      this.els.btnToggleGlobalTheme.querySelector('.moon-icon').classList.add('hidden');
    }
  },

  updateSoundButtons() {
    if (audio.enabled) {
      this.els.btnToggleSound.querySelector('.sound-on-icon').classList.remove('hidden');
      this.els.btnToggleSound.querySelector('.sound-off-icon').classList.add('hidden');
    } else {
      this.els.btnToggleSound.querySelector('.sound-on-icon').classList.add('hidden');
      this.els.btnToggleSound.querySelector('.sound-off-icon').classList.remove('hidden');
    }
  },

  // ==========================================================================
  // GAMEPLAY ENGINE INITIATION
  // ==========================================================================

  startNewGame(difficulty) {
    this.difficulty = difficulty;
    this.switchView('game-screen');
    
    // Render an empty grid first so user gets instant screen feedback
    this.els.board.innerHTML = '';
    this.els.difficultyBadge.textContent = this.getDifficultyLabel(difficulty);
    this.els.gameScreen.setAttribute('data-difficulty', difficulty);
    
    this.mistakes = 0;
    this.seconds = 0;
    this.history = [];
    this.selectedCell = null;
    this.pencilMarks = {};
    this.isNotesMode = false;
    this.updateNotesButton();
    this.els.mistakesVal.textContent = '0';
    this.updateTimerDisplay();

    // Trigger Sudoku generation in micro-task to avoid paint lag
    setTimeout(() => {
      const puzzle = SudokuEngine.generatePuzzle(difficulty);
      this.solutionBoard = puzzle.solutionBoard;
      this.initialBoard = puzzle.initialBoard;
      this.currentBoard = puzzle.currentBoard;
      
      this.buildGridUI();
      this.buildKeypadUI();
      
      StatsManager.recordPlay(difficulty);
      this.startTimer();
      this.saveGame();
    }, 50);
  },

  buildGridUI() {
    this.els.board.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentBoard[r][c];
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        
        if (this.initialBoard[r][c] !== 0) {
          cell.classList.add('original');
          cell.innerHTML = '<span class="cell-value">' + val + '</span>';
        } else if (val !== 0) {
          cell.classList.add('user-filled');
          cell.innerHTML = '<span class="cell-value">' + val + '</span>';
        } else {
          // Empty cell: render a placeholder for notes
          const notesGrid = document.createElement('div');
          notesGrid.className = 'mini-notes';
          for (let i = 1; i <= 9; i++) {
            const mark = document.createElement('span');
            mark.setAttribute('data-note', i);
            notesGrid.appendChild(mark);
          }
          cell.appendChild(notesGrid);
        }

        cell.addEventListener('click', (e) => {
          audio.play('tap');
          this.selectCell(r, c);
        });

        this.els.board.appendChild(cell);
      }
    }
    
    // Load pencil marks if resuming
    this.renderAllPencilMarks();
  },

  buildKeypadUI() {
    this.els.keypadGrid.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
      const button = document.createElement('button');
      button.className = 'key-btn';
      button.setAttribute('data-key', i);
      
      const numSpan = document.createElement('span');
      numSpan.textContent = i;
      button.appendChild(numSpan);
      
      const countBadge = document.createElement('span');
      countBadge.className = 'key-badge';
      button.appendChild(countBadge);

      button.addEventListener('click', () => {
        this.handleKeypadPress(i);
      });

      this.els.keypadGrid.appendChild(button);
    }
    this.updateKeypadBadges();
  },

  selectCell(row, col) {
    this.selectedCell = { r: row, c: col };
    
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
      const r = parseInt(cell.getAttribute('data-row'));
      const c = parseInt(cell.getAttribute('data-col'));
      
      cell.classList.remove('highlight-select', 'highlight-match', 'highlight-group');
      
      const isSelected = (r === row && c === col);
      const isSameBlock = (Math.floor(r / 3) === Math.floor(row / 3) && Math.floor(c / 3) === Math.floor(col / 3));
      const isSameRowCol = (r === row || c === col);
      
      const selectVal = this.currentBoard[row][col];
      const cellVal = this.currentBoard[r][c];

      if (isSelected) {
        cell.classList.add('highlight-select');
      } else if (selectVal !== 0 && cellVal === selectVal) {
        // Highlight same values
        cell.classList.add('highlight-match');
      } else if (isSameRowCol || isSameBlock) {
        // Highlight active groups
        cell.classList.add('highlight-group');
      }
    });
  },

  // ==========================================================================
  // MOVES AND CONTROLS
  // ==========================================================================

  handleKeypadPress(num) {
    if (!this.selectedCell) return;
    const { r, c } = this.selectedCell;
    
    // Ignore edits on locked original clues
    if (this.initialBoard[r][c] !== 0) return;

    this.saveStateToHistory();

    if (this.isNotesMode) {
      // Notes mode: Toggle candidate mark
      audio.play('note');
      const cellKey = `${r}-${c}`;
      if (!this.pencilMarks[cellKey]) {
        this.pencilMarks[cellKey] = new Set();
      }
      
      if (this.pencilMarks[cellKey].has(num)) {
        this.pencilMarks[cellKey].delete(num);
      } else {
        // Clear any filled value first
        this.currentBoard[r][c] = 0;
        const cellEl = this.getCellElement(r, c);
        this.resetCellUI(cellEl);
        this.pencilMarks[cellKey].add(num);
      }
      this.renderPencilMarksForCell(r, c);
    } else {
      // Direct placement mode
      if (this.currentBoard[r][c] === num) return; // Already exists

      const isCorrect = (this.solutionBoard[r][c] === num);
      const cellEl = this.getCellElement(r, c);
      
      // Clear notes for this cell since we entered a value
      const cellKey = `${r}-${c}`;
      if (this.pencilMarks[cellKey]) {
        delete this.pencilMarks[cellKey];
      }

      if (isCorrect) {
        audio.play('tap');
        this.currentBoard[r][c] = num;
        cellEl.className = 'cell user-filled highlight-select';
        cellEl.innerHTML = '<span class="cell-value">' + num + '</span>';
        
        // Dynamic Polish: Automatic note clearing in same row, column, and block!
        this.autoClearPencilMarks(r, c, num);
        
        this.updateKeypadBadges();
        this.selectCell(r, c); // Rehighlight same values

        if (this.checkWinCondition()) {
          this.handleVictory();
        }
      } else {
        audio.play('error');
        this.mistakes++;
        this.els.mistakesVal.textContent = this.mistakes;
        
        // Shake cell and trigger transient red border
        cellEl.classList.add('conflict');
        setTimeout(() => cellEl.classList.remove('conflict'), 350);

        if (this.mistakes >= 3) {
          this.handleGameOver();
        }
      }
    }
    this.saveGame();
  },

  handleErase() {
    if (!this.selectedCell) return;
    const { r, c } = this.selectedCell;
    
    if (this.initialBoard[r][c] !== 0) return; // Cannot erase original

    if (this.currentBoard[r][c] === 0 && (!this.pencilMarks[`${r}-${c}`] || this.pencilMarks[`${r}-${c}`].size === 0)) return;

    this.saveStateToHistory();
    audio.play('erase');

    this.currentBoard[r][c] = 0;
    delete this.pencilMarks[`${r}-${c}`];
    
    const cellEl = this.getCellElement(r, c);
    this.resetCellUI(cellEl);
    this.selectCell(r, c);
    this.updateKeypadBadges();
    this.saveGame();
  },

  handleUndo() {
    if (this.history.length === 0) return;
    audio.play('tap');
    
    const previousState = this.history.pop();
    this.currentBoard = previousState.currentBoard.map(row => [...row]);
    
    // Reconstruct sets for pencil marks
    this.pencilMarks = {};
    for (const [key, valArray] of Object.entries(previousState.pencilMarks)) {
      this.pencilMarks[key] = new Set(valArray);
    }

    this.buildGridUI();
    this.updateKeypadBadges();
    
    if (this.selectedCell) {
      this.selectCell(this.selectedCell.r, this.selectedCell.c);
    }
    this.saveGame();
  },

  toggleNotesMode() {
    audio.play('tap');
    this.isNotesMode = !this.isNotesMode;
    this.updateNotesButton();
  },

  updateNotesButton() {
    if (this.isNotesMode) {
      this.els.btnNotes.classList.add('active');
      this.els.btnNotes.querySelector('.action-label').textContent = '메모 켜짐';
    } else {
      this.els.btnNotes.classList.remove('active');
      this.els.btnNotes.querySelector('.action-label').textContent = '메모 꺼짐';
    }
  },

  handleHint() {
    if (!this.selectedCell) return;
    const { r, c } = this.selectedCell;
    
    if (this.initialBoard[r][c] !== 0) return;
    if (this.currentBoard[r][c] === this.solutionBoard[r][c]) return; // Already solved correctly

    this.saveStateToHistory();
    audio.play('victory');

    const correctVal = this.solutionBoard[r][c];
    this.currentBoard[r][c] = correctVal;
    
    // Remove pencil marks
    delete this.pencilMarks[`${r}-${c}`];

    const cellEl = this.getCellElement(r, c);
    cellEl.className = 'cell user-filled highlight-select';
    cellEl.innerHTML = '<span class="cell-value">' + correctVal + '</span>';
    
    this.autoClearPencilMarks(r, c, correctVal);
    this.updateKeypadBadges();
    this.selectCell(r, c);

    if (this.checkWinCondition()) {
      this.handleVictory();
    }
    this.saveGame();
  },

  // Clear pencil marks from row, col and box automatically on correct placements
  autoClearPencilMarks(row, col, val) {
    // Row & Col
    for (let i = 0; i < 9; i++) {
      this.removePencilMarkValue(row, i, val);
      this.removePencilMarkValue(i, col, val);
    }
    // Block
    const boxRowStart = 3 * Math.floor(row / 3);
    const boxColStart = 3 * Math.floor(col / 3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        this.removePencilMarkValue(boxRowStart + r, boxColStart + c, val);
      }
    }
  },

  removePencilMarkValue(r, c, val) {
    const key = `${r}-${c}`;
    if (this.pencilMarks[key] && this.pencilMarks[key].has(val)) {
      this.pencilMarks[key].delete(val);
      this.renderPencilMarksForCell(r, c);
    }
  },

  // ==========================================================================
  // HELPERS & VISUAL RENDERING
  // ==========================================================================

  getCellElement(r, c) {
    return this.els.board.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
  },

  resetCellUI(cellEl) {
    cellEl.className = 'cell highlight-select';
    cellEl.innerHTML = '';
    
    const notesGrid = document.createElement('div');
    notesGrid.className = 'mini-notes';
    for (let i = 1; i <= 9; i++) {
      const mark = document.createElement('span');
      mark.setAttribute('data-note', i);
      notesGrid.appendChild(mark);
    }
    cellEl.appendChild(notesGrid);
  },

  renderPencilMarksForCell(r, c) {
    const cellEl = this.getCellElement(r, c);
    const key = `${r}-${c}`;
    const candidates = this.pencilMarks[key];
    
    if (this.currentBoard[r][c] !== 0) return; // Value is already entered

    const noteSpans = cellEl.querySelectorAll('.mini-notes span');
    noteSpans.forEach(span => {
      const noteNum = parseInt(span.getAttribute('data-note'));
      if (candidates && candidates.has(noteNum)) {
        span.textContent = noteNum;
      } else {
        span.textContent = '';
      }
    });
  },

  renderAllPencilMarks() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        this.renderPencilMarksForCell(r, c);
      }
    }
  },

  updateKeypadBadges() {
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentBoard[r][c];
        if (val >= 1 && val <= 9) {
          counts[val]++;
        }
      }
    }

    for (let i = 1; i <= 9; i++) {
      const btn = this.els.keypadGrid.querySelector(`.key-btn[data-key="${i}"]`);
      if (!btn) continue;
      
      const badge = btn.querySelector('.key-badge');
      const countRemaining = 9 - counts[i];

      if (countRemaining <= 0) {
        btn.classList.add('completed');
        badge.innerHTML = '✓';
        badge.style.color = 'var(--success)';
      } else {
        btn.classList.remove('completed');
        badge.textContent = countRemaining;
        badge.style.color = 'var(--text-muted)';
      }
    }
  },

  saveStateToHistory() {
    const currentBoardClone = this.currentBoard.map(row => [...row]);
    
    // Store pencil marks by converting Sets to Arrays for clean cloning
    const pencilMarksClone = {};
    for (const [key, valSet] of Object.entries(this.pencilMarks)) {
      if (valSet && valSet.size > 0) {
        pencilMarksClone[key] = Array.from(valSet);
      }
    }

    this.history.push({
      currentBoard: currentBoardClone,
      pencilMarks: pencilMarksClone
    });

    // Limit history stack size to 25 to conserve resources
    if (this.history.length > 25) {
      this.history.shift();
    }
  },

  checkWinCondition() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentBoard[r][c] !== this.solutionBoard[r][c]) {
          return false;
        }
      }
    }
    return true;
  },

  getDifficultyLabel(diff) {
    switch (diff) {
      case 'easy': return '쉬움';
      case 'medium': return '보통';
      case 'hard': return '어려움';
      case 'expert': return '전문가';
      default: return '쉬움';
    }
  },

  // ==========================================================================
  // GAME END HANDLERS (GAME OVER / VICTORY)
  // ==========================================================================

  handleGameOver() {
    this.stopTimer();
    audio.play('error');
    StatsManager.recordLoss(this.difficulty);
    this.clearAutosave();
    
    this.els.gameOverDialog.showModal();
  },

  handleVictory() {
    this.stopTimer();
    audio.play('victory');
    this.clearAutosave();
    
    const { isNewBest } = StatsManager.recordWin(this.difficulty, this.seconds);

    // Setup victory screen texts
    this.els.victoryDiffLbl.textContent = this.getDifficultyLabel(this.difficulty);
    this.els.victoryTimeLbl.textContent = this.formatTime(this.seconds);

    if (isNewBest) {
      this.els.victoryBestContainer.classList.remove('hidden-best');
    } else {
      this.els.victoryBestContainer.classList.add('hidden-best');
    }

    this.els.victoryDialog.showModal();
    this.startConfetti();
  },

  // ==========================================================================
  // CONFETTI CANVAS ANIMATION (NO EXTERNAL SCRIPTS)
  // ==========================================================================

  startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const colors = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * canvas.height,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0
    }));

    let animationId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();

        if (p.y > canvas.height) {
          particles[idx] = {
            x: Math.random() * canvas.width,
            y: -20,
            r: p.r,
            d: p.d,
            color: p.color,
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: p.tiltAngleIncremental,
            tiltAngle: 0
          };
        }
      });

      animationId = requestAnimationFrame(draw);
    }

    draw();

    // Kill animation loop when dialog is closed
    this.els.victoryDialog.addEventListener('close', () => {
      cancelAnimationFrame(animationId);
    }, { once: true });
  },

  // ==========================================================================
  // TIMER FUNCTIONS
  // ==========================================================================

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.seconds++;
        this.updateTimerDisplay();
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  updateTimerDisplay() {
    this.els.timerDigits.textContent = this.formatTime(this.seconds);
  },

  formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  pauseGame() {
    this.stopTimer();
    this.isPaused = true;
    
    // Setup Pause Modal texts
    this.els.pauseDiffLbl.textContent = this.getDifficultyLabel(this.difficulty);
    this.els.pauseTimeLbl.textContent = this.formatTime(this.seconds);
    
    this.els.pauseDialog.showModal();
  },

  resumeGameTimer() {
    this.isPaused = false;
    this.startTimer();
  },

  // ==========================================================================
  // STORAGE persistence (AUTOSAVE & RESUME)
  // ==========================================================================

  saveGame() {
    if (!this.currentBoard) return;
    
    // Map pencilMarks Set values into arrays for JSON conversion
    const pencilMarksObj = {};
    for (const [key, valSet] of Object.entries(this.pencilMarks)) {
      if (valSet && valSet.size > 0) {
        pencilMarksObj[key] = Array.from(valSet);
      }
    }

    const state = {
      difficulty: this.difficulty,
      currentBoard: this.currentBoard,
      initialBoard: this.initialBoard,
      solutionBoard: this.solutionBoard,
      pencilMarks: pencilMarksObj,
      mistakes: this.mistakes,
      seconds: this.seconds,
      history: this.history
    };

    localStorage.setItem('sudoku_autosave', JSON.stringify(state));
  },

  loadAutosave() {
    this.checkActiveSavedGame();
  },

  checkActiveSavedGame() {
    const autosave = localStorage.getItem('sudoku_autosave');
    if (autosave) {
      const state = JSON.parse(autosave);
      this.els.btnResume.classList.remove('hidden');
      this.els.resumeDifficulty.textContent = this.getDifficultyLabel(state.difficulty).toUpperCase();
      this.els.resumeDifficulty.className = `badge badge-${state.difficulty}`;
      this.els.resumeTime.textContent = this.formatTime(state.seconds);
    } else {
      this.els.btnResume.classList.add('hidden');
    }
  },

  resumeAutosavedGame() {
    const autosave = localStorage.getItem('sudoku_autosave');
    if (!autosave) return;

    const state = JSON.parse(autosave);
    
    this.difficulty = state.difficulty;
    this.currentBoard = state.currentBoard;
    this.initialBoard = state.initialBoard;
    this.solutionBoard = state.solutionBoard;
    this.mistakes = state.mistakes;
    this.seconds = state.seconds;
    this.history = state.history || [];
    this.isNotesMode = false;
    this.updateNotesButton();
    
    // Rebuild Set references for pencilMarks
    this.pencilMarks = {};
    for (const [key, valArray] of Object.entries(state.pencilMarks)) {
      this.pencilMarks[key] = new Set(valArray);
    }

    this.switchView('game-screen');
    this.els.difficultyBadge.textContent = this.getDifficultyLabel(this.difficulty);
    this.els.gameScreen.setAttribute('data-difficulty', this.difficulty);
    this.els.mistakesVal.textContent = this.mistakes;
    
    this.buildGridUI();
    this.buildKeypadUI();
    this.startTimer();
  },

  clearAutosave() {
    localStorage.removeItem('sudoku_autosave');
  },

  // ==========================================================================
  // STATISTICS SHEET CONTROLLING
  // ==========================================================================

  openStats() {
    this.els.statsDialog.showModal();
    // Default to easy tab
    const firstTab = document.querySelector('.stats-tabs .tab-btn');
    document.querySelectorAll('.stats-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    firstTab.classList.add('active');
    this.updateStatsTab('easy');
  },

  updateStatsTab(difficulty) {
    const stats = StatsManager.getStats();
    const ds = stats[difficulty];

    document.getElementById('stat-played').textContent = ds.played;
    document.getElementById('stat-won').textContent = ds.won;
    
    const winrate = ds.played > 0 ? Math.round((ds.won / ds.played) * 100) : 0;
    document.getElementById('stat-winrate').textContent = `${winrate}%`;
    
    document.getElementById('stat-best-time').textContent = ds.bestTime !== null ? this.formatTime(ds.bestTime) : '--:--';
    document.getElementById('stat-streak').textContent = ds.streak;
    document.getElementById('stat-max-streak').textContent = ds.maxStreak;
  },

  // ==========================================================================
  // TUTORIAL HELP DIALOG CONTROLLING
  // ==========================================================================

  openHelp() {
    this.currentHelpSlide = 1;
    this.renderHelpSlide();
    this.els.helpDialog.showModal();
  },

  navigateHelpSlide(dir) {
    audio.play('tap');
    this.currentHelpSlide += dir;
    this.renderHelpSlide();
  },

  renderHelpSlide() {
    const slides = document.querySelectorAll('.help-slide');
    const dots = document.querySelectorAll('.help-pagination .dot');
    
    slides.forEach(slide => {
      slide.classList.remove('active', 'prev-slide');
      const idx = parseInt(slide.getAttribute('data-slide'));
      if (idx === this.currentHelpSlide) {
        slide.classList.add('active');
      } else if (idx < this.currentHelpSlide) {
        slide.classList.add('prev-slide');
      }
    });

    dots.forEach(dot => {
      dot.classList.remove('active');
      if (parseInt(dot.getAttribute('data-slide')) === this.currentHelpSlide) {
        dot.classList.add('active');
      }
    });

    // Handle pagination actions states
    if (this.currentHelpSlide === 1) {
      this.els.btnPrevSlide.classList.add('disabled');
    } else {
      this.els.btnPrevSlide.classList.remove('disabled');
    }

    if (this.currentHelpSlide === 4) {
      this.els.btnNextSlide.textContent = '완료';
    } else {
      this.els.btnNextSlide.textContent = '다음';
    }
  },

  navigateHelpSlide(dir) {
    if (dir === 1 && this.currentHelpSlide === 4) {
      audio.play('tap');
      this.els.helpDialog.close();
      return;
    }
    
    audio.play('tap');
    this.currentHelpSlide += dir;
    
    // Bounds clamping
    if (this.currentHelpSlide < 1) this.currentHelpSlide = 1;
    if (this.currentHelpSlide > 4) this.currentHelpSlide = 4;
    
    this.renderHelpSlide();
  },

  // ==========================================================================
  // CUSTOM THEME SETTINGS MANAGEMENT
  // ==========================================================================

  openSettings() {
    this.renderSettingsPickers();
    this.els.settingsDialog.showModal();
  },

  renderSettingsPickers() {
    // 10 beautiful highly legible dark cell backgrounds
    const cellBgOptions = [
      { name: '기본 투명', val: 'transparent' },
      { name: '딥 인디고', val: '#1e1b4b' },
      { name: '미드나잇', val: '#0f172a' },
      { name: '딥 틸', val: '#062f4f' },
      { name: '다크 에메랄드', val: '#064e3b' },
      { name: '차콜 그레이', val: '#1f2937' },
      { name: '와인 레드', val: '#4c0519' },
      { name: '다크 퍼플', val: '#3b0764' },
      { name: '초콜릿 브라운', val: '#2d1610' },
      { name: '네이비 블랙', val: '#0a192f' }
    ];

    // 10 beautiful thick borders (outer borders)
    const outerBorderOptions = [
      { name: '기본 흰색', val: 'var(--text-primary)' },
      { name: '글로잉 인디고', val: '#818cf8' },
      { name: '스카이 블루', val: '#38bdf8' },
      { name: '에메랄드', val: '#34d399' },
      { name: '골든 옐로우', val: '#fbbf24' },
      { name: '소프트 로즈', val: '#fb7185' },
      { name: '슬레이트 실버', val: '#cbd5e1' },
      { name: '글래스 플래티넘', val: '#e2e8f0' },
      { name: '브라이트 코랄', val: '#f87171' },
      { name: '오키드 라벤더', val: '#c084fc' }
    ];

    // 10 beautiful thin inner borders
    const innerBorderOptions = [
      { name: '기본 회색', val: 'var(--border-color)' },
      { name: '글라스 화이트', val: 'rgba(255, 255, 255, 0.15)' },
      { name: '인디고 그레이', val: 'rgba(129, 140, 248, 0.15)' },
      { name: '민트 그린', val: 'rgba(52, 211, 153, 0.15)' },
      { name: '스카이 틴트', val: 'rgba(56, 189, 248, 0.15)' },
      { name: '앰버 틴트', val: 'rgba(251, 191, 36, 0.15)' },
      { name: '로즈 틴트', val: 'rgba(251, 113, 133, 0.15)' },
      { name: '다크 슬레이트', val: 'rgba(0, 0, 0, 0.35)' },
      { name: '클린 블랙', val: 'rgba(0, 0, 0, 0.55)' },
      { name: '브라이트 글래스', val: 'rgba(255, 255, 255, 0.28)' }
    ];

    const currentCellBg = localStorage.getItem('sudoku_cell_color') || 'transparent';
    const currentOuterBorder = localStorage.getItem('sudoku_outer_color') || 'var(--text-primary)';
    const currentInnerBorder = localStorage.getItem('sudoku_inner_color') || 'var(--border-color)';

    // Render pickers helper
    const buildPicker = (container, options, currentVal, storageKey, cssVar) => {
      container.innerHTML = '';
      options.forEach(opt => {
        const circle = document.createElement('div');
        circle.className = 'color-circle';
        
        // Handle visual background preview
        if (opt.val === 'transparent') {
          circle.style.background = 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px)';
          if (document.body.getAttribute('data-theme') === 'light') {
            circle.style.background = 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)';
          }
        } else if (opt.val.startsWith('var(')) {
          circle.style.backgroundColor = document.body.getAttribute('data-theme') === 'light' ? '#111827' : '#f3f4f6';
        } else {
          circle.style.backgroundColor = opt.val;
        }

        circle.setAttribute('title', opt.name);
        
        // Active visual checkmark
        if (currentVal === opt.val) {
          circle.classList.add('active');
        }

        circle.addEventListener('click', () => {
          audio.play('tap');
          localStorage.setItem(storageKey, opt.val);
          document.documentElement.style.setProperty(cssVar, opt.val);
          
          // Re-render this group to update checkmark
          buildPicker(container, options, opt.val, storageKey, cssVar);
        });

        container.appendChild(circle);
      });
    };

    buildPicker(this.els.pickerCellBg, cellBgOptions, currentCellBg, 'sudoku_cell_color', '--board-cell-color');
    buildPicker(this.els.pickerOuterBorder, outerBorderOptions, currentOuterBorder, 'sudoku_outer_color', '--board-outer-color');
    buildPicker(this.els.pickerInnerBorder, innerBorderOptions, currentInnerBorder, 'sudoku_inner_color', '--board-inner-color');
  },

  applyThemeColors() {
    const currentCellBg = localStorage.getItem('sudoku_cell_color') || 'transparent';
    const currentOuterBorder = localStorage.getItem('sudoku_outer_color') || 'var(--text-primary)';
    const currentInnerBorder = localStorage.getItem('sudoku_inner_color') || 'var(--border-color)';

    document.documentElement.style.setProperty('--board-cell-color', currentCellBg);
    document.documentElement.style.setProperty('--board-outer-color', currentOuterBorder);
    document.documentElement.style.setProperty('--board-inner-color', currentInnerBorder);
  },

  resetThemeColors() {
    localStorage.removeItem('sudoku_cell_color');
    localStorage.removeItem('sudoku_outer_color');
    localStorage.removeItem('sudoku_inner_color');
    this.applyThemeColors();
    this.els.settingsDialog.close();
  }
};

// Start application
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('Service Worker registration failed: ', err);
      });
    });
  }

  // Detect PWA running in standalone mode on iOS to hide/show installation toast
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    // Show premium Add to Home Screen popup toast after 4s delay
    setTimeout(() => {
      const toast = document.getElementById('ios-install-toast');
      if (toast) {
        toast.classList.remove('hidden');
      }
    }, 4000);
  }
});
