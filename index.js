import express from 'express';
import mongoose from 'mongoose';

import dotenv from 'dotenv';

dotenv.config();

const CardSchema = new mongoose.Schema({
  name: String,
  level: Number,
  maxLevel: Number,
  iconUrls: {
    medium: String
  }
}, { _id: false });

const PlayerInfoSchema = new mongoose.Schema({
  tag: String,
  name: String,
  startingTrophies: Number,
  clan: {
    tag: String,
    name: String,
    badgeId: Number
  },
  cards: [CardSchema],
  crowns: Number,
  deck: [CardSchema]
}, { _id: false });

const BattleSchema = new mongoose.Schema({
  battleTime: {
    type: Date,
    set: (value) => {
      if (typeof value === "string" && value.match(/^\d{8}T\d{6}\.\d{3}Z$/)) {
        return new Date(
          value.replace(
            /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
            "$1-$2-$3T$4:$5:$6.$7Z"
          )
        );
      }
      return value;
    },
  },
  team: [PlayerInfoSchema],
  opponent: [PlayerInfoSchema],
  type: String,
  gameMode: {
    id: Number,
    name: String
  },
  isLadderTournament: Boolean,
  arena: {
    id: Number,
    name: String
  }
}, { _id: false });

const PlayerSchema = new mongoose.Schema({
  tag: { type: String, unique: true },
  name: String,
  expLevel: Number,
  trophies: Number,
  bestTrophies: Number,
  battleCount: Number,
  wins: Number,
  losses: Number,
  threeCrownWins: Number,
  clan: {
    tag: String,
    name: String,
    badgeId: Number
  },
  arena: {
    id: Number,
    name: String
  },
  currentDeck: [CardSchema],
  cards: [CardSchema],
  battles: [BattleSchema]
});

const Player = mongoose.model("Player", PlayerSchema);


try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB conectado com sucesso!");
} catch (error) {
  console.error("Erro ao conectar no MongoDB:", error);
  process.exit(1);
}

async function fetchApi(url, props = {}) {
  url = `https://api.clashroyale.com/v1/${url}` 
  const response = await fetch(url, { 
    headers: {
      "Authorization": "Bearer " + process.env.CLASH_ROYALE_API
    },
    ...props
  })
  return response
}

const app = express()

// app.get('/', async (req, res) => {
//   // all leaderboards
//   const leaderboards = await fetchApi("leaderboards").then((res) => res.json())
  
//   // find Retro Royale leaderboard
//   const retroRoyale = leaderboards.items.find((leaderboard) => leaderboard.name === "Retro Royale")
    
//   // get 10 players from Retro Royale
//   const leaderboard = await fetchApi(`leaderboard/${retroRoyale.id}`).then((res) => res.json())
//   const players = leaderboard.items
//   const tenPlayers = players.slice(0, 21)
  

//   // attach battles to the players
//   for (const player of tenPlayers) {
//     const tag = player.tag.slice(1)
//     const battles = await fetchApi(`players/%23${tag}/battlelog`).then((res) => res.json())
//     // max battlelog size is 40
//     player.battles = battles.slice(0, 41)
//   }

//   // 1
//   // const card = "Zap"
//   // console.log(`Porcentagem da carta ${card} em um intervalo de tempo: `, getWinAndLossPercentage(card, tenPlayers, "20250326T000000.000Z", "20250412T235959.000Z"))
  
//   // 2
//   // const percentage = 9
//   // console.log(`Decks com ${percentage}% de vitória`, getCompleteDecks(percentage, tenPlayers, "20250326T000000.000Z", "20250412T235959.000Z"))

//   // 4
//   // console.log("Vitorias em que o vencedor tem % menos troféu, a partida durou menos de 2 minutos e o perdedor derrubou 2 torres", getWinCount("Zap", tenPlayers, 20))

//   res.send(tenPlayers)
// })

