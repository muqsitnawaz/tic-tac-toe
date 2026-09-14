# Multiplayer Tic Tac Toe

A two-player tic tac toe game over web sockets: a Node HTTP server (`server.js`)
serving a single page (`home.html`), with moves relayed between the two players
by socket.io.

## How to play

Two players share one board. Player 0 plays `X` and moves first, player 1 plays
`O`. Click any empty square to place your mark; the move is sent to the server,
which validates it and pushes the updated board to both players.

- Clicking an occupied square shows "Invalid move!" and nothing changes.
- Moving when it is not your turn shows "Invalid turn!" and nothing changes.
- The game ends once all nine squares are filled, and the result is announced to
  both players.
- If either player closes the tab, the other is told the player disconnected.

Note: three in a row is not detected yet. The server ends the game only on a
full board and awards it to whoever placed more marks (`getWinner` in
`server.js`), so `X` wins every completed game.

## Running it locally

Requires Node.js.

```sh
npm install socket.io
node server.js
```

Then open <http://localhost:8000> in two browser tabs — the game starts as soon
as the second player connects. The server holds exactly one game for the first
two clients.
