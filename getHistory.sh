PLAYERID=$1

echo '[' > player${PLAYERID}MatchHistory.json

grep 'd\\":'${PLAYERID}',' matchHistory.txt | sed 's/}"/}/' | sed 's/"{/{/' | tr -d '\\' | sed '$s/\(.*\),/\1 /'>> player${PLAYERID}MatchHistory.json

echo ']' >>  player${PLAYERID}MatchHistory.json

node mmrHistory.js ${PLAYERID} | tr -d '[]' > player${PLAYERID}RatingHistory.log