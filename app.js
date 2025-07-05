import { html, render } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

// --- STATE MANAGEMENT & MOCK DATABASE ---
class Store {
    constructor() {
        this.state = {
            currentPage: 'login', // login, register, dashboard, contact, admin
            currentUser: null,
            users: JSON.parse(localStorage.getItem('trx_users')) || [],
            bets: JSON.parse(localStorage.getItem('trx_bets')) || [],
            lottery: JSON.parse(localStorage.getItem('trx_lottery')) || {
                day: null,
                night: null,
            },
            theme: localStorage.getItem('trx_theme') || 'dark',
            pendingDeposits: JSON.parse(localStorage.getItem('trx_pending_deposits')) || [],
            pendingWithdrawals: JSON.parse(localStorage.getItem('trx_pending_withdrawals')) || [],
        };
    }

    _commit() {
        localStorage.setItem('trx_users', JSON.stringify(this.state.users));
        localStorage.setItem('trx_bets', JSON.stringify(this.state.bets));
        localStorage.setItem('trx_lottery', JSON.stringify(this.state.lottery));
        localStorage.setItem('trx_theme', this.state.theme);
        localStorage.setItem('trx_pending_deposits', JSON.stringify(this.state.pendingDeposits));
        localStorage.setItem('trx_pending_withdrawals', JSON.stringify(this.state.pendingWithdrawals));
        app.render();
    }
    
    // --- Page Navigation ---
    setCurrentPage(page) {
        if (page === 'admin') {
            const pin = prompt("Ingrese el PIN de administrador:");
            if (pin === 'Luis850214#') {
                this.state.currentPage = 'admin';
            } else {
                showToast('PIN incorrecto', 'error');
                return;
            }
        } else {
            this.state.currentPage = page;
        }
        app.render();
    }

    // --- User Management ---
    register(username, email, password, trxAddress, avatar) {
        if (this.state.users.find(u => u.email === email)) {
            showToast('El correo electrónico ya está registrado.', 'error');
            return false;
        }
        const newUser = {
            id: Date.now(),
            username,
            email,
            password, // In a real app, this would be hashed
            trxAddress,
            avatar,
            balance: 0,
        };
        this.state.users.push(newUser);
        this._commit();
        showToast('Registro exitoso. Ahora puedes iniciar sesión.', 'success');
        return true;
    }

    login(email, password) {
        const user = this.state.users.find(u => u.email === email && u.password === password);
        if (user) {
            this.state.currentUser = user;
            this.setCurrentPage('dashboard');
            return true;
        }
        showToast('Correo electrónico o contraseña incorrectos.', 'error');
        return false;
    }

    logout() {
        this.state.currentUser = null;
        this.setCurrentPage('login');
    }
    
    updateUser(updates) {
        if (!this.state.currentUser) return;
        let user = this.state.users.find(u => u.id === this.state.currentUser.id);
        if (user) {
            Object.assign(user, updates);
            this.state.currentUser = {...user};
            this._commit();
        }
    }

    // --- Betting ---
    placeBet(number, amount, draw) {
        if (!this.state.currentUser) return;

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours * 60 + minutes;
        
        const dayDrawCloseTime = 13 * 60 + 10; // 1:10 PM
        const nightDrawCloseTime = 20 * 60 + 10; // 8:10 PM

        if (draw === 'day' && currentTime >= dayDrawCloseTime) {
            showToast('Las apuestas para el sorteo de día están cerradas.', 'error');
            return;
        }
        if (draw === 'night' && currentTime >= nightDrawCloseTime) {
            showToast('Las apuestas para el sorteo de noche están cerradas.', 'error');
            return;
        }

        if (this.state.currentUser.balance < amount) {
            showToast('Saldo insuficiente.', 'error');
            return;
        }
        
        const bet = {
            id: Date.now(),
            userId: this.state.currentUser.id,
            number,
            amount,
            draw, // 'day' or 'night'
            date: new Date().toISOString().split('T')[0],
            status: 'pending', // pending, win, loss
        };

        this.state.bets.push(bet);
        this.updateUser({ balance: this.state.currentUser.balance - amount });
        showToast(`Apuesta de ${amount} TRX al número ${number} realizada.`, 'success');
        this._commit();
    }
    
