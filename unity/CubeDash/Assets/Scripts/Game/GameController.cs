using System.Collections.Generic;
using CubeDash.Audio;
using CubeDash.Logic;
using CubeDash.View;
using UnityEngine;
using UnityEngine.UI;
using static CubeDash.Logic.RunnerLogic;

namespace CubeDash.Game
{
    /// <summary>
    /// Port of GameScene.ts minus ads: same state machine (ready/playing/
    /// paused/dead/complete), same seeded spawning, jump buffer, pause rules,
    /// HUD and overlays. The rewarded revive is intentionally omitted.
    /// </summary>
    public sealed class GameController : MonoBehaviour
    {
        public int Level = 1;

        private const float ReadyPulsePeriod = 1.4f;
        private const float MaxDtMs = 50f;
        private const float JumpBufferMs = 110f;
        private const float FirstPowerUpPx = 1500f;
        private const float ClearRunwayPx = 1200f;

        private enum Phase { Ready, Playing, Paused, Dead, Complete }

        private sealed class ObstacleView
        {
            public Obstacle Obs;
            public GameObject View;
        }

        private sealed class PowerUpView
        {
            public PowerUp P;
            public GameObject View;
        }

        private WorldTheme _world;
        private CharacterSpec _spec;
        private Mulberry32 _rng;
        private Phase _phase = Phase.Ready;
        private Runner _runner;
        private readonly List<ObstacleView> _obstacles = new();
        private readonly List<PowerUpView> _powerUps = new();
        private double _levelLengthPx;
        private double _distancePx;
        private double _elapsedMs;
        private double _nextPowerUpAt = FirstPowerUpPx;
        private float _jumpBufferMs;
        private float _doubleJumpMs;
        private float _resumeGuardUntil;

        private GameObject _player;
        private SpriteRenderer _playerShadow;
        private SpriteRenderer _goldAura;
        private ParticleSystem _trail, _dust, _sparkle, _burst;
        private GameObject _finish;
        private ScrollingTiled _bgFar, _bgMid, _bgMid2, _ground;

        private Canvas _canvas;
        private Text _scoreText, _timerText, _levelText, _powerBadge, _readyText, _muteLabel;
        private RectTransform _progressFill;
        private GameObject _pauseOverlay;

        private void Start()
        {
            _world = WorldData.ForLevel(Level);
            _spec = CharacterData.ById(Storage.GetString("character", "dash"));
            _levelLengthPx = LevelLengthM(Level) * 10;
            _runner = new Runner { Y = GROUND_Y, Vy = 0, Grounded = true };
            // Seeded per level: every attempt has the identical layout — and the
            // identical layout to the web build (see RngParityTests).
            _rng = new Mulberry32(LevelSeed(Level));

            BuildBackground();
            BuildPlayer();
            BuildHud();
        }

        private double RemainingPx => _levelLengthPx - _distancePx;

        private int ProgressPct =>
            (int)System.Math.Min(100, System.Math.Floor(_distancePx / _levelLengthPx * 100));

        // ------------------------------------------------------------------
        // Construction

