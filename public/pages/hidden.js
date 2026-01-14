export default async function render(container) {
    // 1. 기존 스타일 가리기 및 전용 스타일 주입
    const styleId = 'hidden-page-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            /* Hide Default Header/Footer for Full Immersion */
            header, footer, .theme-toggle { display: none !important; }
            #app { min-height: 100vh; background: #000; overflow: hidden; }
            main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }

            /* Hidden Page Styles */
            #matrix-canvas {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
            }

            #terminal-container {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                max-width: 800px;
                height: 60vh;
                background: rgba(0, 20, 0, 0.85);
                border: 1px solid #33ff33;
                box-shadow: 0 0 20px rgba(51, 255, 51, 0.2);
                z-index: 10;
                padding: 2rem;
                font-family: 'JetBrains Mono', 'Consolas', monospace;
                color: #33ff33;
                overflow-y: auto;
                border-radius: 4px;
                backdrop-filter: blur(5px);
            }

            .typing-line {
                margin-bottom: 1rem;
                font-size: 1.1rem;
                line-height: 1.4;
                text-shadow: 0 0 5px rgba(51, 255, 51, 0.5);
            }

            .cursor {
                display: inline-block;
                width: 10px;
                height: 1.2rem;
                background: #33ff33;
                animation: blink 1s infinite;
                vertical-align: middle;
            }

            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }

            /* Back Button */
            #exit-btn {
                position: absolute;
                bottom: 2rem;
                right: 2rem;
                background: transparent;
                border: 1px solid #33ff33;
                color: #33ff33;
                padding: 0.5rem 1rem;
                font-family: inherit;
                cursor: pointer;
                z-index: 20;
                opacity: 0;
                transition: all 0.5s ease;
            }
            #exit-btn:hover {
                background: #33ff33;
                color: #000;
            }
        `;
        document.head.appendChild(style);
    }

    // 2. HTML 구조 생성
    container.innerHTML = `
        <canvas id="matrix-canvas"></canvas>
        <div id="terminal-container">
            <div id="terminal-content"></div>
        </div>
        <button id="exit-btn">Escape Matrix</button>
    `;

    // 3. Matrix Rain Effect
    const canvas = document.getElementById('matrix-canvas');
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const columns = Math.floor(width / 20);
    const drops = new Array(columns).fill(1);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@#$%^&*()";

    function drawMatrix() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Trail effect
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#0F0';
        ctx.font = '15px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = chars.charAt(Math.floor(Math.random() * chars.length));
            ctx.fillText(text, i * 20, drops[i] * 20);

            if (drops[i] * 20 > height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
        requestAnimationFrame(drawMatrix);
    }

    // Start Animation
    const animId = requestAnimationFrame(drawMatrix);

    // Resize Handler
    const resizeHandler = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeHandler);


    // 4. Terminal Typing Effect
    const messages = [
        "Initializing connection...",
        "Bypassing security protocols...",
        "Accessing hidden repository...",
        "Decrypting data streams...",
        "System check: OK.",
        "----------------------------------------",
        "Welcome, Administrator.",
        "This is the hidden node of IT-Security_Blog.",
        "Here resides the unimplemented future and forgotten past.",
        "----------------------------------------",
        "> Ready for input (Code: RED)"
    ];

    const termContent = document.getElementById('terminal-content');

    async function typeWriter(text) {
        const line = document.createElement('div');
        line.className = 'typing-line';
        termContent.appendChild(line);

        for (let i = 0; i < text.length; i++) {
            line.innerHTML += text.charAt(i);
            // Scroll to bottom
            const container = document.getElementById('terminal-container');
            container.scrollTop = container.scrollHeight;
            await new Promise(r => setTimeout(r, Math.random() * 30 + 10));
        }
    }

    async function runTerminal() {
        for (const msg of messages) {
            await typeWriter(msg);
            await new Promise(r => setTimeout(r, 400));
        }
        // Add cursor at the end
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        termContent.lastChild.appendChild(cursor);

        // Show Exit Button
        const btn = document.getElementById('exit-btn');
        if (btn) btn.style.opacity = '1';
    }

    runTerminal();

    // 5. Cleanup on Exit (중요: 페이지 이동 시 스타일 제거 필요)
    // Router의 cleanup 메커니즘이 없으므로, 뒤로가기 버튼에 로직 추가
    document.getElementById('exit-btn').onclick = (e) => {
        e.preventDefault();
        history.pushState(null, null, '/');
        // Manually trigger router (or reload)
        // Since we don't have direct access to router's handleLocation here easily unless exported,
        // simpler way is to reload or create a custom event.
        // But better way: remove style and use history.
        cleanup();
        window.dispatchEvent(new Event('popstate'));
    };

    // Cleanup function ensures styles are removed when leaving this view
    function cleanup() {
        const style = document.getElementById(styleId);
        if (style) style.remove();
        window.removeEventListener('resize', resizeHandler);
        cancelAnimationFrame(animId);
    }

    // Attach cleanup to navigate away (Router should ideally handle this lifecycle)
    // For now, we rely on the click handler above.
    // *Caveat*: Browser Back button won't trigger cleanup automatically with this simple setup unless we hook into router.
    // Let's modify router instead to handle cleanup if we could, but for now this is a standalone view. 
    // We will attach a mutation observer or simply let the next page overwrite styles (but we used !important).
    // Better: Hook into window 'popstate' to cleanup ourselves.
    window.addEventListener('popstate', cleanup, { once: true });
}