    // --- Admin Actions ---
    setWinningNumber(draw, number) {
        this.state.lottery[draw] = number;
        const today = new Date().toISOString().split('T')[0];
        
        // Find bets for this draw and date
        const relevantBets = this.state.bets.filter(b => b.draw === draw && b.date === today && b.status === 'pending');
        
        relevantBets.forEach(bet => {
            const user = this.state.users.find(u => u.id === bet.userId);
            if (!user) return;

            if (bet.number === number) {
                bet.status = 'win';
                user.balance += bet.amount * 10;
            } else {
                bet.status = 'loss';
            }
        });
        
        this._commit();
        showToast(`Número ganador (${draw}) establecido. Premios pagados.`, 'success');
    }

    requestDeposit(amount) {
        if (!this.state.currentUser) return;
        const depositRequest = {
            id: Date.now(),
            userId: this.state.currentUser.id,
            username: this.state.currentUser.username,
            amount,
            status: 'pending'
        };
        this.state.pendingDeposits.push(depositRequest);
        this._commit();
        alert(`--- INSTRUCCIONES DE DEPÓSITO ---\n\nPara completar su depósito, por favor siga estos pasos:\n\n1. Envíe exactamente ${amount} TRX a la siguiente dirección de billetera:\n\n   TAGfZz78D9ekTc7bX3VT4XtuEPCvab1cCK\n\n2. Una vez enviado, el administrador verificará la transacción.\n\n3. Su saldo se actualizará tan pronto como el depósito sea confirmado. Este es un proceso manual y puede tomar algún tiempo.\n\nGracias por su paciencia.`);
    }

    confirmDeposit(depositId) {
        const deposit = this.state.pendingDeposits.find(d => d.id === depositId);
        if (!deposit) return;
        
        const user = this.state.users.find(u => u.id === deposit.userId);
        if (user) {
            user.balance += deposit.amount;
        }
        this.state.pendingDeposits = this.state.pendingDeposits.filter(d => d.id !== depositId);
        this._commit();
        showToast('Depósito confirmado.', 'success');
    }
    
    requestWithdrawal() {
        if (!this.state.currentUser) return;
        const amount = parseFloat(prompt("Ingrese la cantidad a retirar:", this.state.currentUser.balance));
        if (isNaN(amount) || amount <= 0 || amount > this.state.currentUser.balance) {
            showToast('Monto de retiro inválido.', 'error');
            return;
        }

        const withdrawalRequest = {
            id: Date.now(),
            userId: this.state.currentUser.id,
            username: this.state.currentUser.username,
            trxAddress: this.state.currentUser.trxAddress,
            amount,
            status: 'pending'
        };
        this.state.pendingWithdrawals.push(withdrawalRequest);
        this.updateUser({ balance: this.state.currentUser.balance - amount });
        this._commit();
        showToast('Solicitud de retiro enviada.', 'info');
        alert(`--- SOLICITUD DE RETIRO ENVIADA ---\n\nSu solicitud para retirar ${amount} TRX ha sido enviada.\n\nEl administrador procesará su retiro a la dirección:\n${this.state.currentUser.trxAddress}\n\nEste es un proceso manual y será completado a la brevedad posible. Recibirá los fondos directamente en su billetera.`);
    }

    completeWithdrawal(withdrawalId) {
        const request = this.state.pendingWithdrawals.find(w => w.id === withdrawalId);
        if(!request) return;
        
        request.status = 'completed';
        // Logic to actually send crypto would go here in a real app
        // For now, we just update the status. We can filter out completed ones from view.
        this.state.pendingWithdrawals = this.state.pendingWithdrawals.filter(w => w.id !== withdrawalId);
        this._commit();
        showToast('Retiro marcado como completado.', 'success');
    }

    // --- Theme ---
    toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        document.body.className = `${this.state.theme}-theme`;
        this._commit();
    }
}

// --- VIEWS / TEMPLATES (using lit-html) ---
class App {
    constructor(store) {
        this.store = store;
        this.root = document.getElementById('app');
        this.init();
    }
    
