// Single Page App Router
class Router {
    constructor() {
        this.currentPage = 'homePage';
        this.pages = {
            'index.html': { id: 'homePage', title: '', showBack: false },
            'chord-progression.html': { id: 'chordProgressionPage', title: 'Chord Progression', showBack: true },
            'progression-info.html': { id: 'progressionInfoPage', title: 'Progression Detail', showBack: true },
            'music-theory.html': { id: 'musicTheoryPage', title: 'Music Theory', showBack: true },
            'chord-generator.html': { id: 'chordGeneratorPage', title: 'Chord Generator', showBack: true }
        };
    }

    init() {
        // Intercept all navigation links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a.nav-link, a.nav-box-card');
            if (link && link.href) {
                e.preventDefault();
                const href = link.href.split('/').pop().split('?')[0];
                this.navigate(href);
            }
        });

        // Back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.navigate('index.html');
            });
        }

        // Load initial page
        this.loadPage('index.html');
    }

    navigate(page) {
        this.loadPage(page);
        // Only use pushState if not on file:// protocol
        if (window.location.protocol !== 'file:') {
            window.history.pushState({ page }, '', page);
        }
    }

    loadPage(page) {
        const pageConfig = this.pages[page];
        if (!pageConfig) {
            console.error('Page not found:', page);
            return;
        }

        // Hide all pages
        document.querySelectorAll('.page-section').forEach(el => {
            el.style.display = 'none';
        });

        // Show selected page
        const pageEl = document.getElementById(pageConfig.id);
        if (pageEl) {
            pageEl.style.display = 'block';
        }

        // Update header
        document.getElementById('pageTitle').textContent = pageConfig.title;
        
        // Show/hide back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.style.display = pageConfig.showBack ? 'block' : 'none';
        }

        // Hide BOTH control buttons first
        const detailControls = document.getElementById('detailControls');
        const progressionControls = document.getElementById('progressionControls');
        if (detailControls) {
            detailControls.style.display = 'none';
        }
        if (progressionControls) {
            progressionControls.style.display = 'none';
        }
        
        // Show only the appropriate button for this page
        if (page === 'progression-info.html' && detailControls) {
            detailControls.style.display = 'block';
        } else if (page === 'chord-progression.html' && progressionControls) {
            progressionControls.style.display = 'block';
        }

        // Trigger page-specific initialization
        this.initPage(page);

        // Scroll to top
        window.scrollTo(0, 0);

        this.currentPage = page;
    }

    initPage(page) {
        if (page === 'chord-progression.html') {
            if (typeof loadProgressions === 'function') loadProgressions();
        } else if (page === 'progression-info.html') {
            if (typeof loadProgressionDetail === 'function') loadProgressionDetail();
        } else if (page === 'music-theory.html') {
            if (typeof loadTheories === 'function') loadTheories();
        } else if (page === 'chord-generator.html') {
            if (typeof initChordGenerator === 'function') initChordGenerator();
        } else if (page === 'index.html') {
            if (typeof loadSiteDescription === 'function') loadSiteDescription();
        }
    }
}

// Initialize router when DOM is ready
let router;
document.addEventListener('DOMContentLoaded', () => {
    router = new Router();
    router.init();
});

