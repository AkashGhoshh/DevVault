# DevVault (ai-dump-yard) — Feature Audit & Simplification Report

> **Status:** ✅ Completed. The codebase has been stripped of over-engineered layers and transformed into a clean, minimal baseline.

---

## 1. Feature Status Summary

| # | Feature / Component | Original Status | Action Taken | Current State |
|---|---------------------|:---------------:|:------------:|---------------|
| **1** | **Capability 3-Token Model** (`owner`, `suggest`, `read`) | Over-engineered | ✂️ **Removed** | Replaced with standard numeric `id` / simple share link. |
| **2** | **Peer Suggestion & Review** (`PasteRevision`) | Over-engineered | ✂️ **Removed** | Deleted `PasteRevision.java` & `PasteRevisionRepository.java`. Direct CRUD only. |
| **3** | **Ephemeral Notes & Burn-After-Reading (TTL)** | Over-engineered | ✂️ **Removed** | Deleted `PasteCleanupService.java` & `V2` migration. |
| **4** | **Google Drive Sync & Migration** | Over-engineered | ✂️ **Removed** | Stripped from `storage.js` & removed GAPI/GIS CDN scripts. |
| **5** | **Chrome-Only Folder Picker (File System Access)** | Over-engineered | ✂️ **Removed** | Stripped from `storage.js` & removed `idb-keyval` script. |
| **6** | **In-Browser Prettier Standalone (5 CDN Scripts)** | Over-engineered | ✂️ **Removed** | Removed 5 unpkg parser bundles from `index.html`. |
| **7** | **JSON-to-Grid Dynamic Table Renderer** | Over-engineered | ✂️ **Removed** | Removed 300-line recursive table DOM engine. Clean syntax highlighting kept. |
| **8** | **Server-Sent Events (SSE) Live Notifications** | Over-engineered | ✂️ **Removed** | Deleted `SseNotificationService.java` & event streaming endpoints. |
| **9** | **Bucket4j + Caffeine Rate Limiting Filter** | Over-engineered | ✂️ **Removed** | Deleted `RateLimitingFilter.java` & removed `bucket4j` dependency. |
| **10** | **Stale Backup Files & Root Dumps** | Dead Code | ✂️ **Removed** | Cleaned up `backup_index.html`, `original_app.js`, `maven.zip`. |
| **11** | **Format Document Button & Shortcuts** | Over-engineered | ✂️ **Removed** | Removed `formatDocBtn`, `Ctrl+Shift+F`, and `window.formatDocument`. |
| **12** | **Share Modal & Direct Link Sharing** | Over-engineered | ✂️ **Removed** | Removed `shareBtn`, `#shareModal`, and share dialog logic. |
| **13** | **Preview Left / Right View Scroll Buttons** | Redundant / Over-engineered | ✂️ **Removed** | Removed horizontal scroll buttons and `window.scrollReadSection`. |
| **14** | **Export Feature (PDF, Word, Text & html2pdf.js)** | Over-engineered / Bloat | ✂️ **Removed** | Removed `html2pdf.js` bundle, export dropdown, and export functions. |
| **15** | **Flyway Database Version Control & Migrations** | Over-engineered / Bloat | ✂️ **Removed** | Removed `flyway-core`, `src/main/resources/db/`, switched to standard Hibernate `ddl-auto=update`. |
| **16** | **Caffeine In-Memory Cache & Spring Cache Starter** | Over-engineered | ✂️ **Removed** | Removed `caffeine`, `spring-boot-starter-cache`, `@Cacheable`, `@CacheEvict`. Pure CRUD to embedded DB. |
| **17** | **Dead Code Sweep** (`@EnableScheduling`, `showToast`, `reloadAllNotes`, multipart upload config, `.glass-header`, `toastContainer`) | Dead Code | ✂️ **Removed** | Completely removed across backend, frontend, HTML, and CSS. |

---

## 2. The Current Minimal Baseline

The application is now clean, lightweight, and blazing fast:

### Backend
* **Entity:** `Paste(id, title, content, createdAt, updatedAt)`
* **Repository:** `PasteRepository extends JpaRepository<Paste, Long>`
* **Service:** `PasteService` (create, get, getAll, update, delete)
* **Controller:** `PasteController` (`/api/pastes` REST CRUD)
* **Schema Management:** Clean Hibernate DDL (`ddl-auto=update`) directly derived from `Paste.java`
* **Tests:** 14 unit & integration tests passing (`BUILD SUCCESS`)

### Frontend
* **`storage.js`:** 44 lines of pure, instant `localStorage` persistence.
* **`index.html`:** Clean markup with zero external OAuth/Prettier CDN dependencies.
* **`app.js`:** Clean CodeMirror 6 editor with markdown rendering, syntax highlighting, and cloud sync.
