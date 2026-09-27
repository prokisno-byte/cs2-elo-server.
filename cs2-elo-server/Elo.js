// utils/elo.js — simplified ELO update
// Real matchmaking doesn't expose the opponents' ratings to us via GSI,
// so we treat the "opponent" as an average-skill baseline (1000) and move
// the player's rating toward/away from that based on win/loss and score margin.
const BASE_OPPONENT_ELO = 1000;
const K_FACTOR = 28;

function computeEloChange(currentElo, result, scoreTeam, scoreEnemy) {
  const expected = 1 / (1 + Math.pow(10, (BASE_OPPONENT_ELO - currentElo) / 400));
  const actual = result === 'win' ? 1 : result === 'loss' ? 0 : 0.5;

  // Small bonus/penalty for margin of victory (capped so it never dominates).
  let marginFactor = 1;
  if (typeof scoreTeam === 'number' && typeof scoreEnemy === 'number') {
    const diff = Math.abs(scoreTeam - scoreEnemy);
    marginFactor = Math.min(1.3, 1 + diff / 40);
  }

  const rawChange = K_FACTOR * marginFactor * (actual - expected);
  return Math.round(rawChange);
}

module.exports = { computeEloChange };
