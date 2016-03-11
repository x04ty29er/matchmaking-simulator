var fs = require('fs');

var MIN_K = 0;
var BASE_K = 32;
var INIT_MMR = 1500;
var TRUE_MMR_BASE = 1500;
var TRUE_STDEV = 400;
var TEAM_SIZE = 5;
var MINIMUM_MMR = 100;
var MATCH_TOTAL = 100000;
var NUM_PLAYERS = 5000;
var VIEW_ID = 0;
var DEBUG = false;

var matchHistory = [];

if (process.argv[2]) {
    playerPool = require("./" + process.argv[2]);
} else {
    var playerPool = generatePlayers(NUM_PLAYERS);
}

if (!String.format) {
    String.format = function (format) {
        var args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    };
}


console.log("BUCKETS");
console.log(countBuckets(playerPool));
var diffObj = computeDifferences(playerPool);
console.log("DIFF FROM TRUE");
console.log(diffObj.dist);
console.log("WORST PLAYER");
console.log(diffObj.worstPlayer);

var prevWorstId = diffObj.worstPlayer.id;

debugOutput(playerPool[VIEW_ID]);
var lastResult;
for (var j = 0; j < MATCH_TOTAL; j++) {
    lastResult = playMatch(playerPool);
    matchHistory.push(JSON.stringify(lastResult));
}

console.log(lastResult.toString());

debugOutput(playerPool[VIEW_ID]);
debugOutput(lastResult.team1);
debugOutput(lastResult.team2);

console.log("BUCKETS");
console.log(countBuckets(playerPool));

diffObj = computeDifferences(playerPool);
debugOutput("Difference between current and true MMR:\n");
debugOutput("Average:\t" + diffObj.average);
debugOutput("Min:\t" + diffObj.min);
debugOutput("Max:\t" + diffObj.max);
console.log("DIFF FROM TRUE");
console.log(diffObj.dist);
console.log("WORST PLAYER");
console.log(diffObj.worstPlayer);
console.log("OLD WORST");
console.log(playerPool[prevWorstId]);

fs.writeFileSync("players.json", JSON.stringify(playerPool));
fs.writeFileSync("matchHistory.json", JSON.stringify(matchHistory));

function computeDifferences(dataSetObject) {
    var output = {
        min: 100000,
        max: 0,
        average: 0,
        worstPlayer: {},
        dist: {}
    };

    var dataSet = Object.keys(dataSetObject).map(function (key) { return (key == 'numPlayers' ? null : dataSetObject[key]); });

    dataSet.forEach(function (player) {
        if (player) {
            var diff = Math.abs(player.currentMMR - player.trueMMR);
            if (diff < output.min) {
                output.min = diff;
            }

            if (diff > output.max) {
                output.max = diff;
                output.worstPlayer = player;
            }

            output.average += diff / dataSet.length;
            var bucket = Math.floor(diff / 100) * 100;
            if (!output.dist[bucket]) {
                output.dist[bucket] = 0;
            }

            output.dist[bucket]++;
        }
    });

    return output;
}

function countBuckets(dataSetObject) {
    var output = {};

    var dataSet = Object.keys(dataSetObject).map(function (key) { return (key == 'numPlayers' ? null : dataSetObject[key]); });

    dataSet.forEach(function (player) {
        if (player) {
            var bucket = Math.floor(player.currentMMR / 100) * 100;
            if (!output[bucket]) {
                output[bucket] = 0;
            }

            output[bucket]++;
        }
    });

    return output;
}

