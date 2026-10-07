## Magnifier
- id: magnifier
- category: camera
- plan: free
- needs: camera
- what: Turns the rear camera into a magnifying glass with a zoom slider (real camera zoom when available, otherwise digital zoom), freeze frame, torch toggle, brightness and contrast sliders, and a button that saves the current view as a picture. When the camera is blocked the message says where to allow it (Settings, Apps, PocketKit, Permissions); the same wording is used by every camera tool.
- test:
  1. Open the tool and allow the camera. Expected: a live rear-camera view appears.
  2. Drag Zoom to the right. Expected: the view enlarges and the label shows the factor.
  3. Tap Freeze, move the phone, then tap Unfreeze. Expected: the picture stays still while frozen and goes live again after.
  4. Tap Torch (shown only if the phone supports it). Expected: the light switches on and off.
  5. Tap Save. Expected: the share sheet (or a download in a desktop browser) offers a JPEG with the zoom and filters applied.
  6. Deny the camera permission and reopen. Expected: a clear message about permission, no crash.

## Colour Detector
- id: colordetect
- category: camera
- plan: free
- needs: camera
- what: Live camera with a centre crosshair that shows the colour under it as HEX and RGB with the nearest of about 110 named colours. Tap the view to lock a colour, copy the HEX, and keep a history of the last 12 locked colours.
- test:
  1. Open the tool and point the crosshair at a red object. Expected: the swatch, HEX, RGB and a name such as Red or Crimson update live.
  2. Tap the camera view. Expected: a Locked badge appears, values stop changing and the colour is added to the history.
  3. Tap Copy HEX, then paste somewhere. Expected: the HEX value such as #C0392B is pasted.
  4. Tap a history swatch. Expected: its HEX is copied. Tap Clear history. Expected: the list empties.
  5. Leave and reopen the tool. Expected: history is kept. With camera denied, a permission message shows.

## Night Cam
- id: nightcam
- category: camera
- plan: free
- needs: camera
- what: Brightens dark scenes live by boosting brightness, contrast and gamma on a canvas, with an optional green night-vision tint, a torch toggle when supported, and a button to capture a photo at full camera resolution. Brightness, contrast, gamma and the tint are remembered.
- test:
  1. Open the tool in a dim room. Expected: a live, brightened picture with a green tint.
  2. Untick the green tint. Expected: the picture becomes normal colour.
  3. Raise Gamma boost and Brightness. Expected: dark areas get visibly lighter (and noisier).
  4. Tap Capture photo. Expected: a processed JPEG is offered for saving.
  5. Deny the camera. Expected: a clear message, no crash.

## Blank Cam
- id: blankcam
- category: camera
- plan: pro
- needs: camera, microphone
- what: Records video from the front or rear camera while the whole screen is black so recording is discreet. A large dim Stop button ends the recording (automatic stop at 30 minutes), then the video can be previewed and saved or shared. The screen is kept awake while recording. If only the microphone is denied it records video without sound and says so. Leaving the tool mid-recording stops it and offers what was captured to the share sheet. A clear note warns that recording others without consent may be illegal.
- test:
  1. Open the tool. Expected: the legal note about consent is visible.
  2. Choose a camera, keep Record sound ticked and tap Start recording; allow permissions. Expected: the screen goes fully black with a faint timer and a Stop button.
  3. Wait ten seconds, then tap Stop. Expected: the black screen closes and a video player with the file size appears.
  4. Tap Save / share video. Expected: the share sheet or a download of a WebM file.
  5. Untick Record sound and record again, or deny the microphone. Expected: it still records video only or shows a clear message. Leaving the tool mid-recording stops the camera and offers the recording to the share sheet instead of discarding it. Double tapping Start recording starts only one recording.

## Motion Cam
- id: motioncam
- category: camera
- plan: pro
- needs: camera
- what: Watches the camera and detects movement by comparing small frames, ignoring small noise. When enough of the picture changes it beeps and vibrates, and keeps a snapshot with the time in a list for this session only (it is cleared when you leave the tool, so save entries you want). Sensitivity can be changed and the entries can be saved. The screen stays awake while watching.
- test:
  1. As a free user open the tool. Expected: the Pro sheet appears. With Pro, the tool opens.
  2. Point the phone at a still scene and tap Start watching. Expected: Watching badge, level bar near zero, no log entries after the 2 second arming time.
  3. Wave a hand in front of the camera. Expected: a beep and vibration, and a log entry with a thumbnail and the time.
  4. Raise Sensitivity to 10 and move slightly. Expected: it triggers more easily; at 1 only large movement triggers. Repeated motion logs at most once per 3 seconds.
  5. Tap Save on a log entry, then Clear log. Expected: a JPEG is offered; the list empties. Denied camera shows a message.

