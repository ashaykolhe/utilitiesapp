## Daily Challenge
- id: dailychal
- category: fun
- plan: free
- needs: storage
- what: One small puzzle per day, chosen from the device date: a word scramble, a number sequence or three quick sums. You get three tries, and a streak counter grows when you solve it on consecutive days. Streak, best streak and today's progress are saved on the device. Solving shows a short confetti burst.
- test:
  1. Open the tool: today's date, a puzzle and "Tries left 3" are shown. Type a wrong answer and tap Check answer: "Not quite, try again" appears, the box shakes and tries drop to 2.
  2. Type the right answer (scramble: the 5-letter word in lowercase or capitals; sums: all three results): "Solved!" appears, the streak shows 1 and the inputs lock.
  3. Leave and reopen the tool: it still shows Solved and the same puzzle (same date gives the same puzzle).
  4. Edge case: leave an input empty and tap Check answer: "Fill in your answer first" and no try is used. Use up all three tries: the correct answer is revealed and the inputs lock.
  5. Change the phone date to the next day and reopen: a new puzzle and 3 tries; the streak from yesterday still shows. Skip a day: the streak shows 0.

## Word Guess
- id: wordguess
- category: fun
- plan: free
- needs: storage
- what: Guess the hidden five-letter word in six tries with an on-screen keyboard (or a hardware keyboard). Tiles carry a tick or dot mark and a stripe pattern as well as colour, a blue/orange palette switch helps colour-blind players, repeated letters are scored correctly, and the result can be shared as an emoji grid. Played, win percent, streaks and a guess distribution are saved. Any five letters are accepted (there is no dictionary check). New word asks first once you have guessed. A short confetti burst celebrates a win (skipped when the phone is set to reduce motion).
- test:
  1. Type five letters with the on-screen keys and tap Enter: the tiles flip and show green (tick), yellow (dot with stripes) or grey; the keyboard keys take the best colour.
  2. Tap Enter with only three letters: "Not enough letters" and the row shakes. Backspace removes a letter.
  3. Win or lose a game: the message appears (the word is revealed on a loss), Share appears and the stats card updates. Tap Share: the share sheet opens or the grid is copied.
  4. Edge case with repeated letters: guess a word with two of the same letter when the answer has one: only one of them is coloured yellow or green, the other stays grey.
  5. Tap the Colours button: the palette switches between green/yellow and blue/orange and the choice is remembered. New word starts a fresh game.
  6. Win a word, then press New word within a second: the old result ("The word was ..." / congratulation) does not appear on the new board and Share stays hidden.

## Mastermind
- id: mastermind
- category: fun
- plan: free
- needs: storage
- what: Crack the secret colour code. After each guess you get black pegs for the right colour in the right place and rings for the right colour in the wrong place. Every colour also has its own symbol so it works without colour vision. Three levels (4 pegs no repeats, 4 pegs with repeats, 5 pegs with 8 colours) and a saved best per level. New game / restart and level changes ask first when a game is in progress, so a stray tap cannot throw it away. A short confetti burst celebrates a win (skipped when the phone is set to reduce motion).
- test:
  1. Tap four colours in the palette, then Guess: a row of black and ring dots appears and the guesses-left counter drops.
  2. Tap a filled slot in the current row: it empties. Clear empties the whole row.
  3. Edge case: tap Guess with an empty slot: "Fill every slot first". On Easy, use the same colour twice: "This level has no repeated colours".
  4. Solve the code: "Cracked it in N guesses" and Best updates. Run out of guesses: the code is revealed.
  5. Switch level: a new game starts and the level is remembered after reopening.

## Peg Solitaire
- id: pegsol
- category: fun
- plan: free
- needs: storage
- what: The classic English peg board: jump a peg over its neighbour into an empty hole to remove the neighbour, and finish with one peg, ideally in the centre. Undo, restart, stuck detection and a saved best (fewest pegs left). Restart asks first once you have jumped. A single peg celebrates with confetti.
- test:
  1. Tap a peg that can jump: it lifts and the landing hole glows. Tap the glowing hole: the peg jumps and the jumped peg disappears; Pegs left drops to 31 and Moves to 1.
  2. Tap Undo: the board returns and Moves drops. Undo is disabled at the start.
  3. Edge case: tap a peg that has no jump: "That peg cannot jump". Tap an empty hole with nothing selected: nothing happens.
  4. Play until no moves remain: a message shows how many pegs are left and Best left updates; Restart resets the board.

