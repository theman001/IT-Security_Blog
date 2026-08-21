const VALID_PALETTES = ['noir', 'signal', 'prism'];
const VALID_MODES = ['dark', 'light'];

function getPalette() {
    return document.documentElement.getAttribute('data-palette') || 'noir';
}

function getMode() {
    return document.documentElement.getAttribute('data-mode') || 'dark';
}

function notifyChange() {
    document.dispatchEvent(new CustomEvent('themechange', {
        detail: { palette: getPalette(), mode: getMode() }
    }));
}

function setPalette(palette) {
    if (!VALID_PALETTES.includes(palette)) return;
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('theme', palette);
    updatePaletteButtons(palette);
    notifyChange();
}

function setMode(mode) {
    if (!VALID_MODES.includes(mode)) return;
    document.documentElement.setAttribute('data-mode', mode);
    localStorage.setItem('mode', mode);
    updateModeIcon(mode);
    notifyChange();
}

function updateModeIcon(mode) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const sun = btn.querySelector('.sun-icon');
    const moon = btn.querySelector('.moon-icon');
    if (sun && moon) {
        sun.style.display = mode === 'dark' ? 'none' : 'block';
        moon.style.display = mode === 'dark' ? 'block' : 'none';
    }
    btn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function updatePaletteButtons(palette) {
    document.querySelectorAll('.palette-btn').forEach(btn => {
        const isActive = btn.dataset.palette === palette;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

export function initThemeSwitcher() {
    const modeToggleBtn = document.getElementById('theme-toggle');
    if (modeToggleBtn) {
        updateModeIcon(getMode());
        modeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setMode(getMode() === 'dark' ? 'light' : 'dark');
        });
    } else {
        console.warn('Mode toggle button not found (ID: theme-toggle)');
    }

    document.querySelectorAll('.palette-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setPalette(btn.dataset.palette);
        });
    });
    updatePaletteButtons(getPalette());
}
