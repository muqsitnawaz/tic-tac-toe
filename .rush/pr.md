chore: review — win detection broken, server crashes on a lone player

## There is no open pull request

`gh pr list --state all` returns nothing: this repository has never had a PR, and
`git branch -a` shows only `master`. So there was nothing to review as requested.

Instead I reviewed the only change that exists — commit `316d540` "Turn and invalid
move working", which is the entire codebase (218 lines across `server.js` and
`home.html`). This PR carries that review; it changes no product code.

**Verdict: would block.** The game cannot correctly decide who won, and two
one-click paths kill the server process.

Every claim below was reproduced against the running server (socket.io 2.x, the
version era this code was written for), not inferred by reading.

## Blocking

### 1. `getWinner()` never looks at rows, columns, or diagonals — X always wins

`server.js:46-65` decides the winner by counting symbols and comparing totals:

```js
if (xCount > oCount) { return "X" } else if (xCount < oCount) { return "O" } else { return "D" }
```

X moves first on a 9-cell board, so a full board is always 5 X and 4 O, so
`xCount > oCount` is always true. I ran all 126 legal full boards through it:

```
every legal full board (5 X / 4 O), getWinner() results: {"X":126}
```

Player 0 wins 100% of games regardless of play. The `"O"` and `"D"` branches are
unreachable dead code — a draw can never be reported.

Confirmed in a real two-player game. Final board `XOXXOXOOX`:

```
X O X      middle column (cells 1,4,7) = O O O   <- O has three in a row
X O X
O O X
```

```
  [p0/X] <- result_win
  [p1/O] <- result_lose
```

O owned a line and was told they lost.

### 2. `isEndState()` only checks for a full board — a win does not end the game

`server.js:36-44` returns true only when no cell is `' '`. In the same game, O
completed the middle column on move 6, at board `"XOXXO  O "`:

```
X O X      cells 1,4,7 = O O O
X O _
_ O _
```

The server emitted no result and play continued for three more moves. Winning
three in a row is simply not a thing this server can detect. Finding 1 and this
are the same missing concept — there is no line-checking code anywhere.

### 3. The first visitor, alone, clicking any square crashes the server

`server.js:90-91` emits to `gameRoom[1]` with no check that a second player
exists. Nothing prevents the click: `home.html:14` uses
`style="disabled: disabled;"`, which is not a CSS property and disables nothing.

One client connected and clicked cell 4:

```
new board:     X
/workspace/server.js:91
        gameRoom[1].emit('board', board)
                    ^
TypeError: Cannot read properties of undefined (reading 'emit')
```

The Node process exits. Any first visitor takes the whole service down for
everyone, with no second player needed.

### 4. A lone visitor closing the tab crashes the server

Same shape at `server.js:118-121` — the disconnect handler emits to both slots
unconditionally. One client connected, then disconnected:

```
/workspace/server.js:120
    gameRoom[1].emit('disconnected')
                ^
TypeError: Cannot read properties of undefined (reading 'emit')
```

Open the page and close it, and the server is gone. Both crash paths need a
`gameRoom.length > 1` guard at minimum, but see finding 6 — the real fix is
per-room state.

## Should fix

### 5. A third visitor resets the live game's UI

`server.js:70` pushes every socket into `gameRoom`, and `server.js:126-129`
re-emits `start` to slots 0 and 1 whenever `length > 1`. So a third person opening
the page rewrites the two real players' status to "Game started!" mid-game:

```
--- a 3rd person opens the page (spectator): ---
  [p0/X] <- start 0
  [p1/O] <- start 1
```

Their board is untouched but the message line lies. `getId()` (`server.js:20-26`)
also falls off the end and returns `undefined` for that socket, so third-party
moves land in the `invalid_turn`/`invalid_move` path by accident rather than by
a deliberate rejection.

### 6. `board` and `turn` are process-wide singletons — one game, ever, no replay

`server.js:16-18` holds `gameRoom`, `board`, and `turn` as module globals. Nothing
resets them when a game ends, so after the result is emitted every subsequent move
is rejected forever:

