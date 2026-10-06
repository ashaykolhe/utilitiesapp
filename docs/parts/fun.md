## Dice Roller
- id: dice
- category: fun
- plan: free
- needs: none
- what: Roll 1 to 6 dice of d4, d6, d8, d10, d12 or d20 with a tumbling animation. Shows each die (pips for d6), the total and a saved history of the last rolls. Uses crypto.getRandomValues.
- test:
  1. Choose 3 dice and d20, tap Roll: dice tumble about 1 second, then show values 1-20 and Total equals their sum.
  2. Switch to d6: dice show pip faces. Tap Roll twice quickly: the second tap is ignored while rolling.
  3. History lists each roll; Clear empties it. Leave and reopen the tool: dice count and sides are remembered.

## Coin Flip
- id: coin
- category: fun
- plan: free
- needs: none
- what: Flip a gold 3D coin that spins and hops, landing on Heads or Tails. Keeps a saved tally with a heads/tails ratio bar.
- test:
  1. Tap the coin or Flip: it spins about 1.4 s, then shows Heads! or Tails! and the tally increases by one.
  2. Flip 10 times: Flips counter reads 10 and Heads + Tails = 10; the bar reflects the ratio.
  3. Reset tally sets everything to 0 (also after reopening the tool).

## Spin Wheel
- id: wheel
- category: fun
- plan: free
- needs: none
- what: A canvas wheel with coloured segments built from your own list of options. Spins with an easing slowdown, highlights the winner and can remove the winner after each spin.
- test:
  1. Add options Pizza, Tacos, Sushi: chips appear and the wheel redraws. Remove one with its x.
  2. Tap Spin: it spins ~4 s, slows down and the pointer at the top lands on the winner, shown below the wheel.
  3. Enable Remove the winner after each spin: after a spin the winner vanishes from the list.
  4. With fewer than 2 options, Spin shows the message Add at least two options. Options persist after reopening.

## Reaction Timer
- id: reactiontimer
- category: fun
- plan: free
- needs: none
- what: Screen turns red, then green after a random delay. Tap as soon as it is green to get your time in ms, with best and average of the last 5 saved.
- test:
  1. Tap to start: the pad turns red (Wait...). After 1.5-4.7 s it turns green; tap and your time in ms shows (about 200-400).
  2. Tap while red: Too soon! with a shake, no result recorded.
  3. Best and Average update after several tries; Reset records clears them.

## Tic-Tac-Toe
- id: tictactoe
- category: fun
- plan: free
- needs: none
- what: Play X and O against an unbeatable minimax phone (choose to play first or second) or against a friend on the same phone. Scoreboard is saved.
- test:
  1. In vs Phone, tap a cell: your X draws with an animation and the phone replies in under a second. Try to win: the best you can get is a draw.
  2. Choose I play O (second): the phone moves first automatically.
  3. 2 Players: taps alternate X and O; a win highlights the line and updates the score. Reset score zeroes it.

## Memory Match
- id: memory
- category: fun
- plan: free
- needs: none
- what: Flip cards to find matching emoji pairs on 3x4, 4x4 or 4x5 grids. Counts moves and time and saves the best result per size.
- test:
  1. Tap two cards: matching ones stay up with a green border, others flip back after ~0.7 s.
  2. Timer starts at the first flip; Moves counts pairs tried.
  3. Clear the board: message shows moves and time and Best updates. Changing size starts a new game.

## Scoreboard
- id: scoreboard
- category: fun
- plan: free
- needs: none
- what: Score keeper for any game: add up to 12 players, edit names, tap -1, +1 or add/subtract a custom amount. Leader gets a crown. Saved automatically.
- test:
  1. Tap +1 on Player 1 three times: score 3 with a crown. Tap -1: score 2.
  2. Set the custom amount to 10 and tap + custom: score increases by 10. Rename a player by typing in the name field.
  3. Add player adds a card; the cross removes one. Reset scores zeroes all. Reopen the tool: players and scores remain.
  4. Scores stay within +-999,999,999; the custom amount is limited to 1..9999.

## Magic 8-Ball
- id: eightball
- category: fun
- plan: free
- needs: motion
- what: Ask a question, then shake the phone or tap the ball for one of 20 classic answers shown in the blue window with a shaking animation.
- test:
  1. Tap the ball: it wobbles and a random answer fades into the window with a hint (good / hazy / bad).
  2. Shake the phone: a new answer appears (at most one per 1.5 s).
  3. Where shake sensor access is missing or denied, a message tells you to tap the ball; tapping still works. On iOS an Enable shake button asks for permission.

## RPS Showdown
- id: rps
- category: fun
- plan: free
- needs: none
- what: Rock paper scissors against the phone with a shaking hands animation, win/draw/loss counts and a current and best winning streak (saved).
- test:
  1. Tap a hand: both fists bounce 3 times, then reveal; the message says who won.
  2. Win twice in a row: Streak shows 2; a loss resets it to 0 while Best streak keeps the record.
  3. Reset stats clears everything.