app.get("/all", async (req, res) => {
  res.json(await Player.find())
  
  // Player.find({}, function(err, players) {
  //   var playerMap = {};

  //   players.forEach(function(player) {
  //     playerMap[player._id] = player;
  //   });

  //   res.send(playerMap);  
  // });
})
app.get("/win-and-loss-percentage", async (req, res) => {
  const result = await getWinAndLossPercentage("Mega Knight", "2025-03-26", "2025-04-14");
  // console.log(`Win %: ${win}, Loss %: ${loss}`);
  res.json({result})
})

app.get("/", async (req, res) => {
  await Player.deleteMany({});
  try {
    // all leaderboards
    const leaderboards = await fetchApi("leaderboards").then(res => res.json());

    // find retro royale leaderboard
    const retroRoyale = leaderboards.items.find(
      leaderboard => leaderboard.name === "Retro Royale"
    );
    if (!retroRoyale) return res.status(404).send("Retro Royale leaderboard not found");

    // top 10 players from leaderboard
    const leaderboard = await fetchApi(`leaderboard/${retroRoyale.id}`).then(res => res.json());
    const topPlayers = leaderboard.items.slice(0, 10);
    const insertedPlayers = [];

    for (const player of topPlayers) {
      const cleanTag = player.tag.slice(1); 
      const battlelog = await fetchApi(`players/%23${cleanTag}/battlelog`).then(res => res.json());

      const cleanBattlelog = battlelog.slice(0, 20).map(battle => ({
        battleTime: battle.battleTime,
        team: battle.team.map(teamEntry => ({
          crowns: teamEntry.crowns,
          cards: teamEntry.cards.map(card => ({
            name: card.name,
            level: card.level,
            maxLevel: card.maxLevel,
            iconUrls: { medium: card.iconUrls?.medium || "" }
          }))
        })),
        opponent: battle.opponent.map(opponentEntry => ({
          crowns: opponentEntry.crowns,
          cards: opponentEntry.cards.map(card => ({
            name: card.name,
            level: card.level,
            maxLevel: card.maxLevel,
            iconUrls: { medium: card.iconUrls?.medium || "" }
          }))
        })),
        type: battle.type,
        gameMode: battle.gameMode,
        isLadderTournament: battle.isLadderTournament,
        arena: battle.arena
      }));
      
      const enrichedPlayer = {
        tag: player.tag,
        name: player.name,
        expLevel: player.expLevel,
        trophies: player.trophies,
        bestTrophies: player.bestTrophies,
        battleCount: player.battleCount,
        wins: player.wins,
        losses: player.losses,
        threeCrownWins: player.threeCrownWins,
        clan: player.clan,
        arena: player.arena,
        currentDeck: player.currentDeck,
        cards: player.cards,
        battles: cleanBattlelog
      };

      // update if exists, insert if not
      const upserted = await Player.findOneAndUpdate(
        { tag: enrichedPlayer.tag },
        { $set: enrichedPlayer },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      insertedPlayers.push(upserted);
      // const stored = await Player.findOne({ tag: enrichedPlayer.tag }).lean();
      // console.log(JSON.stringify(stored.battles, null, 2));
    }

    
    res.json(insertedPlayers);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});


function parseClashTimestamp(timestamp) {
  // 20250411T220846.000Z to 2025-04-11T22:08:46.000Z
  const match = timestamp.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.000Z$/);
  if (!match) return null;

  const [_, year, month, day, hour, minute, second] = match;
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  return new Date(isoString);
}

// 1
// function getWinAndLossPercentage(cardToSearch, players, timestamp1, timestamp2) {
//   let winCount = 0 
//   let battleCount = 0
//   let cardFound = false
//   let cardsUsedCounter = {}
//   for (const player of players) {
//     for (const battle of player.battles) {        
//       const target = parseClashTimestamp(battle.battleTime);
//       const start = parseClashTimestamp(timestamp1);
//       const end = parseClashTimestamp(timestamp2);
//       if (target >= start && target <= end) {
//         for (const card of battle.team[0].cards) {
//           cardsUsedCounter[card.name] = cardsUsedCounter[card.name] + 1 || 1
//           if (card.name === cardToSearch) {
//             cardFound = true
//             battleCount++
//             if (battle.team[0].crowns > battle.opponent[0].crowns) winCount++
//           }
//         }
//         for (const card of battle.opponent[0].cards) {
//           cardsUsedCounter[card.name] = cardsUsedCounter[card.name] + 1 || 1
//           if (card.name === cardToSearch) {
//             if (!cardFound) battleCount++
//             if (battle.opponent[0].crowns > battle.team[0].crowns) winCount++
//           }
//         }
//       }
//     }
//   }
//   const winPercentage = (winCount/battleCount)*100
//   const lossPercentage = 100-winPercentage
  
//   return [winPercentage, lossPercentage]
// }

async function getWinAndLossPercentage(cardToSearch, timestamp1, timestamp2) {
  const start = new Date(timestamp1);
  const end = new Date(timestamp2);
  
  const result = await Player
  .aggregate([
    { $unwind: "$battles" },
    {
      $match: {
        "battles.battleTime": {
          $gte: start,
          $lte: end  
        }
      }
    },
    {
      $project: {
        teamCrowns: {
          $getField: {
            field: "crowns",
            input: { $arrayElemAt: ["$battles.team", 0] }
          }
        },
        opponentCrowns: {
          $getField: {
            field: "crowns",
            input: { $arrayElemAt: ["$battles.opponent", 0] }
          }
        },
        containsCard: {
          $or: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: {
                        $ifNull: [
                          {
                            $getField: {
                              field: "cards",
                              input: { $arrayElemAt: ["$battles.team", 0] }
                            }
                          },
                          []
                        ]
                      },
                      as: "card",
                      cond: { $eq: ["$$card.name", cardToSearch] }
                    }
                  }
                },
                0
              ]
            },
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: {
                        $ifNull: [
                          {
                            $getField: {
                              field: "cards",
                              input: { $arrayElemAt: ["$battles.opponent", 0] }
                            }
                          },
                          []
                        ]
                      },
                      as: "card",
                      cond: { $eq: ["$$card.name", cardToSearch] }
                    }
                  }
                },
                0
              ]
            }
          ]
        }          
      }
    },
    {
      $match: {
        containsCard: true
      }
    },
    {
      $group: {
        _id: null,
        totalMatches: { $sum: 1 },
        victories: {
          $sum: {
            $cond: [{ $gt: ["$teamCrowns", "$opponentCrowns"] }, 1, 0]
          }
        },
        defeats: {
          $sum: {
            $cond: [{ $lt: ["$teamCrowns", "$opponentCrowns"] }, 1, 0]
          }
        }
      }
    },
  
    {
      $project: {
        _id: 0,
        totalMatches: 1,
        victories: 1,
        defeats: 1,
        winPercentage: {
          $multiply: [{ $divide: ["$victories", "$totalMatches"] }, 100]
        },
        lossPercentage: {
          $multiply: [{ $divide: ["$defeats", "$totalMatches"] }, 100]
        }
      }
    }
  ])
  
  console.log(result[0])  

  return [result[0].winPercentage, result[0].lossPercentage]
}

