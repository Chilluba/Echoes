# Echoes — Momentum Trading Game

Echoes is a browser-based trading game inspired by "crash" games like Aviator. Instead of a simple curve that only goes up, the multiplier in Echoes follows a "momentum curve" that can unpredictably reverse direction, creating a dynamic and challenging experience. Players must cash out their bet before the momentum turns against them and the multiplier drops too low.

The game is built with HTML, CSS, and JavaScript, using the Phaser 3 framework for rendering the real-time graph.

## How to Play

1.  **Place Your Bet**: Before the round begins, enter your bet amount (between 10 and 500 credits) in the input field and click the "Place Bet" button.
2.  **Watch the Countdown**: A 5-second countdown will start. Once it finishes, the round begins.
3.  **Monitor the Multiplier**: The multiplier starts at 1.00x and will begin to climb. The line graph on the screen visualizes its history.
4.  **Momentum Reversals**: At random intervals, the momentum can reverse, causing the multiplier to start decreasing. It can reverse back to positive momentum again, making each round unique.
5.  **Cash Out**: Click the "Cash Out" button at any time to lock in your winnings at the current multiplier. Your winnings are your bet amount multiplied by the cash-out multiplier.
6.  **Don't Wait Too Long**: If the round ends (either by the multiplier crashing to 0.00x or the time limit being reached) before you cash out, you lose your entire bet for that round.

The goal is to cash out at the highest multiplier possible before the momentum reverses and drops below your target.

## Running the Game Locally

This game is designed to run directly in your web browser without needing a local server.

1.  Clone or download the repository to your local machine.
2.  Navigate to the project folder.
3.  Open the `index.html` file in a modern web browser (like Chrome, Firefox, or Safari).

The game should load and be ready to play.

## Configuration & Customization

You can easily tweak the core game mechanics by editing the `config` object at the top of the `game.js` file.

```javascript
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
```

Feel free to change these values to alter the game's difficulty and behavior.