## Stop Motion
- id: stopmotion
- category: camera
- plan: pro
- needs: camera
- what: Build stop-motion films: capture frames with a see-through onion-skin of the previous frame, delete or reorder frames, play them back at a chosen frames-per-second and export a WebM video recorded from a canvas.
- test:
  1. As a free user open the tool. Expected: the Pro sheet appears. With Pro, the live camera shows.
  2. Tap Capture frame, move the subject slightly, capture again. Expected: each frame appears in the list and the previous frame is faintly overlaid on the live view.
  3. Use the arrows and the cross on a frame. Expected: frames reorder or are removed and the count and duration update.
  4. Set the speed to 4 fps and tap Play. Expected: frames cycle in the preview; Stop returns to the camera.
  5. Tap Export WebM video with at least 2 frames. Expected: a progress count, then a save/share offer of a WebM file. With fewer than 2 frames a message appears.

## Mirror
- id: mirror
- category: camera
- plan: free
- needs: camera
- what: Uses the front camera as a mirror: the picture is flipped like a real mirror, with zoom, brightness, freeze and a switch to the rear camera.
- test:
  1. Open the tool and allow the camera. Expected: your face appears mirrored (raise your right hand, the right side of the screen moves).
  2. Drag Zoom up. Expected: the view enlarges.
  3. Tap Freeze then Unfreeze. Expected: the picture holds still and then resumes.
  4. Tap Use rear camera. Expected: the rear camera shows without mirroring.
  5. Deny the camera. Expected: a clear permission message.

## Code Scanner
- id: codescan
- category: camera
- plan: free
- needs: camera
- what: Scans QR codes (bundled jsQR) and EAN-13, EAN-8, UPC-A, UPC-E and Code 128 product barcodes with the camera or from a picture, using its own built-in decoder that works without the browser's BarcodeDetector (when the phone has BarcodeDetector it is used first). The decoder tries many scanlines, slightly tilted and sideways ones, both directions (upside down) and light-on-dark codes, and checks the check digit. Camera 1D reads must repeat on a second scan before they are accepted. The result card shows the type (for example EAN-13 or UPC-A) and the digits, with Copy and, for http/https text, Open link. A history keeps the last 20; scanning a picture tries several sizes. A Torch button appears when the camera has a torch, for scanning in the dark. Phones with their own scanner show plain format names (QR code, EAN-13) instead of raw names.
- test:
  1. Open the tool and point at a QR code containing https://example.com. Expected: a result card shows QR code and the text, the phone vibrates, and Open link and Copy are available.
  2. Point at the EAN-13 barcode on a product, about 15 to 25 cm away with a little white space around it. Expected: within a second or two the card shows EAN-13 and the 13 digits (UPC-A and 12 digits for US products); turn the product upside down or sideways and it still reads. Copy puts the digits on the clipboard.
  3. Tap Scan again, then scan a Code 128 label or a small EAN-8 code. Expected: scanning resumes and the new type and digits are shown; the history lists them with the newest first.
  4. Tap Scan from a picture and choose a photo or screenshot of a product barcode and then of a QR code. Expected: each is decoded; a picture with no code shows No code found.
  5. Point at a barcode with a wrong digit or at a plain textured surface. Expected: nothing is reported (no wrong or made-up numbers). Check History keeps the last 20 scans and Clear history empties it. Denied camera shows a message.
  6. On a phone with a torch, tap Torch while scanning in a dim room: the light switches on and off.

## Doc Scanner
- id: docscan
- category: camera
- plan: pro
- needs: camera, storage
- what: Take or pick a photo of a page, drag four corners over it, straighten it with a perspective correction, then choose colour, grey or black-and-white (adaptive threshold for uneven light), rotate and save as JPEG or PNG. The Look (colour, grey, black and white) is remembered.
- test:
  1. Tap Take photo (or Pick image) and choose a photo of a sheet of paper taken at an angle. Expected: the photo shows with four draggable circles.
  2. Drag the circles onto the page corners. Expected: the blue outline follows.
  3. Tap Straighten and crop. Expected: a flat, rectangular page appears in black and white.
  4. Switch Look between Colour, Grey and Black and white, and tap Rotate. Expected: the result updates.
  5. Tap Save as JPEG. Expected: the image is offered for saving. Tap Adjust corners to go back and refine.