## Nonogram
- id: nonogram
- category: fun
- plan: free
- needs: storage
- what: Picross puzzles: use the number clues for each row and column to colour in a hidden picture. 5x5 and 10x10 sizes, built-in pictures or random puzzles, each checked to be solvable by logic alone. Fill and Mark-empty modes, drag to paint, a timer and a saved best time per size. Clear, Next puzzle and size/source changes ask first when you have filled cells. The clock does not count time while the app is in the background. A short confetti burst celebrates a win (skipped when the phone is set to reduce motion).
- test:
  1. Tap cells in Fill mode: they turn the accent colour; tap again to clear. Drag across several cells: they all take the same state as the first cell.
  2. Switch to Mark empty and tap a cell: it shows a cross. Filling an already crossed cell replaces the cross.
  3. Fill the cells so every row and column matches its clues: "Solved in m:ss", the cells pop and Best updates.
  4. Edge case: switch to 10 x 10: the grid and clues fit the screen width without the page scrolling sideways. Clear resets the grid but keeps the puzzle.
  5. Next puzzle loads another picture; Random generates a new puzzle each time.

## Block Stack
- id: blockstack
- category: fun
- plan: free
- needs: storage
- what: A falling-blocks game. Move, rotate and drop the pieces to complete rows; the speed rises with the level. Control by dragging, tapping and swiping on the board or with the on-screen buttons (hold to repeat). Next-piece preview, ghost piece, pause and a saved best score. Drawing falls back to plain squares on an old WebView without rounded rectangles.
- test:
  1. Tap Start: pieces fall. Drag a finger sideways on the board: the piece follows. Tap the board: it rotates. Swipe down quickly: hard drop.
  2. Use the buttons: left, right, rotate, soft drop, hard drop; hold left: the piece repeats moving.
  3. Complete a row: it flashes, disappears, Score and Lines increase; after 10 lines the Level goes up and pieces fall faster.
  4. Tap Pause: the game stops with a Paused overlay; Resume continues. Switch to another app and back: the game is paused.
  5. Edge case: stack to the top: Game over appears with the score; Best updates and survives reopening the tool. Leave the tool mid-game and reopen: the game is idle again and nothing keeps running in the background.
  6. Hold ◀ or ▶ for a moment and release while a piece is falling: the piece keeps falling afterwards (the hold timer used to be able to cancel the game loop).

## Breakout
- id: breakout
- category: fun
- plan: free
- needs: storage
- what: Bounce the ball off your paddle to smash every brick. Drag your finger to steer, three lives, faster balls and more rows each level, with a saved best score. Drawing falls back to plain rectangles on an old WebView.
- test:
  1. Tap Start, then tap the board to launch the ball. Drag left and right: the paddle follows the finger.
  2. The ball bounces off walls, paddle and bricks; hitting a brick removes it and adds points. Where it hits the paddle changes its angle.
  3. Let the ball fall: Lives drop by one and the ball returns to the paddle. At zero lives: Game over and Best updates.
  4. Edge case: clear all bricks: Level increases and a fuller brick wall appears. Tap Pause: the ball freezes; Resume continues.

## Pong
- id: pong
- category: fun
- plan: free
- needs: storage
- what: Table tennis against the phone. Drag your paddle along the bottom, beat the AI paddle at the top to seven points. Three AI levels and a saved count of games won. Drawing falls back to plain rectangles on an old WebView.
- test:
  1. Tap Start: after a short pause the ball is served. Drag left and right: your paddle follows.
  2. Miss the ball: the phone scores; let it pass the AI: you score. First to 7 ends the game with a result message.
  3. Choose Hard: the AI paddle is faster and more accurate than on Easy.
  4. Edge case: switch level mid-game: the game stops and the start overlay returns. Win a game: Games won goes up by 1 and is remembered.

## Dodge
- id: dodge
- category: fun
- plan: free
- needs: motion, storage
- what: Steer a ship left and right to dodge falling rocks and grab stars; it speeds up the longer you survive. Steer by dragging, or switch on tilt steering. The screen stays awake while tilt is on. Saved best score. The steering button always shows its label, also when a saved tilt choice needs a motion permission that is refused or unavailable.
- test:
  1. Tap Start and drag a finger: the ship follows horizontally. Rocks fall; stars add 25 points; surviving adds points every second.
  2. Hit a rock: Crash! with the score; Try again restarts. Best updates.
  3. Tap Steering: tilt. On a phone, tilt left and right: the ship moves. On a device without a tilt sensor or when permission is denied: a message says it is using drag instead and drag still works.
  4. Edge case: Pause, then lock the screen and return: the game is paused, not running behind the overlay.

