# Project Notes (Single Document)

## Status
- Code works.
- Main waste was repeated event listeners (now fixed).
- Cleanup on page change added.

## What I already fixed
- Event listener leak in [pages/js/chordGenerator.js](pages/js/chordGenerator.js).
- Cleanup on navigation in [src/scripts/app.js](src/scripts/app.js).
- Reused one YouTube URL builder in [pages/js/chordGenerator.js](pages/js/chordGenerator.js).

## Optional next fix (if you want)
- Merge duplicated helpers (like `escapeHtml`) into one shared file.

## Simple testing
1) Hover a music title → preview shows and plays.
2) Move away → preview hides.
3) Navigate between pages → no leftover tooltips.