function playMatch(playerPool) {
    var matchResult = {
        winner: "",
        team1: {},
        team2: {}
    };

    var teamSize = TEAM_SIZE;
    var seedPlayerRed = playerPool[Math.floor(Math.random() * playerPool.numPlayers)];
    var seedPlayerBlue;
    var bestMatch;
    var triedPlayers = 0;
    do {
        var playerSeed = Math.floor(Math.random() * playerPool.numPlayers);
        while (playerSeed == seedPlayerRed.id) {
            playerSeed = Math.floor(Math.random() * playerPool.numPlayers);
        }

        seedPlayerBlue = playerPool[Math.floor(Math.random() * playerPool.numPlayers)];
        if (!bestMatch || Math.abs(seedPlayerBlue.currentMMR - seedPlayerRed.currentMMR) <= Math.abs(seedPlayerRed.currentMMR - bestMatch.currentMMR)) {
            bestMatch = seedPlayerBlue;
        }

        triedPlayers++;
    } while ((Math.abs(seedPlayerBlue.currentMMR - seedPlayerRed.currentMMR) > Math.ceil(triedPlayers / 10) * 50))

    seedPlayerBlue = bestMatch;

    var teamRed = {};
    teamRed.members = makeTeam(teamSize, playerPool, seedPlayerRed, [seedPlayerBlue]);
    var teamBlue = {};
    teamBlue.members = makeTeam(teamSize, playerPool, seedPlayerBlue, teamRed.members);

    teamRed.averageMMR = computeTeamSkill(teamRed.members);
    teamBlue.averageMMR = computeTeamSkill(teamBlue.members);

    var randNum = Math.random();
    var teamRedWinChance = 1 / (1 + Math.pow(10,(teamBlue.averageMMR - teamRed.averageMMR) / 400));

    if (teamRedWinChance < 0.01) {
        teamRedWinChance = 0.01;
    } else if (teamRedWinChance > 0.99) {
        teamRedWinChance = 0.99;
    }

    if (randNum <= teamRedWinChance) {
        debugOutput(teamRed.averageMMR + "\tvs\t" + teamBlue.averageMMR + "\tWinner: Red\t" + teamRed.members[0].currentMMR + "\t" + teamBlue.members[0].currentMMR);
        teamRed.members.forEach(function (player) {
            var updatePlayer = playerPool[player.id];
            updatePlayer.wins += 1;
            updateMMR(updatePlayer, teamBlue.members, true);
        });

        teamBlue.members.forEach(function (player) {
            var updatePlayer = playerPool[player.id];
            updatePlayer.losses += 1;
            updateMMR(updatePlayer, teamRed.members, false);
        });

        matchResult.winner = "RED";
    } else {
        debugOutput(teamRed.averageMMR + "\tvs\t" + teamBlue.averageMMR + "\tWinner: Blue\t" + teamRed.members[0].currentMMR + "\t" + teamBlue.members[0].currentMMR);
        teamBlue.members.forEach(function (player) {
            var updatePlayer = playerPool[player.id];
            updatePlayer.wins += 1;
            updateMMR(updatePlayer, teamRed.members, true);
        });

        teamRed.members.forEach(function (player) {
            var updatePlayer = playerPool[player.id];
            updatePlayer.losses += 1;
            updateMMR(updatePlayer, teamBlue.members, false);
        });

        matchResult.winner = "BLUE";
    }

    propgateUpdatedMMR(teamRed.members);
    propgateUpdatedMMR(teamBlue.members);

    teamRed.toString = teamToString.bind(teamRed);
    teamBlue.toString = teamToString.bind(teamBlue);

    matchResult.team1 = teamRed;
    matchResult.team2 = teamBlue;

    matchResult.toString = function matchToString() {
        var output = "";
        output += this.team1.toString();
        output += "vs\n";
        output += this.team2.toString();
        output += "Winner:\t" + this.winner;
        return output;
    };

    return matchResult;
}

function teamToString() {
    var output = "";
    this.members.forEach(function (player) {
        output += player.toString() + "\n";
    });

    output += this.averageMMR + "\n";

    return output;
};

function computeTeamSkill(players) {
    /*
    players.sort(function(player1, player2) {
        return player1.trueMMR - player2.trueMMR;
    });
    
    var totalSkillIndex = 0;
    for (var i = 0; i < players.length; i++) {
        totalSkillIndex += players[i].trueMMR * (2 * (i+1) / players.length);
    }
    
    return totalSkillIndex / players.length;*/

    return players.reduce(function (previousValue, player1, currentIndex, array) {
        return previousValue + player1.trueMMR;
    }, 0)/players.length;
}

