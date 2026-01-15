export default async function render(container) {
    // 1. Inject XP Style (Scoped to prevent leaks, though we hide other elements)
    const styleId = 'xp-desktop-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            /* Hide Default Blog Elements */
            header, footer, .theme-toggle { display: none !important; }
            #app { height: 100vh; overflow: hidden; font-family: 'Tahoma', 'Verdana', sans-serif; }
            main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; height: 100%; }

            /* Desktop Background (With Real Image) */
            #xp-desktop {
                width: 100%;
                height: 100%;
                background-color: #0099cc; /* Fallback */
                background-image: url('/assets/xp/wallpaper.jpg');
                background-size: cover;
                background-position: center;
                position: relative;
                overflow: hidden;
                user-select: none;
            }

            /* Desktop Icons */
            .desktop-icons {
                position: absolute;
                top: 20px;
                left: 20px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                z-index: 10;
            }

            .icon {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 70px;
                cursor: pointer;
                text-align: center;
                color: white;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            }
            
            .icon:hover {
                background-color: rgba(0,0,255,0.2);
                border: 1px solid rgba(255,255,255,0.4);
                border-radius: 4px;
            }

            .icon-img {
                width: 32px;
                height: 32px;
                margin-bottom: 5px;
                background-repeat: no-repeat;
                background-position: center;
                background-size: contain;
            }

            .icon-text {
                font-size: 11px;
                line-height: 1.3;
            }

            /* Windows */
            .window {
                position: absolute;
                width: 400px;
                height: 300px;
                background-color: #ECE9D8; 
                border: 1px solid #0055EA;
                border-radius: 8px 8px 0 0;
                box-shadow: 4px 4px 12px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                z-index: 100;
            }

            .title-bar {
                height: 30px;
                background: linear-gradient(to bottom, #245EDC 0%, #3583F8 3%, #2669EB 100%);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 8px;
                color: white;
                font-weight: bold;
                font-size: 13px;
                text-shadow: 1px 1px 1px black;
                border-radius: 6px 6px 0 0;
                cursor: default;
            }

            .title-bar-controls {
                display: flex;
                gap: 4px;
            }

            .control-btn {
                width: 21px;
                height: 21px;
                border: 1px solid white;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-family: sans-serif;
                cursor: pointer;
                background: linear-gradient(to bottom, #EBC599 0%, #D88E53 100%);
                box-shadow: inset 1px 1px 0 rgba(255,255,255,0.5);
            }

            .close-btn {
                background: linear-gradient(to bottom, #E87A6F 0%, #D34639 100%);
                font-weight: bold;
            }

            .window-content {
                flex: 1;
                padding: 2px;
                background: white;
                border: 1px solid #999;
                margin: 0 3px 3px 3px;
                overflow: auto;
                font-family: 'Tahoma', sans-serif;
                font-size: 12px;
                color: black;
            }

            /* Taskbar */
            #taskbar {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 30px;
                background: linear-gradient(to bottom, #245EDC 0%, #3E8CF8 10%, #245EDC 100%);
                display: flex;
                align-items: center;
                z-index: 9999;
                border-top: 2px solid #3E8CF8;
            }

            #start-btn {
                width: 100px;
                height: 100%;
                background: linear-gradient(to bottom, #3C9F40 0%, #46B44B 100%);
                border-radius: 0 10px 15px 0;
                display: flex;
                align-items: center;
                padding-left: 10px;
                cursor: pointer;
                box-shadow: 2px 0 5px rgba(0,0,0,0.3);
                font-style: italic;
                font-weight: bold;
                color: white;
                font-size: 14px;
                text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
                margin-right: 10px;
                transition: filter 0.2s;
            }
            
            #start-btn:hover {
                 filter: brightness(1.1);
            }

            #start-logo {
                width: 20px;
                height: 20px;
                margin-right: 5px;
                background: url('/assets/xp/icons/start_button.png') no-repeat left center;
                background-size: auto 100%; /* Scale height to fit, trim width */
                filter: drop-shadow(0 0 1px rgba(0,0,0,0.2));
            }

            .taskbar-divider {
                width: 2px;
                height: 20px;
                background: rgba(0,0,0,0.2);
                border-right: 1px solid rgba(255,255,255,0.2);
                margin: 0 5px;
            }
            
            /* App in Taskbar (Not active yet) */
            .taskbar-app {
                width: 150px;
                height: 24px;
                background: #316AC5;
                border-radius: 3px;
                display: flex;
                align-items: center;
                padding: 0 5px;
                color: white;
                font-size: 11px;
                margin-right: 4px;
                cursor: pointer;
                box-shadow: inset 0 0 2px rgba(0,0,0,0.3);
            }
            
            .taskbar-app:hover {
                background: #538AE2;
            }

            .taskbar-app.active {
                background: #1e52b7; /* XP Darker Blue */
                box-shadow: inset 2px 2px 2px rgba(0,0,0,0.4);
            }


            #tray-clock {
                margin-left: auto;
                background: #1168D4;
                padding: 5px 15px;
                color: white;
                font-size: 12px;
                border-left: 1px solid rgba(0,0,0,0.2);
                height: 100%;
                display: flex;
                align-items: center;
                box-shadow: inset 1px 1px 2px rgba(0,0,0,0.2);
            }

            /* Start Menu */
            #start-menu {
                position: absolute;
                bottom: 30px;
                left: 0;
                width: 280px;
                background: white;
                border: 1px solid #0055EA;
                border-radius: 5px 5px 0 0;
                display: none;
                flex-direction: column;
                z-index: 9998;
                box-shadow: 4px 4px 10px rgba(0,0,0,0.4);
            }
            
            #start-menu.active {
                display: flex;
            }

            .start-header {
                background: linear-gradient(to bottom, #245EDC 0%, #3583F8 100%);
                padding: 10px;
                color: white;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 10px;
                border-radius: 4px 4px 0 0;
                height: 48px;
            }
            
            .user-pic {
                width: 48px;
                height: 48px;
                background: url('https://win98icons.alexmeub.com/icons/png/chess-0.png'); /* Placeholder */
                background-size: cover;
                border: 2px solid white;
                border-radius: 4px;
                box-shadow: 1px 1px 2px rgba(0,0,0,0.3);
                position: relative;
                top: 5px;
            }

            .start-items {
                padding: 10px 5px;
                background: white;
                border-left: 5px solid #E3E9F5;
            }

            .start-item {
                padding: 6px 10px;
                display: flex;
                align-items: center;
                gap: 10px;
                color: #333;
                font-size: 12px;
                cursor: pointer;
            }
            
            .start-item .start-icon {
                width: 24px;
                height: 24px;
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
            }
            
            .start-item:hover {
                background-color: #316AC5;
                color: white;
            }
            
            .shutdown {
                border-top: 1px solid #ccc;
                background: linear-gradient(to top, #E59F30 0%, #F5C065 100%); /* XP Orange */
                padding: 8px;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                color: white;
                cursor: pointer;
                gap: 5px;
            }
            .shutdown:hover {
                filter: brightness(1.1);
            }
            
            .shutdown-icon {
                width: 20px;
                height: 20px;
                background: url('https://win98icons.alexmeub.com/icons/png/shut_down_with_computer.png') no-repeat center;
                background-size: contain;
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Play Startup Sound
    const startupSound = new Audio('/assets/xp/startup.mp3');
    startupSound.volume = 0.5;
    startupSound.play().catch(() => { }); // Autoplay might block it

    // 3. Render Desktop
    container.innerHTML = `
        <div id="xp-desktop">
            <div class="desktop-icons">
                <div class="icon" onclick="window.openNotepad()">
                    <div class="icon-img" style="background-image: url('/assets/xp/icons/notepad.ico');"></div>
                    <div class="icon-text">ReadMe.txt</div>
                </div>
                <div class="icon" onclick="window.openBrowser()">
                    <div class="icon-img" style="background-image: url('/assets/xp/icons/internet_explorer.ico');"></div>
                    <div class="icon-text">Internet<br>Explorer</div>
                </div>
                <div class="icon" onclick="window.openMyComputer()">
                    <div class="icon-img" style="background-image: url('/assets/xp/icons/my_computer.ico');"></div>
                    <div class="icon-text">My Computer</div>
                </div>
                <div class="icon" onclick="window.playError()">
                    <div class="icon-img" style="background-image: url('/assets/xp/icons/recycle_bin_empty.ico');"></div>
                    <div class="icon-text">Recycle Bin</div>
                </div>
            </div>
            
            <!-- Start Menu -->
            <div id="start-menu">
                <div class="start-header">
                     <div class="user-pic" style="background-image: url('/assets/xp/icons/user_pic.ico');"></div>
                     <span style="font-size: 14px; margin-left:10px; margin-top: -10px;">Administrator</span>
                </div>
                <div class="start-items">
                     <div class="start-item" onclick="window.openBrowser()">
                        <div class="start-icon" style="background-image: url('/assets/xp/icons/internet_explorer.ico');"></div>
                        <span>Internet Explorer</span>
                     </div>
                     <div class="start-item" onclick="window.openNotepad()">
                        <div class="start-icon" style="background-image: url('/assets/xp/icons/notepad.ico');"></div>
                        <span>Notepad</span>
                     </div>
                     <div class="start-item" onclick="window.playError()">
                        <div class="start-icon" style="background-image: url('/assets/xp/icons/outlook_express.png');"></div>
                        <span>E-mail</span>
                     </div>
                </div>
                <div class="shutdown" id="shutdown-btn">
                     <div class="shutdown-icon"></div>
                     <span>Turn Off Computer</span>
                </div>
            </div>

            <!-- Taskbar -->
            <div id="taskbar">
                <div id="start-btn" onclick="document.getElementById('start-menu').classList.toggle('active')">
                    <div id="start-logo"></div>
                    start
                </div>
                <div class="taskbar-divider"></div>
                <!-- Running apps area -->
                <div id="taskbar-apps" style="display:flex; height:100%; align-items:center;"></div>
                <div id="tray-clock">12:00 PM</div>
            </div>
        </div>
    `;

    // 4. Logic & Handlers
    // 3. Logic (Window Manager)
    let zIndex = 100;

    // Notepad State (Memory Only)
    let notepadContent = `Welcome to the Hidden Node.

You have found the secret backdoor.
This system is running on a legacy kernel simulation.

Feel free to look around, but don't touch the kernel files.

- The Architect`;

    window.playError = () => {
        new Audio('/assets/xp/error.mp3').play().catch(() => { });
        alert('Access Denied: Recycle Bin is corrupted.');
    };

    // Window Management Helpers
    window.focusWindow = (win) => {
        // Bring to front
        win.style.zIndex = ++zIndex;

        // Update Taskbar
        document.querySelectorAll('.taskbar-app').forEach(el => el.classList.remove('active'));
        if (win.taskItem) win.taskItem.classList.add('active');

        // Visuals (Optional: dim inactive title bars could be added here)
    };

    window.toggleWindow = (win) => {
        if (win.style.display === 'none') {
            win.style.display = 'flex';
            window.focusWindow(win);
        } else {
            if (win.taskItem && win.taskItem.classList.contains('active')) {
                // Minimize
                win.style.display = 'none';
                win.taskItem.classList.remove('active');
            } else {
                // Bring to front
                window.focusWindow(win);
            }
        }
    };

    window.minimizeWindow = (btn) => {
        const win = btn.closest('.window');
        win.style.display = 'none';
        if (win.taskItem) win.taskItem.classList.remove('active');
    };

    window.createWindow = function (title, contentHtml, width = 400, height = 300, appId = null) {
        const desktop = document.getElementById('xp-desktop');

        // Prevent multiple instances if appId provided
        if (appId && document.getElementById('win-' + appId)) {
            const win = document.getElementById('win-' + appId);
            if (win.style.display === 'none') win.style.display = 'flex';
            window.focusWindow(win);
            return;
        }

        const win = document.createElement('div');
        win.className = 'window';
        if (appId) win.id = 'win-' + appId;
        win.style.width = width + 'px';
        win.style.height = height + 'px';
        win.style.left = (150 + (zIndex % 10) * 30) + 'px';
        win.style.top = (100 + (zIndex % 10) * 30) + 'px';
        win.style.zIndex = ++zIndex;

        // Taskbar Item
        const taskbar = document.getElementById('taskbar-apps');
        const taskItem = document.createElement('div');
        taskItem.className = 'taskbar-app';
        if (appId) taskItem.id = 'task-' + appId;

        // Determine Icon
        let iconUrl = '';
        if (appId === 'ie') iconUrl = '/assets/xp/icons/internet_explorer.ico';
        else if (appId === 'notepad') iconUrl = '/assets/xp/icons/notepad.ico';
        else if (appId === 'mycomputer') iconUrl = '/assets/xp/icons/my_computer.ico';
        else iconUrl = '/assets/xp/icons/application.png'; // Generic App

        taskItem.innerHTML = `<div style="width:16px; height:16px; margin-right:5px; background:url('${iconUrl}') no-repeat center/contain;"></div><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${title}</span>`;

        // Link objects
        win.taskItem = taskItem;
        taskItem.onclick = () => window.toggleWindow(win);

        taskbar.appendChild(taskItem);

        win.innerHTML = `
            <div class="title-bar" onmousedown="window.startDrag(event, this.parentElement)">
                <div class="title-text" style="display:flex; align-items:center; gap:5px;">
                    <img src="${iconUrl}" style="width:16px; height:16px; pointer-events:none;" onerror="this.style.display='none'"> ${title}
                </div>
                <div class="title-bar-controls">
                    <div class="control-btn" onclick="window.minimizeWindow(this)">_</div>
                    <div class="control-btn" onclick="/* Maximize */">□</div>
                    <div class="control-btn close-btn" onclick="window.closeWindow(this)">X</div>
                </div>
            </div>
            <div class="window-content">
                ${contentHtml}
            </div>
        `;

        win.onmousedown = () => window.focusWindow(win);
        desktop.appendChild(win);

        // Initial Focus
        window.focusWindow(win);
    };

    window.closeWindow = (btn) => {
        const win = btn.closest('.window');
        if (win.taskItem) win.taskItem.remove();
        win.remove();
    };

    window.startDrag = function (e, win) {
        e.preventDefault();
        let shiftX = e.clientX - win.getBoundingClientRect().left;
        let shiftY = e.clientY - win.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            win.style.left = pageX - shiftX + 'px';
            win.style.top = pageY - shiftY + 'px';
        }

        function onMouseMove(event) {
            moveAt(event.pageX, event.pageY);
        }

        document.addEventListener('mousemove', onMouseMove);

        document.onmouseup = function () {
            document.removeEventListener('mousemove', onMouseMove);
            document.onmouseup = null;
        };
    };

    window.openNotepad = () => {
        const content = `
            <div style="display:flex; flex-direction:column; height:100%;">
                <div style="background:#f0f0f0; border-bottom:1px solid #d0d0d0; padding:3px 5px; font-size:11px; display:flex; gap:10px; cursor:default;">
                    <span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span>
                </div>
                <textarea id="notepad-area" style="flex:1; border:none; resize:none; outline:none; font-family:'Lucida Console', monospace; font-size:13px; padding:5px; box-sizing:border-box; overflow:auto;" oninput="window.updateNotepad(this.value)">${notepadContent}</textarea>
            </div>
        `;
        window.createWindow('ReadMe.txt - Notepad', content, 400, 300, 'notepad');
        document.getElementById('start-menu').classList.remove('active');
    };

    window.updateNotepad = (val) => {
        notepadContent = val;
    };

    window.navigateBrowser = (val) => {
        const iframe = document.getElementById('ie-iframe');
        if (iframe) {
            let url = val;
            if (!url.startsWith('http') && !url.startsWith('//')) {
                url = 'https://' + url;
            }
            iframe.src = url;
            // Update input if normalized
            const input = document.getElementById('ie-address');
            if (input) input.value = url;
        }
    };

    window.openBrowser = () => {
        const content = `
            <div style="height:100%; display:flex; flex-direction:column;">
                 <!-- Toolbar -->
                <div style="background:#f0f0f0; padding:2px; border-bottom:1px solid #999;">
                    <div style="display:flex; gap:2px; margin-bottom:2px; padding:2px;">
                        <button style="font-size:11px; padding:2px 5px;">Back</button>
                        <button style="font-size:11px; padding:2px 5px;">Forward</button>
                        <button style="font-size:11px; padding:2px 5px;">Stop</button>
                        <button style="font-size:11px; padding:2px 5px;" onclick="document.getElementById('ie-iframe').src += ''">Refresh</button>
                        <button style="font-size:11px; padding:2px 5px;" onclick="window.navigateBrowser('https://blog.taeuk.o-r.kr/')">Home</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:5px; padding:2px; background:white; border:1px solid #7f9db9; margin:0 2px;">
                        <img src="/assets/xp/icons/internet_explorer.ico" width="16" height="16">
                        <span style="font-size:11px; color:#444;">Address:</span>
                        <input id="ie-address" type="text" value="https://blog.taeuk.o-r.kr/" style="flex:1; border:none; outline:none; font-size:11px;" onkeydown="if(event.key==='Enter') window.navigateBrowser(this.value)">
                        <button style="font-size:11px; padding:0 5px;" onclick="window.navigateBrowser(document.getElementById('ie-address').value)">Go</button>
                    </div>
                </div>
                <iframe id="ie-iframe" src="/" style="flex:1; border:none;"></iframe>
            </div>
        `;
        window.createWindow('Internet Explorer - IT Security Blog', content, 800, 600, 'ie');
        document.getElementById('start-menu').classList.remove('active');
    };

    window.openDriveC = () => {
        const content = `
             <div style="padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 10px;">
                <div style="display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;">
                    <img src="/assets/xp/icons/folder.ico" width="32" height="32">
                    <span style="font-size:11px; margin-top:5px;">Windows</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;">
                    <img src="/assets/xp/icons/folder.ico" width="32" height="32">
                    <span style="font-size:11px; margin-top:5px;">Program Files</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;">
                    <img src="/assets/xp/icons/disk_drive.ico" width="32" height="32">
                    <span style="font-size:11px; margin-top:5px;">autoexec.bat</span>
                </div>
                 <div style="display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;" onclick="window.openNotepad()">
                    <img src="/assets/xp/icons/notepad.png" width="32" height="32">
                    <span style="font-size:11px; margin-top:5px;">ReadMe.txt</span>
                </div>
            </div>
            <div style="position:absolute; bottom:0; left:0; width:100%; padding:5px; background:#ece9d8; border-top:1px solid #d8d8d8; font-size:11px;">
                4 objects (Disk free space: 12.4 GB)
            </div>
        `;
        window.createWindow('Local Disk (C:)', content, 600, 400);
    };

    window.openMyComputer = () => {
        const content = `
            <div style="padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 10px;">
                <div style="display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;" onclick="window.openDriveC()">
                    <img src="/assets/xp/icons/disk_drive.png" width="32" height="32">
                    <span style="font-size:11px; margin-top:5px;">Local Disk (C:)</span>
                </div>
                 <div style="display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;" onclick="alert('Please insert a disk')">
                    <img src="/assets/xp/icons/cd_drive.png" width="32" height="32">
                    <span style="font-size:11px; margin-top:5px;">Audio CD (D:)</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;" onclick="alert('Restricted')">
                    <img src="/assets/xp/icons/control_panel.png" width="32" height="32">
                    <span style="font-size:11px; margin-top:5px;">Control Panel</span>
                </div>
            </div>
            <div style="position:absolute; bottom:0; left:0; width:100%; padding:5px; background:#ece9d8; border-top:1px solid #d8d8d8; font-size:11px;">
                3 objects
            </div>
        `;
        window.createWindow('My Computer', content, 500, 350, 'mycomputer');
        document.getElementById('start-menu').classList.remove('active');
    };

    // Clock
    setInterval(() => {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const el = document.getElementById('tray-clock');
        if (el) el.innerText = time;
    }, 1000);

    // Shutdown Handler
    document.getElementById('shutdown-btn').onclick = (e) => {
        // Play Sound
        new Audio('/assets/xp/shutdown.mp3').play().catch(() => { });

        // Simple Fade Out
        document.body.style.transition = 'opacity 2s';
        document.body.style.opacity = '0';
        setTimeout(() => {
            history.pushState(null, null, '/');
            cleanup();
            document.body.style.opacity = '1';
            location.reload();
        }, 2000); // Wait for sound
    };

    // Initial Apps
    setTimeout(() => window.openNotepad(), 500);

    // Cleanup
    function cleanup() {
        const style = document.getElementById(styleId);
        if (style) style.remove();
        // Remove global handlers if any
        window.createWindow = null;
        window.startDrag = null;
        window.openNotepad = null;
    }
}
