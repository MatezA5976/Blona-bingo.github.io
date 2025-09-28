import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, query, collection, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyBqlNXCJb0PlMJKb68yOMaPfU4rNfMpWxY",
    authDomain: "logins-d2e98.firebaseapp.com",
    projectId: "logins-d2e98",
    storageBucket: "logins-d2e98.firebasestorage.app",
    messagingSenderId: "590806251041",
    appId: "1:590806251041:web:f061c4d892d47f1411d560"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('Firebase initialized');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');

    // Global click listener for debugging
    document.addEventListener('click', function(e) {
        console.log('Click on:', {
            tag: e.target.tagName,
            id: e.target.id,
            class: e.target.className,
            text: e.target.textContent ? e.target.textContent.trim().substring(0, 50) : '',
            closestForm: e.target.closest('form') ? e.target.closest('form').id : 'none'
        });
    }, true);

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

    console.log('Elements loaded:', { authSection, bingoSection, loginForm, registerForm });

    let currentUser = null;
    let currentUid = null;
    let markedItems = new Set();
    let currentPoints = 0;
    let rememberMe = false;
    let userDocRef = null;

    const items = [
        'Piwko', 'Daj bucha', 'Zatarta skrzynia biegów', 'Wywrotka',
        'Odur', 'Snusik', 'Boomer dzwonek', 'Tabaka',
        'Kłótnia', 'Down', 'Zegar', 'Kichnięcie',
        'Chrapanie', 'Przekleństwa', 'Klima', 'RARE EVENT - Żyd'
    ];

    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? user.uid : 'logged out');
        if (user) {
            currentUid = user.uid;
            userDocRef = doc(db, 'users', currentUid);
            await loadUserData();
            showBingo();
        } else {
            console.log('User logged out - calling showAuth');
            currentUid = null;
            currentUser = null;
            markedItems.clear();
            currentPoints = 0;
            userDocRef = null;
            showAuth();
        }
    });

    // Check remember me for persistent login (Firebase handles session)
    const rememberMeFlag = localStorage.getItem('rememberMe');
    if (rememberMeFlag === 'true') {
        rememberMe = true;
        document.getElementById('remember-me').checked = true;
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

    async function loadUserData() {
        try {
            // Ensure displayName is set if missing
            if (auth.currentUser && !auth.currentUser.displayName) {
                const defaultName = 'Użytkownik';
                await updateProfile(auth.currentUser, { displayName: defaultName });
                console.log('Set default displayName:', defaultName);
            }

            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentUser = data.username || auth.currentUser?.displayName || 'Użytkownik';
                markedItems = new Set(data.marked || []);
                currentPoints = data.points || 0;
                const lastPlay = data.lastPlay;
                if (lastPlay) {
                    const hoursSinceLastPlay = (Date.now() - lastPlay.toMillis()) / (1000 * 60 * 60);
                    if (hoursSinceLastPlay > 20) {
                        markedItems.clear();
                        currentPoints = 0;
                        await updateDoc(userDocRef, { marked: [], points: 0, lastPlay: new Date() });
                        showAlert('Bingo zostało zresetowane po 20 godzinach!', 'info');
                    }
                } else {
                    await updateDoc(userDocRef, { lastPlay: new Date() });
                }
            } else {
                // New user, initialize doc
                currentUser = auth.currentUser?.displayName || 'Użytkownik';
                await setDoc(userDocRef, {
                    username: currentUser,
                    marked: [],
                    points: 0,
                    lastPlay: new Date()
                });
            }
            updateGrid();
            updateMarkedInfo();
            if (checkWin()) {
                winMessage.classList.remove('hidden');
            }
            console.log('Loaded user:', currentUser);
        } catch (error) {
            console.error('Error loading user data:', error);
            currentUser = auth.currentUser?.displayName || 'Użytkownik';
            showAlert('Błąd ładowania danych użytkownika. Używasz domyślnej nazwy: ' + currentUser, 'warning');
        }
    }

    async function saveUserData() {
        try {
            await updateDoc(userDocRef, {
                marked: [...markedItems],
                points: currentPoints,
                lastPlay: new Date()
            });
        } catch (error) {
            console.error('Error saving user data:', error);
            showAlert('Błąd zapisywania danych. Spróbuj ponownie.', 'danger');
        }
    }

    async function updateLeaderboard() {
        try {
            const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(5));
            const querySnapshot = await getDocs(q);
            const leaderboard = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                leaderboard.push({
                    name: data.username || 'Anonim',
                    points: data.points || 0
                });
            });
            const html = leaderboard.map((user, index) => `
                <div class="leaderboard-item">
                    <span class="leaderboard-rank">#${index + 1} ${user.name}</span>
                    <span>${user.points} pkt</span>
                </div>
            `).join('');
            leaderboardDiv.innerHTML = html || '<p class="text-muted">Brak graczy w topce</p>';
            console.log('Leaderboard loaded:', leaderboard);
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            let errorMsg = 'Błąd ładowania topki';
            if (error.code === 'permission-denied') {
                errorMsg += ' - Ustaw w Firebase Console reguły Firestore na allow read, write: if true; (tylko do testów)';
            } else {
                errorMsg += ' - sprawdź konfigurację Firebase.';
            }
            leaderboardDiv.innerHTML = `<p class="text-muted">${errorMsg}</p>`;
        }
    }

