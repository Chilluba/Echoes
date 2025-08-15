class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    // Tweakable Game Parameters
    // ========================================================================
    config = {
        // Starting balance for the player
        startingBalance: 1000,
        // Minimum and maximum bet amounts
        minBet: 10,
        maxBet: 500,
        // The duration of the countdown before a round starts (in seconds)
        countdownSeconds: 5,
        // The maximum duration of a single game round (in milliseconds)
        roundTimeLimit: 30000,
        // The chance (0 to 1) of momentum reversing during each check
        reversalProbability: 0.1,
        // How often to check for a momentum reversal (in milliseconds)
        reversalCheckInterval: 500,
        // The range for the multiplier's rate of increase per second
        multiplierRiseRate: { min: 0.5, max: 2.5 },
        // The range for the multiplier's rate of decrease per second
        multiplierFallRate: { min: 1.0, max: 3.0 },
        // How many historical points to show on the graph
        graphMaxPoints: 150,
    };
    // ========================================================================

    // Game State & Variables
    gameState = 'WAITING_FOR_BET'; // WAITING_FOR_BET, COUNTDOWN, IN_PROGRESS, ROUND_OVER
    playerBalance = this.config.startingBalance;
    currentBet = 0;

    multiplier = 1.00;
    momentum = 'upward'; // 'upward' or 'downward'
    cashedOut = false;
    cashoutMultiplier = 0;

    // Timers & History
    roundTimer = null;
    reversalTimer = null;
    countdownTimer = null;
    countdownValue = this.config.countdownSeconds;
    multiplierHistory = [];
    roundHistory = [];

    // UI Elements
    ui = {};

    // Sound
    audioContext = null;
    backgroundHum = null;

    init() {
        // Initialize or reset variables before the scene starts
        this.playerBalance = this.config.startingBalance;
        this.gameState = 'WAITING_FOR_BET';
        this.multiplierHistory = [];
        this.currentBet = 0;
        this.cashedOut = false;
    }

    create() {
        this.setupUI();
        this.setupAudio();
        this.setupInput();
        this.setupTutorial();
        this.setupVisuals();

        this.graph = this.add.graphics();
        this.updateUI();
        this.updateHistoryDisplay();
    }

    setupUI() {
        this.ui.balanceText = document.getElementById('balance');
        this.ui.winningsText = document.getElementById('winnings');
        this.ui.multiplierText = document.getElementById('multiplier-value');
        this.ui.momentumIndicator = document.getElementById('momentum-indicator');
        this.ui.countdownText = document.getElementById('countdown-timer');
        this.ui.betAmountInput = document.getElementById('bet-amount');
        this.ui.actionButton = document.getElementById('action-button');
        this.ui.tutorialModal = document.getElementById('tutorial-modal');
        this.ui.closeTutorialButton = document.getElementById('close-tutorial');
        this.ui.roundHistoryContainer = document.getElementById('round-history');
    }

    setupTutorial() {
        this.ui.closeTutorialButton.addEventListener('click', () => {
            this.ui.tutorialModal.style.display = 'none';
            localStorage.setItem('echoesGameTutorialSeen', 'true');
        });

        const tutorialSeen = localStorage.getItem('echoesGameTutorialSeen');
        if (!tutorialSeen) {
            this.ui.tutorialModal.style.display = 'flex';
        }
    }

    setupAudio() {
        // Create audio context on first user interaction (required by browsers)
        const initAudio = () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

                // Setup background hum
                this.backgroundHum = this.audioContext.createOscillator();
                const humGain = this.audioContext.createGain();
                this.backgroundHum.type = 'sine';
                this.backgroundHum.frequency.value = 80;
                humGain.gain.value = 0.03; // Keep it subtle
                this.backgroundHum.connect(humGain);
                humGain.connect(this.audioContext.destination);
                this.backgroundHum.start();
            }
            document.removeEventListener('click', initAudio);
        };
        document.addEventListener('click', initAudio, { once: true });
    }

    playSound(type) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        let duration = 0.5;

        switch (type) {
            case 'tick':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.1);
                duration = 0.1;
                break;
            case 'bet':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.2);
                duration = 0.2;
                break;
            case 'ding': // Cash out (ka-ching!)
                duration = 0.4;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(587.33, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.1, this.audioContext.currentTime + 0.1);

                setTimeout(() => {
                    const osc2 = this.audioContext.createOscillator();
                    const gain2 = this.audioContext.createGain();
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(880, this.audioContext.currentTime);
                    gain2.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                    osc2.connect(gain2);
                    gain2.connect(this.audioContext.destination);
                    osc2.start(this.audioContext.currentTime);
                    osc2.stop(this.audioContext.currentTime + 0.2);
                    gain2.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.2);
                }, 100);

                gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
                break;
            case 'reversal':
                duration = 0.3;
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + duration);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
                break;
            case 'buzz': // Loss
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.5);
                break;
        }

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    setupInput() {
        this.ui.actionButton.addEventListener('click', () => this.handleActionButton());
    }

    handleActionButton() {
        if (this.gameState === 'WAITING_FOR_BET') {
            this.placeBet();
        } else if (this.gameState === 'IN_PROGRESS' && !this.cashedOut) {
            this.cashOut();
        }
    }

    placeBet() {
        const betValue = parseInt(this.ui.betAmountInput.value, 10);

        if (isNaN(betValue) || betValue < this.config.minBet || betValue > this.config.maxBet) {
            alert(`Bet must be between ${this.config.minBet} and ${this.config.maxBet}.`);
            return;
        }
        if (betValue > this.playerBalance) {
            alert('Insufficient balance.');
            return;
        }

        this.currentBet = betValue;
        this.playerBalance -= this.currentBet;
        this.ui.winningsText.textContent = '0';
        this.playSound('bet');
        this.updateUI();
        this.startCountdown();
    }

    startCountdown() {
        this.gameState = 'COUNTDOWN';
        this.countdownValue = this.config.countdownSeconds;
        this.ui.actionButton.disabled = true;
        this.ui.actionButton.textContent = `Starting...`;
        this.ui.betAmountInput.disabled = true;
        this.ui.countdownText.style.display = 'block';

        this.updateUI();
        this.playSound('tick');

        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.countdownValue--;
                this.updateUI();
                if (this.countdownValue > 0) {
                    this.playSound('tick');
                } else {
                    this.startRound();
                }
            },
            repeat: this.config.countdownSeconds - 1
        });
    }

    startRound() {
        this.gameState = 'IN_PROGRESS';
        this.multiplier = 1.00;
        this.momentum = 'upward';
        this.cashedOut = false;
        this.multiplierHistory = [1.00];

        this.ui.countdownText.style.display = 'none';
        this.ui.actionButton.disabled = false;
        this.ui.actionButton.textContent = 'Cash Out';

        // Timer to end the round after a fixed duration
        this.roundTimer = this.time.delayedCall(this.config.roundTimeLimit, () => this.endRound('timeout'));

        // Timer to check for momentum reversals
        this.reversalTimer = this.time.addEvent({
            delay: this.config.reversalCheckInterval,
            callback: this.checkMomentumReversal,
            callbackScope: this,
            loop: true
        });
    }

    setupVisuals() {
        // Create a programmatic texture for particles
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(8, 8, 8); // A simple gold coin particle
        graphics.generateTexture('particle_coin', 16, 16);
        graphics.destroy();

        // Create and configure the particle emitter
        this.cashoutEmitter = this.add.particles(0, 0, 'particle_coin', {
            speed: { min: -400, max: 400 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.0, end: 0 },
            blendMode: 'SCREEN',
            lifespan: 800,
            gravityY: 1000,
            emitting: false
        });
    }

    checkMomentumReversal() {
        if (Math.random() < this.config.reversalProbability) {
            const oldMomentum = this.momentum;
            this.momentum = (this.momentum === 'upward') ? 'downward' : 'upward';

            // If momentum flips to downward, trigger screen shake and play sound
            if (this.momentum === 'downward' && oldMomentum === 'upward') {
                this.cameras.main.shake(150, 0.008);
                this.playSound('reversal');
            }
        }
    }

    cashOut() {
        if (this.gameState !== 'IN_PROGRESS' || this.cashedOut) return;

        this.cashedOut = true;
        this.cashoutMultiplier = this.multiplier;
        const winnings = this.currentBet * this.cashoutMultiplier;
        this.playerBalance += winnings;

        this.ui.winningsText.textContent = winnings.toFixed(2);
        this.ui.actionButton.textContent = `Cashed Out @ ${this.cashoutMultiplier.toFixed(2)}x`;
        this.ui.actionButton.disabled = true;

        // Trigger particle explosion
        const { width, height } = this.sys.game.canvas;
        this.cashoutEmitter.setPosition(width / 2, height / 2);
        this.cashoutEmitter.explode(100);

        this.updateUI();
        this.playSound('ding');
    }

    endRound(reason) {
        this.gameState = 'ROUND_OVER';

        // Add final multiplier to history
        this.roundHistory.push(this.multiplier);
        if (this.roundHistory.length > 5) { // Keep last 5 results
            this.roundHistory.shift();
        }
        this.updateHistoryDisplay();

        if (this.backgroundHum) {
            this.backgroundHum.frequency.setTargetAtTime(80, this.audioContext.currentTime, 0.1);
        }

        this.reversalTimer?.remove();
        this.roundTimer?.remove();

        if (!this.cashedOut) {
            this.ui.winningsText.textContent = `-${this.currentBet.toFixed(2)}`;
            this.playSound('buzz');
        }

        this.ui.actionButton.textContent = 'Round Over';
        this.ui.actionButton.disabled = true;

        // Wait a few seconds before resetting for the next round
        this.time.delayedCall(3000, this.resetForNewRound, [], this);
    }

    resetForNewRound() {
        this.currentBet = 0;
        this.gameState = 'WAITING_FOR_BET';
        this.multiplier = 1.00;
        this.multiplierHistory = [];

        this.ui.actionButton.disabled = false;
        this.ui.betAmountInput.disabled = false;
        this.ui.actionButton.textContent = 'Place Bet';

        this.updateUI();
        this.drawGraph();
    }

    updateHistoryDisplay() {
        if (!this.ui.roundHistoryContainer) return;
        this.ui.roundHistoryContainer.innerHTML = '';
        this.roundHistory.forEach(multiplier => {
            const item = document.createElement('span');
            item.textContent = `${multiplier.toFixed(2)}x`;
            item.classList.add('history-item');
            if (multiplier < 1.1) {
                item.style.color = '#ff4d4d'; // Red for low crash
            } else if (multiplier < 2) {
                item.style.color = '#ffeb3b'; // Yellow for medium
            } else {
                item.style.color = '#00ff64'; // Green for high
            }
            this.ui.roundHistoryContainer.appendChild(item);
        });
    }

    update(time, delta) {
        if (this.gameState !== 'IN_PROGRESS') return;

        // Update background sound pitch
        if (this.audioContext && this.backgroundHum) {
            const targetFreq = 80 + (this.multiplier * 5);
            this.backgroundHum.frequency.setTargetAtTime(targetFreq, this.audioContext.currentTime, 0.1);
        }

        // Calculate multiplier change based on delta time for frame-rate independence
        const deltaSeconds = delta / 1000;
        let rate;
        if (this.momentum === 'upward') {
            rate = Phaser.Math.FloatBetween(this.config.multiplierRiseRate.min, this.config.multiplierRiseRate.max);
            this.multiplier += rate * deltaSeconds;
        } else {
            rate = Phaser.Math.FloatBetween(this.config.multiplierFallRate.min, this.config.multiplierFallRate.max);
            this.multiplier -= rate * deltaSeconds;
        }

        if (this.multiplier <= 0) {
            this.multiplier = 0;
            this.endRound('crash');
        }

        this.multiplierHistory.push(this.multiplier);
        if (this.multiplierHistory.length > this.config.graphMaxPoints) {
            this.multiplierHistory.shift();
        }

        // Check if player lost their bet
        if (!this.cashedOut && this.momentum === 'downward' && this.multiplier < this.cashoutMultiplier) {
            // This logic is flawed, player hasn't cashed out yet.
            // A loss is determined only at the end of the round if not cashed out.
        }

        this.updateUI();
        this.drawGraph();
    }

    updateUI() {
        this.ui.balanceText.textContent = this.playerBalance.toFixed(2);

        const multText = this.ui.multiplierText;
        const indicator = this.ui.momentumIndicator;

        if (this.gameState === 'COUNTDOWN') {
            this.ui.countdownText.textContent = `Starting in ${this.countdownValue}...`;
            indicator.textContent = '';
        } else if (this.gameState === 'IN_PROGRESS' || this.gameState === 'ROUND_OVER') {
            multText.textContent = `${this.multiplier.toFixed(2)}x`;

            // Update momentum indicator
            indicator.textContent = this.momentum === 'upward' ? '▲' : '▼';
            indicator.style.color = this.momentum === 'upward' ? '#00ff64' : '#ff4d4d';

            // Update multiplier color based on value
            const mult = this.multiplier;
            if (mult < 2.0) {
                multText.style.color = '#fff';
                multText.style.textShadow = '0 0 20px var(--green-glow)';
            } else if (mult < 5.0) {
                multText.style.color = '#ffeb3b'; // Yellow
                multText.style.textShadow = '0 0 20px rgba(255, 235, 59, 0.7)';
            } else {
                multText.style.color = '#ff8f3b'; // Orange
                multText.style.textShadow = '0 0 20px rgba(255, 143, 59, 0.7)';
            }
            if (this.momentum === 'downward') {
                multText.style.color = '#ff4d4d'; // Red
                multText.style.textShadow = '0 0 20px var(--red-glow)';
            }

        } else { // WAITING_FOR_BET
            multText.textContent = '--.--x';
            multText.style.color = '#fff';
            multText.style.textShadow = 'none';
            indicator.textContent = '';
        }
    }

    drawGraph() {
        this.graph.clear();

        const { width, height } = this.sys.game.canvas;
        const maxMultiplier = Math.max(2, ...this.multiplierHistory); // Ensure graph y-axis is at least 2x

        this.graph.lineStyle(3, 0x00ffde, 1);
        this.graph.beginPath();

        for (let i = 0; i < this.multiplierHistory.length; i++) {
            const x = (i / (this.config.graphMaxPoints - 1)) * width;
            const y = height - (this.multiplierHistory[i] / maxMultiplier) * height;

            if (i === 0) {
                this.graph.moveTo(x, y);
            } else {
                this.graph.lineTo(x, y);
            }
        }
        this.graph.strokePath();
    }
}

// Phaser Game Configuration
const phaserConfig = {
    type: Phaser.AUTO,
    width: document.getElementById('game-canvas').clientWidth,
    height: document.getElementById('game-canvas').clientHeight,
    parent: 'game-canvas',
    backgroundColor: '#000000',
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(phaserConfig);
