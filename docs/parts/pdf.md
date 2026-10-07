## Images to PDF
- id: pdfimages
- category: create
- plan: pro
- needs: storage
- what: Turns up to 60 pictures (120 MB in all) into one PDF. Reorder with up and down buttons, turn single pictures, choose A4, Letter or fit-to-picture pages, a margin, whole-picture or fill-the-page layout, and a quality level (High, Medium, Low) to control file size. Large photos are shrunk to 2400 px on the long side before embedding. The result is shared or saved from the share sheet.
- test:
  1. Open Images to PDF, tap Choose pictures and pick three photos: thumbnails, names and sizes are listed with a total.
  2. Tap the down arrow on picture 1: it moves to position 2. Tap the rotate button on one picture: its thumbnail turns and "turned 90°" shows. Tap the cross on one: it is removed.
  3. Choose A4, margin 10, Medium, tap Make PDF: progress text shows, then a result row with the file size. Tap Share / save, open the PDF: pages are in the listed order, rotated pictures are turned, pages are A4 (landscape for wide pictures).
  4. Switch to "Fit to each picture" with margin 0 and make again: each page has the shape of its picture. Try Low quality: the file is clearly smaller than High.
  5. Edge cases: choose a non-image file (refused with a message); try to add more than 60 pictures (only 60 are kept, a message appears); set margin to 99: the field shows a maximum of 40.

## Merge PDFs
- id: pdfmerge
- category: create
- plan: pro
- needs: storage
- what: Joins several PDF files into one in the order you set with the up and down buttons. Each file may be up to 50 MB and 500 pages; password protected PDFs and files that are not PDFs are refused with a clear message naming the file.
- test:
  1. Open Merge PDFs, tap Choose PDFs and pick two or three PDFs: they are listed with sizes.
  2. Move one file up or down and remove another with the cross: the list follows.
  3. With one file only, tap Merge: "Choose at least two PDFs to merge." appears.
  4. Add a second PDF and tap Merge: progress shows, a result with the total page count appears. Share / save it and open it: the pages follow the list order.
  5. Choose a .txt file: "That is not a PDF file". Choose a password protected PDF and merge: the message names that file and says it is password protected.

## PDF Pages
- id: pdfpages
- category: create
- plan: pro
- needs: storage
- what: Opens one PDF and lists its pages with checkboxes. Extract selected pages, delete selected pages, rotate selected pages by 90, 180 or 270 degrees, move selected pages up or down, or type ranges like 1-3,5,7-9 to make a new PDF of those pages (numbered as in the list). Split into two PDFs at a page number. Changes are kept in the list until you make a PDF.
- test:
  1. Open PDF Pages and open a multi-page PDF: the page count and a list of pages with size show.
  2. Tick pages 2 and 3, tap Extract selected: a result with 2 pages appears; open it and check they are the right pages.
  3. Tick one page, tap Rotate 90° then make "Make PDF of the pages as listed": that page is turned in the new file. Use Move up and Move down with ticked pages: the numbering changes, "(was N)" shows the original number.
  4. Tick a page and tap Delete selected: it leaves the list. Select all and Delete: "That would delete every page" appears.
  5. Type 1-3,5 in the pages box and tap Make PDF of these pages: a 4-page file. Type 5-3, 99, or abc: a clear message each time.
  6. Set Split after page 2 and tap Split into two PDFs: two results, the first with 2 pages, the second with the rest. Open a password protected PDF: refused with a message.

## Text to PDF
- id: pdftext
- category: create
- plan: pro
- needs: storage
- what: Type or paste up to 200,000 characters and save them as a PDF in Helvetica, with an optional bold title, font size 6 to 36, A4 or Letter pages, margins, and line spacing. Lines are wrapped and pages added automatically. Characters the standard font cannot show (emoji, non-Latin letters) become "?" and the tool tells you how many were replaced.
- test:
  1. Open Text to PDF and tap Make PDF with empty text: "Type or paste some text first."
  2. Type a title and a few paragraphs, tap Make PDF, then Share / save: the PDF opens with the bold title and wrapped text.
  3. Paste about 20,000 characters with font size 10: several pages are made and the page count shows in the result.
  4. Type "Hello 😀 世界": the PDF shows "Hello ? ??" and the message says 3 characters were replaced.
  5. Set font size 99 or margin 80: the fields show their limits; Letter size gives Letter pages.