## 2048
- id: g2048
- category: fun
- plan: free
- needs: none
- what: Swipe to slide and merge tiles with smooth sliding and pop animations. Score and best score (saved). Arrow keys also work on desktop.
- test:
  1. Swipe left/right/up/down: tiles slide and equal tiles merge, adding to Score; one new tile appears after each move.
  2. A swipe that changes nothing shakes the board and spawns nothing.
  3. Fill the board with no merges: Game over shows. New game restarts; Best remains after reopening.

## Minesweeper
- id: minesweeper
- category: fun
- plan: free
- needs: none
- what: Classic mine hunting at three sizes. Tap digs, long-press or Flag mode places flags. The first tap is always safe; best times are saved.
- test:
  1. Tap a cell: a safe area opens and the timer starts. Numbers show neighbouring mines.
  2. Long-press a cell (or switch to Flag mode): a flag appears and Left decreases; again removes it.
  3. Tap a mine: all mines show and Boom appears. Clear all safe cells: win message and Best time.

## Snake
- id: snake
- category: fun
- plan: free
- needs: none
- what: Steer a snake with swipes, the on-screen arrow pad or arrow keys to eat apples. Speeds up as you grow; best score saved.
- test:
  1. Tap the board to start; swipe or use the arrows to turn. Eating an apple grows the snake and adds 1.
  2. Pressing the opposite direction does nothing (no instant reversal).
  3. Hit a wall or yourself: Game over with score; tap to play again.

## Sudoku
- id: sudoku
- category: fun
- plan: free
- needs: none
- what: Generates a new Sudoku with exactly one solution at Easy, Medium or Hard. Conflicts show red, a number pad fills cells, hints and a check button help. Best times saved.
- test:
  1. Open: Making a puzzle appears briefly, then a grid. Tap an empty cell and a number: it fills in accent colour.
  2. Enter a duplicate in a row: both cells turn red. Check marks entries that differ from the solution.
  3. Hint fills the selected (or a random) cell. Fill the grid correctly: solved message with time.

## Simon Says
- id: simon
- category: fun
- plan: free
- needs: none
- what: Four coloured pads light up with musical tones in a growing pattern; repeat it from memory. Best round saved.
- test:
  1. Tap Start: the pattern plays (watch and listen), then Your turn.
  2. Repeat correctly: Nice, the pattern grows by one. A wrong tap shakes and shows the round reached.
  3. Best updates to your highest completed round.

## Hangman
- id: hangman
- category: fun
- plan: free
- needs: none
- what: Guess a hidden word from a built-in list of 80 words with a category hint. A gallows drawing builds up with each miss (6 lives). Win/loss and streaks saved.
- test:
  1. Tap letters: correct ones appear in the word and the key turns green; wrong ones turn red, a body part appears and a heart is lost.
  2. Guess the word: You got it and Won increases. Use all 6 lives: the word is revealed in red.
  3. New word starts again.

## Connect Four
- id: connect4
- category: fun
- plan: free
- needs: none
- what: Drop discs and connect four. Play a minimax phone at Easy, Normal or Hard, or two players on one phone. Score saved.
- test:
  1. Tap any column: a red disc falls to the bottom; the phone answers with yellow.
  2. Make four in a row: the winning discs glow and the score updates.
  3. Hard level takes a moment to think; 2 Players alternates red and yellow. Fill the board: Draw.

## Tower of Hanoi
- id: hanoi
- category: fun
- plan: free
- needs: none
- what: Move a stack of 3 to 7 discs to the right peg, one at a time, never a larger disc on a smaller one. Shows minimum moves; best saved.
- test:
  1. Tap the first peg: its top disc lifts; tap another peg: it moves.
  2. Try placing a big disc on a small one: a message says it cannot, and the disc is dropped.
  3. Solve with 3 discs in 7 moves: message says perfect.

## Number Guess
- id: numguess
- category: fun
- plan: free
- needs: none
- what: Guess the secret number from 1 to 50, 100 or 1000 using too-high / too-low hints, a narrowing range bar and a guess history. Best number of tries saved.
- test:
  1. Enter 50 and tap Guess: message says too high or too low and the range bar narrows.
  2. Enter 0 or leave empty: an error shake and message, guess count unchanged.
  3. Guess the number: success message with tries; New number starts over.

## Math Sprint
- id: mathsprint
- category: fun
- plan: free
- needs: none
- what: Answer as many arithmetic questions as possible in 30 seconds with a built-in number pad. Auto-checks when you type enough digits. Three levels, best saved.
- test:
  1. Tap Start and answer using the keypad: right answers advance instantly and increase Score.
  2. A wrong answer shakes, counts as a miss and clears your input.
  3. When the bar runs out Time! shows your score; Best updates per level.

## Truth or Dare
- id: truthdare
- category: fun
- plan: free
- needs: none
- what: Draws a family-friendly truth question or a silly dare from 30 of each, with a card flip animation. Surprise me chooses one randomly.
- test:
  1. Tap Truth: a blue card shows a question. Tap Dare: a red card shows a challenge.
  2. Tap the same button repeatedly: the same card never repeats twice in a row.

