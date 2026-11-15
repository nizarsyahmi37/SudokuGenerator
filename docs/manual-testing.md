# Manual accessibility and print checks

Automated tests (axe-core, the contrast audit, Playwright) catch a lot, but they cannot tell whether
something is *pleasant* to use with a screen reader, or whether a printer accepts a file. These checks
need a person. Record each run in the table at the end.

## 1. Screen readers

Test the **Play** tab, the **Make a book** tab, `/privacy` and `/accessibility`.

### VoiceOver (macOS, Safari)
1. Turn on VoiceOver (Cmd+F5). Open the site in Safari.
2. Press VO+U to open the rotor. Check **Headings**: there is one level 1, and the panels have sensible headings.
3. Check **Landmarks**: banner/header, main, complementary (controls), footer navigation.
4. Move into the board. It should say "Sudoku board, grid". Arrow around: each cell should read like
   "Row 3, column 4, empty" or "..., 7, clue". A cell with notes reads "notes 1 3 5".
5. Type a digit, then press Hint. The status message should be announced without moving focus.
6. Make a conflict (same digit twice in a row). The cell should read "conflicts with another number".
7. Use the book builder with only the keyboard: steppers, radio groups (arrows move inside a group),
   file input, Build, Cancel, and the preview page buttons. The progress bar and result message must be announced.

### NVDA (Windows, Firefox and Chrome)
Repeat the same steps. Also check: forms mode switches when you enter the board, the page number field in the
preview is labelled, and the cookie banner (if ads are configured) is announced when it appears.

### VoiceOver (iOS) and TalkBack (Android)
Swipe through the page. Check that the number pad buttons read "5, 3 left to place" and that the
level buttons say what they do ("Starts a new game").

## 2. Zoom, text size and reflow
- **200% browser zoom** at 1280 px wide: nothing overlaps, nothing is cut off, every control still reachable.
- **400% zoom** (320 CSS px): no horizontal scrolling except the board itself is allowed to scale, not scroll.
- **Large text**: set the browser's minimum or default font size to 24 px. Layout must hold.
- **Text spacing**: apply the WCAG 1.4.12 bookmarklet (line height 1.5, letter spacing 0.12 em, word spacing 0.16 em).

## 3. Mobile
- iPhone Safari and Android Chrome, portrait and landscape.
- Touch targets are comfortable (at least 24 CSS px, ideally 44).
- The number pad, notes toggle and hint card work with one hand.
- Switching dark/light in the device settings changes the site when "Match device" is chosen.

## 4. Keyboard and other input
- Tab order follows the visual order. Focus is always visible.
- Skip link works. Escape does not trap focus anywhere.
- Windows High Contrast / forced colours: board, selection, conflicts and buttons are still distinguishable.
- Reduced motion (system setting): no animated backdrop, no particle effects.

## 5. PDF accessibility
Generate the samples first: `WRITE_SAMPLE_PDFS=1 yarn test tests/validation-pdfs.test.ts` writes a digital book, a dark book, a large-print book, a book with a cover picture, a print interior and cover, an ink-saver book and the single-board PDFs to `artifacts/pdfs/`.
Then open that folder in the **veraPDF** desktop app (from verapdf.org; choose the *PDF/UA-1* profile) and read the report. Fix or record every failed rule.

Then by hand, for a digital book and a large-print book:
1. Open in **Adobe Acrobat Reader**. Run *Tools > Accessibility > Full Check*. Review every warning.
2. Open the **Tags** panel: a Document with headings (H1/H2), paragraphs and Figures with alternative text.
3. Use **Read Out Loud** (View > Read Out Loud) from page 1. Order should be cover, how to play, contents, puzzles.
4. Check the **bookmarks** panel matches the contents page.
5. Run the **PAC** checker (PDF Accessibility Checker, Windows) for a second opinion.
6. Test with a screen reader (NVDA + Acrobat or VoiceOver + Preview): the grids should be read through
   their text description ("Row 1: 5, blank, 3, ...").

## 6. Print-ready files
- **Amazon KDP**: upload the interior and the cover. Use their previewer. Check: trim size, bleed shown correctly, nothing
  in the margins flagged, spine text only when the page count allows it, barcode area clear.
- **IngramSpark / Lulu**: choose "all sides" bleed. Check their file checker.
- Print one proof copy. Check the gutter (text is not lost in the binding), that clues and solutions are legible,
  and the large-print edition is comfortable to read.

## Results log

| Date | Tester | Tool / device | Area | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
