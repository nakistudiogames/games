/*
 * Allow/deny matrix for firestore.rules, run against the local emulator
 * (needs Java; downloads the emulator jar on first run). From firebase/:
 *
 *   npx firebase-tools emulators:exec --only firestore \
 *     --project demo-rules-check "node rules-check.mjs"
 *
 * Run this after ANY rules change, before deploying. Add cases here when a
 * new game adds its own rule blocks.
 */
const HOST = "http://127.0.0.1:8080";
const PROJECT = "demo-rules-check";
const BASE = `${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (uid) =>
  `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    auth_time: 1000000000,
    user_id: uid,
    sub: uid,
    iat: 1000000000,
    exp: 9000000000,
    firebase: { sign_in_provider: "anonymous", identities: {} },
  })}.`;

const S = (v) => ({ stringValue: v });
const I = (v) => ({ integerValue: String(v) });

async function patch(path, fields, uid) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}),
    },
    body: JSON.stringify({ fields }),
  });
  return res.status;
}
async function get(path, uid) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: uid ? { Authorization: `Bearer ${token(uid)}` } : {},
  });
  return res.status;
}

let failures = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} (got ${got}, want ${want})`);
}

const lvl = (n, uid) => `games/cube-dash/levels/${n}/scores/${uid}`;
const now = Date.now();

// players
check("player create own", await patch("games/cube-dash/players/u1", { name: S("Tester") }, "u1"), 200);
check("player write other's doc", await patch("games/cube-dash/players/u1", { name: S("Evil") }, "u2"), 403);
check("player extra field", await patch("games/cube-dash/players/u3", { name: S("Tester"), hack: S("x") }, "u3"), 403);
check("player short name", await patch("games/cube-dash/players/u4", { name: S("ab") }, "u4"), 403);
check("player unauthenticated", await patch("games/cube-dash/players/u5", { name: S("Tester") }, null), 403);
check("player public read", await get("games/cube-dash/players/u1"), 200);

// cube-dash level times (level 1 floor = (15+3)*250 = 4500ms)
const t = { name: S("Tester"), timeMs: I(30000), at: I(now) };
check("level create valid", await patch(lvl(1, "u1"), t, "u1"), 200);
check("level create below floor", await patch(lvl(1, "u9"), { ...t, timeMs: I(4400) }, "u9"), 403);
check("level 100 floor rejects 60s", await patch(lvl(100, "u9"), { ...t, timeMs: I(60000) }, "u9"), 403);
check("level 100 accepts 100s", await patch(lvl(100, "u9"), { ...t, timeMs: I(100000) }, "u9"), 200);
check("level update worse time", await patch(lvl(1, "u1"), { ...t, timeMs: I(31000) }, "u1"), 403);
check("level update better time", await patch(lvl(1, "u1"), { ...t, timeMs: I(29000) }, "u1"), 200);
check("level extra field", await patch(lvl(2, "u1"), { ...t, hack: S("x") }, "u1"), 403);
check("level non-numeric id", await patch(lvl("abc", "u1"), t, "u1"), 403);
check("level id 0", await patch(lvl(0, "u1"), t, "u1"), 403);
check("level missing at", await patch(lvl(3, "u1"), { name: S("Tester"), timeMs: I(30000) }, "u1"), 403);

// cube-dash overall
const ov = { name: S("Tester"), highestLevel: I(3), totalTimeMs: I(95000), at: I(now) };
check("overall create", await patch("games/cube-dash/overall/u1", ov, "u1"), 200);
check("overall lower highestLevel", await patch("games/cube-dash/overall/u1", { ...ov, highestLevel: I(2) }, "u1"), 403);
check("overall higher level, more time", await patch("games/cube-dash/overall/u1", { ...ov, highestLevel: I(4), totalTimeMs: I(140000) }, "u1"), 200);

// generic per-game high-score board (future games)
const sc = { name: S("Tester"), score: I(120), at: I(now) };
check("scores create (word-rush)", await patch("games/word-rush/scores/u1", sc, "u1"), 200);
check("scores lower score", await patch("games/word-rush/scores/u1", { ...sc, score: I(50) }, "u1"), 403);
check("scores equal score", await patch("games/word-rush/scores/u1", sc, "u1"), 200);
check("scores other's doc", await patch("games/word-rush/scores/u1", sc, "u2"), 403);

// private cloud saves
const save = { data: { mapValue: { fields: { unlockedLevel: I(7) } } }, at: I(now) };
check("save create own", await patch("games/cube-dash/saves/u1", save, "u1"), 200);
check("save write other's doc", await patch("games/cube-dash/saves/u1", save, "u2"), 403);
check("save read own", await get("games/cube-dash/saves/u1", "u1"), 200);
check("save read other's (private)", await get("games/cube-dash/saves/u1", "u2"), 403);
check("save read unauthenticated", await get("games/cube-dash/saves/u1", null), 403);
check("save extra field", await patch("games/cube-dash/saves/u3", { ...save, hack: S("x") }, "u3"), 403);
check("save data not a map", await patch("games/cube-dash/saves/u3", { data: S("junk"), at: I(now) }, "u3"), 403);
check("save missing at", await patch("games/cube-dash/saves/u3", { data: save.data }, "u3"), 403);

// old root-level paths are dead
check("old root players path", await patch("players/u1", { name: S("Tester") }, "u1"), 403);
check("old root levels path", await patch("levels/1/scores/u1", t, "u1"), 403);
check("random collection", await patch("junk/x", { a: S("b") }, "u1"), 403);

console.log(failures === 0 ? "ALL_RULES_CHECKS_PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
