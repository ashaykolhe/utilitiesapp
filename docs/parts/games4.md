## Klondike Solitaire
- id: solitaire
- category: fun
- plan: free
- needs: storage
- what: Classic Klondike with seven tableau columns that fit a 360 px phone, draw 1 or draw 3, unlimited undo, move counter and timer. Tap a card to send it to the best legal place (foundation first, then a tableau column) or drag it. When every card is face up an Auto-complete button finishes the game. Deals are random, not guaranteed winnable. Wins, best time and the draw mode are saved.
- test:
  1. Open the tool: seven columns with 1 to 7 cards (only the last face up), a stock pile and an empty waste. Moves 0 and a timer start counting after the first move.
  2. Tap the stock: one card (or three in Draw 3) moves to the waste. Tap the waste card or an Ace: it jumps to the foundation when legal; a card with no legal place shakes and nothing moves.
  3. Tap Undo several times: each move is reverted exactly (including a flipped card turning face down again). The move counter goes back too.
  4. Tap Draw 3 / Draw 1: the mode switches and a new deal starts. Tap New deal: a fresh deal and timer reset.
  5. Edge case: play until all cards are face up: Auto-complete appears; tap it and the cards fly to the foundations and the win message shows. Leave and reopen the tool: the game continues where it was.

## Backgammon
- id: backgammon
- category: fun
- plan: free
- needs: storage
- what: Standard backgammon (no doubling cube) on a portrait board, against the phone at Easy or Normal, or pass-and-play with a friend. Dice are rolled for you, legal checkers are highlighted, then legal destinations; the bar, blocked points, bearing off and the rules that force you to use both dice (or the larger one when only one can be played) are all enforced. Wins are counted.
- test:
  1. Start a game vs Phone: the standard opening position shows (15 checkers each). Tap Roll: two dice appear and only checkers that can legally move are highlighted.
  2. Tap a highlighted checker: its legal landing points are marked; tap one to move. The phone then rolls and plays by itself.
  3. Get hit (or hit the phone): the checker goes on the bar and must enter before anything else moves; if the entry points are blocked the turn is skipped with a message.
  4. Edge case: when only one die can be played, only moves with the larger die are offered; with no legal move the turn passes ("No legal move").
  5. Bring all checkers home: bearing off is offered; bear off all 15 to win and the result is shown. Switch to Pass and play and Easy/Normal in the menu: a new game starts in that mode.

## Ludo
- id: ludo
- category: fun
- plan: free
- needs: storage
- what: Ludo for 2 to 4 players, each seat set to Human or Phone. Roll a six to leave home, capture opponents on unsafe squares, safe squares (starting squares and stars) protect, an exact roll is needed to finish in the home lane, a six gives another turn (three sixes in a row loses the turn), and finishing places are ranked.
- test:
  1. Open the tool, choose 4 players with seat 1 Human and the rest Phone, tap Start: the cross-shaped board shows with four yards of four tokens.
  2. Tap the dice until a six: tokens in the yard that can leave are highlighted; tap one and it moves to your start square and you roll again.
  3. Land on an opponent token on an unsafe square: it is sent back to its yard. On a starred or start square both tokens coexist.
  4. Edge case: with a token two steps from home roll a larger number: that token cannot move (exact roll needed); if nothing can move the turn passes. Roll three sixes in a row: the third six is ignored and the turn passes.
  5. Finish all four tokens: you get a place (1st, 2nd ...) and play continues for the others until only one is left; the final ranking is shown.

## Snakes & Ladders
- id: snakesladders
- category: fun
- plan: free
- needs: storage
- what: The classic 10x10 board with a fixed, balanced set of 8 ladders and 8 snakes, for 2 to 4 players, each Human or Phone. The dice animate and the token hops square by square. You must land exactly on 100: a roll that is too big bounces you back from 100 by the surplus. Wins are counted.
- test:
  1. Pick the number of players and who is Phone, tap Start: all tokens sit beside square 1 and the board numbers run in zigzag from the bottom left.
  2. Tap Roll: the dice animates, then the token hops forward square by square. Land on a ladder foot to climb, on a snake head to slide.
  3. Phone players roll by themselves after a short pause; the turn marker shows whose turn it is.
  4. Edge case: near 100, roll more than needed: the token goes up to 100 and bounces back by the surplus. Landing exactly on 100 wins.
  5. After a win the winner is announced and New game starts again; the player setup is remembered.