```
--- game over. p0 tries to start a new game: ---
  [p0/X] <- invalid_move
```

Restarting the process is the only way to play again. This is also why findings 3,
4, and 5 exist: there is no room concept, so every socket in the process shares one
board. Pairing sockets into a room object holds 3-6 together.

### 7. Disconnect never removes the socket from `gameRoom`

`server.js:118-121` notifies, but never splices. The array only grows, so slots 0
and 1 stay pinned to dead sockets and a returning player can never be a player
again — they are permanently a spectator per finding 5.

### 8. No `package.json` — a fresh clone cannot run

`socket.io` is required at `server.js:12` but declared nowhere, and there is no
lockfile, no README, and no start script. A clean checkout gives:

```
Error: Cannot find module 'socket.io'
Require stack:
- /workspace/server.js
```

I had to install socket.io out-of-tree to review this. Adding a `package.json`
with the dependency pinned and a `start` script is the smallest fix.

### 9. `gameRoom` and `cid` are implicit globals

`server.js:16` (`gameRoom = []`) and `server.js:74` (`cid = getId(sock)`) assign
without `var`/`let`/`const`, so both leak onto `globalThis`:

```
leaked to globalThis?  gameRoom: object | cid: number
under "use strict" the same pattern throws: ReferenceError: nope is not defined
```

`cid` is the sharper one: it is shared mutable state across every connection that
happens to work only because each handler runs to completion synchronously. Add
declarations before anything in this file becomes async.

## Nits

- `home.html:11` — `<h3>You are player ...</h4>` opens `h3` and closes `h4`.
- `home.html:14` — `style="disabled: disabled;"` is not a CSS property and has no
  effect; the board is clickable before the game starts and after it ends.
- `home.html:33` — jQuery is loaded from the Google CDN and every handler lives
  inside `$(document).ready`, so with no network the page renders but nothing works.
- `home.html:47-50` — players are told they are "player 0"/"player 1" but the board
  draws X and O; the mapping is never shown.
- `server.js:78` — the move `id` is taken from the client and used unvalidated. I
  tried to corrupt the board with a string `"0"`, a float `1.5`, an off-board `100`,
  and a crafted object; all were either handled correctly or safely rejected as
  `invalid_move`, so this is defense-in-depth, not a live exploit. A
  `Number.isInteger(id) && id >= 0 && id < 9` check makes it explicit.
- `server.js:6-10` — the `readFile` error is ignored (`res.end(undefined)` on a
  missing file), no `Content-Type` is set, and every path returns `home.html`.

## How to test

There is no test suite and no way to install dependencies from the repo as it
stands, so reproduction needs an out-of-tree install:

```bash
mkdir -p /tmp/ttt && cd /tmp/ttt && npm install socket.io@2 socket.io-client@2
cd /path/to/tic-tac-toe
NODE_PATH=/tmp/ttt/node_modules node server.js
```

Then, against that running server:

1. **Finding 3** — connect one socket.io client and `emit('move', 4)`. The server
   process dies with a `TypeError` at `server.js:91`.
2. **Finding 4** — connect one client and close it. The server dies at
   `server.js:120`.
3. **Findings 1, 2, 6** — connect two clients and play cells in the order
   `0,1,2,4,3,7,5,6,8`. O completes the middle column on move 6 with no result
   emitted; at move 9 player 0 receives `result_win` and player 1 `result_lose`.
   Any further move returns `invalid_move` forever.
4. **Finding 5** — with a game in progress, connect a third client. Both existing
   players receive a fresh `start` event.
5. **Finding 1 in isolation** — copy `getWinner()` out of `server.js` and call it
   over every arrangement of 5 X and 4 O; it returns `"X"` for all 126.

Fixing findings 1 and 2 needs the eight winning lines checked after each move, and
fixing 3-7 needs `board`/`turn` moved off the module scope into a per-pair room.
Both are behavioural changes to how the game works, so I have left the code
untouched and am reporting rather than rewriting.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