        private void BuildBackground()
        {
            var sky = Draw.FromSprite(transform, "sky", TextureFactory.Sky(_world), 0);
            sky.transform.position = Px.V(360, GROUND_Y / 2);
            sky.transform.localScale = new Vector3(Px.WIDTH / 2f, (float)GROUND_Y / 2f, 1f);

            _bgFar = ScrollingTiled.Create(transform, "stars", TextureFactory.Stars(),
                0, 0, Px.WIDTH, GROUND_Y, 10, 0.7f);

            var sil = TextureFactory.Silhouette(_world);
            _bgMid = ScrollingTiled.Create(transform, "sil", sil,
                0, GROUND_Y - 320, Px.WIDTH, 320, 20, 0.55f);
            // Third level of each world onward gains a second, more distant layer
            // (web: tileScale 0.7 => displayed height 224).
            if ((Level - 1) % 5 >= 2)
            {
                _bgMid2 = ScrollingTiled.Create(transform, "sil2", sil,
                    0, GROUND_Y - 545, Px.WIDTH / 0.7f, 320, 10, 0.3f);
                _bgMid2.transform.localScale = new Vector3(0.7f, 0.7f, 1f);
            }

            // Atmospheric haze over the silhouettes (alpha ramps downward).
            var hazeP = new Painter(2, 64);
            for (int y = 0; y < 64; y++)
                hazeP.FillRect(0, y, 2, 1, _world.Haze, 0.35f * y / 63f);
            var haze = Draw.FromSprite(transform, "haze", hazeP.ToSprite(new Vector2(0, 1), FilterMode.Bilinear), 30);
            haze.transform.position = Px.V(0, GROUND_Y - 320);
            haze.transform.localScale = new Vector3(Px.WIDTH / 2f, 5f, 1f);

            _ground = ScrollingTiled.Create(transform, "ground", TextureFactory.Ground(_world),
                0, GROUND_Y, Px.WIDTH, Px.HEIGHT - (float)GROUND_Y, 40);

            // Ground falls away into darkness below the track.
            var fadeP = new Painter(2, 64);
            for (int y = 0; y < 64; y++)
                fadeP.FillRect(0, y, 2, 1, 0x000000, 0.65f * y / 63f);
            var fade = Draw.FromSprite(transform, "groundFade", fadeP.ToSprite(new Vector2(0, 1), FilterMode.Bilinear), 41);
            fade.transform.position = Px.V(0, GROUND_Y);
            fade.transform.localScale = new Vector3(Px.WIDTH / 2f, (Px.HEIGHT - (float)GROUND_Y) / 64f, 1f);

            // Neon edge on the ground in the level accent color.
            uint accent = LevelColor(Level);
            var glow = Draw.Quad(transform, "edgeGlow", Px.WIDTH, 10, accent, 50, 0.12f);
            glow.transform.position = Px.V(360, GROUND_Y - 5);
            var edge = Draw.Quad(transform, "edge", Px.WIDTH, 5, accent, 50);
            edge.transform.position = Px.V(360, GROUND_Y - 0.5);
        }

        private void BuildPlayer()
        {
            float s = (float)PLAYER_SIZE;
            _player = new GameObject("player");
            _player.transform.SetParent(transform, false);
            _player.transform.position = Px.V(PLAYER_X + s / 2, GROUND_Y - s / 2);

            // Gold overlay shown only while double-jump is active — distinct
            // from the character's always-on signature aura.
            var gold = Draw.Quad(_player.transform, "goldAura", s + 18, s + 18, 0xffd54f, 98, 0.28f);
            _goldAura = gold.GetComponent<SpriteRenderer>();
            _goldAura.enabled = false;

            Auras.Attach(_player.transform, _spec, s, 99);
            CharacterFactory.BuildParts(_player.transform, _spec, s, 100);

            var shadow = Draw.FromSprite(transform, "playerShadow", TextureFactory.Shadow(), 60);
            shadow.transform.position = Px.V(PLAYER_X + s / 2, GROUND_Y + 9);
            _playerShadow = shadow.GetComponent<SpriteRenderer>();

            _trail = Fx.Trail(_player.transform, _spec.Trail);
            _dust = Fx.Dust(transform);
            _sparkle = Fx.Sparkle(transform);
            _burst = Fx.Burst(transform);
        }

        private void BuildHud()
        {
            _canvas = UiFactory.EnsureCanvas("game-hud");
            _canvas.transform.SetParent(transform, false);
            var root = _canvas.transform;
            uint accent = LevelColor(Level);

            _scoreText = UiFactory.Label(root, "0%", 360, 110, 72, 0xffffff, bold: true);
            _timerText = UiFactory.Label(root, "0.0s", 505, 110, 30, 0x8a93a8,
                align: TextAnchor.MiddleLeft);
            _levelText = UiFactory.Label(root, $"LEVEL {Level}", 360, 172, 34, accent);

            // Progress bar across the top, GD-style.
            MakeBar(root, 0x232b3e, out _);
            MakeBar(root, accent, out _progressFill);
            _progressFill.localScale = new Vector3(0f, 1f, 1f);

            _powerBadge = UiFactory.Label(root, "", 40, 145, 38, 0xffd54f, bold: true,
                align: TextAnchor.MiddleLeft);

            UiFactory.TextButton(root, "II", 668, 70, 40, 0xffffff, 0x232b3e,
                TogglePause, 80, 80);
            _muteLabel = UiFactory.TextButton(root, MuteGlyph(), 52, 70, 26, 0xffffff, 0x232b3e,
                ToggleMute, 84, 80).GetComponentInChildren<Text>();

            _readyText = UiFactory.Label(root,
                $"{_world.Name}\nLEVEL {Level}\nTAP TO START", 360, 700, 52, 0xa5d6a7);
        }