## Grid Cam
- id: gridcam
- category: camera
- plan: free
- needs: camera, motion
- what: Camera with composition overlays (rule of thirds, 4 by 4 grid, cross, diagonals) and a live horizon line driven by the accelerometer that turns green when the phone is level. Capture a photo with front or rear camera. The chosen grid is remembered. If the phone has no motion sensor (or never sends a reading) the level line is hidden and a message says so, instead of showing a line stuck at 0 degrees.
- test:
  1. Open the tool. Expected: camera view with thirds lines and a yellow horizon line.
  2. Tilt the phone left and right. Expected: the line rotates against the tilt and the angle badge changes; within 1.5 degrees it turns green and says Level.
  3. Change Grid to Cross and None. Expected: the overlay changes.
  4. Tap Capture photo. Expected: a clean photo (no grid drawn in) is offered for saving.
  5. On a device with no motion sensor or denied permission, a message says the level line is off and the camera still works.
  6. On a phone or browser with no motion sensor: after about 2.5 seconds the level line and degree badge disappear and a line says there is no sensor reading.

## Timer Cam
- id: timercam
- category: camera
- plan: free
- needs: camera
- what: Self-timer camera: choose a 3, 5, 10 or 15 second delay and take 1, 3 or 5 shots in a row, with a big on-screen countdown and a beep for the last seconds. Photos collect below and a tap saves each. Delay and number of shots are remembered.
- test:
  1. Set Delay 3 s, Shots 1 and tap Start timer. Expected: a 3, 2, 1 countdown on screen then a thumbnail appears.
  2. Set Shots 3 and start. Expected: three pictures are taken a couple of seconds apart.
  3. Start the timer and tap Cancel mid-countdown. Expected: the countdown stops and no picture is added.
  4. Tap a thumbnail. Expected: the picture is offered for saving.
  5. Switch to the front camera and capture. Expected: the saved photo is mirrored like the preview. Denied camera shows a message.

## Time-lapse
- id: timelapse
- category: camera
- plan: pro
- needs: camera
- what: Captures a frame every 1 to 60 seconds and builds them into a WebM time-lapse video at 8, 12 or 24 fps. Keep the app open and the phone steady; up to 600 frames are kept in memory. Interval and video speed are remembered.
- test:
  1. Choose Every 1 s and tap Start capturing. Expected: the frame counter climbs once per second.
  2. Tap Stop capturing after about 10 frames, then Make video. Expected: progress text, then a video player and a Save / share video button.
  3. Play the video. Expected: the frames play quickly as a time-lapse.
  4. Tap Discard frames. Expected: the counter returns to 0. Make video with under 2 frames shows a message.
  5. Deny the camera. Expected: a clear message.

## Collage
- id: collage
- category: camera
- plan: pro
- needs: storage
- what: Combine up to 9 pictures from the phone into one collage using layouts from two side by side up to 3 by 3, with spacing and background colour, a shuffle button, and save as JPEG. Layout, spacing and background colour are remembered. Before pictures are chosen a line says to pick up to 9.
- test:
  1. Tap Pick pictures and choose 4 photos. Expected: a 2 x 2 collage appears.
  2. Change Layout to 3 across. Expected: the collage re-arranges; with fewer pictures than cells, pictures repeat.
  3. Move Spacing and change Background. Expected: gaps and colour update live.
  4. Tap Shuffle. Expected: the picture order changes.
  5. Tap Save collage. Expected: a JPEG is offered. Pressing Save before picking pictures shows a message.

## Image Shrink
- id: imgshrink
- category: camera
- plan: free
- needs: storage
- what: Reduces picture file size by limiting the longest side and setting JPEG or WebP quality, for many pictures at once, showing the before and after sizes and the percentage saved. Size, format and quality are remembered. A second tap on Shrink pictures while it is working is ignored (it used to double the result list).
- test:
  1. Tap Pick pictures and select 2 large photos. Expected: the count is shown.
  2. Choose 1024 px, JPEG, quality 60 and tap Shrink pictures. Expected: each file is listed with the original and new size and a percentage smaller.
  3. Tap Save on a result. Expected: the smaller file is offered for saving.
  4. Choose Keep size with quality 100 on a small PNG. Expected: it may say no saving instead of failing.
  5. Include a non-image file. Expected: that entry says Could not read this file, others still work.