## Gem Match
- id: gemmatch
- category: fun
- plan: free
- needs: storage
- what: A match-3 puzzle on an 8x8 fruit board: swap neighbours (tap two, or swipe) to line up three or more. Matches clear, gems fall, new ones drop in and cascades score combo bonuses. 30 moves per game, hint button, automatic reshuffle when no moves are left and a saved best. New game asks first once you have used a move.
- test:
  1. Tap a gem then a neighbour that makes a match: they swap, the match clears, gems fall and the score rises; Moves left drops by 1.
  2. Swipe a gem towards a neighbour: it swaps the same way.
  3. Edge case: swap two gems that make no match: they swap back with a shake and no move is used.
  4. Tap Hint: two gems pulse. A chain reaction shows "Combo x2!".
  5. Use all 30 moves: "Out of moves" with the final score and Best updates. New game resets, even while gems are still moving.

## Dots and Boxes
- id: dotsboxes
- category: fun
- plan: free
- needs: storage
- what: Take turns drawing lines between dots; closing the fourth side of a box claims it and gives another go. Play the phone on a 3x3, 4x4 or 5x5 grid at an easy or smart level. Wins are saved. New game and grid changes ask first once lines are drawn. A win shows confetti.
- test:
  1. Tap between two dots: a line appears in your colour and the phone replies after a moment.
  2. Complete a box: it fills with your colour and a Y, and you go again. The phone's boxes use its colour and an M.
  3. Finish the board: the message shows who won and the score; a win adds 1 to Games won.
  4. Edge case: tap a line that is already drawn, or tap while the phone is thinking: nothing happens. Press New game while the phone is thinking: the phone's pending move is cancelled.
  5. Change grid size: a new game of that size starts.

## Reversi
- id: reversi
- category: fun
- plan: free
- needs: storage
- what: Outflank the phone's discs to flip them to your colour (you are black). Legal moves are shown as dots, with a look-ahead AI at three levels, automatic passing when someone cannot move and a saved win record. New game asks first during a game. A win shows confetti.
- test:
  1. At the start, four dots show your legal moves. Tap one: your disc is placed, the flipped discs animate, and the phone replies.
  2. Edge case: tap a square that is not a dot: the board shakes and "Not a legal move" appears.
  3. When one side has no move, the message says so and the other side plays again. When neither can move the game ends with the final count.
  4. Win a game: Games won increases and is remembered. New game restarts, even during the phone's turn.

## Stroop Test
- id: stroop
- category: fun
- plan: free
- needs: storage
- what: A colour-word brain test: tap the button for the colour the word is printed in, not the word it spells. 30 seconds, with the number correct, accuracy and average reaction time; the best result is saved. Time in the background is not taken off the 30-second clock.
- test:
  1. Tap Start: a colour word appears in coloured ink and the 30 second timer runs. Tap the button matching the ink colour: Correct goes up.
  2. Tap a wrong button: the word shakes and no point is scored.
  3. After 30 seconds the word is replaced with the score (correct / total) and the message shows accuracy and average reaction in milliseconds.
  4. Edge case: tap Start and answer nothing: the result shows 0 / 0 and 0% without errors. Beat your best: "new best" shows and persists after reopening.

## Maze Runner
- id: mazerun
- category: fun
- plan: free
- needs: storage
- what: A new random maze every level, always solvable and growing from 8x8 up to 15x15. Swipe or use the arrows to run along the corridors to the flag; the runner stops at junctions and dead ends. Timer and a saved best level. The clock does not count time while the app is in the background. New maze asks first mid-run. Finishing a level shows confetti.
- test:
  1. Swipe in a direction: the runner slides along the corridor until a junction or wall and leaves a trail. The arrow buttons do the same.
  2. Reach the flag: the message shows the time, steps taken and the shortest path; the next, larger maze loads after a moment and Best level updates.
  3. Edge case: swipe into a wall: nothing moves. Restart level returns the runner to the start with the same maze; New maze creates a different one.
  4. The maze fits the screen width at every level (no sideways page scroll).

## Balance Ball
- id: balanceball
- category: fun
- plan: free
- needs: motion, storage
- what: Tilt the phone to roll a ball around an arena, collect stars (they add time) and avoid the moving red mines before the 45 seconds run out. Without a tilt sensor, drag a finger to pull the ball instead. The screen stays awake during play. Saved best score.
- test:
  1. Tap Start (allow motion access if asked). Hold the phone flat and tilt: the ball rolls in the tilt direction. Roll onto the star: Stars increases and time is added.
  2. Touch a mine: the ball flashes red, bounces away and 3 seconds are lost.
  3. Edge case: deny the motion permission or use a desktop browser: the message says no tilt was detected and dragging on the arena pulls the ball.
  4. When time hits zero: "Time!" with the star count, Best updates; Play again restarts. Pause freezes everything.

