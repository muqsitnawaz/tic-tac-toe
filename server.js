var http = require('http')
var fs = require('fs')
const port = 8000

// doing routing on client's side
var server = http.createServer(function(req, res) {
  fs.readFile('home.html', (err, data) => {
    res.end(data);
  })
});

const io = require('socket.io')(server)
server.listen(port)
console.log("server listening on port:" + port)

gameRoom = []
var board = '         ';
var turn = 0;

function getId(sock) {
  if (gameRoom[0] === sock) {
    return 0
  } else if (gameRoom[1] === sock) {
    return 1
  }
}

function nextTurn(turn) {
  if (turn === 0) {
    return 1
  } else {
    return 0
  }
}

function isEndState() {
  for (var i = 0; i < board.length; i++) {
    if (board[i] === ' ') {
      return false
    }
  }

  return true
}

function getWinner() {
  var xCount = 0
  var oCount = 0

  for (var i = 0; i < board.length; i++) {
    if (board[i] === 'X') {
      xCount += 1
    } else if (board[i] === 'O') {
      oCount += 1
    }
  }

  if (xCount > oCount) {
    return "X"
  } else if (xCount < oCount) {
    return "O"
  } else {
    return "D"
  }
}

// code for web-sockets
io.sockets.on('connection', function (sock) {
  console.log('a client connected');
  gameRoom.push(sock);

  // getting a user's move
  sock.on('move', function(id) {
    cid = getId(sock)
    console.log("client " + cid + " wants to move: m" + id)
    console.log("turn of player: " + turn)

    if (board[id] === ' ') {
      if (turn === cid) {
        if (sock === gameRoom[0]) {
          board = board.substring(0, id) + 'X' + board.substring(id+1);
        } else if (sock === gameRoom[1]) {
          board = board.substring(0, id) + 'O' + board.substring(id+1);
        }
        
        // showing new board
        console.log("new board: " + board);

        // sending baord to both players
        gameRoom[0].emit('board', board)
        gameRoom[1].emit('board', board)

        if (isEndState()) {
          var winner = getWinner();

          if (winner === "X") {
            gameRoom[0].emit('result_win')
            gameRoom[1].emit('result_lose')
          } else if (winner === "O") {
            gameRoom[0].emit('result_lose')
            gameRoom[1].emit('result_win')
          } else {
            gameRoom[0].emit('result_draw')
            gameRoom[1].emit('result_draw')
          }
        }

        // giving next turn
        turn = nextTurn(turn);
      } else {
        sock.emit('invalid_turn')
      }
    } else {
      sock.emit('invalid_move');
    }
  });

  sock.on('disconnect', function () {
    gameRoom[0].emit('disconnected')
    gameRoom[1].emit('disconnected')
  });

  console.log("total players: " + gameRoom.length)
  
  // starting a game
  if (gameRoom.length > 1) {
    gameRoom[0].emit('start', 0)
    gameRoom[1].emit('start', 1)
  }
});