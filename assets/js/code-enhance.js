// Wraps every markdown code block in a titlebar (macOS dots + copy button).
// The dots used to be a ::before decoration baked into the <pre>; now they're
// real DOM so the titlebar can also host an interactive copy button.

const copyIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

export function enhanceCodeBlocks(root = document) {
    root.querySelectorAll('.markdown-body pre').forEach((pre) => {
        if (pre.closest('.code-block-wrapper')) return; // already enhanced

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const titlebar = document.createElement('div');
        titlebar.className = 'code-titlebar glass-lite';
        titlebar.innerHTML = `
            <span class="code-dots" aria-hidden="true">
                <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
            </span>
            <button type="button" class="copy-code-btn" aria-label="Copy code to clipboard">
                <span class="copy-code-icon">${copyIcon}</span>
                <span class="copy-code-label">Copy</span>
            </button>
        `;

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(titlebar);
        wrapper.appendChild(pre);

        const btn = titlebar.querySelector('.copy-code-btn');
        btn.addEventListener('click', async () => {
            const code = pre.querySelector('code');
            const text = code ? code.innerText : pre.innerText;
            try {
                await navigator.clipboard.writeText(text);
                btn.classList.add('copied');
                btn.querySelector('.copy-code-icon').innerHTML = checkIcon;
                btn.querySelector('.copy-code-label').textContent = 'Copied!';
            } catch (e) {
                btn.classList.add('copy-failed');
                btn.querySelector('.copy-code-label').textContent = 'Failed';
            }
            btn.disabled = true;
            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('copied', 'copy-failed');
                btn.querySelector('.copy-code-icon').innerHTML = copyIcon;
                btn.querySelector('.copy-code-label').textContent = 'Copy';
            }, 1800);
        });
    });
}
