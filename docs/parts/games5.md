# Arcade games 5 (notes, eight tools)

## Star Defender
- id: invaders
- category: fun
- plan: free
- needs: storage
- what: Space Invaders style shooter. Drag to slide your ship, it fires automatically. Waves of aliens speed up each round, three shields soak shots and you have three lives. Best score is saved on the device.
- test:
  1. Open the tool and tap Start: the ship appears at the bottom and fires by itself. Drag a finger left and right: the ship follows.
  2. Shoot an alien: it disappears and the score rises. Clear the whole wave: "Wave 2" appears with faster aliens and fresh shields.
  3. Get hit by an alien shot: lives drop by one and the ship turns faint for about a second (no rapid flashing).
  4. Tap Pause: the game freezes with a Paused panel; Resume continues. Switch to another app and back: the game is paused.
  5. Lose all lives (or let aliens reach the ship): Game over shows score and best; Play again restarts. Leave the tool: no sound or movement continues.

## Rock Blaster
- id: asteroids
- category: fun
- plan: free
- needs: storage
- what: Asteroids style space shooter. Drag on the screen to point the ship, hold the Thrust button to fly and the ship fires by itself. Big rocks split into medium and small ones, everything wraps around the edges and you have three lives. Best score is saved.
- test:
  1. Tap Start: the ship sits in the middle with rocks drifting. Drag a finger: the ship turns toward the drag direction. Hold Thrust: the ship accelerates and a flame shows; release: it slowly drifts to a stop.
  2. Shoot a large rock: it splits into two medium rocks; shoot those: small ones; shoot a small one: it disappears. Score rises by 20, 50, 100.
  3. Fly off one edge: the ship appears on the opposite edge.
  4. Hit a rock: a life is lost, the ship returns to the centre and is faint for about two seconds.
  5. Clear all rocks: a new wave with more rocks starts away from the ship. Pause and the visibility pause work; Game over shows score and best.

## Road Hopper
- id: hopper
- category: fun
- plan: free
- needs: storage
- what: Frogger style crossing game with endless generated lanes. Swipe in any direction or tap to hop forward across roads full of cars and rivers where you must ride logs. Never more than three hazard lanes in a row, and the screen slowly creeps forward so you cannot stand still. Score is the furthest lane reached.
- test:
  1. Tap Start, then tap the screen: the frog hops one lane forward and the score becomes 1. Swipe left, right and down: the frog hops sideways and back (it cannot go off the bottom of the view).
  2. Hop into a car lane without waiting: the game ends. Wait for a gap and cross: the score keeps rising.
  3. Reach a river: hop onto a log and the frog is carried sideways; hop into water or ride off the edge: game over.
  4. Stand still near the bottom of the screen: the view creeps up and finally catches the frog (game over).
  5. Pause with the button or by leaving the app: traffic freezes. Game over shows score and best; Play again starts new lanes.

## Sprint Runner
- id: runner
- category: fun
- plan: free
- needs: storage
- what: Endless runner with a generated track. Tap to jump, hold to jump higher, swipe down to slide under flying obstacles. Obstacles are always beatable with a plain tap at every speed, and the speed keeps ramping up to a maximum. Score is the distance run.
- test:
  1. Tap Start: the runner moves and cacti approach. Tap: a short jump; tap and hold: a clearly higher jump.
  2. Jump over a cactus: the run continues and the score rises. Run into one: Game over with score and best.
  3. After a few seconds a flying obstacle appears at head height: swipe down to slide under it (tapping to jump into it ends the run).
  4. The speed readout in the corner rises over time and stops at 520 px/s.
  5. Pause and Resume work; leaving and returning to the app pauses. Play again starts from the slow speed.