    init() {
        // Initial setup
        document.body.className = `${this.store.state.theme}-theme`;
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);

        // Auto logout if user data is cleared
        if (!this.store.state.currentUser && this.store.state.currentPage === 'dashboard') {
            this.store.setCurrentPage('login');
        }
        
        this.render();
    }
    
    handleEvent(e) {
        e.preventDefault();
        const { type, target } = e;
        const action = target.dataset.action;

        if (type === 'submit') {
            const formData = new FormData(target);
            const data = Object.fromEntries(formData.entries());

            switch(target.id) {
                case 'login-form':
                    this.store.login(data.email, data.password);
                    break;
                case 'register-form':
                    if (data.password !== data.confirmPassword) {
                        showToast('Las contraseñas no coinciden.', 'error');
                        return;
                    }
                    if (!data.avatar) {
                        showToast('Por favor, seleccione un avatar.', 'error');
                        return;
                    }
                    const success = this.store.register(data.username, data.email, data.password, data.trxAddress, data.avatar);
                    if (success) this.store.setCurrentPage('login');
                    break;
                case 'bet-form':
                    this.store.placeBet(data.number.padStart(2, '0'), parseInt(data.amount), data.draw);
                    break;
            }
        }

        if (type === 'click' && action) {
            switch(action) {
                case 'navigate':
                    this.store.setCurrentPage(target.dataset.page);
                    break;
                case 'logout':
                    this.store.logout();
                    break;
                case 'toggle-theme':
                    this.store.toggleTheme();
                    break;
                case 'select-avatar':
                    document.querySelectorAll('.avatar-selector img').forEach(img => img.classList.remove('selected'));
                    target.classList.add('selected');
                    document.getElementById('avatar-input').value = target.src;
                    break;
                case 'update-trx':
                    const newAddress = prompt('Ingrese su nueva dirección TRX:', this.store.state.currentUser.trxAddress);
                    if (newAddress) {
                        this.store.updateUser({ trxAddress: newAddress });
                        showToast('Dirección TRX actualizada.', 'success');
                    }
                    break;
                case 'update-avatar':
                    // This is a bit of a hack. We re-route to register page to update avatar.
                    // A dedicated profile edit page would be better in a larger app.
                    // We also need to handle how to get back to the dashboard.
                    this.store.state.isUpdatingAvatar = true;
                    this.store.setCurrentPage('register');
                    break;
                case 'deposit':
                    const amount = parseFloat(prompt('¿Cuánto TRX desea depositar?', '10'));
                    if (!isNaN(amount) && amount > 0) {
                        this.store.requestDeposit(amount);
                    } else {
                        showToast('Monto inválido.', 'error');
                    }
                    break;
                case 'withdraw':
                    this.store.requestWithdrawal();
                    break;
                case 'set-day-winner':
                    const dayNum = prompt('Ingrese el número ganador del día (00-99):');
                    if (dayNum && /^\d{2}$/.test(dayNum)) {
                        this.store.setWinningNumber('day', dayNum);
                    } else { showToast('Número inválido.', 'error'); }
                    break;
                case 'set-night-winner':
                    const nightNum = prompt('Ingrese el número ganador de la noche (00-99):');
                    if (nightNum && /^\d{2}$/.test(nightNum)) {
                        this.store.setWinningNumber('night', nightNum);
                    } else { showToast('Número inválido.', 'error'); }
                    break;
                case 'confirm-deposit':
                    this.store.confirmDeposit(parseInt(target.dataset.id));
                    break;
                case 'complete-withdrawal':
                    this.store.completeWithdrawal(parseInt(target.dataset.id));
                    break;
            }
        }
    }

    // --- Templates ---
    
    avatarsTpl() {
        const avatarFiles = ['avatar1.png', 'avatar2.png', 'avatar3.png', 'avatar4.png', 'avatar5.png', 'avatar6.png'];
        return html`
            <div class="form-group">
                <label><i class="fas fa-user-astronaut"></i> Escoger Avatar</label>
                <div class="avatar-selector">
                    ${avatarFiles.map(file => html`
                        <img src="${file}" alt="Avatar" data-action="select-avatar" @click=${e => this.handleEvent(e)}>
                    `)}
                </div>
                <input type="hidden" id="avatar-input" name="avatar" required>
            </div>
        `;
    }

    loginPageTpl() {
        return html`
        <div id="login-page" class="page ${this.store.state.currentPage === 'login' ? 'active' : ''}">
            <div class="auth-container">
                <img src="logo.png" alt="TRX Logo">
                <h2>Iniciar Sesión</h2>
                <form id="login-form" @submit=${e => this.handleEvent(e)}>
                    <div class="form-group">
                        <label for="login-email"><i class="fas fa-envelope"></i> Correo Electrónico</label>
                        <input type="email" id="login-email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="login-password"><i class="fas fa-lock"></i> Contraseña</label>
                        <input type="password" id="login-password" name="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-sign-in-alt"></i> Entrar</button>
                </form>
                <a class="auth-link" data-action="navigate" data-page="register" @click=${e => this.handleEvent(e)}><i class="fas fa-user-plus"></i> ¿No tienes cuenta? Regístrate</a>
                <a class="auth-link" data-action="navigate" data-page="admin" @click=${e => this.handleEvent(e)}><i class="fas fa-user-shield"></i> Panel de Administrador</a>

                <div class="auth-info-box">
                    <h4><i class="fas fa-trophy"></i> Últimos Ganadores</h4>
                     <div class="winners-container">
                        <div class="winner">
                            <h4>Día</h4>
                            <span class="winner-number">${this.store.state.lottery.day || '--'}</span>
                        </div>
                        <div class="winner">
                            <h4>Noche</h4>
                            <span class="winner-number">${this.store.state.lottery.night || '--'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    registerPageTpl() {
        const isUpdating = this.store.state.isUpdatingAvatar;
        return html`
        <div id="register-page" class="page ${this.store.state.currentPage === 'register' ? 'active' : ''}">
            <div class="auth-container">
                <img src="logo.png" alt="TRX Logo">
                <h2>${isUpdating ? 'Actualizar Avatar' : 'Crear Cuenta'}</h2>
                <form id="register-form" @submit=${e => this.handleEvent(e)}>
                    ${!isUpdating ? html`
                    <div class="form-group">
                        <label for="reg-username"><i class="fas fa-user"></i> Nombre de usuario</label>
                        <input type="text" id="reg-username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-email"><i class="fas fa-envelope"></i> Correo Electrónico</label>
                        <input type="email" id="reg-email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-password"><i class="fas fa-lock"></i> Contraseña</label>
                        <input type="password" id="reg-password" name="password" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-confirm-password"><i class="fas fa-check-double"></i> Confirmar Contraseña</label>
                        <input type="password" id="reg-confirm-password" name="confirmPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-trx"><i class="fa-brands fa-google-wallet"></i> Dirección TRX de retiro</label>
                        <input type="text" id="reg-trx" name="trxAddress" required>
                    </div>
                    ` : ''}

                    ${this.avatarsTpl()}
                    
                    <button type="submit" class="btn btn-primary">${isUpdating ? html`<i class="fas fa-sync-alt"></i> Actualizar Avatar` : html`<i class="fas fa-user-plus"></i> Registrarse`}</button>
                </form>
                 <a class="auth-link" data-action="navigate" data-page="${isUpdating ? 'dashboard' : 'login'}" @click=${e => { this.store.state.isUpdatingAvatar = false; this.handleEvent(e); }}>
                    <i class="fas fa-arrow-left"></i> ${isUpdating ? 'Volver al panel' : '¿Ya tienes cuenta? Inicia Sesión'}
                </a>
            </div>
        </div>
        `;
    }

    dashboardPageTpl() {
        if (!this.store.state.currentUser) return '';
        const { username, avatar, balance } = this.store.state.currentUser;
        const userBets = this.store.state.bets.filter(b => b.userId === this.store.state.currentUser.id).sort((a, b) => b.id - a.id).slice(0, 10);

        return html`
        <div id="dashboard-page" class="page ${this.store.state.currentPage === 'dashboard' ? 'active' : ''}">
            <header class="dashboard-header">
                <div class="user-info">
                    <img src="${avatar}" alt="Avatar" class="avatar">
                    <div>
                        <h3>Bienvenido, ${username}</h3>
                        <p>Balance: <strong>${balance.toFixed(2)} TRX</strong></p>
                    </div>
                </div>
                <div class="header-controls">
                    <img src="logo.png" alt="TRX Logo" style="height: 40px;">
                    <span id="theme-switcher" data-action="toggle-theme" @click=${e => this.handleEvent(e)}>
                        ${this.store.state.theme === 'dark' ? '☀️' : '🌙'}
                    </span>
                    <button class="btn" data-action="logout" @click=${e => this.handleEvent(e)}><i class="fas fa-sign-out-alt"></i> Salir</button>
                </div>
            </header>
            
            <main class="dashboard-grid">
                <div class="card">
                    <h3><i class="fas fa-trophy"></i> Sorteos y Ganadores</h3>
                    <div class="timers-container" id="timers">Cargando...</div>
                    <hr style="border-color: var(--border-color); margin: 1.5rem 0;">
                    <div class="winners-container">
                        <div class="winner">
                            <h4><i class="fas fa-sun"></i> Último Ganador (Día)</h4>
                            <span class="winner-number">${this.store.state.lottery.day || '--'}</span>
                        </div>
                        <div class="winner">
                            <h4><i class="fas fa-moon"></i> Último Ganador (Noche)</h4>
                            <span class="winner-number">${this.store.state.lottery.night || '--'}</span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h3><i class="fas fa-ticket-alt"></i> Realizar Apuesta</h3>
                    <form id="bet-form" @submit=${e => this.handleEvent(e)}>
                        <div class="bet-form-group">
                           <div>
                             <label for="bet-number"><i class="fas fa-hashtag"></i> Número (00-99)</label>
                             <input type="text" id="bet-number" name="number" required pattern="\\d{2}" maxlength="2" placeholder="00">
                           </div>
                           <div>
                              <label for="bet-amount"><i class="fas fa-coins"></i> Monto (1-5 TRX)</label>
                              <input type="number" id="bet-amount" name="amount" required min="1" max="5" value="1">
                           </div>
                        </div>
                        <div class="form-group">
                            <label for="bet-draw"><i class="fas fa-clock"></i> Sorteo</label>
                            <select id="bet-draw" name="draw">
                                <option value="day">Día (1:35 PM)</option>
                                <option value="night">Noche (9:50 PM)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Apostar Ahora</button>
                    </form>
                </div>

                <div class="card">
                    <h3><i class="fas fa-history"></i> Historial de Apuestas</h3>
                    <div class="bet-history">
                        <ul>
                            ${userBets.length ? userBets.map(bet => html`
                                <li class="${bet.status}">
                                    <span><i class="far fa-calendar-alt"></i> ${new Date(bet.date).toLocaleDateString()} - #${bet.number} (${bet.draw})</span>
                                    <span>${bet.amount} TRX - <strong style="text-transform: capitalize;">${bet.status === 'win' ? 'Ganó' : (bet.status === 'loss' ? 'Perdió' : 'Pendiente')}</strong></span>
                                </li>
                            `) : html`<li><i class="fas fa-info-circle"></i> No hay apuestas todavía.</li>`}
                        </ul>
                    </div>
                </div>

                <div class="card">
                    <h3><i class="fas fa-user-cog"></i> Mi Perfil y Billetera</h3>
                    <div class="profile-actions">
                        <button class="btn" data-action="update-trx" @click=${e => this.handleEvent(e)}><i class="fa-brands fa-google-wallet"></i> Cambiar Dirección TRX</button>
                        <button class="btn" data-action="update-avatar" @click=${e => this.handleEvent(e)}><i class="fas fa-user-astronaut"></i> Actualizar Avatar</button>
                         <button class="btn" data-action="navigate" data-page="contact" @click=${e => this.handleEvent(e)}><i class="fas fa-headset"></i> Contactar Admin</button>
                    </div>
                    <hr style="border-color: var(--border-color); margin: 1.5rem 0;">
                    <div class="wallet-actions">
                         <button class="btn btn-secondary" data-action="deposit" @click=${e => this.handleEvent(e)}><i class="fas fa-arrow-down"></i> Depositar TRX</button>
                         <button class="btn btn-primary" data-action="withdraw" @click=${e => this.handleEvent(e)}><i class="fas fa-arrow-up"></i> Retirar Ganancias</button>
                    </div>
                </div>
            </main>
        </div>
        `;
    }
    
    contactPageTpl() {
        if (!this.store.state.currentUser) return '';
        const { email, trxAddress } = this.store.state.currentUser;
        const adminEmail = "cubanopopular@gmail.com";
        const subject = "Contacto desde Plataforma de Apuestas";
        const body = `Correo del usuario: ${email}\nDirección TRX: ${trxAddress}\n\nMensaje:\n`;
        const mailtoLink = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        return html`
        <div id="contact-page" class="page ${this.store.state.currentPage === 'contact' ? 'active' : ''}">
            <div class="auth-container">
                <h2><i class="fas fa-headset"></i> Contactar al Administrador</h2>
                <p>Tu información de usuario será incluida en el correo para una rápida atención.</p>
                <p>Se abrirá tu cliente de correo electrónico para enviar el mensaje a <strong>${adminEmail}</strong>.</p>
                <br>
                <a href=${mailtoLink} class="btn btn-primary"><i class="fas fa-envelope-open-text"></i> Abrir Cliente de Correo</a>
                <a class="auth-link" data-action="navigate" data-page="dashboard" @click=${e => this.handleEvent(e)}><i class="fas fa-arrow-left"></i> Volver al panel</a>
            </div>
        </div>
        `;
    }

    adminPanelTpl() {
        const allUsers = this.store.state.users;
        const allBets = [...this.store.state.bets].sort((a, b) => b.id - a.id);

        return html`
        <div id="admin-panel" class="page ${this.store.state.currentPage === 'admin' ? 'active' : ''}">
            <h2><i class="fas fa-user-shield"></i> Panel de Administrador</h2>
            
            <div class="dashboard-grid">
                <div class="card">
                    <h3><i class="fas fa-trophy"></i> Ingresar Número Ganador</h3>
                    <div class="form-group">
                       <label>Sorteo de Día (1:35 PM)</label>
                       <button class="btn" data-action="set-day-winner" @click=${e => this.handleEvent(e)}><i class="fas fa-sun"></i> Ingresar Ganador</button>
                    </div>
                     <div class="form-group">
                       <label>Sorteo de Noche (9:50 PM)</label>
                       <button class="btn" data-action="set-night-winner" @click=${e => this.handleEvent(e)}><i class="fas fa-moon"></i> Ingresar Ganador</button>
                    </div>
                </div>

                <div class="card">
                    <h3><i class="fas fa-arrow-down"></i> Depósitos Pendientes</h3>
                    ${this.adminTableTpl(
                        this.store.state.pendingDeposits, 
                        ['Usuario', 'Monto', 'Acción'], 
                        (item) => html`
                            <td>${item.username}</td>
                            <td>${item.amount} TRX</td>
                            <td><button class="btn btn-secondary" data-action="confirm-deposit" data-id=${item.id} @click=${e => this.handleEvent(e)}><i class="fas fa-check"></i> Confirmar</button></td>
                        `
                    )}
                </div>
                
                <div class="card">
                    <h3><i class="fas fa-arrow-up"></i> Retiros Pendientes</h3>
                     ${this.adminTableTpl(
                         this.store.state.pendingWithdrawals,
                         ['Usuario', 'Monto', 'Dirección TRX', 'Acción'],
                         (item) => html`
                            <td>${item.username}</td>
                            <td>${item.amount} TRX</td>
                            <td>${item.trxAddress}</td>
                            <td><button class="btn" data-action="complete-withdrawal" data-id=${item.id} @click=${e => this.handleEvent(e)}><i class="fas fa-check"></i> Completar</button></td>
                         `
                     )}
                </div>

                <div class="card">
                    <h3><i class="fas fa-users"></i> Usuarios Registrados (${allUsers.length})</h3>
                    ${this.adminTableTpl(
                        allUsers,
                        ['ID', 'Usuario', 'Email', 'Balance'],
                        (user) => html`
                            <td>${user.id}</td>
                            <td>${user.username}</td>
                            <td>${user.email}</td>
                            <td>${user.balance.toFixed(2)} TRX</td>
                        `
                    )}
                </div>

                <div class="card">
                    <h3><i class="fas fa-history"></i> Historial General de Apuestas</h3>
                    ${this.adminTableTpl(
                        allBets,
                        ['Usuario', 'Número', 'Monto', 'Sorteo', 'Estado'],
                        (bet) => {
                            const user = this.store.state.users.find(u => u.id === bet.userId);
                            return html`
                                <td>${user ? user.username : 'N/A'}</td>
                                <td>${bet.number}</td>
                                <td>${bet.amount} TRX</td>
                                <td>${bet.draw}</td>
                                <td class="${bet.status}">${bet.status}</td>
                            `;
                        }
                    )}
                </div>
            </div>
             <a class="auth-link" style="text-align:center; margin-top:2rem;" data-action="navigate" data-page="login" @click=${e => this.handleEvent(e)}><i class="fas fa-sign-out-alt"></i> Salir del Panel de Admin</a>
        </div>
        `;
    }
    
    adminTableTpl(items, headers, rowTemplate) {
        if (!items || !items.length) return html`<p>No hay items para mostrar.</p>`;
        return html`
        <div style="max-height: 400px; overflow-y: auto;">
            <table class="admin-table">
                <thead>
                    <tr>${headers.map(h => html`<th>${h}</th>`)}</tr>
                </thead>
                <tbody>
                    ${items.map(item => html`<tr>${rowTemplate(item)}</tr>`)}
                </tbody>
            </table>
        </div>
        `;
    }

    render() {
        const tpl = html`
            ${this.loginPageTpl()}
            ${this.registerPageTpl()}
            ${this.dashboardPageTpl()}
            ${this.contactPageTpl()}
            ${this.adminPanelTpl()}
        `;
        render(tpl, this.root);
        this.updateTimers();
    }
    
    updateTimers() {
        const timerEl = document.getElementById('timers');
        if (!timerEl) return;

        const now = new Date();
        
        // Define target times in local timezone
        const dayDrawTime = new Date(now);
        dayDrawTime.setHours(13, 35, 0, 0);

        const nightDrawTime = new Date(now);
        nightDrawTime.setHours(21, 50, 0, 0);

        const dayCloseTime = new Date(now);
        dayCloseTime.setHours(13, 10, 0, 0);

        const nightCloseTime = new Date(now);
        nightCloseTime.setHours(20, 10, 0, 0);

        let nextDraw, nextClose;
        let drawName;

        if (now < dayCloseTime) {
            nextDraw = dayDrawTime;
            nextClose = dayCloseTime;
            drawName = "Próximo sorteo (Día) en...";
        } else if (now < nightCloseTime) {
            nextDraw = nightDrawTime;
            nextClose = nightCloseTime;
            drawName = "Próximo sorteo (Noche) en...";
        } else {
            // Next day's day draw
            nextDraw = new Date(dayDrawTime.getTime() + 24 * 60 * 60 * 1000);
            nextClose = new Date(dayCloseTime.getTime() + 24 * 60 * 60 * 1000);
            drawName = "Próximo sorteo (Día) en...";
        }

        const formatTime = (ms) => {
            if (ms < 0) return '00:00:00';
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
            const seconds = (totalSeconds % 60).toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        };
        
        const drawDiff = nextDraw - now;
        const closeDiff = nextClose - now;
        
        const timerHTML = html`
            <div class="timer">
                <h4><i class="far fa-clock"></i> ${drawName}</h4>
                <span class="timer-time">${formatTime(drawDiff)}</span>
            </div>
            <div class="timer">
                <h4><i class="fas fa-lock"></i> Apuestas cierran en...</h4>
                <span class="timer-time">${formatTime(closeDiff)}</span>
            </div>
        `;
        render(timerHTML, timerEl);
    }
}

// --- UTILS ---
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}


// --- INITIALIZATION ---
const store = new Store();
const app = new App(store);
setInterval(() => app.updateTimers(), 1000);