// 2
function getCompleteDecks(percentage, players, timestamp1, timestamp2) {
  const decksWinsMap = {}
  const decks = {}
  let battleCount = 0
  for (const player of players) {
    for (const battle of player.battles) {
      battleCount++
      const target = parseClashTimestamp(battle.battleTime);
      const start = parseClashTimestamp(timestamp1);
      const end = parseClashTimestamp(timestamp2);
      if (target >= start && target <= end) {
        let hashedDeck = ''
        let deck = []
        if (battle.team[0].crowns > battle.opponent[0].crowns) {
          hashedDeck = arrayHash(battle.team[0].cards, (card) => card.name)
          deck = battle.team[0].cards.map((card) => card.name)
        } else {
          hashedDeck = arrayHash(battle.opponent[0].cards, (card) => card.name)
          deck = battle.opponent[0].cards.map((card) => card.name)
        }
        decksWinsMap[hashedDeck] = decksWinsMap[hashedDeck] + 1 || 1
        decks[hashedDeck] = deck
      }
    }
  }
  
  // only above percentage
  let abovePercentage = []
  Object.entries(decksWinsMap).forEach((value) => {
    const [hashedDeck, wins] = value
    if ((wins/battleCount)*100 > percentage) {
      abovePercentage.push(decks[hashedDeck])
    }
  })

  return abovePercentage
}

