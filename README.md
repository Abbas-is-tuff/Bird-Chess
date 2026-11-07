# Bird Chess 🦅🦉🐧🦩🦜🐤

Chess, but every piece is a bird. The rules are real chess rules; the birds are just costumes.

## Play

Open `index.html` in any browser. There's no build step and nothing to install.

- **vs Computer**: three levels, Hatchling (easy), Fledgling (medium) and Raptor (hard). You can play either side.
- **2 players**: take turns on the same screen.

Click a bird to see where it can go, then click the square you want.

## Meet the flock

| Bird | Chess piece | How it moves |
| --- | --- | --- |
| 🦅 Eagle | King | One square in any direction. If it gets trapped, you lose. |
| 🦉 Owl | Queen | Any distance in any direction. |
| 🐧 Penguin | Rook | Slides any distance in a straight line. |
| 🦩 Flamingo | Bishop | Struts any distance diagonally. |
| 🦜 Parrot | Knight | Hops in an L shape, over other birds. |
| 🐤 Chick | Pawn | Moves forward and captures diagonally. When it reaches the far side it grows into another bird. |

The **Dawn flock** (cream) moves first. The **Dusk flock** (navy) moves second.

All the usual rules are in: castling, en passant, promotion, check, checkmate, stalemate, the 50-move rule, threefold repetition and draws when neither side has enough pieces left to win.

## Files

- `engine.js`: the rules and the computer opponent
- `game.js`: the board, sounds and game flow
- `style.css`: how it looks
- `test.js`: checks the move generator against standard counts (`node test.js`)
