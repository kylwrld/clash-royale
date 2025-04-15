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
app.get("/1", async (req, res) => {
  const result = await getWinAndLossPercentage("Mega Knight", "2025-03-26", "2025-04-14");
  // console.log(`Win %: ${win}, Loss %: ${loss}`);
  res.json({result})
})

app.get("/2", async (req, res) => {
  const result = await getCompleteDecks(30, "2025-03-26", "2025-04-14");
  // console.log(`Win %: ${win}, Loss %: ${loss}`);
  res.json({result})
})

app.get("/3", async (req, res) => {
  const result = await getLossCombo(["Zap", "Bandit"], "2025-03-26", "2025-04-14");
  // console.log(`Win %: ${win}, Loss %: ${loss}`);
  res.json({result})
})

app.get("/4", async (req, res) => {
  const result = await getWinCount("Zap", 20)
  // console.log(`Win %: ${win}, Loss %: ${loss}`);
  res.json({result})
})

app.get("/5", async (req, res) => {
  const result = await getWinComboGreaterThanPercentage(2, 10, "2025-03-26", "2025-04-14")
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
          startingTrophies: teamEntry.startingTrophies,
          crowns: teamEntry.crowns,
          cards: teamEntry.cards.map(card => ({
            name: card.name,
            level: card.level,
            maxLevel: card.maxLevel,
            iconUrls: { medium: card.iconUrls?.medium || "" }
          }))
        })),
        opponent: battle.opponent.map(opponentEntry => ({
          startingTrophies: opponentEntry.startingTrophies,
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
// function getCompleteDecks(percentage, players, timestamp1, timestamp2) {
//   const decksWinsMap = {}
//   const decks = {}
//   let battleCount = 0
//   for (const player of players) {
//     for (const battle of player.battles) {
//       battleCount++
//       const target = parseClashTimestamp(battle.battleTime);
//       const start = parseClashTimestamp(timestamp1);
//       const end = parseClashTimestamp(timestamp2);
//       if (target >= start && target <= end) {
//         let hashedDeck = ''
//         let deck = []
//         if (battle.team[0].crowns > battle.opponent[0].crowns) {
//           hashedDeck = arrayHash(battle.team[0].cards, (card) => card.name)
//           deck = battle.team[0].cards.map((card) => card.name)
//         } else {
//           hashedDeck = arrayHash(battle.opponent[0].cards, (card) => card.name)
//           deck = battle.opponent[0].cards.map((card) => card.name)
//         }
//         decksWinsMap[hashedDeck] = decksWinsMap[hashedDeck] + 1 || 1
//         decks[hashedDeck] = deck
//       }
//     }
//   }
  
//   // only above percentage
//   let abovePercentage = []
//   Object.entries(decksWinsMap).forEach((value) => {
//     const [hashedDeck, wins] = value
//     if ((wins/battleCount)*100 > percentage) {
//       abovePercentage.push(decks[hashedDeck])
//     }
//   })

//   return abovePercentage
// }

async function getCompleteDecks(percentage, timestamp1, timestamp2) {
  const start = new Date(timestamp1);
  const end = new Date(timestamp2);
  
  const result = await Player.aggregate([
    { $unwind: "$battles" },
  
    {
      $match: {
        "battles.battleTime": { $gte: start, $lte: end }
      }
    },
  
    {
      $project: {
        deck: {
          $map: {
            input: {
              $getField: {
                field: "cards",
                input: { $arrayElemAt: ["$battles.team", 0] }
              }
            },
            as: "card",
            in: "$$card.name"
          }
        },
        victory: {
          $gt: [
            { $getField: { field: "crowns", input: { $arrayElemAt: ["$battles.team", 0] } } },
            { $getField: { field: "crowns", input: { $arrayElemAt: ["$battles.opponent", 0] } } }
          ]
        }
      }
    },
  
    {
      $project: {
        deck: { $setUnion: ["$deck", []] },
        victory: 1
      }
    },
  
    {
      $group: {
        _id: "$deck",
        victories: {
          $sum: { $cond: ["$victory", 1, 0] }
        },
        total: { $sum: 1 }
      }
    },
  
    {
      $addFields: {
        winRate: {
          $multiply: [{ $divide: ["$victories", "$total"] }, 100]
        }
      }
    },
  
    {
      $match: {
        winRate: { $gte: percentage } 
      }
    },  
    {
      $project: {
        _id: 0,
        deck: "$_id",
        victories: 1,
        total: 1,
        winRate: 1
      }
    }
  ]);
  
  console.log(result)
  return result
}

// 3
async function getLossCombo(cards, timestamp1, timestamp2) {
  const start = new Date(timestamp1);
  const end = new Date(timestamp2);
  Z
  const result = await Player.aggregate([
    { $unwind: "$battles" },
  
    {
      $match: {
        "battles.battleTime": { $gte: start, $lte: end }
      }
    },
  
    {
      $project: {
        deck: {
          $map: {
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
            in: "$$card.name"
          }
        },
        isDefeat: {
          $lt: [
            { $getField: { field: "crowns", input: { $arrayElemAt: ["$battles.team", 0] } } },
            { $getField: { field: "crowns", input: { $arrayElemAt: ["$battles.opponent", 0] } } }
          ]
        }
      }
    },
  
    {
      $addFields: {
        hasCombo: {
          $setIsSubset: [cards, "$deck"]
        }
      }
    },
  
    {
      $match: {
        isDefeat: true,
        hasCombo: true
      }
    },
  
    {
      $group: {
        _id: null,
        defeatsWithCombo: { $sum: 1 }
      }
    },
  
    {
      $project: {
        _id: 0,
        defeatsWithCombo: 1
      }
    }
  ]);
  console.log(result)
  return result
}

// 4
// function getWinCount(cardToSearch, players, percentage) {
//   let winCount = 0 
//   const towerHealth = [1400, 1512, 1624, 1750, 1890, 
//                       2030, 2184, 2352, 2534, 2786,
//                       3052, 3346, 3668, 4032, 4424]

//   for (const player of players) {
//     for (const battle of player.battles) {
//       const duration = estimateBattleDuration(battle.type, battle.team[0].crowns, battle.opponent[0].crowns)
//       if (duration <= 120) {
//         const winner = battle.team[0].crowns > battle.opponent[0].crowns ? battle.team[0] : battle.opponent[0] 
//         const loser = battle.team[0].crowns > battle.opponent[0].crowns ? battle.opponent[0] : battle.team[0] 
//         if (loser.princessTowersHitPoints === null || loser.princessTowersHitPoints.length < 2) continue
//         for (const card of winner.cards) {
//           if (card.name !== cardToSearch) continue
//           const loserTrophies = (loser.startingTrophies-(loser.startingTrophies*(percentage/100)))
//           const percentageLessTrophies = winner.startingTrophies < loserTrophies
//           const twoTowersTaken = towerHealth.includes(loser.princessTowersHitPoints[0]) && towerHealth.includes(loser.princessTowersHitPoints[1])
//           if (percentageLessTrophies && twoTowersTaken) winCount++
//         }
//       }
//     }
//   }
//   return winCount
// }
async function getWinCount(cardToSearch, percentage) {
  const result = await Player.aggregate([
    { $unwind: "$battles" },

    {
      $project: {
        battleTime: "$battles.battleTime",
        team: { $arrayElemAt: ["$battles.team", 0] },
        opponent: { $arrayElemAt: ["$battles.opponent", 0] }
      }
    },

    {
      $project: {
        teamCrowns: "$team.crowns",
        opponentCrowns: "$opponent.crowns",
        teamTrophies: "$team.startingTrophies",
        opponentTrophies: "$opponent.startingTrophies",
        isTeamWinner: { $gt: ["$teamCrowns", "$opponentCrowns"] },
        teamDeck: {
          $map: {
            input: { $ifNull: ["$team.cards", []] },
            as: "card",
            in: "$$card.name"
          }
        },
        opponentDeck: {
          $map: {
            input: { $ifNull: ["$opponent.cards", []] },
            as: "card",
            in: "$$card.name"
          }
        },
        battleType: "$battles.type"
      }
    },
  
    {
      $addFields: {
        duration: {
          $switch: {
            branches: [
              {
                // Instant win (3 crowns)
                case: { $eq: [{ $max: ["$teamCrowns", "$opponentCrowns"] }, 3] },
                then: 90
              },
              {
                // Sudden death mode
                case: { $eq: ["$battleType", "suddenDeath"] },
                then: 60
              },
              {
                // Low crown count games usually lasted full time
                case: {
                  $and: [
                    { $lte: [{ $sum: ["$teamCrowns", "$opponentCrowns"] }, 1] },
                    {
                      $in: [
                        "$battleType",
                        [
                          "pvp",
                          "trail",
                          "pathOfLegend",
                          "tournament",
                          "seasonalBattle",
                          "clanWarWarDay",
                          "riverRacePvp",
                          "riverRaceDuel",
                          "riverRaceDuelColosseum",
                          "clanWarCollectionDay"
                        ]
                      ]
                    }
                  ]
                },
                then: 240
              },
              {
                // Fast-paced modes
                case: {
                  $in: [
                    "$battleType",
                    [
                      "tripleElixir",
                      "doubleElixir",
                      "rampUp",
                      "casual",
                      "pvp2v2",
                      "clanMate",
                      "challenge",
                      "friendly",
                      "boatBattle",
                      "boatBattlePractice",
                      "practice"
                    ]
                  ]
                },
                then: 120
              },
              {
                // Survival and other long modes
                case: { $eq: ["$battleType", "survival"] },
                then: 300
              },
              {
                // Tutorial or PVE (generally short)
                case: { $in: ["$battleType", ["tutorial", "pve"]] },
                then: 120
              }
            ],
            default: 180 // Default fallback duration
          }
        },
        winnerDeck: {
          $cond: ["$isTeamWinner", "$teamDeck", "$opponentDeck"]
        },
        loserTrophies: {
          $cond: ["$isTeamWinner", "$opponentTrophies", "$teamTrophies"]
        },
        winnerTrophies: {
          $cond: ["$isTeamWinner", "$teamTrophies", "$opponentTrophies"]
        },
        loserCrowns: {
          $cond: ["$isTeamWinner", "$opponentCrowns", "$teamCrowns"]
        } 
      }
    },

    {
      $match: {
        duration: { $lt: 121 },
        loserCrowns: { $gte: 2 },
        $expr: {
          $and: [
            { $in: [cardToSearch, "$winnerDeck"] },
            {
              $lte: [
                "$winnerTrophies",
                {
                  $multiply: [
                    "$loserTrophies",
                    1 - percentage / 100
                  ]
                }
              ]
            }
          ]
        }
      }
    },
  
    {
      $group: {
        _id: null,
        victoryCount: { $sum: 1 }
      }
    },
  
    {
      $project: {
        _id: 0,
        victoryCount: 1
      }
    }
  

  ]);
  
  return result
}

// 5
async function getWinComboGreaterThanPercentage(n, percentage, timestamp1, timestamp2) {
  const start = new Date(timestamp1);
  const end = new Date(timestamp2);
  
  function getCombos(deck, size) {
    const results = [];
    const combine = (start, path) => {
      if (path.length === size) {
        results.push([...path].sort());
        return;
      }
      for (let i = start; i < deck.length; i++) {
        combine(i + 1, [...path, deck[i]]);
      }
    };
    combine(0, []);
    return results;
  }
  
  async function calculateWinningCombos(start, end, comboSize, minWinRate) {
    const players = await mongoose.connection.collection("players").find({
      "battles.battleTime": { $gte: start, $lte: end }
    }).toArray();
    
    const comboStats = new Map();
  
    for (const player of players) {
      for (const battle of player.battles) {
  
        const team = battle.team?.[0];
        const opponent = battle.opponent?.[0];
        if (!team?.cards || !opponent) continue;
  
        const teamCrowns = team.crowns || 0;
        const opponentCrowns = opponent.crowns || 0;
  
        const isVictory = teamCrowns > opponentCrowns;
        const cardNames = team.cards.map(c => c.name);
        console.log(cardNames, comboSize)
        const combos = getCombos(cardNames, comboSize);
        
  
        for (const combo of combos) {
          const key = combo.join("|");
          const data = comboStats.get(key) || { victories: 0, total: 0, deck: combo };
          data.total++;
          if (isVictory) data.victories++;
          comboStats.set(key, data);
        }
      }
    }
    
    const results = Array.from(comboStats.values())
      .map(c => ({
        ...c,
        winRate: (c.victories / c.total) * 100
      }))
      .filter(c => c.winRate >= minWinRate)
      .sort((a, b) => b.winRate - a.winRate);
  
    return results;
  }

  const results = await calculateWinningCombos(start, end, n, 60);
  
  return results
}

// const estimateBattleDuration = (battleType, teamCrowns, opponentCrowns) => {
//   const totalCrowns = teamCrowns + opponentCrowns;
//   const maxCrowns = Math.max(teamCrowns, opponentCrowns);

//   // Instant win (3-crown) often ends < 2min
//   if (maxCrowns === 3) return 90;

//   // If game mode is sudden death, it's short by design
//   if (battleType === "suddenDeath") return 60;

//   // Low crown count usually means it went full time or overtime
//   if (totalCrowns <= 1) {
//     switch (battleType) {
//       case "pvp":
//       case "trail":
//       case "pathOfLegend":
//       case "tournament":
//       case "seasonalBattle":
//       case "clanWarWarDay":
//       case "riverRacePvp":
//       case "riverRaceDuel":
//       case "riverRaceDuelColosseum":
//       case "clanWarCollectionDay":
//         return 240; // Very likely a full-length match
//     }
//   }

//   // Fast-paced modes, often end <2min
//   const fastModes = [
//     "tripleElixir",
//     "doubleElixir",
//     "rampUp",
//     "casual",
//     "pvp2v2",
//     "clanMate",
//     "challenge",
//     "friendly",
//     "clanMate",
//     "boatBattle",
//     "boatBattlePractice",
//     "practice",
//   ];

//   if (fastModes.includes(battleType)) return 120;

//   // Survival and others that can run long
//   if (battleType === "survival") return 300;

//   // Tutorial or PVE — generally short
//   if (battleType === "tutorial" || battleType === "pve") return 120;

//   // Fallback
//   return 180;
// };


// function charSum(s) {
//   var i, sum = 0;
//   for (i = 0; i < s.length; i++) {
//     sum += (s.charCodeAt(i) * (i+1));
//   }
//   return sum
// }

// function arrayHash(arr, key) {
//   var i, sum = 0
//   for (i = 0; i < arr.length; i++) {
//     var cs = charSum(key(arr[i]))
//     sum = sum + (65027 / cs)
//   }
//   return ("" + sum).slice(0,16)
// }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))