var CHECK_ID = process.argv[2] | 0;
var matchHistory = require(`./player${CHECK_ID}MatchHistory.json`);


var MMRHistory = [];
for (var i = 0 ; i < matchHistory.length; i++) {
    var match = matchHistory[i];
    var team1Players = match.team1.members;
    var team2Players = match.team2.members;
    for (var j = 0; j < team1Players.length; j++) {
        if (team1Players[j].id == CHECK_ID) {
            MMRHistory.push(team1Players[j].currentMMR);
            break;
        } else if (team2Players[j].id == CHECK_ID) {
            MMRHistory.push(team2Players[j].currentMMR);
            break;
        }
    }
}

console.log(MMRHistory);
