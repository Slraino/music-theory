# Development Notes

Quick reference for adding features and understanding the codebase.

## Adding a New Page

1. **Add section to index.html**:
```html
<section id="myNewPage" class="page-section" style="display: none;">
    <!-- Content -->
</section>
```

2. **Add route to Router in app.js**:
```javascript
this.pages = {
    'my-new-page.html': { id: 'myNewPage', title: 'My Page', showBack: true }
}
```

3. **Create page files** (optional):
- `pages/css/myNewPage.css`
- `pages/js/myNewPage.js`

4. **Add init call in Router.initPage()**:
```javascript
else if (page === 'my-new-page.html') {
    if (typeof initMyNewPage === 'function') initMyNewPage();
}
```

5. **Add cleanup if needed** in Router.cleanupPage():
```javascript
if (typeof cleanupMyNewPage === 'function') cleanupMyNewPage();
```

6. **Add navigation link on home page**

## CSS Utility Classes

### Layout
- `.flex-center` - Center items
- `.flex-column` - Column direction
- `.flex-gap-sm/md/lg` - Gap spacing

### Colors
- `.brand-text` - Brand color
- `.brand-glow` - Text shadow
- `.bg-dark` / `.bg-dark-strong` - Backgrounds

### Borders
- `.brand-border-thin/medium/thick`
- `.rounded-none/sm/md/lg/xl`

### Effects
- `.transition-smooth` - 0.2s
- `.transition-default` - 0.3s
- `.shadow-brand` / `.shadow-brand-glow`

## Config Pattern

Extract magic numbers to config object at file top:

```javascript
const PageConfig = {
    SOME_VOLUME: 0.5,
    SOME_DELAY: 100,
    DEFAULT_VALUE: 'default'
};
```

Then use: `PageConfig.SOME_VOLUME`

## Cleanup Pattern

For pages with audio, timers, or event listeners:

```javascript
function cleanupMyPage() {
    // Stop audio
    if (audioContext) audioContext.close();
    
    // Clear timers
    if (intervalId) clearInterval(intervalId);
    
    // Remove listeners
    element.removeEventListener('click', handler);
    
    // Reset state
    myState = null;
}
```

Register in Router.cleanupPage().

## Error Handling

### Audio
```javascript
try {
    oscillator.start(startTime);
} catch (error) {
    console.warn('Audio failed:', error);
}
```

### Fetch
```javascript
try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
} catch (error) {
    console.error('Fetch failed:', error);
    return fallbackData;
}
```

## IndexedDB Usage

Save setting:
```javascript
await MusicTheoryDB.saveSetting('key', value);
```

Load setting:
```javascript
const value = await MusicTheoryDB.getSetting('key');
```

Load all settings:
```javascript
const settings = await MusicTheoryDB.loadSettings();
```

## File Locations

| Purpose | Location |
|---------|----------|
| Core logic | src/scripts/app.js |
| Global styles | src/styles/app.css |
| Page JS | pages/js/*.js |
| Page CSS | pages/css/*.css |
| JSON data | pages/json/*.json |
| Audio | assets/audio/ |
