# Manga Reader Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable manga reader version with a manga library index, bookshelf, comic detail page, and high-performance vertical reader.

**Architecture:** The backend owns filesystem scanning, SQLite persistence, image serving, and progress APIs. The frontend is rewritten around manga domain pages while keeping Vite/Vue and a responsive web-first UI that can later be wrapped by Capacitor.

**Tech Stack:** Node.js, Express, Sequelize, SQLite, Vue 3, Vite, vue-router, browser APIs for lazy loading.

---

## File Structure

- `backend/db.js`: replace the old menu-first database model with manga domain models while preserving legacy exports where practical.
- `backend/mangaScanner.js`: pure filesystem scanner that converts a manga library directory into comics, chapters, and pages.
- `backend/mangaScanner.test.mjs`: Node test coverage for scanner sorting, cover selection, and image filtering.
- `backend/server.js`: add manga API routes and point SQLite/image library behavior at the new manga model.
- `frontend/src/router/index.js`: route `/`, `/comic/:id`, `/reader/:chapterId`, and keep `/admin` available.
- `frontend/src/services/api.js`: shared API client helpers.
- `frontend/src/views/Bookshelf.vue`: responsive manga bookshelf.
- `frontend/src/views/ComicDetail.vue`: comic detail and chapter list.
- `frontend/src/views/Reader.vue`: vertical chapter reader with page placeholders and lazy image loading.
- `frontend/src/style.css`: global app styling for the new manga UI.

## Tasks

### Task 1: Backend Scanner

- [x] Add scanner tests for comic/chapter/page discovery.
- [x] Implement `scanMangaLibrary`.
- [x] Run backend scanner tests.

### Task 2: Database Models

- [x] Add `Comic`, `Chapter`, `Page`, `ReadingProgress`, `Category`, and `ComicCategory` models.
- [x] Store SQLite at project root `database.sqlite`.
- [x] Preserve legacy model exports during transition.

### Task 3: Backend Manga APIs

- [x] Add scan, list, detail, chapter pages, image, progress, and recent routes.
- [x] Keep legacy admin/image routes available where possible.
- [x] Verify backend starts.

### Task 4: Frontend Reader App

- [x] Add shared API service.
- [x] Replace default route with bookshelf.
- [x] Add comic detail page.
- [x] Add reader page with stable placeholders and lazy loading.
- [x] Keep `/admin` routed to old admin page.

### Task 5: Verification

- [x] Install dependencies.
- [x] Run backend tests.
- [x] Run frontend build.
- [x] Start backend and frontend dev server.
- [x] Open browser and visually verify the app shell.