## 24 Game
- id: game24
- category: fun
- plan: free
- needs: storage
- what: Make exactly 24 from four numbers using + - x and / with each number used once. Every deal is guaranteed solvable, with exact fractions, undo, reset, a hint that shows one solution, a timer and a saved solve count and best time. The clock does not count time while the app is in the background. A solve shows confetti.
- test:
  1. Tap a number, an operator, then another number: the two are replaced by the result. Continue until one card remains.
  2. If the last number is 24: "24! Solved" with the time and Solved increases. If not, a message says what it made; tap Undo to step back.
  3. Edge case: divide by a card with value 0 (for example 5 - 5 then divide by it): "Cannot divide by zero". Divisions can produce fractions that are shown as n / d.
  4. Tap Hint: a working solution is shown. New deals four new numbers; Reset restores the current four.

## Blackjack
- id: blackjack
- category: fun
- plan: free
- needs: storage
- what: Single-player blackjack against the dealer with saved chips: hit, stand or double down. Blackjack pays 3 to 2, the dealer stands on all 17s and aces count as 11 or 1. Chips and best chips are remembered; if you run out you can start again with 1000. Diamonds are drawn in red like hearts (they were black before).
- test:
  1. Tap chip buttons to build a bet (chips shows the amount), then Deal: you get two cards and the dealer shows one with one hidden.
  2. Hit: a card is added and the total updates (soft totals are labelled). Over 21: Bust and you lose the bet. Stand: the dealer reveals and draws to 17.
  3. Double: only available with two cards and enough chips; the bet doubles, you get one card and the hand ends.
  4. Edge case: Deal with no bet: "Place a bet first". A natural 21 pays 3 to 2 (a bet of 10 wins 15). All in then lose: "Out of chips" button restores 1000.
  5. Leave and reopen: the chip total is kept.
  6. Deal several hands: hearts and diamonds are red, spades and clubs black.

## Higher or Lower
- id: hilo
- category: fun
- plan: free
- needs: storage
- what: Will the next card be higher or lower? Build the longest streak you can through a shuffled 52-card deck. Aces are high and equal values are a push. Saved best streak. Diamonds are drawn in red like hearts (they were black before).
- test:
  1. A card is shown face up and the next is face down. Tap Higher or Lower: the next card flips after a moment and the streak goes up when you were right.
  2. A wrong guess ends the game with the final streak; the buttons are disabled until New game.
  3. Edge case: when the next card has the same value, "Same value: a push" appears and the streak is unchanged. Tap the buttons twice quickly: only one guess counts.
  4. Best updates and is remembered after reopening the tool.

## Digit Span
- id: digitspan
- category: fun
- plan: free
- needs: storage
- what: A memory span test: digits flash one at a time, then you type them back forwards or backwards. The sequence grows by one each round; two wrong answers end the run. The best length per mode is saved. The game-over line says how many digits you really remembered in a row (0 if the first round failed).
- test:
  1. Tap Start: three digits flash one by one, then you can type them with the on-screen keypad (or keyboard). The OK button or filling all digits submits.
  2. A correct answer shows the next length (4, 5, ...). A wrong answer shows the right sequence and strikes 1 / 2, then repeats at the same length.
  3. Switch to Backwards: type the sequence in reverse order to be correct.
  4. Edge case: press OK with too few digits: "Need N digits". Change mode while digits are flashing: the sequence stops and the tool resets cleanly. A second strike shows Game over and Best updates.

## Typing Falls
- id: typingfalls
- category: fun
- plan: free
- needs: storage
- what: Words rain down: type each one before it reaches the ground to clear it. The word you are typing is highlighted; words get longer and faster as you level up. Five lives, pause, and a saved best score. Drawing falls back to plain rectangles on an old WebView.
- test:
  1. Tap Start: the keyboard opens and words fall. Type a word's letters: they highlight in the word; finishing it removes the word and adds points.
  2. Edge case: type a letter that no falling word starts with: the box shakes and clears. Capital letters and symbols are ignored.
  3. Let a word reach the bottom: Lives drops by one. At zero: Game over with score and words cleared; Best updates.
  4. After every 10 words the Level goes up. Tap Pause: words freeze and typing is ignored.
