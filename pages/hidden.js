import { navigateTo } from '../assets/js/router.js';

// Fake Linux terminal — every command below is a scripted response, not a
// real shell. It only needs to *look* functional (per the requesting user),
// not actually execute anything, so there's no interpreter here on purpose.
const HOSTNAME = 'theman';
const USER = 'guest';
const HOME = `/home/${USER}`;

// A tiny virtual filesystem, just enough for ls/cd/cat/pwd to feel coherent.
const FS = {
    [HOME]: { type: 'dir', children: ['notes.txt', 'secrets', '.bash_history'] },
    [`${HOME}/secrets`]: { type: 'dir', children: ['README.md'] },
    [`${HOME}/notes.txt`]: {
        type: 'file',
        content: '재현 안 되는 버그와 재현되는 나의 실수들에 대한 고찰.\n"...분명 어제는 됐습니다."',
    },
    [`${HOME}/.bash_history`]: {
        type: 'file',
        content: 'sudo rm -rf --no-preserve-root /\ny\n(그 다음 기억이 없음)',
    },
    [`${HOME}/secrets/README.md`]: {
        type: 'file',
        content: '여긴 아무것도 없습니다. 다시 한번 말하지만, 아무것도 없습니다.',
    },
};

function resolvePath(cwd, target) {
    if (!target || target === '~') return HOME;
    const base = target.startsWith('/') ? '/' : cwd;
    const parts = (base === '/' ? target : `${cwd}/${target}`).split('/').filter(Boolean);
    const stack = [];
    for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
    }
    return '/' + stack.join('/');
}

function render(cwd, path) {
    return path.startsWith(HOME) ? '~' + path.slice(HOME.length) : path;
}

const HELP_TEXT = `사용 가능한 명령어:
  ls [dir]      디렉토리 내용 나열
  cd [dir]      디렉토리 이동
  cat <file>    파일 내용 출력
  pwd           현재 경로 출력
  whoami        현재 사용자 출력
  echo <text>   텍스트 출력
  clear         화면 지우기
  sudo <...>    (해봐도 됨)
  exit          시스템 종료`;

