document.addEventListener('DOMContentLoaded', () => {
    fetchGames();
    loadVotes();
});

async function fetchGames() {
    const loading = document.getElementById('loading');
    const gamesGrid = document.getElementById('games-grid');
    
    try {
        const response = await fetch(`${API_DOMAIN}api/gametimes`);
        const data = await response.json();
        
        if (data.games && data.games.length > 0) {
            const gamesHTML = data.games.map(game => createGameCard(game)).join('');
            gamesGrid.innerHTML = gamesHTML;
        } else {
            gamesGrid.innerHTML = '<div class="no-games">No games scheduled at this time.</div>';
        }
    } catch (error) {
        console.error('Error fetching games:', error);
        gamesGrid.innerHTML = '<div class="error">Failed to load games. Please try again later.</div>';
    } finally {
        loading.style.display = 'none';
    }
}

const TEAM_IMAGES = {
    'Chiefs': 'https://serpapi.com/searches/6791435cc2a5b143fe206802/images/16fc75e2607e2679d44b03632d85b1cfcc334782a233aa83c6c643c84cdc7ccef21b02cc1dbd409ae71bd233627e5e57.png',
    'Bills': 'https://serpapi.com/searches/6791435cc2a5b143fe206802/images/16fc75e2607e2679d44b03632d85b1cfcc334782a233aa83cdc75853bfe95aeafbdcd69b5dfe275131ae5f876cf63370.png',
    'Eagles': 'https://serpapi.com/searches/6791435cc2a5b143fe206802/images/16fc75e2607e2679d44b03632d85b1cfd78cd99fc631830000929c36bbc4e7119eace05b0dafc3b629af2587deabb4a9.png',
    'Commanders': 'https://serpapi.com/searches/6791435cc2a5b143fe206802/images/16fc75e2607e2679d44b03632d85b1cfd78cd99fc6318300dcd6528b575d2c337d298f48c43da95b81611f822bcf11d4.png'
};

function createGameCard(game) {
    const teams = game.teams || [];
    
    const getTeamImage = (teamName) => {
        return TEAM_IMAGES[teamName] || '/static/placeholder-team.png';
    };

    return `
        <div class="game-card">
            <div class="game-date">
                <div class="date">${game.date}</div>
                <div class="time">${game.time}</div>
            </div>
            <div class="teams">
                ${teams.length === 2 ? `
                    <div class="team">
                        <img src="${getTeamImage(teams[0].name)}" alt="${teams[0].name}">
                        <div class="team-name">${teams[0].name}</div>
                    </div>
                    <div class="vs">
                        <span>VS</span>
                        <div class="venue">${game.venue}</div>
                    </div>
                    <div class="team">
                        <img src="${getTeamImage(teams[1].name)}" alt="${teams[1].name}">
                        <div class="team-name">${teams[1].name}</div>
                    </div>
                ` : '<div class="team-tbd">Teams TBD</div>'}
            </div>
            ${game.tournament ? `<div class="tournament">${game.tournament}</div>` : ''}
        </div>
    `;
}

let votes = {
    Chiefs: 0,
    Bills: 0,
    Eagles: 0,
    Commanders: 0
};

const hasVoted = localStorage.getItem('hasVoted');

function updateVoteDisplay() {
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    document.getElementById('total-votes').textContent = totalVotes;

    Object.keys(votes).forEach(team => {
        const percentage = totalVotes === 0 ? 0 : Math.round((votes[team] / totalVotes) * 100);
        const progressBar = document.getElementById(`${team}-progress`);
        const percentageText = document.getElementById(`${team}-percentage`);
        
        progressBar.style.width = `${percentage}%`;
        percentageText.textContent = `${percentage}%`;
    });

    if (hasVoted) {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.disabled = true;
            btn.textContent = 'Voted';
        });
    }
}

async function loadVotes() {
    try {
        const response = await fetch(`${API_DOMAIN}api/votes`);
        const data = await response.json();
        votes = data;
        updateVoteDisplay();
    } catch (error) {
        console.error('Error loading votes:', error);
    }
}

document.querySelectorAll('.vote-btn').forEach(button => {
    button.addEventListener('click', async function() {
        if (hasVoted) return;

        const team = this.dataset.team;
        try {
            const response = await fetch(`${API_DOMAIN}api/votes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ team })
            });
            
            if (!response.ok) throw new Error('Vote failed');
            
            const data = await response.json();
            votes = data;
            
            localStorage.setItem('hasVoted', 'true');
            updateVoteDisplay();
            
            document.querySelectorAll('.vote-btn').forEach(btn => {
                btn.disabled = true;
                btn.textContent = 'Voted';
            });
        } catch (error) {
            console.error('Error casting vote:', error);
            alert('Failed to cast vote. Please try again.');
        }
    });
});