// 4
// Calcule a quantidade de vitórias envolvendo a carta X (parâmetro) nos
// casos em que o vencedor possui Z% (parâmetro) menos troféus do que
// o perdedor, a partida durou menos de 2 minutos, e o perdedor 
// derrubou ao menos duas torres do adversário.
function getWinCount(cardToSearch, players, percentage) {
  let winCount = 0 
  const towerHealth = [1400, 1512, 1624, 1750, 1890, 
                      2030, 2184, 2352, 2534, 2786,
                      3052, 3346, 3668, 4032, 4424]

  for (const player of players) {
    for (const battle of player.battles) {
      const duration = estimateBattleDuration(battle.type, battle.team[0].crowns, battle.opponent[0].crowns)
      if (duration <= 120) {
        const winner = battle.team[0].crowns > battle.opponent[0].crowns ? battle.team[0] : battle.opponent[0] 
        const loser = battle.team[0].crowns > battle.opponent[0].crowns ? battle.opponent[0] : battle.team[0] 
        if (loser.princessTowersHitPoints === null || loser.princessTowersHitPoints.length < 2) continue
        for (const card of winner.cards) {
          if (card.name !== cardToSearch) continue
          const loserTrophies = (loser.startingTrophies-(loser.startingTrophies*(percentage/100)))
          const percentageLessTrophies = winner.startingTrophies < loserTrophies
          const twoTowersTaken = towerHealth.includes(loser.princessTowersHitPoints[0]) && towerHealth.includes(loser.princessTowersHitPoints[1])
          if (percentageLessTrophies && twoTowersTaken) winCount++
        }
      }
    }
  }
  return winCount
}

const estimateBattleDuration = (battleType, teamCrowns, opponentCrowns) => {
  const totalCrowns = teamCrowns + opponentCrowns;
  const maxCrowns = Math.max(teamCrowns, opponentCrowns);

  // Instant win (3-crown) often ends < 2min
  if (maxCrowns === 3) return 90;

  // If game mode is sudden death, it's short by design
  if (battleType === "suddenDeath") return 60;

  // Low crown count usually means it went full time or overtime
  if (totalCrowns <= 1) {
    switch (battleType) {
      case "pvp":
      case "trail":
      case "pathOfLegend":
      case "tournament":
      case "seasonalBattle":
      case "clanWarWarDay":
      case "riverRacePvp":
      case "riverRaceDuel":
      case "riverRaceDuelColosseum":
      case "clanWarCollectionDay":
        return 240; // Very likely a full-length match
    }
  }

  // Fast-paced modes, often end <2min
  const fastModes = [
    "tripleElixir",
    "doubleElixir",
    "rampUp",
    "casual",
    "pvp2v2",
    "clanMate",
    "challenge",
    "friendly",
    "clanMate",
    "boatBattle",
    "boatBattlePractice",
    "practice",
  ];

  if (fastModes.includes(battleType)) return 120;

  // Survival and others that can run long
  if (battleType === "survival") return 300;

  // Tutorial or PVE — generally short
  if (battleType === "tutorial" || battleType === "pve") return 120;

  // Fallback
  return 180;
};