export default async function render_page(container) {
    let cwd = HOME;
    const history = [];
    let historyIndex = -1;

    container.innerHTML = `
        <div id="linux-terminal" role="application" aria-label="Fake terminal easter egg">
            <div class="term-titlebar">
                <span class="term-dot term-dot-red"></span>
                <span class="term-dot term-dot-yellow"></span>
                <span class="term-dot term-dot-green"></span>
                <span class="term-titlebar-label">${USER}@${HOSTNAME}: ${render(cwd, cwd)}</span>
            </div>
            <div class="term-body" id="term-body" tabindex="0">
                <div class="term-line">Linux ${HOSTNAME} 6.1.0-fake #1 SMP PREEMPT_DYNAMIC x86_64</div>
                <div class="term-line">이 시스템에 로그인한 적은 없지만 어쨌든 환영합니다.</div>
                <div class="term-line">'help'을 입력하면 사용 가능한 명령어를 볼 수 있습니다.</div>
                <div class="term-line">&nbsp;</div>
                <div id="term-output"></div>
                <div class="term-input-row">
                    <span class="term-prompt">${USER}@${HOSTNAME}:<span class="term-prompt-path">${render(cwd, cwd)}</span>$</span>
                    <input type="text" id="term-input" class="term-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="terminal input">
                </div>
            </div>
        </div>
    `;

    const output = container.querySelector('#term-output');
    const input = container.querySelector('#term-input');
    const body = container.querySelector('#term-body');
    const promptPath = container.querySelector('.term-prompt-path');
    const titleLabel = container.querySelector('.term-titlebar-label');

    function updatePrompt() {
        promptPath.textContent = render(cwd, cwd);
        titleLabel.textContent = `${USER}@${HOSTNAME}: ${render(cwd, cwd)}`;
    }

    function printLine(html, cls = '') {
        const line = document.createElement('div');
        line.className = `term-line ${cls}`.trim();
        line.innerHTML = html;
        output.appendChild(line);
    }

    function printEcho(cmd) {
        printLine(`<span class="term-prompt-echo">${USER}@${HOSTNAME}:${render(cwd, cwd)}$</span> ${escapeHtml(cmd)}`);
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    async function shutdownSequence() {
        input.disabled = true;
        const lines = ['Broadcast message from root@theman:', 'The system is going down for reboot NOW!'];
        for (const l of lines) {
            printLine(l);
            body.scrollTop = body.scrollHeight;
            await new Promise(r => setTimeout(r, 500));
        }
        body.classList.add('term-fade-out');
        await new Promise(r => setTimeout(r, 700));
        history.length = 0;
        navigateTo('/');
    }

    function runCommand(raw) {
        const cmd = raw.trim();
        printEcho(raw);
        if (!cmd) return;

        const [name, ...args] = cmd.split(/\s+/);
        const arg = args.join(' ');

        switch (name) {
            case 'help':
                printLine(escapeHtml(HELP_TEXT).replace(/\n/g, '<br>'));
                break;
            case 'pwd':
                printLine(render(cwd, cwd));
                break;
            case 'whoami':
                printLine(USER);
                break;
            case 'echo':
                printLine(escapeHtml(arg));
                break;
            case 'clear':
                output.innerHTML = '';
                break;
            case 'ls': {
                const target = arg ? resolvePath(cwd, arg) : cwd;
                const node = FS[target];
                if (!node || node.type !== 'dir') {
                    printLine(`ls: cannot access '${escapeHtml(arg || target)}': No such file or directory`, 'term-error');
                } else {
                    printLine(node.children.map(c => {
                        const childPath = `${target}/${c}`;
                        const isDir = FS[childPath] && FS[childPath].type === 'dir';
                        return `<span class="${isDir ? 'term-dir' : 'term-file'}">${c}</span>`;
                    }).join('&nbsp;&nbsp;'));
                }
                break;
            }
            case 'cd': {
                const target = resolvePath(cwd, arg || '~');
                const node = FS[target];
                if (!node || node.type !== 'dir') {
                    printLine(`bash: cd: ${escapeHtml(arg)}: No such file or directory`, 'term-error');
                } else {
                    cwd = target;
                    updatePrompt();
                }
                break;
            }
            case 'cat': {
                if (!arg) { printLine('cat: missing operand', 'term-error'); break; }
                const target = resolvePath(cwd, arg);
                const node = FS[target];
                if (!node) {
                    printLine(`cat: ${escapeHtml(arg)}: No such file or directory`, 'term-error');
                } else if (node.type === 'dir') {
                    printLine(`cat: ${escapeHtml(arg)}: Is a directory`, 'term-error');
                } else {
                    printLine(escapeHtml(node.content).replace(/\n/g, '<br>'));
                }
                break;
            }
            case 'sudo':
                printLine(`${USER} is not in the sudoers file. This incident will be reported.`, 'term-error');
                break;
            case 'exit':
            case 'shutdown':
            case 'reboot':
                shutdownSequence();
                break;
            case 'sl':
                printLine('🚂💨 . . . (기차가 지나갑니다)');
                break;
            default:
                printLine(`bash: ${escapeHtml(name)}: command not found`, 'term-error');
        }
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = input.value;
            if (val.trim()) { history.push(val); }
            historyIndex = history.length;
            input.value = '';
            runCommand(val);
            body.scrollTop = body.scrollHeight;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) { historyIndex--; input.value = history[historyIndex] || ''; }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < history.length - 1) { historyIndex++; input.value = history[historyIndex] || ''; }
            else { historyIndex = history.length; input.value = ''; }
        }
    });

    body.addEventListener('click', () => input.focus());
    input.focus();
}
