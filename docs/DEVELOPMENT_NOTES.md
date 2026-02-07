# Development Notes

Quick reference for adding features and understanding code patterns.

> **For AI assistants:** Read [ARCHITECTURE.md](ARCHITECTURE.md) first for the full picture. This file covers common tasks.

---

## Adding a New Page

### Step 1: Add the HTML section to `index.html`
```html
<section id="myNewPage" class="page-section" style="display: none;">
    <div id="myNewPageContent"></div>
</section>
```

### Step 2: Add the route to Router in `app.js`
Find the `this.pages = { ... }` object inside the Router class and add:
```javascript
'my-new-page.html': { id: 'myNewPage', title: 'My Page', display: 'block', showBack: true }
```

### Step 3: Add init call in `Router.initPage()`
```javascript
else if (page === 'my-new-page.html') {
    if (typeof initMyNewPage === 'function') initMyNewPage();
}
```

### Step 4: Add cleanup if needed in `Router.cleanupPage()`
```javascript
if (typeof cleanupMyNewPage === 'function') cleanupMyNewPage();
```

### Step 5: Create page files (optional)
- `pages/css/myNewPage.css` — Page-specific styles
- `pages/js/myNewPage.js` — Page-specific JavaScript

### Step 6: Link files in `index.html`
```html
<link rel="stylesheet" href="./pages/css/myNewPage.css?v=1.0">
<script src="./pages/js/myNewPage.js" defer></script>
```

### Step 7: Add a navigation card on the home page
Add inside the appropriate category grid in the `#home` section.

---

## Adding a New Button to the Top Bar

If you add an icon-style button (no background), you **must** add `:not(.your-class)` to the THREE global button selectors in `app.css` to prevent it from getting the red crimson background. Search for `button:not(.back-btn)` to find them.

Example — if you add a `.help-btn`:
```css
button:not(.back-btn):not(.settings-btn):not(... existing ...):not(.help-btn) { ... }
```
Do this for all three rules (base, primary, hover).

---

## CSS Variables

All colors and transitions are defined as CSS custom properties on `:root` in `app.css`. Use them everywhere:

```css
color: var(--theme);          /* crimson */
background: var(--bg);        /* #121212 */
background: var(--bg-soft);   /* #1a1a1a */
color: var(--text);           /* #e0e0e0 */
color: var(--text-lebal);     /* #a0a0a0 (muted) */
transition: all var(--transition); /* 0.2s ease */
```

For semi-transparent theme colors:
```css
background: color-mix(in srgb, var(--theme) 30%, transparent);
border-color: color-mix(in srgb, var(--theme) 50%, transparent);
```

---

## Version Cache Busting

When you edit a CSS or JS file, bump its version number in `index.html`:
```html
<!-- Before -->
<link rel="stylesheet" href="./pages/css/profile.css?v=1.1">
<!-- After -->
<link rel="stylesheet" href="./pages/css/profile.css?v=1.2">
```

This forces browsers to re-download the updated file instead of using a stale cached version.

---

## Firebase / Cloud Features

### Adding a new synced setting
1. Add the key to `SYNC_KEYS` in `settings-sync.js`
2. Call `window.cloudSync.saveSettingToCloud('key', value)` wherever the setting changes
3. Handle it in the `applyCloudSettings()` method of `SoundEffects` in `app.js`

### Adding a new Firestore collection
1. Add read/write functions in the appropriate auth module
2. Add security rules in `firestore.rules`
3. Copy updated rules to Firebase Console → Firestore → Rules

### Module bridge (window globals)
Firebase modules use ES6 imports and can't be accessed by regular scripts directly. Communication happens via `window`:
- `window.cloudSync` — Settings sync functions
- `window.renderProfilePage` / `window.renderChatPage` — Page render functions
- `window.cleanupChat` — Chat cleanup
- `window.router` — SPA router instance
- `window.loadUserProfile` — Profile data loader

---

## Chord Progression JSON Format

See [BAR_SYSTEM_GUIDE.md](BAR_SYSTEM_GUIDE.md) for the visual guide.

### Quick summary:
| Scenario | Format |
|----------|--------|
| Simple 4-bar | `["1", "5", "6m", "4"]` |
| Multi-chord in one bar | `["1", ["2", "3"], "4", "5"]` |
| 2+ phrases | Each phrase is its own array, each bar is an array of chords |

### Progression ID format (used in progressionInfo.json):
- Bars separated by `-`
- Chords in same bar separated by `,`
- Example: `"6m,4,5-1-5/7-1"` → Bar 1 has 3 chords, bars 2-4 have 1 each

---

## File Locations Quick Reference

| Purpose | Location |
|---------|----------|
| Core SPA logic | `src/scripts/app.js` |
| Global styles | `src/styles/app.css` |
| Firebase modules | `src/auth/*.js` |
| Page scripts | `pages/js/*.js` |
| Page styles | `pages/css/*.css` |
| JSON content | `pages/json/*.json` |
| Background music | `assets/audio/bgm/` |
| Firestore rules | `firestore.rules` (root) |
| Documentation | `docs/` |

---

## Common Pitfalls

1. **Emoji corruption:** When editing files that contain emoji (like 👤), some tools may corrupt them into `�`. Use Unicode escapes like `\u{1F464}` in JavaScript to be safe.

2. **Button gets red background:** If a new button unexpectedly has a crimson background, you forgot to add its class to the `:not()` exclusion chain in `app.css`. See "Adding a New Button" section above.

3. **Firebase won't work on file://:** Must use `http://` (Live Server or `node server/server.js`). Firebase SDK requires a proper web server.

4. **Chat listener not cleaning up:** Always call `window.cleanupChat()` when navigating away from the chat page, or Firestore listeners will keep running and waste reads.

5. **img onerror on void elements:** `<img>` is a void element — you can't set `this.innerHTML` on it. Use `this.parentElement.innerHTML` or `this.style.display='none'` instead.
