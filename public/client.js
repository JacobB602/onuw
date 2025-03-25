console.log("Enhanced client.js loaded!");

document.addEventListener('DOMContentLoaded', function () {
    // Establish socket connection
    let socket;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        socket = io('http://localhost:10000');
    } else {
        socket = io('https://onuw.up.railway.app');
    }

    // Game state variables
    let currentRoom = null;
    let currentUsername = null;
    let isHost = false;
    let playerCount = 0;
    let roles = [];
    let clientAssignedRoles = {};
    let clientOriginalRole = '';

    // Enhanced role display configuration
    const roleConfig = {
        'werewolf-1': { name: 'Werewolf', icon: 'fas fa-paw', color: 'evil', team: 'werewolf' },
        'werewolf-2': { name: 'Werewolf', icon: 'fas fa-paw', color: 'evil', team: 'werewolf' },
        'serpent': { name: 'Serpent', icon: 'fas fa-snake', color: 'evil', team: 'werewolf' },
        'mystic-wolf': { name: 'Mystic Wolf', icon: 'fas fa-eye', color: 'evil', team: 'werewolf' },
        'dream-wolf': { name: 'Dream Wolf', icon: 'fas fa-moon', color: 'evil', team: 'werewolf' },
        'minion': { name: 'Minion', icon: 'fas fa-skull', color: 'evil', team: 'minion' },
        'squire': { name: 'Squire', icon: 'fas fa-shield-alt', color: 'evil', team: 'squire' },
        'tanner': { name: 'Tanner', icon: 'fas fa-tshirt', color: 'neutral', team: 'tanner' },
        'apprentice-tanner': { name: 'Apprentice Tanner', icon: 'fas fa-tshirt', color: 'neutral', team: 'tanner' },
        'sentinel': { name: 'Sentinel', icon: 'fas fa-lock', color: 'good', team: 'villager' },
        'villager-1': { name: 'Villager', icon: 'fas fa-user', color: 'good', team: 'villager' },
        'villager-2': { name: 'Villager', icon: 'fas fa-user', color: 'good', team: 'villager' },
        'villager-3': { name: 'Villager', icon: 'fas fa-user', color: 'good', team: 'villager' },
        'seer': { name: 'Seer', icon: 'fas fa-eye', color: 'good', team: 'villager' },
        'apprentice-seer': { name: 'Apprentice Seer', icon: 'fas fa-eye', color: 'good', team: 'villager' },
        'troublemaker': { name: 'Troublemaker', icon: 'fas fa-random', color: 'good', team: 'villager' },
        'gremlin': { name: 'Gremlin', icon: 'fas fa-bolt', color: 'good', team: 'villager' },
        'paranormal-investigator': { name: 'Investigator', icon: 'fas fa-search', color: 'good', team: 'villager' },
        'robber': { name: 'Robber', icon: 'fas fa-mask', color: 'good', team: 'villager' },
        'witch': { name: 'Witch', icon: 'fas fa-hat-wizard', color: 'good', team: 'villager' },
        'drunk': { name: 'Drunk', icon: 'fas fa-beer', color: 'good', team: 'villager' },
        'insomniac': { name: 'Insomniac', icon: 'fas fa-moon', color: 'good', team: 'villager' }
    };

    // DOM Elements
    const lobbyElement = document.getElementById('lobby');
    const gameScreenElement = document.getElementById('gameScreen');
    const playerListElement = document.getElementById('playerList');
    const roomDisplayElement = document.getElementById('roomDisplay');
    const rolesRequiredText = document.getElementById('rolesRequiredText');
    const startGameButton = document.getElementById('startGameButton');
    const joinRoomButton = document.getElementById('joinRoom');
    const roomCodeInput = document.getElementById('roomCode');
    const nameModal = document.getElementById('nameModal');
    const usernameInput = document.getElementById('usernameInput');
    const submitNameButton = document.getElementById('submitName');
    const settingsPopup = document.getElementById('settingsPopup');
    const closePopupButton = document.getElementById('closePopup');
    const roleCards = document.querySelectorAll('.role-card');
    const rolesButton = document.getElementById('roles');

    // Helper Functions
    function showElement(element) {
        element.style.display = 'block';
    }

    function hideElement(element) {
        element.style.display = 'none';
    }

    function toggleModal(modal, show) {
        modal.classList.toggle('active', show);
    }

    function getRoleInfo(role) {
        return roleConfig[role] || { name: role, icon: 'fas fa-question', color: 'neutral', team: 'unknown' };
    }

    // Event Listeners
    joinRoomButton.addEventListener('click', joinRoom);
    submitNameButton.addEventListener('click', handleNameSubmit);
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleNameSubmit();
    });
    closePopupButton.addEventListener('click', () => toggleModal(settingsPopup, false));
    startGameButton.addEventListener('click', startGame);

    document.getElementById('roles').addEventListener('click', () => {
        toggleModal(settingsPopup, true);
        
        // If host, show all roles as selectable
        if (isHost) {
            roleCards.forEach(card => {
                card.classList.remove('disabled');
                const role = card.getAttribute('data-role');
                const roleInfo = getRoleInfo(role);
                if (roles.includes(role)) {
                    card.classList.add('selected');
                    card.classList.add(roleInfo.color);
                } else {
                    card.classList.remove('selected');
                    card.classList.remove(roleInfo.color);
                }
            });
        } else {
            // For non-hosts, disable selection
            roleCards.forEach(card => {
                card.classList.add('disabled');
            });
        }
    });

    // Role selection handling
    roleCards.forEach(card => {
        card.addEventListener('click', function() {
            if (!isHost) return;
            
            const role = this.getAttribute('data-role');
            this.classList.toggle('selected');
            
            const selectedRoles = Array.from(document.querySelectorAll('.role-card.selected'))
                .map(el => el.getAttribute('data-role'));
            
            socket.emit('updateRoles', { roomCode: currentRoom, roles: selectedRoles });
            
            // Update visual state
            const roleInfo = getRoleInfo(role);
            if (this.classList.contains('selected')) {
                this.classList.add(roleInfo.color);
            } else {
                this.classList.remove('evil', 'good', 'neutral');
            }
        });
    });

    // Main Game Functions
    function joinRoom() {
        const roomCode = roomCodeInput.value.trim();
        if (!roomCode) {
            alert("Please enter a room code!");
            return;
        }
        currentRoom = roomCode;
        socket.emit('joinRoom', { roomCode });
        toggleModal(nameModal, true);
        usernameInput.focus();
    }

    function handleNameSubmit() {
        const username = usernameInput.value.trim();
        if (username) {
            currentUsername = username;
            socket.emit('joinRoomWithName', { roomCode: currentRoom, username });
            toggleModal(nameModal, false);
            usernameInput.value = '';
        } else {
            alert("Please enter a valid name!");
        }
    }

    function startGame() {
        console.log("Starting game...");
        socket.emit("startGame", { roomCode: currentRoom });
    }

    function showRoleCard(role) {
        const roleInfo = getRoleInfo(role);
        gameScreenElement.innerHTML = `
            <div class="phase-header">
                <h2>Your Role</h2>
            </div>
            <div class="card-container">
                <div class="card" id="roleCard">
                    <div class="card-face card-front">
                        <div class="card-icon"><i class="fas fa-question"></i></div>
                        <div class="card-title">Click to Reveal</div>
                        <div class="card-desc">Your hidden role awaits</div>
                    </div>
                    <div class="card-face card-back ${roleInfo.color}">
                        <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                        <div class="card-title">${roleInfo.name}</div>
                        <div class="card-desc">${roleInfo.team.toUpperCase()} TEAM</div>
                    </div>
                </div>
            </div>
            <button class="btn-primary" id="confirmButton">
                <i class="fas fa-check"></i> Confirm Role
            </button>
        `;

        document.getElementById('roleCard').addEventListener('click', function() {
            this.classList.toggle('flipped');
        });

        document.getElementById('confirmButton').addEventListener('click', function() {
            socket.emit('confirmRole', { roomCode: currentRoom });
            this.disabled = true;
            
            // Only add the message if it doesn't exist
            if (!document.querySelector('.result-display')) {
                const display = document.createElement('div');
                display.className = 'result-display';
                display.innerHTML = '<p>Waiting for other players to confirm...</p>';
                gameScreenElement.appendChild(display);
            }
        });
    }

    function createNightActionUI(role, players) {
        // First sanitize the role
        const cleanRole = role.replace('stolen-', '');
        const roleInfo = getRoleInfo(cleanRole);
        
        // Verify this is actually our current role
        if (clientAssignedRoles[socket.id].replace('stolen-', '') !== cleanRole) {
            console.error(`UI/role mismatch: Showing ${cleanRole} but have ${clientAssignedRoles[socket.id]}`);
        }
        
        let html = `
            <div class="phase-header">
                <h2>${roleInfo.name}'s Turn</h2>
                <div class="phase-timer" id="turnTimerDisplay">15</div>
            </div>
            <div id="actionContent"></div>
        `;
    
        gameScreenElement.innerHTML = html;
        const actionContent = document.getElementById('actionContent');
    
        switch(cleanRole) {
            case 'werewolf-1':
            case 'werewolf-2':
            case 'mystic-wolf':
            case 'dream-wolf':
            case 'serpent':
                // Get all werewolf-type players including current player
                const allWerewolves = players.filter(p => 
                    ['werewolf-1', 'werewolf-2', 'mystic-wolf', 'dream-wolf', 'serpent']
                    .includes(clientAssignedRoles[p.id])
                );
                const otherWerewolves = allWerewolves.filter(p => p.id !== socket.id);
            
                if (otherWerewolves.length === 0) {
                    // Only werewolf - show center card selection
                    actionContent.innerHTML = `
                        <div class="phase-header">
                            <h2>Werewolf's Turn</h2>
                            <div class="phase-timer" id="turnTimerDisplay">15</div>
                        </div>
                        <p>You are the only werewolf! View a center card:</p>
                        <div class="center-selection">
                            <div class="center-option" data-card="center1">Center 1</div>
                            <div class="center-option" data-card="center2">Center 2</div>
                            <div class="center-option" data-card="center3">Center 3</div>
                        </div>
                        <div id="werewolfResult"></div>
                        <button class="btn-primary" id="skipWerewolfAction" style="margin-top: 15px;">
                            Skip Viewing
                        </button>
                    `;
            
                    let cardSelected = false;
                    document.querySelectorAll('.center-option').forEach(option => {
                        option.addEventListener('click', function() {
                            cardSelected = true;
                            socket.emit('viewCenterCard', {
                                roomCode: currentRoom,
                                card: this.dataset.card
                            });
                            this.classList.add('selected');
                            document.querySelectorAll('.center-option').forEach(opt => {
                                opt.style.pointerEvents = 'none';
                            });
                            document.getElementById('skipWerewolfAction').style.display = 'none';
                        });
                    });
            
                    document.getElementById('skipWerewolfAction').addEventListener('click', () => {
                        if (!cardSelected) {
                            socket.emit('werewolfActionComplete', { roomCode: currentRoom });
                        }
                    });
                } else {
                    // There are other werewolves - show the werewolf team
                    actionContent.innerHTML = `
                        <div class="werewolf-team">
                            <h3><i class="fas fa-paw"></i> Werewolf Team</h3>
                            <p>Your fellow werewolves:</p>
                            <div class="werewolf-list">
                                ${otherWerewolves.map(wolf => {
                                    const roleInfo = getRoleInfo(clientAssignedRoles[wolf.id]);
                                    return `
                                        <div class="werewolf-member ${roleInfo.color}">
                                            <div class="werewolf-avatar">${wolf.name.charAt(0).toUpperCase()}</div>
                                            <div class="werewolf-info">
                                                <div class="werewolf-name">${wolf.name}</div>
                                                <div class="werewolf-role">${roleInfo.name}</div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            ${allWerewolves.length === 2 ? `
                                <p class="werewolf-hint">There are ${allWerewolves.length} werewolves in total (including you).</p>
                            ` : `
                                <p class="werewolf-hint">There are ${allWerewolves.length} werewolves in total (including you).</p>
                            `}
                        </div>
                    `;
                }
                break;
            case 'seer':
                actionContent.innerHTML = `
                    <p>Choose an action:</p>
                    <div class="action-buttons">
                        <button class="btn-primary" id="viewPlayer">
                            <i class="fas fa-user"></i> View Player Card
                        </button>
                        <button class="btn-primary" id="viewCenter">
                            <i class="fas fa-cards"></i> View Center Cards
                        </button>
                    </div>
                    <div id="seerResult"></div>
                `;
    
                document.getElementById('viewPlayer').addEventListener('click', () => {
                    actionContent.innerHTML = `
                        <p>Select a player to view:</p>
                        <div class="player-selection" id="playerSelection"></div>
                    `;
                    
                    const playerSelection = document.getElementById('playerSelection');
                    players.filter(p => p.id !== socket.id).forEach(player => {
                        const playerBtn = document.createElement('div');
                        playerBtn.className = 'player-option';
                        playerBtn.innerHTML = `
                            <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                            <div>${player.name}</div>
                        `;
                        playerBtn.addEventListener('click', () => {
                            socket.emit('seerAction', { roomCode: currentRoom, target: player.id });
                            playerBtn.classList.add('selected');
                        });
                        playerSelection.appendChild(playerBtn);
                    });
                });
    
                document.getElementById('viewCenter').addEventListener('click', () => {
                    actionContent.innerHTML = `
                        <p>Select 2 center cards to view:</p>
                        <div class="center-selection">
                            <div class="center-option" data-card="center1">Center 1</div>
                            <div class="center-option" data-card="center2">Center 2</div>
                            <div class="center-option" data-card="center3">Center 3</div>
                        </div>
                        <div id="seerCenterResult"></div>
                    `;
            
                    const selectedCards = [];
                    document.querySelectorAll('.center-option').forEach(option => {
                        option.addEventListener('click', function() {
                            if (selectedCards.includes(this.dataset.card)) {
                                this.classList.remove('selected');
                                selectedCards.splice(selectedCards.indexOf(this.dataset.card), 1);
                            } else if (selectedCards.length < 2) {
                                this.classList.add('selected');
                                selectedCards.push(this.dataset.card);
                            }
            
                            if (selectedCards.length === 2) {
                                socket.emit('seerAction', { 
                                    roomCode: currentRoom, 
                                    target: selectedCards 
                                });
                                // Disable all options after selection
                                document.querySelectorAll('.center-option').forEach(opt => {
                                    opt.style.pointerEvents = 'none';
                                });
                            }
                        });
                    });
                });
                break;
    
            case 'robber':
                actionContent.innerHTML = `
                    <p>Select a player to rob:</p>
                    <div class="player-selection" id="robberSelection"></div>
                    <div id="robberResult"></div>
                `;
            
                players.filter(p => p.id !== socket.id).forEach(player => {
                    const playerBtn = document.createElement('div');
                    playerBtn.className = 'player-option';
                    playerBtn.innerHTML = `
                        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div class="player-name">${player.name}</div>
                    `;
                    playerBtn.addEventListener('click', () => {
                        socket.emit('robberAction', { 
                            roomCode: currentRoom, 
                            target: player.id 
                        });
                        playerBtn.classList.add('selected');
                        document.querySelectorAll('.player-option').forEach(btn => {
                            btn.style.pointerEvents = 'none';
                            btn.style.opacity = '0.6';
                        });
                    });
                    document.getElementById('robberSelection').appendChild(playerBtn);
                });
                break;
    
            case 'mystic-wolf':
                actionContent.innerHTML = `
                    <p>Select a player to view:</p>
                    <div class="player-selection" id="mysticWolfSelection"></div>
                    <div id="mysticWolfResult"></div>
                `;
    
                players.filter(p => p.id !== socket.id).forEach(player => {
                    const playerBtn = document.createElement('div');
                    playerBtn.className = 'player-option';
                    playerBtn.innerHTML = `
                        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div>${player.name}</div>
                    `;
                    playerBtn.addEventListener('click', () => {
                        socket.emit('mysticWolfAction', { roomCode: currentRoom, target: player.id });
                        document.querySelectorAll('.player-option').forEach(btn => btn.style.pointerEvents = 'none');
                    });
                    document.getElementById('mysticWolfSelection').appendChild(playerBtn);
                });
                break;
    
            case 'troublemaker':
                actionContent.innerHTML = `
                    <p>Select 2 players to swap:</p>
                    <div class="player-selection" id="troublemakerSelection"></div>
                    <div id="troublemakerResult"></div>
                `;
    
                const troublemakerSelected = [];
                players.filter(p => p.id !== socket.id).forEach(player => {
                    const playerBtn = document.createElement('div');
                    playerBtn.className = 'player-option';
                    playerBtn.innerHTML = `
                        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div>${player.name}</div>
                    `;
                    playerBtn.addEventListener('click', function() {
                        if (troublemakerSelected.includes(player.id)) {
                            this.classList.remove('selected');
                            troublemakerSelected.splice(troublemakerSelected.indexOf(player.id), 1);
                        } else if (troublemakerSelected.length < 2) {
                            this.classList.add('selected');
                            troublemakerSelected.push(player.id);
                        }
    
                        if (troublemakerSelected.length === 2) {
                            socket.emit('troublemakerAction', { 
                                roomCode: currentRoom, 
                                targets: troublemakerSelected 
                            });
                        }
                    });
                    document.getElementById('troublemakerSelection').appendChild(playerBtn);
                });
                break;
    
            case 'minion':
                actionContent.innerHTML = `
                    <div class="result-display" id="minionResult">
                        <p>Identifying werewolves...</p>
                    </div>
                `;
                socket.emit('minionAction', { roomCode: currentRoom });
                break;
    
            case 'squire':
                actionContent.innerHTML = `
                    <div class="result-display" id="squireResult">
                        <p>Identifying werewolves...</p>
                    </div>
                `;
                socket.emit('squireAction', { roomCode: currentRoom });
                break;
    
            case 'apprentice-seer':
                actionContent.innerHTML = `
                    <p>Select a center card to view:</p>
                    <div class="center-selection">
                        <div class="center-option" data-card="center1">Center 1</div>
                        <div class="center-option" data-card="center2">Center 2</div>
                        <div class="center-option" data-card="center3">Center 3</div>
                    </div>
                    <div id="apprenticeSeerResult"></div>
                `;
            
                document.querySelectorAll('.center-option').forEach(option => {
                    option.addEventListener('click', function() {
                        const card = this.dataset.card;
                        socket.emit('apprenticeSeerAction', { 
                            roomCode: currentRoom, 
                            card: card 
                        });
                        // Disable all options after selection
                        document.querySelectorAll('.center-option').forEach(opt => {
                            opt.style.pointerEvents = 'none';
                        });
                    });
                });
                break;
    
            case 'insomniac':
                actionContent.innerHTML = `
                    <div class="result-display" id="insomniacResult">
                        <p>Checking your current role...</p>
                    </div>
                `;
                socket.emit('insomniacAction', { roomCode: currentRoom });
                break;
    
            case 'witch':
                actionContent.innerHTML = `
                    <p>Select a center card to view:</p>
                    <div class="center-selection">
                        <div class="center-option" data-card="center1">Center 1</div>
                        <div class="center-option" data-card="center2">Center 2</div>
                        <div class="center-option" data-card="center3">Center 3</div>
                    </div>
                    <div id="witchViewResult"></div>
                    <div id="witchGiveOptions" style="display:none;"></div>
                `;
    
                let selectedCenter = null;
                document.querySelectorAll('.center-option').forEach(option => {
                    option.addEventListener('click', function() {
                        selectedCenter = this.dataset.card;
                        socket.emit('witchViewAction', { 
                            roomCode: currentRoom, 
                            centerCard: selectedCenter 
                        });
                        this.classList.add('selected');
                    });
                });
                break;
    
            case 'drunk':
                actionContent.innerHTML = `
                    <p>Select a center card to swap with:</p>
                    <div class="center-selection">
                        <div class="center-option" data-card="center1">Center 1</div>
                        <div class="center-option" data-card="center2">Center 2</div>
                        <div class="center-option" data-card="center3">Center 3</div>
                    </div>
                    <div id="drunkResult"></div>
                `;
    
                document.querySelectorAll('.center-option').forEach(option => {
                    option.addEventListener('click', function() {
                        socket.emit('drunkAction', { 
                            roomCode: currentRoom, 
                            targetCenter: this.dataset.card 
                        });
                        document.querySelectorAll('.center-option').forEach(opt => {
                            opt.style.pointerEvents = 'none';
                        });
                    });
                });
                break;
    
            case 'paranormal-investigator':
                actionContent.innerHTML = `
                    <p>Select a player to investigate:</p>
                    <div class="player-selection" id="piSelection"></div>
                    <div id="piResult"></div>
                `;
    
                players.filter(p => p.id !== socket.id).forEach(player => {
                    const playerBtn = document.createElement('div');
                    playerBtn.className = 'player-option';
                    playerBtn.innerHTML = `
                        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div>${player.name}</div>
                    `;
                    playerBtn.addEventListener('click', () => {
                        socket.emit('piAction', { 
                            roomCode: currentRoom, 
                            target: player.id 
                        });
                        document.querySelectorAll('.player-option').forEach(btn => {
                            btn.style.pointerEvents = 'none';
                            btn.style.opacity = '0.6';
                        });
                    });
                    document.getElementById('piSelection').appendChild(playerBtn);
                });
                break;
    
            case 'gremlin':
                actionContent.innerHTML = `
                    <p>Select 2 players to swap (can include yourself):</p>
                    <div class="player-selection" id="gremlinSelection"></div>
                    <div id="selectionStatus">Select 2 players</div>
                    <div id="gremlinResult"></div>
                `;
    
                const gremlinSelected = [];
                players.forEach(player => {
                    const playerBtn = document.createElement('div');
                    playerBtn.className = 'player-option';
                    playerBtn.innerHTML = `
                        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div>${player.name} ${player.id === socket.id ? '(You)' : ''}</div>
                    `;
                    playerBtn.addEventListener('click', function() {
                        if (gremlinSelected.includes(player.id)) {
                            this.classList.remove('selected');
                            gremlinSelected.splice(gremlinSelected.indexOf(player.id), 1);
                        } else if (gremlinSelected.length < 2) {
                            this.classList.add('selected');
                            gremlinSelected.push(player.id);
                        }
    
                        document.getElementById('selectionStatus').textContent = 
                            gremlinSelected.length === 0 ? 'Select 2 players' :
                            gremlinSelected.length === 1 ? 'Select 1 more player' :
                            'Ready to swap!';
    
                        if (gremlinSelected.length === 2) {
                            socket.emit('gremlinAction', { 
                                roomCode: currentRoom, 
                                targets: gremlinSelected 
                            });
                        }
                    });
                    document.getElementById('gremlinSelection').appendChild(playerBtn);
                });
                break;
    
            case 'serpent':
                const otherWerewolvesSerpent = players.filter(p => 
                    p.id !== socket.id && 
                    ['werewolf-1', 'werewolf-2', 'mystic-wolf', 'dream-wolf']
                    .includes(clientAssignedRoles[p.id])
                );
        
                let serpentHtml = `
                    <div class="serpent-actions">
                        <h3>Serpent Actions</h3>
                `;
        
                if (otherWerewolvesSerpent.length === 0) {
                    serpentHtml += `
                        <p>You are the only werewolf!</p>
                        <p>Select a center card to view:</p>
                        <div class="center-selection">
                            <div class="center-option" data-card="center1">Center 1</div>
                            <div class="center-option" data-card="center2">Center 2</div>
                            <div class="center-option" data-card="center3">Center 3</div>
                        </div>
                        <div id="serpentCenterResult"></div>
                    `;
                } else {
                    serpentHtml += `<p>There are ${otherWerewolvesSerpent.length} other werewolves in the game.</p>`;
                }
        
                serpentHtml += `
                        <div class="action-buttons">
                            <button class="btn-primary" id="disguiseOnePlayer">
                                <i class="fas fa-user-secret"></i> Disguise 1 Player
                            </button>
                            <button class="btn-primary" id="disguiseTwoCenters">
                                <i class="fas fa-cards"></i> Disguise 2 Center Cards
                            </button>
                        </div>
                        <div id="serpentTargetSelection"></div>
                        <div id="serpentResult"></div>
                    </div>
                `;
        
                actionContent.innerHTML = serpentHtml;
        
                // Center card viewing
                if (otherWerewolvesSerpent.length === 0) {
                    document.querySelectorAll('.center-option').forEach(option => {
                        option.addEventListener('click', function() {
                            socket.emit('viewCenterCard', {
                                roomCode: currentRoom,
                                card: this.dataset.card
                            });
                            this.classList.add('selected');
                        });
                    });
                }
        
                // Player disguise
                document.getElementById('disguiseOnePlayer').addEventListener('click', () => {
                    const targetSelection = document.getElementById('serpentTargetSelection');
                    targetSelection.innerHTML = `
                        <p>Select a player to disguise:</p>
                        <div class="player-selection">
                            ${players.filter(p => p.id !== socket.id).map(player => `
                                <div class="player-option" data-target="${player.id}">
                                    <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                                    <div>${player.name}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
    
                    document.querySelectorAll('#serpentTargetSelection .player-option').forEach(option => {
                        option.addEventListener('click', function() {
                            socket.emit('serpentAction', {
                                roomCode: currentRoom,
                                targets: [this.dataset.target]
                            });
                            this.classList.add('selected');
                        });
                    });
                });
        
                // Center card disguise
                document.getElementById('disguiseTwoCenters').addEventListener('click', () => {
                    const targetSelection = document.getElementById('serpentTargetSelection');
                    targetSelection.innerHTML = `
                        <p>Select 2 center cards to disguise:</p>
                        <div class="center-selection">
                            <div class="center-option" data-target="center1">Center 1</div>
                            <div class="center-option" data-target="center2">Center 2</div>
                            <div class="center-option" data-target="center3">Center 3</div>
                        </div>
                    `;
    
                    const selectedCenters = [];
                    document.querySelectorAll('#serpentTargetSelection .center-option').forEach(option => {
                        option.addEventListener('click', function() {
                            if (selectedCenters.includes(this.dataset.target)) {
                                this.classList.remove('selected');
                                selectedCenters.splice(selectedCenters.indexOf(this.dataset.target), 1);
                            } else if (selectedCenters.length < 2) {
                                this.classList.add('selected');
                                selectedCenters.push(this.dataset.target);
                            }
    
                            if (selectedCenters.length === 2) {
                                socket.emit('serpentAction', {
                                    roomCode: currentRoom,
                                    targets: selectedCenters
                                });
                            }
                        });
                    });
                });
                break;
    
            default:
                actionContent.innerHTML = `<p>Waiting for ${roleInfo.name} to take their turn...</p>`;
        }
    }

    // Socket Event Handlers
    socket.on('roomUpdate', (players, receivedRoles) => {
        roles = receivedRoles;
        playerCount = players.length;
        
        // Update player list
        playerListElement.innerHTML = players.map(player => `
            <li>
                <div class="player-avatar">${player.name?.charAt(0).toUpperCase() || '?'}</div>
                <div class="player-name">${player.name || 'Unnamed'}</div>
                ${player.id === socket.id ? '<span class="player-you">(You)</span>' : ''}
            </li>
        `).join('');

        // Update roles required text
        rolesRequiredText.textContent = `Select ${playerCount + 3} roles`;
        
        // Update host status and UI
        isHost = players[0]?.id === socket.id;
        document.getElementById('roles').textContent = isHost ? "Edit Roles" : "View Roles";
        updateStartGameButtonState();
        
        // Show room info after joining
        document.getElementById('roomInfo').style.display = 'block';
        roomDisplayElement.textContent = currentRoom;
    });

    socket.on('allPlayersConfirmed', () => {
        // This ensures all players are synced before starting night phase
        console.log('All players confirmed - starting night phase');
        // The nightTurn event will handle the actual UI transition
    });
    
    socket.on('clearConfirmationScreen', () => {
        const resultDisplay = document.querySelector('.result-display');
        if (resultDisplay) {
            resultDisplay.remove();
        }
    });
    
    socket.on('prepareForNightPhase', () => {
        // Clear any existing UI
        gameScreenElement.innerHTML = '';
        console.log('Preparing for night phase...');
    });
    
    socket.on('roleConfirmed', ({ confirmedPlayers, players }) => {
        const confirmedCount = Object.keys(confirmedPlayers).length;
        const totalPlayers = players.length;
        
        // Update or create the confirmation display
        let resultDisplay = document.querySelector('.result-display');
        if (!resultDisplay) {
            resultDisplay = document.createElement('div');
            resultDisplay.className = 'result-display';
            gameScreenElement.appendChild(resultDisplay);
        }
        
        resultDisplay.innerHTML = `
            <p>${confirmedCount}/${totalPlayers} players confirmed</p>
        `;
    });

    socket.on('turnTimer', ({ timer }) => {
        const timerDisplay = document.getElementById('turnTimerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = timer;
            
            // Add visual feedback when time is running low
            if (timer <= 5) {
                timerDisplay.classList.add('pulse');
                timerDisplay.style.color = 'var(--accent-red)';
            } else {
                timerDisplay.classList.remove('pulse');
                timerDisplay.style.color = 'var(--accent-blue)';
            }
        }
    });

    socket.on('centerCardViewed', ({ card, role }) => {
        const roleInfo = getRoleInfo(role);
        let resultDiv = document.getElementById('werewolfResult');
        const actionContent = document.getElementById('actionContent'); // More reliable than querySelector
        
        if (!resultDiv) {
            resultDiv = document.createElement('div');
            resultDiv.id = 'werewolfResult';
            actionContent.appendChild(resultDiv);
        }
        
        resultDiv.innerHTML = `
            <div class="card-reveal ${roleInfo.color}">
                <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                <div class="card-title">${roleInfo.name}</div>
                <div class="card-desc">${card.toUpperCase()}</div>
            </div>
        `;
    });

    socket.on('dayTimer', ({ timer }) => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        const timerDisplay = document.getElementById('dayTimerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            
            if (timer <= 30) {
                timerDisplay.classList.add('pulse');
                timerDisplay.style.color = 'var(--accent-red)';
            }
        }
    });
    
    socket.on('voteTimer', ({ timer }) => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        const timerDisplay = document.getElementById('voteTimerDisplay');
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            
            if (timer <= 5) {
                timerDisplay.classList.add('pulse');
                timerDisplay.style.color = 'var(--accent-red)';
            }
        }
    });

    socket.on('gameStart', (assignedRoles) => {
        if (Object.keys(clientAssignedRoles).length > 0) {
            console.error('Received duplicate gameStart! Current roles:', clientAssignedRoles);
        }
        clientAssignedRoles = assignedRoles;

        // Verify the assigned role matches what the server sent
        if (assignedRoles[socket.id] !== clientAssignedRoles[socket.id]) {
            console.error("Role mismatch between client and server!");
            // Handle error or reconnect
        }
        
        clientAssignedRoles = assignedRoles;
        hideElement(lobbyElement);
        showElement(gameScreenElement);
        showRoleCard(assignedRoles[socket.id]);
    });

    socket.on('nightTurn', ({ currentRole, currentPlayer, isOriginalRole, actualCurrentRole }) => {
        // Completely clear and rebuild the UI
        gameScreenElement.innerHTML = '';
        
        const roleInfo = getRoleInfo(currentRole.replace('stolen-', ''));
        const header = document.createElement('div');
        header.className = 'phase-header';
        header.innerHTML = `
            <h2>${roleInfo.name}'s Turn</h2>
            <div class="phase-timer" id="turnTimerDisplay">15</div>
        `;
        gameScreenElement.appendChild(header);
        
        const content = document.createElement('div');
        content.id = 'actionContent';
        gameScreenElement.appendChild(content);
    
        if (currentPlayer === socket.id) {
            // Show action UI
            socket.emit('requestPlayerList', currentRoom);
            socket.once('playerList', players => {
                createNightActionUI(currentRole.replace('stolen-', ''), players);
            });
        } else {
            // Show waiting UI
            content.innerHTML = `<p>Waiting for ${roleInfo.name} to take their turn...</p>`;
        }
    });

    socket.on('seerResult', ({ targetRole }) => {
        const resultElement = document.getElementById('seerResult') || 
                             document.getElementById('seerCenterResult');
        
        if (Array.isArray(targetRole)) {
            // Handle center cards view
            resultElement.innerHTML = targetRole.map((role, index) => {
                const roleInfo = getRoleInfo(role);
                return `
                    <div class="card-reveal ${roleInfo.color}">
                        <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                        <div class="card-title">${roleInfo.name}</div>
                        <div class="card-desc">Center ${index + 1}</div>
                    </div>
                `;
            }).join('');
        } else {
            // Handle single player view
            const roleInfo = getRoleInfo(targetRole);
            resultElement.innerHTML = `
                <div class="card-reveal ${roleInfo.color}">
                    <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                    <div class="card-title">${roleInfo.name}</div>
                </div>
            `;
        }
    });

    socket.on('apprenticeSeerResult', ({ card, role }) => {
        const roleInfo = getRoleInfo(role);
        const resultElement = document.getElementById('apprenticeSeerResult');
        resultElement.innerHTML = `
            <div class="card-reveal ${roleInfo.color}">
                <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                <div class="card-title">${roleInfo.name}</div>
                <div class="card-desc">${card.toUpperCase()}</div>
            </div>
        `;
    });

    socket.on('startDayPhase', () => {
        console.log('Day phase starting');
        gameScreenElement.innerHTML = `
            <div class="phase-header">
                <h2>Day Phase</h2>
                <div class="phase-timer" id="dayTimerDisplay">05:00</div>
            </div>
            <div class="result-display">
                <p>Discuss with other players and determine who the werewolves are!</p>
            </div>
        `;
    });

    socket.on('endDayPhase', () => {
        gameScreenElement.innerHTML = `
            <div class="phase-header">
                <h2>Voting Phase</h2>
                <div class="phase-timer" id="voteTimerDisplay">00:15</div>
            </div>
            <div id="votingOptions"></div>
        `;

        socket.emit('requestPlayerList', currentRoom);
        socket.once('playerList', players => {
            const votingOptions = document.getElementById('votingOptions');
            votingOptions.innerHTML = `
                <p>Vote for who you think is a werewolf:</p>
                <div class="vote-options">
                    ${players.filter(p => p.id !== socket.id).map(player => `
                        <div class="vote-option" data-player-id="${player.id}">
                            <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                            <div class="player-name">${player.name}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        });
    });

    socket.on('votingResult', ({ votedPlayerId, votes, winningTeam, roleReveal, centerCards }) => {
        const votedPlayer = roleReveal.find(p => p.id === votedPlayerId);
        
        gameScreenElement.innerHTML = `
            <div class="game-result ${winningTeam.toLowerCase()}">
                <h2>${winningTeam} Win${winningTeam === 'Villagers' ? '' : 's'}!</h2>
                ${votedPlayer ? `<p>The village voted out: ${votedPlayer.name}</p>` : '<p>No one was voted out!</p>'}
            </div>
            
            <div class="role-reveal">
                <h2>Final Roles</h2>
                ${roleReveal.map(player => {
                    const roleInfo = getRoleInfo(player.role);
                    const originalRoleInfo = getRoleInfo(player.originalRole);
                    const changed = player.role !== player.originalRole;
                    
                    return `
                        <div class="reveal-card ${roleInfo.color}">
                            <div class="role-icon"><i class="${roleInfo.icon}"></i></div>
                            <h3>${player.name}</h3>
                            <p>${roleInfo.name}</p>
                            ${changed ? `<p class="original-role">Originally: ${originalRoleInfo.name}</p>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <button class="btn-primary" id="playAgainButton">
                <i class="fas fa-redo"></i> Play Again
            </button>
        `;

        document.getElementById('playAgainButton').addEventListener('click', () => {
            socket.emit('playAgain', currentRoom);
        });
    });

    socket.on('resetGame', () => {
        hideElement(gameScreenElement);
        showElement(lobbyElement);
        playerListElement.innerHTML = '';
        document.getElementById('roomInfo').style.display = 'none';
    });

    // Utility Functions
    function updateStartGameButtonState() {
        startGameButton.disabled = !(isHost && roles.length === playerCount + 3);
    }

    // Initialize
    toggleModal(settingsPopup, false);
    toggleModal(nameModal, false);
    hideElement(gameScreenElement);
});