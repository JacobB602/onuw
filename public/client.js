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
    let currentTimerDisplay = null;
    let isProcessingTurn = false; // New flag to prevent duplicate turn processing
    let currentTimerInterval = null;

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
        try {
            if (!role) {
                return {
                    name: 'Unknown Role',
                    icon: 'fas fa-question',
                    color: 'neutral',
                    team: 'unknown'
                };
            }
    
            // Handle center cards
            if (['center1', 'center2', 'center3'].includes(role)) {
                return {
                    name: role.toUpperCase(),
                    icon: 'fas fa-cards',
                    color: 'neutral',
                    team: 'center'
                };
            }
    
            // Check if role exists in config
            const info = roleConfig[role];
            if (!info) {
                console.warn(`Unknown role: ${role}`);
                return {
                    name: role,
                    icon: 'fas fa-question',
                    color: 'neutral',
                    team: 'unknown'
                };
            }
            
            return info;
        } catch (error) {
            console.error('Error in getRoleInfo:', error);
            return {
                name: 'Error',
                icon: 'fas fa-exclamation-triangle',
                color: 'neutral',
                team: 'unknown'
            };
        }
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
            
            if (!document.querySelector('.result-display')) {
                const display = document.createElement('div');
                display.className = 'result-display';
                display.innerHTML = '<p>Waiting for other players to confirm...</p>';
                gameScreenElement.appendChild(display);
            }
        });
    }

    function createNightActionUI(role, players, isCurrentPlayer) {
        const cleanRole = role.replace('stolen-', '');
        const roleInfo = getRoleInfo(cleanRole);
        
        // Clear and rebuild the action content only
        const actionContent = document.getElementById('actionContent');
        actionContent.innerHTML = '';
    
        if (!isCurrentPlayer) {
            actionContent.innerHTML = `<p>Waiting for ${roleInfo.name} to take their turn...</p>`;
            return;
        }
    
        switch(cleanRole) {
            
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
                    playerBtn.addEventListener('click', function() {
                        socket.emit('mysticWolfAction', { 
                            roomCode: currentRoom, 
                            target: player.id 
                        });
                        this.classList.add('selected');
                        document.querySelectorAll('.player-option').forEach(btn => {
                            btn.style.pointerEvents = 'none';
                        });
                    });
                    document.getElementById('mysticWolfSelection').appendChild(playerBtn);
                });
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
                        <div id="seerResult"></div>
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
                            document.querySelectorAll('.player-option').forEach(btn => {
                                btn.style.pointerEvents = 'none';
                            });
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
                            document.querySelectorAll('.player-option').forEach(btn => {
                                btn.style.pointerEvents = 'none';
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
                        document.querySelectorAll('.center-option').forEach(opt => {
                            opt.style.pointerEvents = 'none';
                        });
                    });
                });
                break;
    
            case 'insomniac':
                // Get the player's current role
                const currentRole = clientAssignedRoles[socket.id];
                const roleInfo = getRoleInfo(actualCurrentRole.replace('stolen-', ''));
                
                actionContent.innerHTML = `
                    <div class="insomniac-result">
                        <div class="card-reveal ${roleInfo.color}">
                            <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                            <div class="card-title">${roleInfo.name}</div>
                            <div class="card-desc">${roleInfo.team.toUpperCase()} TEAM</div>
                        </div>
                        <p class="insomniac-message">This is your current role after all changes</p>
                    </div>
                `;
                
                // Automatically notify server the action is complete
                socket.emit('insomniacAction', { roomCode: currentRoom });
                break;

            case 'witch':
                actionContent.innerHTML = `
                    <div class="witch-instructions">
                        <p>Select a center card to view:</p>
                        <div class="center-selection">
                            <div class="center-option" data-card="center1">Center 1</div>
                            <div class="center-option" data-card="center2">Center 2</div>
                            <div class="center-option" data-card="center3">Center 3</div>
                        </div>
                        <div id="witchViewResult"></div>
                        <div id="witchGiveOptions" style="display:none;">
                            <p>Select a player to give this card to:</p>
                            <div class="player-selection" id="witchPlayerSelection"></div>
                        </div>
                    </div>
                `;
            
                let selectedCenterCard;
                document.querySelectorAll('.center-option').forEach(option => {
                    option.addEventListener('click', function() {
                        selectedCenterCard = this.dataset.card;
                        socket.emit('witchViewAction', { 
                            roomCode: currentRoom, 
                            centerCard: selectedCenterCard 
                        });
                        
                        document.querySelectorAll('.center-option').forEach(opt => {
                            opt.style.pointerEvents = 'none';
                        });
                        this.classList.add('selected');
                        
                        // Get player list for the next step
                        socket.emit('requestPlayerList', currentRoom);
                        socket.once('playerList', players => {
                            const otherPlayers = players.filter(p => p.id !== socket.id);
                            
                            // Set up player selection UI
                            const playerSelection = document.getElementById('witchPlayerSelection');
                            playerSelection.innerHTML = otherPlayers.map(player => `
                                <div class="player-option" data-player-id="${player.id}">
                                    <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                                    <div class="player-name">${player.name}</div>
                                </div>
                            `).join('');
                            
                            // Show player selection
                            document.getElementById('witchGiveOptions').style.display = 'block';
                            
                            // Player selection handler
                            document.querySelectorAll('#witchPlayerSelection .player-option').forEach(option => {
                                option.addEventListener('click', function() {
                                    const targetPlayer = this.dataset.playerId;
                                    socket.emit('witchGiveAction', {
                                        roomCode: currentRoom,
                                        centerCard: selectedCenterCard,
                                        targetPlayer: targetPlayer
                                    });
                                    
                                    document.querySelectorAll('#witchPlayerSelection .player-option').forEach(opt => {
                                        opt.style.pointerEvents = 'none';
                                    });
                                    this.classList.add('selected');
                                });
                            });
                        });
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
                    <div class="drunk-confirmation" style="display:none;">
                        <p>You've swapped with a center card!</p>
                        <p>You won't know which card you took.</p>
                    </div>
                `;
            
                document.querySelectorAll('.center-option').forEach(option => {
                    option.addEventListener('click', function() {
                        socket.emit('drunkAction', { 
                            roomCode: currentRoom, 
                            targetCenter: this.dataset.card 
                        });
                        this.classList.add('selected');
                        document.querySelectorAll('.center-option').forEach(opt => {
                            opt.style.pointerEvents = 'none';
                        });
                        // Show confirmation message instead of card reveal
                        document.querySelector('.drunk-confirmation').style.display = 'block';
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
                            document.querySelectorAll('.player-option').forEach(btn => {
                                btn.style.pointerEvents = 'none';
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
                            document.querySelectorAll('.center-option').forEach(opt => {
                                opt.style.pointerEvents = 'none';
                            });
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
                            document.querySelectorAll('.player-option').forEach(btn => {
                                btn.style.pointerEvents = 'none';
                            });
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
                                document.querySelectorAll('.center-option').forEach(opt => {
                                    opt.style.pointerEvents = 'none';
                                });
                            }
                        });
                    });
                });
                break;
    
            default:
                actionContent.innerHTML = `
                    <div class="phase-header">
                        <h2>${roleInfo.name}'s Turn</h2>
                        <div class="phase-timer" id="turnTimerDisplay">15</div>
                    </div>
                    <p>Waiting for ${roleInfo.name} to take their turn...</p>
                `;
        }
    }

    // Socket Event Handlers
    socket.on('roomUpdate', (players, receivedRoles) => {
        roles = receivedRoles;
        playerCount = players.length;
        
        playerListElement.innerHTML = players.map(player => `
            <li>
                <div class="player-avatar">${player.name?.charAt(0).toUpperCase() || '?'}</div>
                <div class="player-name">${player.name || 'Unnamed'}</div>
                ${player.id === socket.id ? '<span class="player-you">(You)</span>' : ''}
            </li>
        `).join('');

        rolesRequiredText.textContent = `Select ${playerCount + 3} roles`;
        
        isHost = players[0]?.id === socket.id;
        document.getElementById('roles').textContent = isHost ? "Edit Roles" : "View Roles";
        updateStartGameButtonState();
        
        document.getElementById('roomInfo').style.display = 'block';
        roomDisplayElement.textContent = currentRoom;
    });

    socket.on('allPlayersConfirmed', () => {
        console.log('All players confirmed - starting night phase');
    });
    
    socket.on('clearConfirmationScreen', () => {
        const resultDisplay = document.querySelector('.result-display');
        if (resultDisplay) {
            resultDisplay.remove();
        }
    });
    
    socket.on('prepareForNightPhase', () => {
        gameScreenElement.innerHTML = '';
        console.log('Preparing for night phase...');
    });
    
    socket.on('roleConfirmed', ({ confirmedPlayers, players }) => {
        const confirmedCount = Object.keys(confirmedPlayers).length;
        const totalPlayers = players.length;
        
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
        let resultDiv = document.getElementById('werewolfResult') || 
                       document.getElementById('serpentCenterResult') ||
                       document.createElement('div');
        
        if (!resultDiv.id) {
            resultDiv.id = 'werewolfResult';
            document.getElementById('actionContent').appendChild(resultDiv);
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
            } else {
                timerDisplay.classList.remove('pulse');
                timerDisplay.style.color = 'var(--accent-blue)';
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
            } else {
                timerDisplay.classList.remove('pulse');
                timerDisplay.style.color = 'var(--accent-blue)';
            }
        }
    });

    socket.on('gameStart', (assignedRoles) => {
        if (Object.keys(clientAssignedRoles).length > 0) {
            console.error('Received duplicate gameStart! Current roles:', clientAssignedRoles);
            return;
        }
        
        clientAssignedRoles = assignedRoles;
        hideElement(lobbyElement);
        showElement(gameScreenElement);
        showRoleCard(assignedRoles[socket.id]);
    });

    socket.on('nightTurn', ({ currentRole, currentPlayer, isOriginalRole, actualCurrentRole }) => {
        console.log('Received nightTurn event:', { currentRole, currentPlayer, isOriginalRole, actualCurrentRole });
        
        // Clear any existing timer interval
        if (currentTimerInterval) {
            clearInterval(currentTimerInterval);
        }
        
        // Clear any existing elements
        gameScreenElement.innerHTML = `
            <div class="phase-header">
                <h2>${getRoleInfo(currentRole.replace('stolen-', '')).name}'s Turn</h2>
                <div class="phase-timer" id="turnTimerDisplay">15</div>
            </div>
            <div id="actionContent"></div>
        `;
        
        // Start the timer
        let timer = 15;
        const timerDisplay = document.getElementById('turnTimerDisplay');
        currentTimerInterval = setInterval(() => {
            timer--;
            timerDisplay.textContent = timer;
            
            if (timer <= 5) {
                timerDisplay.classList.add('pulse');
                timerDisplay.style.color = 'var(--accent-red)';
            } else {
                timerDisplay.classList.remove('pulse');
                timerDisplay.style.color = 'var(--accent-blue)';
            }
            
            if (timer <= 0) {
                clearInterval(currentTimerInterval);
                // Just let the timer expire - server will handle turn advancement
            }
        }, 1000);
    
        // Get player list and create the full UI
        socket.emit('requestPlayerList', currentRoom);
        socket.once('playerList', players => {
            console.log('Received player list:', players);
            createNightActionUI(currentRole.replace('stolen-', ''), players, currentPlayer === socket.id);
        });
    });

    socket.on('mysticWolfResult', ({ targetRole, targetName }) => {
        const resultElement = document.getElementById('mysticWolfResult');
        const roleInfo = getRoleInfo(targetRole);
        
        resultElement.innerHTML = `
            <div class="card-reveal ${roleInfo.color}">
                <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                <div class="card-title">${targetName}'s Role</div>
                <div class="card-desc">${roleInfo.name}</div>
            </div>
        `;
        
        // Notify server the action is complete
        socket.emit('actionComplete', { roomCode: currentRoom });
    });

    socket.on('minionResult', ({ werewolves, noWerewolves, message }) => {
        const resultElement = document.getElementById('minionResult');
        
        if (noWerewolves) {
            resultElement.innerHTML = `
                <div class="minion-result">
                    <h3>No Werewolves!</h3>
                    <p>${message}</p>
                    <div class="minion-instruction">
                        <i class="fas fa-exclamation-triangle"></i>
                        You must ensure someone dies to win!
                    </div>
                </div>
            `;
        } else {
            resultElement.innerHTML = `
                <div class="minion-result">
                    <h3>${message}</h3>
                    <div class="werewolf-list">
                        ${werewolves.map(name => `
                            <div class="werewolf-item">
                                <i class="fas fa-paw"></i>
                                <span>${name}</span>
                            </div>
                        `).join('')}
                    </div>
                    <p class="minion-note">Remember: You must ensure the werewolves survive!</p>
                </div>
            `;
        }
    });

    socket.on('seerResult', ({ targetRole }) => {
        const resultElement = document.getElementById('seerResult') || 
                             document.getElementById('seerCenterResult');
        
        if (Array.isArray(targetRole)) {
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

    socket.on('witchViewResult', ({ centerCard, centerRole }) => {
        const roleInfo = getRoleInfo(centerRole);
        const resultElement = document.getElementById('witchViewResult');
        
        resultElement.innerHTML = `
            <div class="card-reveal ${roleInfo.color}">
                <div class="card-icon"><i class="${roleInfo.icon}"></i></div>
                <div class="card-title">${roleInfo.name}</div>
                <div class="card-desc">${centerCard.toUpperCase()}</div>
            </div>
        `;
    });
    
    socket.on('witchGiveResult', ({ message }) => {
        const resultElement = document.getElementById('witchViewResult');
        resultElement.innerHTML += `
            <div class="witch-success">
                <i class="fas fa-check-circle"></i> ${message}
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

            document.querySelectorAll('.vote-option').forEach(option => {
                option.addEventListener('click', function() {
                    socket.emit('castVote', {
                        roomCode: currentRoom,
                        target: this.dataset.playerId
                    });
                    this.classList.add('selected');
                    document.querySelectorAll('.vote-option').forEach(opt => {
                        opt.style.pointerEvents = 'none';
                    });
                });
            });
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
                
                <div class="center-cards-reveal">
                    <h3>Center Cards</h3>
                    <div class="center-cards">
                        ${centerCards.map((card, index) => {
                            const roleInfo = getRoleInfo(card);
                            return `
                                <div class="reveal-card ${roleInfo.color}">
                                    <div class="role-icon"><i class="${roleInfo.icon}"></i></div>
                                    <h3>Center ${index + 1}</h3>
                                    <p>${roleInfo.name}</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
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
        clientAssignedRoles = {};
        roles = [];
        isProcessingTurn = false;
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