function propgateUpdatedMMR(playerList) {
    playerList.forEach(function (player) {
        player.currentMMR = Math.max(player.adjustedMMR, MINIMUM_MMR);
    });
}

function updateMMR(playerToUpdate, opposingTeam, updatePlayerWin) {
    var expectedScore = 0;
    var actualScore = (updatePlayerWin ? 1 : 0) * opposingTeam.length;
    for (var i = 0; i < opposingTeam.length; i++) {
        expectedScore += 1 / (1 + Math.pow(10,(opposingTeam[i].currentMMR - playerToUpdate.currentMMR) / 400));
    }

    playerToUpdate.adjustedMMR = playerToUpdate.currentMMR + getK(playerToUpdate) * (actualScore - expectedScore);
    if (playerToUpdate.id == 0) {
        debugOutput((updatePlayerWin ? "WIN\t" : "LOSE\t") + playerToUpdate.currentMMR + "\t" + playerToUpdate.adjustedMMR + "\t" + expectedScore);
    }
}

function getK(player) {
    if (player.currentMMR > 2600) {
        return BASE_K / 4;
    }

    if (player.currentMMR > 2200) {
        return BASE_K / 2;
    }

    return BASE_K;
}

function makeTeam(teamSize, playerPool, seedPlayer, unusablePlayers) {
    var unusableIds = unusablePlayers.map(function (player) {
        return player.id;
    });

    var team = [];
    var testPlayer;
    var triedPlayers = 0;
    do {
        var playerSeed = Math.floor(Math.random() * playerPool.numPlayers);
        while (unusableIds.indexOf(playerSeed) >= 0) {
            playerSeed = Math.floor(Math.random() * playerPool.numPlayers);
        }

        testPlayer = playerPool[playerSeed];
        if (Math.abs(testPlayer.currentMMR - seedPlayer.currentMMR) < Math.ceil(triedPlayers / 10) * 50) {
            team.push(testPlayer);
            unusableIds.push(testPlayer.id);
        }

        triedPlayers++;
    } while (team.length < teamSize)

    return team;
}

function generatePlayers(numPlayers) {
    var players = {};
    var baseMMR = INIT_MMR;
    var trueBaseMMR = TRUE_MMR_BASE;
    var baseDev = 0;
    var stdev = TRUE_STDEV;

    var currentMMRDist = gaussian(baseMMR, baseDev);
    var trueMMRDist = gaussian(trueBaseMMR, stdev);
    /**
     * player
     * id           uniqueId
     * currentMMR   current rating. all starts at 1200
     * trueMMR      "skill" rating.
     * wins         wins
     * losses
     */

    players.numPlayers = numPlayers;

    for (var i = 0; i < numPlayers; i++) {
        var player = {
            id: i,
            currentMMR: currentMMRDist(),
            trueMMR: trueMMRDist(),
            wins: 0,
            losses: 0
        };

        player.adjustedMMR = player.currentMMR;

        player.toString = function playerToString() {
            var output = this.id + "\t" + this.currentMMR + "\t" + this.trueMMR + "\t" + this.wins + "\t" + this.losses;
            return output;
        };

        players[player.id] = player;
    }

    return players;
}

function gaussian(mean, stdev) {
    var y2;
    var use_last = false;
    return function () {
        var y1;
        if (use_last) {
            y1 = y2;
            use_last = false;
        } else {
            var x1, x2, w;
            do {
                x1 = 2.0 * Math.random() - 1.0;
                x2 = 2.0 * Math.random() - 1.0;
                w = x1 * x1 + x2 * x2;
            } while (w >= 1.0);
            w = Math.sqrt((-2.0 * Math.log(w)) / w);
            y1 = x1 * w;
            y2 = x2 * w;
            use_last = true;
        }

        var retval = mean + stdev * y1;
        return Math.abs(retval);
    };
}

function debugOutput(message) {
    if (DEBUG) {
        console.log(message);
    }
}