# games6 (www/js/tools/games6.js)

Puzzle and dice games, category `fun`, plan free. Saved state under Store key `fun3.<id>`.

(Per-tool sections are added below as each game is finished.)

## Word Search
- id: wordsearch
- category: fun
- plan: free
- needs: storage
- what: A new letter grid every time (8x8, 10x10 or 12x12) built from a list of 420+ common words in nine themes, with words hidden in all 8 directions. Drag across letters (or tap the first and last letter) to select; found words get a colour and are struck through in the list. Timer, hint (marks the first letter of a word), "Show solution", best time per size, and an unfinished puzzle is resumed when you come back.
- test:
  1. Open the tool: a 10x10 grid, a word list and a running timer are shown. Drag along a listed word (any direction, including backwards and diagonals): the cells colour in, the word is struck through and Found goes up.
  2. Drag across letters that are not a listed word: the cells flash red and nothing is marked. Tap one letter and then another letter on the same line: that line is checked too.
  3. Tap Hint: a square turns green and the message names a word starting there. Tap Show solution: every word is marked, the timer stops and no best time is saved.
  4. Pick a Theme such as Animals and a size of 8x8: a new puzzle with only animal words; the size and theme are remembered after reopening.
  5. Find every word: "All found in m:ss" appears and Best updates. Leave mid-puzzle and reopen: the same grid, found words and elapsed time are restored.

## Mini Crossword
- id: miniwords
- category: fun
- plan: free
- needs: storage
- what: A small 5x5-style crossword generated fresh each time from 260 answer and clue pairs of everyday words (3 to 5 letters), with black squares, numbered clues, an on-screen keyboard, Check, Reveal letter, Reveal word and Show solution. Best time is saved and an unfinished crossword is resumed.
- test:
  1. Open the tool: a 5x5 grid with black squares, a clue bar and the Across and Down clue lists appear. Tap a square: its word is highlighted and the clue shows. Tap the same square again: the direction switches.
  2. Type letters with the on-screen keyboard: the cursor moves along the word; the backspace key clears and steps back. Tap a clue in the list: the cursor jumps to that word.
  3. Fill a wrong letter and tap Check: wrong letters turn red for a few seconds. Tap Reveal letter / Reveal word: the letters appear in green.
  4. Fill every square correctly: "Solved in m:ss" appears and Best updates (not when letters were revealed). Edge case: fill every square with a wrong letter: "Some letters are wrong. Tap Check."
  5. Tap Show solution: the full grid appears and the timer stops. New crossword gives a different grid; leaving and reopening restores the unfinished grid and time.

## KenKen
- id: kenken
- category: fun
- plan: free
- needs: storage
- what: Fill a 4x4, 5x5 or 6x6 grid with 1 to N so no number repeats in any row or column, and each outlined cage reaches its target using + - × or ÷. Every puzzle has exactly one solution (checked by a solver while it is generated). Pencil notes, red highlighting of repeats and of finished cages that miss their target, Check, Hint, Show solution, best time per size, and an unfinished puzzle is resumed.
- test:
  1. Open the tool: a 4x4 grid with thick cage outlines and a target label (like 6× or 3+) in each cage corner. Tap a cell and a pad number: it is entered in blue.
  2. Enter the same number twice in a row: both cells turn red. Fill a whole cage with numbers that miss its target: its label turns red.
  3. Turn Notes on and tap pad numbers in an empty cell: small pencil digits appear (tap again to remove); with Notes off, entering a number clears the notes.
  4. Tap Check with a wrong number entered: it turns red briefly. Tap Hint: a correct number is filled in. Tap Show solution: the grid fills and the timer stops.
  5. Switch to 6x6: a new puzzle appears in under a second. Solve one properly: "Solved in m:ss" and Best updates (not after using Hint or Show solution).

## Kakuro
- id: kakuro
- category: fun
- plan: free
- needs: storage
- what: Cross-sums on a small board (6x6, 7x7 or 8x8 including the clue row and column). Fill the white cells with 1 to 9 so each run adds up to the clue in its black cell (across clue top right, down clue bottom left) and no digit repeats within a run. Boards are generated and checked by a solver to have exactly one solution; a few digits may be pre-filled (shown bold) where needed to keep it unique. Number pad, red highlighting of repeats and of full runs with a wrong sum, Check, Hint, Show solution, best time per size, resume.
- test:
  1. Open the tool: a board with split black clue cells and white squares appears. Tap a white square and a pad number: it is entered.
  2. Type the same digit twice in one run: both cells turn red. Complete a run with the wrong total: the whole run turns red.
  3. Tap a bold pre-filled cell and a number: nothing changes (givens are locked).
  4. Tap Check with a wrong digit entered: it flashes red. Hint fills a correct digit. Show solution fills the board and stops the timer.
  5. Switch to Large (8x8): a new board appears quickly. Solve one fully: "Solved in m:ss" and Best updates (not after Hint or Show solution).