## Img Convert
- id: imgconvert
- category: camera
- plan: free
- needs: storage
- what: Converts pictures between PNG, JPEG and WebP, for several files at once. Transparent areas become white when saving as JPEG. Format and quality are remembered. A second tap while working is ignored.
- test:
  1. Pick a PNG and convert to JPEG. Expected: a result named like photo.jpg with its size.
  2. Pick a JPEG and convert to PNG. Expected: a larger .png result with the same pixel size.
  3. Convert to WebP. Expected: a .webp file, or a note that the device saved PNG if WebP is unsupported.
  4. Change Quality and convert again to JPEG. Expected: file size changes.
  5. Tap Save on a result. Expected: the file is offered for saving.

## Photo FX
- id: photofx
- category: camera
- plan: pro
- needs: storage
- what: Simple photo editor: look presets (grey, sepia, invert, vivid, cool, warm, soft), brightness, contrast and saturation sliders, rotate and flip, and save at full size as JPEG or PNG. Before a picture is chosen a line says to pick one.
- test:
  1. Tap Pick a picture. Expected: it shows in the preview with its pixel size.
  2. Choose Look grey, then sepia. Expected: the preview changes accordingly.
  3. Move Brightness, Contrast and Saturation. Expected: the preview updates live; Reset restores the original.
  4. Tap Rotate twice and Flip. Expected: the picture turns upside down and mirrors.
  5. Tap Save JPEG. Expected: the edited full-size picture is offered for saving.

## Photo Cleaner
- id: exifclean
- category: camera
- plan: free
- needs: storage
- what: Removes hidden metadata such as GPS location, camera model and time from photos by re-encoding them (pictures over 4096 px on the longest side are scaled down to 4096 px), and tells you whether metadata was found in each JPEG. Nothing is uploaded. JPEGs with XMP, Photoshop/IPTC data or an embedded comment (not EXIF) are reported as "Removed other embedded data" instead of "No metadata found". A second tap while working is ignored.
- test:
  1. Pick a photo taken with the phone camera with location on. Expected: the result says Removed metadata including location.
  2. Tap Save and open the saved file in an EXIF viewer. Expected: no GPS or camera data remains and the picture size is unchanged (unless it was over 4096 px).
  3. Pick a screenshot (PNG). Expected: it says Re-encoded without metadata and saves as PNG.
  4. Pick several photos at once. Expected: each is listed with its own Save button.
  5. Pick a file that is not a picture. Expected: Could not read this file for that item only.

## Eye Dropper
- id: eyedrop
- category: camera
- plan: free
- needs: storage
- what: Pick a picture, touch or drag over it to read any pixel colour as HEX and RGB with the nearest colour name, copy the HEX, and tap one of the six main colours automatically extracted from the picture. Before a picture is chosen the readout says to pick one.
- test:
  1. Tap Pick a picture. Expected: the picture and a ring marker appear, with the centre colour read out.
  2. Touch and drag across the picture. Expected: the ring follows and the swatch, HEX, RGB and name update.
  3. Tap Copy HEX. Expected: the value can be pasted elsewhere.
  4. Tap a main colour swatch. Expected: that colour becomes the selected one.
  5. Pick a very small image. Expected: it still works without errors.

## Pixel Ruler
- id: pixelruler
- category: camera
- plan: free
- needs: camera, storage
- what: Take or pick a photo, drag two points over it to measure the distance in image pixels, then calibrate with an object of known length (a coin or card) to show real units such as mm.
- test:
  1. Tap Take photo or Pick picture and choose a photo containing a credit card. Expected: the photo shows with two circles and a line.
  2. Drag the circles apart. Expected: the pixel distance updates live.
  3. Place the points on the card long edge, enter 85.6 with unit mm, tap Set scale. Expected: the big number now shows about 85.60 mm.
  4. Move the points to another object. Expected: the length is shown in mm.
  5. Tap Clear scale. Expected: it goes back to pixels. Entering no length shows a message.
  6. Known length: -5 is refused, 99999999999 is limited to 1,000,000,000. Choose a non-image file or one over 60 MB in any picture tool: a message says why it was refused.