function charSum(s) {
  var i, sum = 0;
  for (i = 0; i < s.length; i++) {
    sum += (s.charCodeAt(i) * (i+1));
  }
  return sum
}

function arrayHash(arr, key) {
  var i, sum = 0
  for (i = 0; i < arr.length; i++) {
    var cs = charSum(key(arr[i]))
    sum = sum + (65027 / cs)
  }
  return ("" + sum).slice(0,16)
}

const test1 = [
  {
     "name":"Wall Breakers",
     "id":26000058,
     "level":6,
     "starLevel":3,
     "evolutionLevel":1,
     "maxLevel":9,
     "maxEvolutionLevel":1,
     "rarity":"epic",
     "elixirCost":2,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/_xPphEfC8eEwFNrfU3cMQG9-f5JaLQ31ARCA7l3XtW4.png",
        "evolutionMedium":"https://api-assets.clashroyale.com/cardevolutions/300/_xPphEfC8eEwFNrfU3cMQG9-f5JaLQ31ARCA7l3XtW4.png"
     }
  },
  {
     "name":"Mega Knight",
     "id":26000055,
     "level":3,
     "starLevel":2,
     "evolutionLevel":1,
     "maxLevel":6,
     "maxEvolutionLevel":1,
     "rarity":"legendary",
     "elixirCost":7,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/O2NycChSNhn_UK9nqBXUhhC_lILkiANzPuJjtjoz0CE.png",
        "evolutionMedium":"https://api-assets.clashroyale.com/cardevolutions/300/O2NycChSNhn_UK9nqBXUhhC_lILkiANzPuJjtjoz0CE.png"
     }
  },
  {
     "name":"Prince",
     "id":26000016,
     "level":6,
     "starLevel":1,
     "maxLevel":9,
     "rarity":"epic",
     "elixirCost":5,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/3JntJV62aY0G1Qh6LIs-ek-0ayeYFY3VItpG7cb9I60.png"
     }
  },
  {
     "name":"Archer Queen",
     "id":26000072,
     "level":1,
     "maxLevel":4,
     "rarity":"champion",
     "elixirCost":5,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/p7OQmOAFTery7zCzlpDdm-LOD1kINTm42AwIHchZfWk.png"
     }
  },
  {
     "name":"Bandit",
     "id":26000046,
     "level":3,
     "starLevel":1,
     "maxLevel":6,
     "rarity":"legendary",
     "elixirCost":3,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/QWDdXMKJNpv0go-HYaWQWP6p8uIOHjqn-zX7G0p3DyM.png"
     }
  },
  {
     "name":"Goblin Gang",
     "id":26000041,
     "level":11,
     "starLevel":3,
     "maxLevel":14,
     "rarity":"common",
     "elixirCost":3,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/NHflxzVAQT4oAz7eDfdueqpictb5vrWezn1nuqFhE4w.png"
     }
  },
  {
     "name":"Arrows",
     "id":28000001,
     "level":11,
     "starLevel":3,
     "maxLevel":14,
     "rarity":"common",
     "elixirCost":3,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/Flsoci-Y6y8ZFVi5uRFTmgkPnCmMyMVrU7YmmuPvSBo.png"
     }
  },
  {
     "name":"Zap",
     "id":28000008,
     "level":11,
     "starLevel":1,
     "maxLevel":14,
     "maxEvolutionLevel":1,
     "rarity":"common",
     "elixirCost":2,
     "iconUrls":{
        "medium":"https://api-assets.clashroyale.com/cards/300/7dxh2-yCBy1x44GrBaL29vjqnEEeJXHEAlsi5g6D1eY.png",
        "evolutionMedium":"https://api-assets.clashroyale.com/cardevolutions/300/7dxh2-yCBy1x44GrBaL29vjqnEEeJXHEAlsi5g6D1eY.png"
     }
  }
]
// console.log(arrayHash(test1, (obj) => obj.name))
// const t = {}
// t[arrayHash(test1, (obj) => obj.name)] = 0
// console.log(t)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))