## Futoshiki
- id: futoshiki
- category: fun
- plan: free
- needs: storage
- what: A Latin-square puzzle with greater-than and less-than signs between neighbouring cells. Fill the 4x4, 5x5 or 6x6 grid with 1 to N so no number repeats in a row or column and every sign is true. Each puzzle has exactly one solution (checked by a solver); one or two numbers may be pre-filled (outlined). Pencil notes, red highlighting of repeats and false signs, Check, Hint, Show solution, best time per size, resume.
- test:
  1. Open the tool: a 4x4 grid with < > and up/down arrows between cells. Tap a cell and a pad number: it is entered in blue.
  2. Enter two numbers that break a sign (for example a larger number where the sign says the cell must be smaller): the sign and both cells turn red. A repeated number in a row turns red too.
  3. Turn Notes on and tap pad numbers in an empty cell: small pencil digits appear. Tap an outlined (given) cell and a number: nothing changes.
  4. Tap Check with a wrong number entered: it flashes red. Hint fills a correct number. Show solution fills the grid and stops the timer.
  5. Switch to 6x6: a new puzzle appears quickly and fits the screen width. Solve one properly: "Solved in m:ss" and Best updates (not after Hint or Show solution).

## Killer Sudoku
- id: killersudoku
- category: fun
- plan: free
- needs: storage
- what: A 9x9 Sudoku where there are no starting digits but dashed cages: digits inside a cage must all differ and add up to the small sum in its corner. Puzzles come from a bank of 84 pre-verified puzzles (each checked by a solver to have exactly one solution) in Easy, Medium and Hard, shown rotated or mirrored at random, so repeats are rare. Pencil notes, red highlighting of repeats and finished cages with a wrong sum, Check, Hint, Show solution, best time per level, resume.
- test:
  1. Open the tool: a 9x9 grid with dashed cage outlines and small sums appears. Tap a cell and a pad number: it is entered in blue and other cells with the same number are tinted.
  2. Enter the same digit twice in a row, column, box or cage: both cells turn red. Fill a cage with the wrong total: the cage turns red.
  3. Turn Notes on and tap pad numbers in an empty cell: small pencil digits appear in a 3x3 pattern; entering a real number clears them.
  4. Tap Check with a wrong number entered: it flashes red. Hint fills a correct number. Show solution fills the grid and stops the timer.
  5. Switch Easy / Medium / Hard: a new puzzle each time. Leave mid-puzzle and reopen: the grid, notes and elapsed time are restored. Solving properly shows "Solved in m:ss" and updates Best.

## Tangram
- id: tangram
- category: fun
- plan: free
- needs: storage
- what: Rebuild a grey silhouette with the seven tangram pieces (two large triangles, a medium triangle, two small triangles, a square and a parallelogram). Drag a piece to move it, tap it to turn it by 45 degrees, flip the parallelogram, and pieces snap to nearby corners. 36 silhouettes, each built from the seven pieces so it can always be solved; the check is by area coverage with a small tolerance, so any arrangement that fills the shape counts. Hint outlines where a piece goes, Show solution places them, timer, best time per shape and solved count are saved.
- test:
  1. Open the tool: a grey silhouette on top and seven coloured pieces below. Drag a piece onto the grey shape: it follows the finger and snaps to nearby corners when released.
  2. Tap a piece without dragging: it turns by 45 degrees and is highlighted. Use Turn piece, Flip piece and Next piece to change the selected piece (flipping only changes the parallelogram).
  3. Tap Hint: a dashed outline shows where a piece belongs and the message names it. Pieces that overlap each other do not count as solved.
  4. Fill the whole silhouette: "Shape solved in m:ss" appears, Best is saved and the solved count goes up. Use the arrows or Random shape for another silhouette.
  5. Tap Show solution: the pieces fly to their places and the timer stops (no best time saved). Leave mid-puzzle and reopen: pieces are where you left them.