## Would You Rather
- id: wyr
- category: fun
- plan: free
- needs: none
- what: Two silly choices at a time from 30 built-in dilemmas. Tap one to pick it, then go to the next question.
- test:
  1. Tap the first option: it grows and the other fades.
  2. Tap Next question: two new options appear and the counter increases.

## Lucky Numbers
- id: lucky
- category: fun
- plan: free
- needs: none
- what: Random number picker with presets for 6 of 49 and 5 of 50 plus 2 stars, or a custom amount from any range up to 1000. Balls pop in one by one, sorted and unique.
- test:
  1. Choose 6 of 49 and tap Draw: six different numbers 1-49 appear in ascending order.
  2. Choose 5/50 + 2: five balls plus two stars (1-12).
  3. Custom: Pick 3 from 1 to 10 gives three different numbers; Pick 20 from 5 is limited to 5.

## Bingo Caller
- id: bingo
- category: fun
- plan: free
- needs: none
- what: Calls bingo numbers 1 to 75 with the B-I-N-G-O letter, shows all called numbers on a board and the last few calls, optionally read aloud. Saved between sessions.
- test:
  1. Tap Call next: a ball with a letter and number animates in; the matching board cell highlights.
  2. Never repeats a number; after 75 a message says all are called.
  3. Enable Read numbers aloud: the number is spoken. New game clears the board.

## Whack-a-Mole
- id: whackamole
- category: fun
- plan: free
- needs: none
- what: Tap moles popping from nine holes for 30 seconds; they appear faster as you score. Best score saved.
- test:
  1. Tap Start: moles pop up randomly. Tap one: it shows a hit and Score increases.
  2. Moles that are not hit hide on their own; at 0 s the game ends with the final score.

## Flappy Tap
- id: flappy
- category: fun
- plan: free
- needs: none
- what: Tap to flap a bird between pipes. Canvas animation with gravity, scoring per pipe and a saved best.
- test:
  1. Tap the game to start; each tap lifts the bird. Passing a pipe adds 1.
  2. Hit a pipe or the ground: Game over; tap after half a second to retry.

## Slide Puzzle
- id: slide15
- category: fun
- plan: free
- needs: none
- what: Classic sliding tile puzzle in 3x3 and 4x4 with smooth tile movement. Shuffles are always solvable. Moves, time and best saved.
- test:
  1. Tap a tile next to the empty space: it slides in. Tapping a far tile shakes it.
  2. Solve the puzzle: message with moves and time. Shuffle starts a new one.

## Lights Out
- id: lightsout
- category: fun
- plan: free
- needs: none
- what: Tap a light to toggle it and its four neighbours; turn them all off. Three difficulty levels, every level is solvable, best moves saved.
- test:
  1. Tap a lit cell: it and its neighbours toggle, Moves increases.
  2. Turn all off: success message; Restart level resets the same pattern, New level generates another.

## Trivia Quiz
- id: quiz
- category: fun
- plan: free
- needs: none
- what: Ten random questions per round from 40 built-in general knowledge questions with four options each. Correct answer shown in green; best score saved.
- test:
  1. Tap an answer: right turns green with Correct, wrong turns red and shows the right answer.
  2. Tap Next 10 times: final score. Play again gives a new random round.

## Finger Chooser
- id: fingers
- category: fun
- plan: free
- needs: none
- what: Everyone holds a finger on the screen; after a 3 second countdown the phone picks 1, 2 or 3 random fingers as the winners.
- test:
  1. Put two or more fingers down: coloured circles follow them and Hold still 3,2,1 counts down.
  2. At the end the winner enlarges and the others fade. Lift all fingers to play again.
  3. Changing the finger count (adding or lifting one) restarts the countdown. With one finger it asks for more.

## Team Maker
- id: teams
- category: fun
- plan: free
- needs: none
- what: Paste names (lines or commas) and split them into 2 to 6 fair random teams. Duplicates are removed and names are remembered.
- test:
  1. Enter Ava, Ben, Chloe, Dev, Eli and choose 2 teams: two cards with 3 and 2 names.
  2. Tap Make teams again: different groupings. Fewer names than teams shows a message.

## Bottle Spinner
- id: bottle
- category: fun
- plan: free
- needs: none
- what: Spin a bottle in the middle of a circle of 2 to 12 numbered seats. It slows to a stop and highlights the seat it points at.
- test:
  1. Choose 6 seats and tap the bottle or Spin: it turns for about 4 s.
  2. The bottle points at the highlighted seat and the message says Seat N.

## Word Scramble
- id: scramble
- category: fun
- plan: free
- needs: none
- what: Unscramble jumbled letters by tapping tiles into slots. Category hint, skip, streak and best streak saved.
- test:
  1. Tap letter tiles in order: letters fill the slots; tap a slot to take a letter back.
  2. Spell it correctly: success message and a new word. A wrong word shakes and clears.
  3. Skip breaks the streak and reveals the word.

