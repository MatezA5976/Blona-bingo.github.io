document.addEventListener('DOMContentLoaded', function() {
    const authSection = document.getElementById('auth');
    const bingoSection = document.getElementById('bingo');
    const userInfo = document.getElementById('user-info');
    const logoutButton = document.getElementById('logout-button');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const bingoGrid = document.getElementById('bingo-grid');
    const markedInfo = document.getElementById('marked-info');
    const markedCountSpan = document.getElementById('marked-count');
    const currentPointsSpan = document.getElementById('current-points');
    const winMessage = document.getElementById('win-message');
    const leaderboardDiv = document.getElementById('leaderboard');

    let currentUser = null;
    let currentEmail = null;
    let markedItems = new Set();
    let currentPoints = 0;
    let rememberMe = false;

    const items = [
        'Piwko', 'Daj bucha', 'Zatarta skrzynia biegów', 'Wywrotka',
        'Odur', 'Snusik', 'Boomer dzwonek', 'Tabaka',
        'Kłótnia', 'Down', 'Zegar', 'Kichnięcie',
        'Chrapanie', 'Przekleństwa', 'Klima', 'RARE EVENT - Żyd'
    ];

    // Migrate old user data format
    let users = JSON.parse(localStorage.getItem('users') || '{}');
    for (let email in users) {
        if (typeof users[email] === 'string') {
            users[email] = { password: users[email], username: email }; // Fallback username to email
        }
    }
    localStorage.setItem('users', JSON.stringify(users));

    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (savedUser) {
        users = JSON.parse(localStorage.getItem('users') || '{}'); // Reload after migration
        if (users[savedUser] && users[savedUser].password) {
            currentEmail = savedUser;
            currentUser = users[savedUser].username || savedUser; // Fallback if no username
            loadUserData();
            showBingo();
        } else {
            showAuth();
        }
    } else {
        showAuth();
    }

    function validateForm(username, email, password, isLogin = false) {
        if (!isLogin && (!username || username.length < 3)) return 'Nazwa użytkownika musi mieć co najmniej 3 znaki.';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Podaj poprawny email.';
        if (!password || password.length < 4) return 'Hasło musi mieć co najmniej 4 znaki.';
        return null;
    }

    function showAlert(message, type = 'danger') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
        authSection.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }

    function checkWin() {
        const cells = Array.from(bingoGrid.querySelectorAll('.bingo-cell'));
        const markedIndices = cells.map((cell, index) => markedItems.has(cell.dataset.item) ? index : -1).filter(i => i !== -1);

        // Check rows (4x4 grid)
        const rows = [0,4,8,12].map(start => [start, start+1, start+2, start+3]);
        for (let row of rows) {
            if (row.every(idx => markedIndices.includes(idx))) return true;
        }

        // Check columns
        const cols = [[0,4,8,12], [1,5,9,13], [2,6,10,14], [3,7,11,15]];
        for (let col of cols) {
            if (col.every(idx => markedIndices.includes(idx))) return true;
        }

        // Check if all marked
        if (markedItems.size === 16) return true;

        return false;
    }

    function loadUserData() {
        const storedMarked = localStorage.getItem(`marked_${currentEmail}`);
        const storedPoints = localStorage.getItem(`points_${currentEmail}`);
        const lastPlay = localStorage.getItem(`lastPlay_${currentEmail}`);
        if (storedMarked) {
            markedItems = new Set(JSON.parse(storedMarked));
        }
        currentPoints = parseInt(storedPoints) || 0;
        if (lastPlay) {
            const hoursSinceLastPlay = (Date.now() - parseInt(lastPlay)) / (1000 * 60 * 60);
            if (hoursSinceLastPlay > 20) {
                markedItems.clear();
                currentPoints = 0;
                localStorage.setItem(`marked_${currentEmail}`, JSON.stringify([]));
                localStorage.setItem(`points_${currentEmail}`, '0');
                localStorage.setItem(`lastPlay_${currentEmail}`, Date.now().toString());
                showAlert('Bingo zostało zresetowane po 20 godzinach!', 'info');
            }
        } else {
            localStorage.setItem(`lastPlay_${currentEmail}`, Date.now().toString());
        }
        updateGrid();
        updateMarkedInfo();
        if (checkWin()) {
            winMessage.classList.remove('hidden');
        }
    }

    function saveUserData() {
        localStorage.setItem(`marked_${currentEmail}`, JSON.stringify([...markedItems]));
        localStorage.setItem(`points_${currentEmail}`, currentPoints.toString());
        localStorage.setItem(`lastPlay_${currentEmail}`, Date.now().toString());
    }

    function updateLeaderboard() {
        const users = JSON.parse(localStorage.getItem('users') || '{}');
        const leaderboard = Object.entries(users).map(([email, data]) => ({
            name: (data && data.username) ? data.username : email,
            points: parseInt(localStorage.getItem(`points_${email}`) || '0')
        })).sort((a, b) => b.points - a.points).slice(0, 5);
        const html = leaderboard.map((user, index) => `
            <div class="leaderboard-item">
                <span class="leaderboard-rank">#${index + 1} ${user.name}</span>
                <span>${user.points} pkt</span>
            </div>
        `).join('');
        leaderboardDiv.innerHTML = html || '<p class="text-muted">Brak graczy w topce</p>';
    }

    function showBingo() {
        authSection.classList.add('hidden');
        bingoSection.classList.remove('hidden');
        userInfo.innerHTML = `Zalogowany jako: <strong>${currentUser}</strong> | Punkty: ${currentPoints}`;
        logoutButton.classList.remove('hidden');
        const leaderboardCard = document.getElementById('leaderboard-card');
        leaderboardCard.classList.remove('hidden');
        document.getElementById('toggle-leaderboard').textContent = 'Ukryj Topke';
        updateLeaderboard();
    }

    function showAuth() {
        authSection.classList.remove('hidden');
        bingoSection.classList.add('hidden');
        logoutButton.classList.add('hidden');
        markedInfo.classList.add('hidden');
        winMessage.classList.add('hidden');
    }

    function updateGrid() {
        const cells = bingoGrid.querySelectorAll('.bingo-cell');
        cells.forEach(cell => {
            const item = cell.dataset.item;
            if (markedItems.has(item)) {
                cell.classList.add('marked');
            } else {
                cell.classList.remove('marked');
            }
        });
    }

    function updateMarkedInfo() {
        markedCountSpan.textContent = markedItems.size;
        currentPointsSpan.textContent = currentPoints;
        if (markedItems.size > 0) {
            markedInfo.classList.remove('hidden');
        }
    }

    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');

    showRegisterLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
    });

    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
    });

    // Remember me checkbox
    const rememberCheckbox = document.getElementById('remember-me');
    rememberCheckbox.addEventListener('change', function() {
        rememberMe = this.checked;
    });

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const error = validateForm('', email, password, true);
        if (error) {
            showAlert(error);
            return;
        }
        let users = JSON.parse(localStorage.getItem('users') || '{}');
        // Ensure migrated
        if (typeof users[email] === 'string') {
            users[email] = { password: users[email], username: email };
            localStorage.setItem('users', JSON.stringify(users));
        }
        if (users[email] && users[email].password === password) {
            currentEmail = email;
            currentUser = users[email].username || email;
            if (rememberMe) {
                localStorage.setItem('currentUser', email);
                localStorage.setItem('rememberMe', 'true');
            } else {
                sessionStorage.setItem('currentUser', email);
            }
            loadUserData();
            showBingo();
        } else {
            showAlert('Nieprawidłowe dane logowania');
        }
    });

    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const error = validateForm(username, email, password, false);
        if (error) {
            showAlert(error);
            return;
        }
        const users = JSON.parse(localStorage.getItem('users') || '{}');
        if (users[email]) {
            showAlert('Użytkownik już istnieje');
        } else {
            users[email] = { password, username };
            localStorage.setItem('users', JSON.stringify(users));
            localStorage.setItem(`points_${email}`, '0');
            localStorage.setItem(`marked_${email}`, JSON.stringify([]));
            localStorage.setItem(`lastPlay_${email}`, Date.now().toString());
            showAlert('Rejestracja zakończona sukcesem. Możesz się zalogować.', 'success');
            document.getElementById('register-username').value = '';
            document.getElementById('register-email').value = '';
            document.getElementById('register-password').value = '';
            registerCard.classList.add('hidden');
            loginCard.classList.remove('hidden');
        }
    });

    logoutButton.addEventListener('click', function() {
        currentUser = null;
        currentEmail = null;
        markedItems.clear();
        currentPoints = 0;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('currentUser');
        showAuth();
    });

    // Modal confirmation
    let currentCell = null;
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmItemSpan = document.getElementById('confirm-item');
    const confirmPointsSpan = document.getElementById('confirm-points');
    const confirmMarkBtn = document.getElementById('confirm-mark');

    confirmMarkBtn.addEventListener('click', function() {
        if (currentCell) {
            const item = currentCell.dataset.item;
            const points = parseInt(currentCell.dataset.points);
            markedItems.add(item);
            currentPoints += points;
            saveUserData();
            updateGrid();
            updateMarkedInfo();
            updateLeaderboard();
            userInfo.innerHTML = `Zalogowany jako: <strong>${currentUser}</strong> | Punkty: ${currentPoints}`;
            if (checkWin()) {
                winMessage.classList.remove('hidden');
            }
            confirmModal.hide();
            currentCell = null;
        }
    });

    // Add click listeners to bingo cells
    bingoGrid.addEventListener('click', function(e) {
        if (!currentUser) return;
        currentCell = e.target.closest('.bingo-cell');
        if (!currentCell || currentCell.classList.contains('marked')) return;

        const item = currentCell.dataset.item;
        const points = currentCell.dataset.points;
        confirmItemSpan.textContent = item;
        confirmPointsSpan.textContent = points;
        confirmModal.show();
    });

    // Leaderboard Toggle
    const toggleLeaderboardBtn = document.getElementById('toggle-leaderboard');
    const leaderboardCard = document.getElementById('leaderboard-card');
    toggleLeaderboardBtn.addEventListener('click', () => {
        leaderboardCard.classList.toggle('hidden');
        if (leaderboardCard.classList.contains('hidden')) {
            toggleLeaderboardBtn.textContent = 'Pokaż Topke';
        } else {
            toggleLeaderboardBtn.textContent = 'Ukryj Topke';
        }
    });

    // Mobile detection and 3D setup
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    let effectEnabled = !isMobile && (localStorage.getItem('effectEnabled') !== 'false');
    const effectToggle = document.getElementById('effect-toggle');
    const interactiveElements = document.querySelectorAll('.card, .btn, .bingo-cell, .form-control, #effect-toggle');

    function updateEffect() {
        if (effectEnabled) {
            document.body.classList.remove('no-3d');
            if (effectToggle) effectToggle.textContent = '3D';
        } else {
            document.body.classList.add('no-3d');
            if (effectToggle) effectToggle.textContent = '2D';
            interactiveElements.forEach(el => el.style.transform = '');
        }
        localStorage.setItem('effectEnabled', effectEnabled);
    }

    updateEffect();

    if (effectToggle && !isMobile) {
        effectToggle.addEventListener('click', function() {
            effectEnabled = !effectEnabled;
            updateEffect();
        });
    }

    function apply3DTransform(el, e) {
        if (!effectEnabled) return;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const deltaX = (mouseX - centerX) / (rect.width / 2);
        const deltaY = (mouseY - centerY) / (rect.height / 2);
        const rotateX = deltaY * -15;
        const rotateY = deltaX * 15;
        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    }

    function resetTransform(el) {
        if (!effectEnabled) return;
        el.style.transform = '';
    }

    interactiveElements.forEach(el => {
        if (!isMobile) {
            el.addEventListener('mousemove', (e) => apply3DTransform(el, e));
            el.addEventListener('mouseleave', () => resetTransform(el));
        }
    });

    // Starfield Canvas - optimized for mobile (50 stars)
    const numStarsMobile = 50;
    if (!isMobile) {
        const canvas = document.getElementById('starfield');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const stars = [];
        const numStars = 150;
        const maxDistance = 150;
        const repulsionRadius = 100;
        const damping = 0.99;
        const pullForce = 0.005;
        const repulsionForce = 2;

        for (let i = 0; i < numStars; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            stars.push({
                x: x,
                y: y,
                vx: 0,
                vy: 0,
                originalX: x,
                originalY: y,
                size: Math.random() * 2 + 1
            });
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            for (let i = 0; i < stars.length; i++) {
                for (let j = i + 1; j < stars.length; j++) {
                    const dx = stars[i].x - stars[j].x;
                    const dy = stars[i].y - stars[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < maxDistance) {
                        ctx.beginPath();
                        ctx.moveTo(stars[i].x, stars[i].y);
                        ctx.lineTo(stars[j].x, stars[j].y);
                        ctx.stroke();
                    }
                }
            }
            stars.forEach(star => {
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        function update() {
            stars.forEach(star => {
                star.vx *= damping;
                star.vy *= damping;
                const dxOrig = star.originalX - star.x;
                const dyOrig = star.originalY - star.y;
                const origDist = Math.sqrt(dxOrig * dxOrig + dyOrig * dyOrig);
                if (origDist > 1) {
                    star.vx += (dxOrig / origDist) * pullForce;
                    star.vy += (dyOrig / origDist) * pullForce;
                }
                star.x += star.vx;
                star.y += star.vy;
                if (star.x < 0 || star.x > canvas.width) star.vx *= -1;
                if (star.y < 0 || star.y > canvas.height) star.vy *= -1;
            });
        }

        function animate() {
            update();
            draw();
            requestAnimationFrame(animate);
        }

        animate();

        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            stars.forEach(star => {
                const dx = mouseX - star.x;
                const dy = mouseY - star.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < repulsionRadius && distance > 0) {
                    const force = repulsionForce / distance;
                    star.vx += (dx / distance) * force;
                    star.vy += (dy / distance) * force;
                }
            });
        });

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            stars.forEach(star => {
                star.originalX = Math.random() * canvas.width;
                star.originalY = Math.random() * canvas.height;
                star.x = star.originalX;
                star.y = star.originalY;
                star.vx = 0;
                star.vy = 0;
            });
        });
    } else {
        // For mobile, reduce stars or disable if needed
        document.body.style.background = '#000'; // Simple black bg for mobile
    }
});