## Dice Five
- id: dicefive
- category: fun
- plan: free
- needs: storage
- what: A five-dice scorecard game in the style of the classic family dice game (no money, no betting). Roll up to three times, tap dice to hold them, then fill one of 13 boxes: ones to sixes (35 bonus for 63 or more), three and four of a kind, full house 25, small straight 30, large straight 40, Dice Five 50 and chance. A second Dice Five earns 100 when the Dice Five box holds 50 and follows the joker rules. Play solo for a high score or against the phone, whose AI weighs the expected score of every choice. Hint suggests dice to keep. High score and win record are saved.
- test:
  1. Open the tool (Solo): tap Roll dice; five dice appear. Tap two dice: they get an accent border (held). Roll again: only the unheld dice change; the button shows the rolls left.
  2. After a roll the scorecard shows outlined buttons with the points each open box would give. Tap one: the box fills, the dice reset and the next turn starts. Fill all 13 boxes: "Game over", total and a new best when higher.
  3. Tap Hint after a roll: the dice worth keeping are highlighted. With no rolls left it names a box to try.
  4. Switch to vs Phone: you play a turn, then the phone rolls, holds and scores on its own with short pauses and a message. At the end the winner is shown and the win record (e.g. 1-0) updates.
  5. Edge case: roll a second Dice Five after scoring 50 in the Dice Five box: only the matching upper box (or lower boxes with full values) can be picked and +100 is added.

## Farkle
- id: farkle
- category: fun
- plan: free
- needs: storage
- what: The classic push-your-luck dice game (no money, no betting) for 2 to 4 players: you plus friends sharing the phone and/or phone players. Roll six dice, set aside scoring dice (1 = 100, 5 = 50, three of a kind, four, five, six of a kind, straight 1500, three pairs 1500, two triplets 2500), then roll the rest or bank. No scoring dice means a Farkle and the turn total is lost; using all six gives hot dice and a fresh six. Optional rule: you need 500 in one turn to get on the board. First to 10,000 triggers one last turn for everyone else. The phone AI chooses which dice to keep and when to bank from the dice left and the scores. Wins against the phone and best score are saved.
- test:
  1. Open the tool: choose 2 players (you and the phone), keep the 500 rule on and tap Start game. Tap Roll 6 dice: six dice appear and the message asks you to set scoring dice aside.
  2. Tap a 1 or 5 (or a triple) so it is outlined, check Selected shows the points, tap Set aside: it moves to the small row and the turn total grows. Tap a non-scoring die and Set aside: the button stays disabled or says only scoring dice can be set aside.
  3. Tap Bank with less than 500 as a new player: "You need 500 to get on the board". Reach 500 and Bank: your total updates and the phone plays (dice highlight, short pauses).
  4. Roll a roll with no scoring dice: "Farkle!" appears, the turn total is lost and play passes. Use all six dice: "Hot dice!" and Roll shows six dice again.
  5. Choose 3 or 4 players and switch a seat to Friend: the scoreboard lists You, Friend and Phone. When someone passes 10,000 everyone else gets one more turn, then the winner is shown and the record updates.

## Liar's Dice
- id: liarsdice
- category: fun
- plan: free
- needs: storage
- what: A bluffing dice game (no money, no betting) against 1 to 3 phone players, each with 3 to 5 dice hidden under a cup. You see only your own dice. Bid how many dice of a face are showing among everyone's dice (more dice, or the same number of a higher face), or call the last bid a lie. The wrong side loses a die and everyone's dice are revealed; the last player with dice wins. Ones can be wild. The phone players work out the chance that each bid is true from their own dice and the number hidden, with different levels of boldness and occasional bluffs. Hint shows the chance of the current bid. Games won and lost are saved.
- test:
  1. Open the tool, keep 1 opponent, 5 dice and wild ones on, tap Start game. Your five dice are shown, the phone's dice appear as question marks. If the phone opens, its bid shows as "Current bid".
  2. Use the minus and plus buttons and the face dice to build a bid. A bid that is not higher than the current one shows "Bid must be higher" and the Bid button is disabled; a higher bid is accepted and the phone answers after a short pause.
  3. Tap Hint: it shows the percentage chance that the current bid is true and whether to raise or call Liar. Tap Liar!: all dice are revealed, matching dice are highlighted and the message says who loses a die.
  4. Tap Next round: new dice are rolled, the loser starts and dice counts update. Count with wild ones on: a one counts toward every face except a bid on ones.
  5. Play to the end: "You win the game!" or the winner's name is shown with Play again, and the games won record updates. New game returns to the setup (try 3 opponents).
