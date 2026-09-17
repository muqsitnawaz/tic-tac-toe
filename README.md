# Tic Tac Toe

A real-time, two-player tic-tac-toe game built with `socket.io`.

## How to play

- The game needs exactly two players. Open the page in two browser tabs (or
  have a friend open it) — the first two clients to connect are seated as
  Player 0 (X) and Player 1 (O).
- Once both players are connected, the board activates and Player 0 moves
  first. Click an empty square to place your mark.
- Turns alternate automatically; moving out of turn or on an occupied square
  shows an inline error instead of updating the board.
- The board fills top-left to bottom-right across 9 squares. The game ends
  when the board is full, with a win/lose/draw message shown to each player.
- If a player disconnects mid-game, the other player is notified.

## Running locally

```bash
npm install socket.io
node server.js
```

Then open `http://localhost:8000` in two browser tabs to start a game.