## Sky Jumper
- id: jumper
- category: fun
- plan: free
- needs: motion, storage
- what: Doodle Jump style endless climb. The jumper bounces automatically; steer left and right by tilting the phone, or by dragging a finger when there is no tilt sensor (a button switches steering and a Flip tilt button fixes a reversed sensor). Springs launch you higher, blue platforms slide and brown ones crumble. Platforms are always spaced so the next one can be reached. The screen is kept awake while you play. Score is the height.
- test:
  1. Tap Start: the jumper bounces up from the bottom platform. Drag a finger left and right: it steers toward the finger. Leave the screen at the left edge: it re-appears on the right.
  2. Tilt the phone left and right: it steers the same way. If it goes the wrong way, tap Flip tilt. Tap Steering to switch to Drag only.
  3. On a device or browser without a motion sensor the button shows "Tilt (waiting)" and dragging still works, with no error.
  4. Land on a spring (red coil): a much higher bounce. Land on a brown platform: it crumbles.
  5. Fall below the screen: Game over with height and best. Pause and leaving the app pause; the screen no longer stays awake after leaving the tool.

## Tower Stack
- id: towerstack
- category: fun
- plan: free
- needs: storage
- what: Tap to drop a sliding block on the tower. Whatever overhangs is cut off and falls away, so the tower narrows. A near-perfect drop snaps into place and grows the block a little. The block slides faster as you climb. Score is the height of the tower.
- test:
  1. Tap Start: a block slides left and right above the tower. Tap: it drops and sticks; the part hanging over the edge falls off and the next block is that narrower width.
  2. Line a block up almost exactly: it snaps, a white outline flashes briefly and the block gets slightly wider; "Perfect x1" shows.
  3. The score and "Height" rise by one for each block and the view scrolls down when the tower gets tall.
  4. Drop a block with no overlap (miss the tower entirely): it falls and Game over shows height and best.
  5. Pause, Resume and the app-switch pause work; Play again restarts with a full-width block.

## Bubble Pop
- id: bubblepop
- category: fun
- plan: free
- needs: storage
- what: Bubble shooter. Drag to aim a dotted guide, release to fire, and bubbles bounce off the side walls and stick. Match three or more of one colour to pop them; any bubbles left hanging from nothing fall for bonus points. A new row drops from the ceiling after a run of misses (the counter is shown), and clearing the board starts a harder level with more colours.
- test:
  1. Tap Start: a board of coloured bubbles hangs from the top. Press and drag: a dotted aim line follows. Release: a bubble flies, bounces off a side wall if aimed that way, and sticks to the board.
  2. Make a group of three or more of the same colour: they pop and the score rises by 10 each. Pop a bubble that holds up others: the loose ones fall and add 20 each.
  3. Miss on purpose a few times: "Drop in" counts down and then a new row appears at the top.
  4. Let the bubbles reach the dashed red line near the bottom: Game over with score and best.
  5. Clear the whole board: "Level 2" starts with a new board. Pause and the app-switch pause work.

## Maze Chase
- id: mazechase
- category: fun
- plan: free
- needs: storage
- what: Maze chase with an original design. Swipe to steer an orange muncher through a freshly generated maze, eat every dot and avoid three bugs that each hunt differently: one chases directly, one ambushes ahead of you and one wanders and only chases when close. Power pellets make the bugs edible for a few seconds with growing bonus points. Levels bring a new maze, faster bugs and a shorter power time.
- test:
  1. Tap Start: after a short pause the muncher moves. Swipe in each direction: it turns at the next opening; swiping the opposite way reverses at once. It never passes through walls.
  2. Eat dots: the score rises by 10 each; a large pellet gives 50 and turns the bugs blue and slower for a few seconds.
  3. Touch a blue bug: it returns to its home and you score 200, then 400 and so on. Touch a normal bug: a life is lost and everyone returns to the start (dots stay eaten).
  4. Lose three lives: Game over with score and best. Eat every dot: "Level 2" begins with a different maze.
  5. Pause with the button or by leaving the app: everything freezes. Blue bugs fade in tone (about one change per second) before they recover.