        private static void MakeBar(Transform root, uint color, out RectTransform fill)
        {
            var go = new GameObject("bar");
            fill = go.AddComponent<RectTransform>();
            fill.SetParent(root, false);
            fill.anchorMin = fill.anchorMax = new Vector2(0.5f, 0.5f);
            fill.pivot = new Vector2(0f, 0.5f);
            fill.sizeDelta = new Vector2(400, 10);
            fill.anchoredPosition = new Vector2(160 - 360, 640 - 36);
            var img = go.AddComponent<Image>();
            img.color = Px.C(color);
            img.raycastTarget = false;
        }

        private static string MuteGlyph() => Storage.GetBool("musicMuted", false) ? "off" : "on";

        // ------------------------------------------------------------------
        // Input & phases

        private void OnTap()
        {
            if (_phase == Phase.Ready)
            {
                _phase = Phase.Playing;
                Destroy(_readyText.gameObject);
                _readyText = null;
                _trail.Play();
                if (!Storage.GetBool("musicMuted", false)) AudioEngine.I.PlayMusic(_world.Music);
                return;
            }
            if (_phase != Phase.Playing) return;
            if (Time.time < _resumeGuardUntil) return;
            string kind = TryJump(_runner, _doubleJumpMs > 0);
            if (kind == "ground")
            {
                AudioEngine.I.Jump();
            }
            else if (kind == "air")
            {
                AudioEngine.I.AirJump();
                Fx.Explode(_sparkle, 10, _player.transform.position + Vector3.down * (float)PLAYER_SIZE / 2);
            }
            else
            {
                _jumpBufferMs = JumpBufferMs;
            }
        }

        private void TogglePause()
        {
            if (_phase == Phase.Playing) PauseGame();
            else if (_phase == Phase.Paused) ResumeGame();
        }

        private void ToggleMute()
        {
            bool nowMuted = !Storage.GetBool("musicMuted", false);
            Storage.SetBool("musicMuted", nowMuted);
            _muteLabel.text = MuteGlyph();
            if (nowMuted) AudioEngine.I.StopMusic();
            else if (_phase == Phase.Playing) AudioEngine.I.PlayMusic(_world.Music);
        }

        private void PauseGame()
        {
            _phase = Phase.Paused;
            _trail.Stop();
            AudioEngine.I.StopMusic();

            _pauseOverlay = new GameObject("pause-overlay");
            var rt = _pauseOverlay.AddComponent<RectTransform>();
            rt.SetParent(_canvas.transform, false);
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            var img = _pauseOverlay.AddComponent<Image>();
            img.color = new Color(0, 0, 0, 0.7f);

            UiFactory.Label(rt, "PAUSED", 360, 1280 * 0.3, 80, 0xffffff, bold: true);
            UiFactory.Label(rt, $"Level {Level}  ·  {ProgressPct}%", 360, 1280 * 0.4, 40, 0xffd54f);
            UiFactory.TextButton(rt, "RESUME", 360, 1280 * 0.53, 52, 0xa5d6a7, 0x1e3320, ResumeGame);
            UiFactory.TextButton(rt, "RESTART LEVEL", 360, 1280 * 0.63, 44, 0xffd54f, 0x332e1a,
                () => Flow.ToGame(Level));
            UiFactory.TextButton(rt, "MENU", 360, 1280 * 0.73, 44, 0x90caf9, 0x16283d, () =>
            {
                AudioEngine.I.StopMusic();
                Flow.ToMenu();
            });
        }

        private void ResumeGame()
        {
            if (_pauseOverlay != null) Destroy(_pauseOverlay);
            _phase = Phase.Playing;
            // Swallows the tap that pressed RESUME so it doesn't also jump.
            _resumeGuardUntil = Time.time + 0.2f;
            _trail.Play();
            if (!Storage.GetBool("musicMuted", false)) AudioEngine.I.PlayMusic(_world.Music);
        }

        private void OnApplicationFocus(bool focus)
        {
            if (!focus && _phase == Phase.Playing) PauseGame();
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused && _phase == Phase.Playing) PauseGame();
        }

        // ------------------------------------------------------------------
        // Frame loop

        private void Update()
        {
            if (_readyText != null)
            {
                var c = _readyText.color;
                c.a = Mathf.Lerp(1f, 0.35f, 0.5f - 0.5f * Mathf.Cos(2 * Mathf.PI * Time.time / ReadyPulsePeriod));
                _readyText.color = c;
            }

            bool tapped = Input.GetMouseButtonDown(0) && !PointerOnUi()
                          || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.UpArrow);
            if (tapped) OnTap();
            if (Input.GetKeyDown(KeyCode.Escape)) TogglePause();

