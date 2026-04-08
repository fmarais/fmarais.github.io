# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static one-page marketing site for **xeni CODE**, a software studio. Deployed via GitHub Pages to the custom domain in `CNAME` (`xenicode.app`). There is no build step, no package manager, and no test suite — the repo contains only the files served directly to the browser.

## Stack

Pure vanilla HTML / CSS / JS. No frameworks, no libraries, no bundler. Three source files plus logos in `assets/`:

- `index.html` — single page, sectioned by `id` (`#top`, `#services`, `#work`, `#about`, `#contact`) with anchor-based nav
- `styles.css` — all styling. Design tokens live in `:root` at the top of the file (`--ink`, `--paper`, `--accent`, etc.) — reuse these instead of hardcoding colors
- `script.js` — single IIFE wrapping all behavior; sections are numbered in comments (mobile menu, reveal-on-scroll, stat counters, contact form, year, hero mesh canvas)

## Local preview

Open `index.html` directly in a browser, or serve from the repo root if you need a real HTTP origin (e.g. `python3 -m http.server 8000`).

## Deployment

Pushing to `main` deploys to GitHub Pages automatically. There is no staging environment — verify changes locally first.

## Conventions worth knowing

- **Design language**: dark monochrome wireframe aesthetic. Hairline borders (`--hairline: 1px`), generous whitespace, the mint `--accent` is used *very* sparingly — don't introduce new colors without a strong reason.
- **Reveal animations**: any element given the `.reveal` class is faded in by the IntersectionObserver in `script.js` once it scrolls into view. Add the class to new elements that should animate in; no JS changes needed.
- **Hero canvas** (`#mesh`): the particle/line mesh in `script.js` self-pauses when the hero scrolls out of view or the tab is hidden. It also respects `prefers-reduced-motion` by drawing a single static frame. Preserve both behaviors when editing.
- **Contact form**: client-side only. The submit handler in `script.js` fakes success — there is no backend wired up. If you change the fields, also update the validation block that reads `form.name` / `form.email` / `form.type` / `form.message`.
- **Section numbering**: nav links, section headers, and service cards use `01`–`04`/`05` numbering as a visual motif. Keep numbering consistent across `index.html` if you add or reorder sections.