function showBingo() {
    authSection.classList.add('hidden');
    bingoSection.classList.remove('hidden');
    if (!currentUser) {
        currentUser = 'Użytkownik';
        console.log('Fallback username set to Użytkownik');
    }
    userInfo.innerHTML = `Zalogowany jako: <strong>${currentUser}</strong> | Punkty: ${currentPoints}`;
    userInfo.classList.remove('hidden');
    userInfo.classList.add('mt-2');
    logoutButton.classList.remove('hidden');
    const leaderboardCard = document.getElementById('leaderboard-card');
    leaderboardCard.classList.remove('hidden');
    document.getElementById('toggle-leaderboard').textContent = 'Ukryj Topke';
    updateLeaderboard();
}

function showAuth() {
    console.log('showAuth called - hiding userInfo');
    authSection.classList.remove('hidden');
    bingoSection.classList.add('hidden');
    logoutButton.classList.add('hidden');
    markedInfo.classList.add('hidden');
    winMessage.classList.add('hidden');
    userInfo.innerHTML = '';
    userInfo.classList.add('hidden');
    userInfo.classList.remove('mt-2');
    console.log('userInfo classes after hide:', userInfo.className);
    console.log('userInfo display style:', window.getComputedStyle(userInfo).display);
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

    console.log('Links loaded:', { showRegisterLink, showLoginLink, loginCard, registerCard });

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function(e) {
            console.log('Register link clicked');
            e.preventDefault();
            if (loginCard && registerCard) {
                loginCard.classList.add('hidden');
                registerCard.classList.remove('hidden');
            }
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', function(e) {
            console.log('Login link clicked');
            e.preventDefault();
            if (registerCard && loginCard) {
                registerCard.classList.add('hidden');
                loginCard.classList.remove('hidden');
            }
        });
    }

    // Remember me checkbox
    const rememberCheckbox = document.getElementById('remember-me');
    if (rememberCheckbox) {
        rememberCheckbox.addEventListener('change', function() {
            rememberMe = this.checked;
            console.log('Remember me changed:', rememberMe);
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            console.log('Login form submitted');
            e.preventDefault();
            const emailInput = document.getElementById('login-username');
            const passwordInput = document.getElementById('login-password');
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const error = validateForm('', email, password, true);
            if (error) {
                showAlert(error);
                return;
            }
            try {
                console.log('Attempting login with:', email);
                await signInWithEmailAndPassword(auth, email, password);
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                }
                // Auth state listener will handle showBingo
            } catch (error) {
                console.error('Login error:', error);
                showAlert('Nieprawidłowe dane logowania');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            console.log('Register form submitted');
            e.preventDefault();
            const usernameInput = document.getElementById('register-username');
            const emailInput = document.getElementById('register-email');
            const passwordInput = document.getElementById('register-password');
            const username = usernameInput ? usernameInput.value.trim() : '';
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const error = validateForm(username, email, password, false);
            if (error) {
                showAlert(error);
                return;
            }
            try {
                console.log('Attempting registration with:', email, username);
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: username });
                showAlert('Rejestracja zakończona sukcesem. Możesz się zalogować.', 'success');
                if (usernameInput) usernameInput.value = '';
                if (emailInput) emailInput.value = '';
                if (passwordInput) passwordInput.value = '';
                if (registerCard && loginCard) {
                    registerCard.classList.add('hidden');
                    loginCard.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Register error:', error);
                if (error.code === 'auth/email-already-in-use') {
                    showAlert('Użytkownik już istnieje');
                } else {
                    showAlert('Błąd rejestracji. Spróbuj ponownie.');
                }
            }
        });

        // Additional click listener on submit button for reliability
        const registerSubmitBtn = registerForm.querySelector('button[type="submit"]');
        if (registerSubmitBtn) {
            registerSubmitBtn.addEventListener('click', function(e) {
                console.log('Register submit button clicked');
                e.preventDefault();
                registerForm.dispatchEvent(new Event('submit'));
            });
        }
    }

    logoutButton.addEventListener('click', async function() {
        console.log('Logout button clicked');
        try {
            await signOut(auth);
            localStorage.removeItem('rememberMe');
            console.log('signOut called successfully');
        } catch (error) {
            console.error('Logout error:', error);
        }
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

    if (effectToggle) {
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
        const damping = 0.95;
        const repulsionForce = 5;
        const mouseRepulsionForce = 8;

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
            // Repulsion between stars
            stars.forEach((star, i) => {
                for (let j = i + 1; j < stars.length; j++) {
                    const other = stars[j];
                    const dx = star.x - other.x;
                    const dy = star.y - other.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < repulsionRadius && distance > 0) {
                        const force = repulsionForce / distance;
                        star.vx += (dx / distance) * force;
                        star.vy += (dy / distance) * force;
                        other.vx -= (dx / distance) * force;
                        other.vy -= (dy / distance) * force;
                    }
                }
            });

            stars.forEach(star => {
                star.vx *= damping;
                star.vy *= damping;
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
                    const force = mouseRepulsionForce / distance;
                    star.vx += (-dx / distance) * force;
                    star.vy += (-dy / distance) * force;
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