            if (_phase != Phase.Playing) return;

            float deltaMs = Time.deltaTime * 1000f;
            _elapsedMs += deltaMs;
            double dt = Mathf.Min(deltaMs, MaxDtMs) / 1000.0;
            double speed = LevelSpeed(Level);
            _distancePx += speed * dt;

            // Parallax: stars drift, skyline rolls, ground grid matches the track.
            _bgFar.Scroll((float)(speed * dt * 0.12));
            if (_bgMid2 != null) _bgMid2.Scroll((float)(speed * dt * 0.22));
            _bgMid.Scroll((float)(speed * dt * 0.4));
            _ground.Scroll((float)(speed * dt));

            foreach (var ov in _obstacles)
            {
                ov.Obs.X -= speed * dt;
                PlaceObstacle(ov);
            }
            while (_obstacles.Count > 0 && _obstacles[0].Obs.X + _obstacles[0].Obs.W < -40)
            {
                Destroy(_obstacles[0].View);
                _obstacles.RemoveAt(0);
            }
            MaybeSpawnPattern(speed);
            UpdatePowerUps(speed, dt, deltaMs);
            UpdateFinish();

            var obsList = new Obstacle[_obstacles.Count];
            for (int i = 0; i < _obstacles.Count; i++) obsList[i] = _obstacles[i].Obs;

            bool wasAirborne = !_runner.Grounded;
            StepRunner(_runner, dt, SupportAt(_runner.Y, obsList));
            if (_runner.Grounded && wasAirborne)
            {
                float z = _player.transform.localEulerAngles.z;
                _player.transform.localRotation = Quaternion.Euler(0, 0, Mathf.Round(z / 90f) * 90f);
                Fx.Explode(_dust, 6, Px.V(PLAYER_X + PLAYER_SIZE / 2, _runner.Y - 4));
                if (_jumpBufferMs > 0)
                {
                    Jump(_runner);
                    AudioEngine.I.Jump();
                }
            }
            _jumpBufferMs = Mathf.Max(0, _jumpBufferMs - deltaMs);
            if (!_runner.Grounded)
                _player.transform.Rotate(0, 0, -6f * Mathf.Rad2Deg * (float)dt);
            _player.transform.position = Px.V(PLAYER_X + PLAYER_SIZE / 2, _runner.Y - PLAYER_SIZE / 2);

            // Ground shadow shrinks and fades as the cube gains height.
            float airHeight = (float)(GROUND_Y - _runner.Y);
            float shadowF = Mathf.Max(0.25f, 1f - airHeight / 500f);
            _playerShadow.transform.localScale = new Vector3(1.25f * shadowF, shadowF, 1f);
            _playerShadow.color = new Color(1, 1, 1, 0.35f + 0.45f * shadowF);

            _scoreText.text = $"{ProgressPct}%";
            _timerText.text = $"{_elapsedMs / 1000.0:0.0}s";
            _progressFill.localScale = new Vector3(
                Mathf.Min(1f, (float)(_distancePx / _levelLengthPx)), 1f, 1f);

            if (RemainingPx <= 40)
            {
                CompleteLevel();
                return;
            }
            if (CheckDeath(_runner.Y, obsList)) Die();
        }

        private static bool PointerOnUi() =>
            UnityEngine.EventSystems.EventSystem.current != null &&
            UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject();

        private void PlaceObstacle(ObstacleView ov)
        {
            var o = ov.Obs;
            double top = o.Kind == ObstacleKind.Swing
                ? GROUND_Y - o.H - SwingElev(o)
                : GROUND_Y - o.Elev - o.H;
            ov.View.transform.position = Px.V(o.X, top);
        }

        private void MaybeSpawnPattern(double speed)
        {
            // Leave a clean runway before the finish line.
            if (RemainingPx < ClearRunwayPx) return;
            double gap = MinGapPx(speed) * LevelGapScale(Level);
            double lastEnd = _obstacles.Count > 0
                ? _obstacles[^1].Obs.X + _obstacles[^1].Obs.W
                : double.NegativeInfinity;
            if (lastEnd > Px.WIDTH + 40 - gap) return;
            double startX = System.Math.Max(Px.WIDTH + 40, lastEnd + gap);
            var pattern = PickPattern(_rng, speed, Level);
            foreach (var spec in pattern.Obstacles)
            {
                var obs = new Obstacle
                {
                    X = startX + spec.Dx,
                    W = spec.W,
                    H = spec.H,
                    Elev = spec.Elev,
                    Kind = spec.Kind,
                    // Seeded rng: the bob phase is part of the fixed layout.
                    Phase = spec.Kind == ObstacleKind.Swing ? _rng.Next() * Mathf.PI * 2 : 0,
                };
                var ov = new ObstacleView { Obs = obs, View = ObstacleFactory.Build(transform, obs) };
                PlaceObstacle(ov);
                _obstacles.Add(ov);
            }
        }

        private void UpdateFinish()
        {
            if (_finish == null && RemainingPx < Px.WIDTH + 400)
            {
                _finish = ObstacleFactory.BuildFinish(transform);
                ObstacleFactory.TintFinishPole(_finish, LevelColor(Level));
            }
            if (_finish != null)
                _finish.transform.position = Px.V(PLAYER_X + RemainingPx, GROUND_Y);
        }

        private void UpdatePowerUps(double speed, double dt, float deltaMs)
        {
            for (int i = _powerUps.Count - 1; i >= 0; i--)
            {
                var pv = _powerUps[i];
                pv.P.X -= speed * dt;
                pv.View.transform.position = Px.V(pv.P.X, pv.P.Y);
                if (pv.P.X < -80)
                {
                    Destroy(pv.View);
                    _powerUps.RemoveAt(i);
                }
                else if (CollectsPowerUp(_runner.Y, pv.P))
                {
                    CollectPowerUp(pv.P);
                    Destroy(pv.View);
                    _powerUps.RemoveAt(i);
                }
            }

            // Spawn the next pickup once due, clear of obstacles and runway.
            if (_distancePx >= _nextPowerUpAt && RemainingPx > ClearRunwayPx)
            {
                double x = Px.WIDTH + 60;
                bool blocked = false;
                foreach (var ov in _obstacles)
                    if (ov.Obs.X < x + 160 && ov.Obs.X + ov.Obs.W > x - 160) blocked = true;
                if (!blocked)
                {
                    var p = MakePowerUp(_rng, x);
                    _powerUps.Add(new PowerUpView { P = p, View = BuildPowerUpView(p) });
                    _nextPowerUpAt = _distancePx + PowerUpGapPx(_rng);
                }
            }

            if (_doubleJumpMs > 0)
            {
                _doubleJumpMs = Mathf.Max(0, _doubleJumpMs - deltaMs);
                _powerBadge.text = $"^^ {Mathf.CeilToInt(_doubleJumpMs / 1000f)}s";
                _goldAura.enabled = true;
                var c = _goldAura.color;
                c.a = 0.2f + 0.12f * Mathf.Sin(Time.time * 1000f / 110f);
                _goldAura.color = c;
                if (_doubleJumpMs == 0)
                {
                    _powerBadge.text = "";
                    _goldAura.enabled = false;
                }
            }
        }

        private void CollectPowerUp(PowerUp p)
        {
            _doubleJumpMs = 10_000;
            AudioEngine.I.Collect();
            Fx.Explode(_sparkle, 16, Px.V(PLAYER_X + PLAYER_SIZE / 2, p.Y));
            UiFactory.FloatBanner(_canvas.transform, "DOUBLE JUMP!", 520, 60, 0xffd54f);
        }

        private GameObject BuildPowerUpView(PowerUp p)
        {
            var root = new GameObject("powerup");
            root.transform.SetParent(transform, false);
            root.transform.position = Px.V(p.X, p.Y);
            var spinner = new GameObject("spin");
            spinner.transform.SetParent(root.transform, false);
            var back = Draw.Quad(spinner.transform, "edge", 46, 46, 0xffffff, 85, 0.9f);
            back.transform.localRotation = Quaternion.Euler(0, 0, 45);
            var diamond = Draw.Quad(spinner.transform, "fill", 40, 40, 0xffd54f, 86);
            diamond.transform.localRotation = Quaternion.Euler(0, 0, 45);
            spinner.AddComponent<SpinBehaviour>().DegreesPerSec = -360f / 1.8f;

            // Double-chevron glyph, drawn (emoji-free).
            var pGlyph = new Painter(22, 24);
            pGlyph.Line(3, 10, 11, 2, 3.4, 0x12141c);
            pGlyph.Line(11, 2, 19, 10, 3.4, 0x12141c);
            pGlyph.Line(3, 20, 11, 12, 3.4, 0x12141c);
            pGlyph.Line(11, 12, 19, 20, 3.4, 0x12141c);
            Draw.FromSprite(root.transform, "glyph", pGlyph.ToSprite(), 87);

            root.AddComponent<BobBehaviour>();
            return root;
        }

        // ------------------------------------------------------------------
        // End states

        private int BumpBestPct(int pct)
        {
            string key = $"bestPct:{Level}";
            int best = Mathf.Max(Storage.GetInt(key, 0), pct);
            Storage.SetInt(key, best);
            return best;
        }

        private void CompleteLevel()
        {
            _phase = Phase.Complete;
            _scoreText.text = "100%";
            _progressFill.localScale = Vector3.one;
            _trail.Stop();
            BumpBestPct(100);
            int unlocked = Storage.GetInt("unlockedLevel", 1);
            if (Level + 1 > unlocked) Storage.SetInt("unlockedLevel", Level + 1);
            AudioEngine.I.StopMusic();
            AudioEngine.I.Complete();
            Fx.Explode(_sparkle, 30, _player.transform.position);

            var rt = Overlay();
            UiFactory.Label(rt, "LEVEL\nCOMPLETE!", 360, 1280 * 0.28, 84, LevelColor(Level), bold: true);
            UiFactory.Label(rt,
                $"Level {Level} cleared in {_elapsedMs / 1000.0:0.0}s\nLevel {Level + 1} unlocked!",
                360, 1280 * 0.44, 44, 0xffd54f);
            UiFactory.TextButton(rt, "NEXT LEVEL", 360, 1280 * 0.58, 52, 0xa5d6a7, 0x1e3320,
                () => Flow.ToGame(Level + 1));
            UiFactory.TextButton(rt, "REPLAY", 360, 1280 * 0.68, 44, 0xffd54f, 0x332e1a,
                () => Flow.ToGame(Level));
            UiFactory.TextButton(rt, "MENU", 360, 1280 * 0.77, 40, 0x90caf9, 0x16283d, Flow.ToMenu);
        }

        private void Die()
        {
            _phase = Phase.Dead;
            _trail.Stop();
            Fx.Explode(_burst, 28, _player.transform.position);
            _player.SetActive(false);
            _playerShadow.enabled = false;
            _powerBadge.text = "";
            AudioEngine.I.StopMusic();
            AudioEngine.I.Death();
            StartCoroutine(CameraShake(0.2f, 7f));
            int pct = ProgressPct;
            int best = BumpBestPct(pct);

            var rt = Overlay();
            UiFactory.Label(rt, $"CRASHED\nAT {pct}%", 360, 1280 * 0.28, 80, 0xffffff, bold: true);
            UiFactory.Label(rt, $"Level {Level}  ·  Best: {best}%", 360, 1280 * 0.43, 46, 0xffd54f);
            UiFactory.TextButton(rt, "RETRY", 360, 1280 * 0.56, 52, 0xa5d6a7, 0x1e3320,
                () => Flow.ToGame(Level));
            UiFactory.TextButton(rt, "MENU", 360, 1280 * 0.75, 40, 0x90caf9, 0x16283d, Flow.ToMenu);
        }

        private RectTransform Overlay()
        {
            var go = new GameObject("overlay");
            var rt = go.AddComponent<RectTransform>();
            rt.SetParent(_canvas.transform, false);
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            var img = go.AddComponent<Image>();
            img.color = new Color(0, 0, 0, 0.78f);
            return rt;
        }

        private System.Collections.IEnumerator CameraShake(float durationSec, float amplitude)
        {
            var cam = Camera.main.transform;
            Vector3 basePos = cam.position;
            float t = 0;
            while (t < durationSec)
            {
                t += Time.deltaTime;
                cam.position = basePos + (Vector3)(Random.insideUnitCircle * amplitude);
                yield return null;
            }
            cam.position = basePos;
        }

        private sealed class BobBehaviour : MonoBehaviour
        {
            private Transform _spin;

            private void Start() => _spin = transform.Find("spin");

            private void Update()
            {
                // Visual bob only — the logic-side pickup box stays put.
                if (_spin != null)
                    _spin.localPosition = new Vector3(0,
                        6f + 6f * Mathf.Sin(2 * Mathf.PI * Time.time / 1.4f), 0);
            }
        }
    }
}
