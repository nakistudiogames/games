using System.Collections;
using System.Collections.Generic;
using CubeDash.Audio;
using CubeDash.Logic;
using CubeDash.View;
using UnityEngine;
using UnityEngine.UI;

namespace CubeDash.Game
{
    /// <summary>
    /// The native rebuild's game screen. The PLAYER moves through a fixed,
    /// pre-built level and the CAMERA follows with look-ahead, landing kicks
    /// and height tracking — plus squash & stretch, coyote time, buffered
    /// jumps, apex float, GD-style half-flip rotation, hit-stop deaths and
    /// instant tap-to-retry. Same characters, auras, worlds and music.
    /// </summary>
    public sealed class RunController : MonoBehaviour
    {
        public int Level = 1;

        private const float PlayerScreenX = 216;   // player left edge on screen
        private const float CamBaseY = 240;        // ground sits at ~62% height
        private const float MaxDt = 1f / 30f;

        private enum Phase { Ready, Playing, Paused, Dead, Complete }

        private static readonly Dictionary<int, int> SessionAttempts = new();

        private WorldTheme _world;
        private CharacterSpec _spec;
        private LevelLayout _layout;
        private PlayerState _p;
        private float _speed;
        private Phase _phase = Phase.Ready;
        private float _elapsed;

        private Camera _cam;
        private Transform _bgRoot;
        private ScrollingTiled _stars, _sil, _sil2;
        private GameObject _playerRoot;   // squash/stretch scale lives here
        private Transform _playerBody;    // rotation lives here
        private SpriteRenderer _playerShadow;
        private ParticleSystem _trail, _dust, _sparkle, _burst;
        private float _rotStart;
        /// <summary>Arc progress at airborne start (0 for jumps, ~0.5 for
        /// walk-offs) so the flip always begins from the current pose.</summary>
        private float _arcBase;
        private bool _wasGrounded = true;

        private float _camY = CamBaseY, _camYVel, _standY, _shakeT;
        private float _deadAt;

        private Canvas _canvas;
        private Text _pctText, _readyText, _muteLabel;
        private RectTransform _progressFill;
        private Image _progressTip;
        private GameObject _pauseOverlay;

        private void Start()
        {
            _world = WorldData.ForLevel(Level);
            _spec = CharacterData.ById(Storage.GetString("character", "dash"));
            _layout = Chunks.Build(Level);
            _speed = Chunks.LevelSpeed(Level);
            _p = new PlayerState { X = 0, Y = 0, Grounded = true };
            if (!SessionAttempts.ContainsKey(Level)) SessionAttempts[Level] = 1;

            _cam = Camera.main;
            BuildBackdrop();
            BuildTrack();
            BuildObstacles();
            BuildPlayer();
            BuildHud();
            SnapCamera();
        }

        private void OnDestroy()
        {
            Time.timeScale = 1f; // never leak slow-mo/pause into other screens
            if (_bgRoot != null) Destroy(_bgRoot.gameObject);
        }

        private float Progress01 => Mathf.Clamp01(_p.X / _layout.LengthPx);
        private int ProgressPct => Mathf.FloorToInt(Progress01 * 100);
        private uint Accent => Chunks.AccentForLevel(Level);

        // ------------------------------------------------------------------
        // Construction

        /// <summary>Screen-anchored layers ride the camera; parallax is done by
        /// scrolling their tile offsets from the camera's x.</summary>
        private void BuildBackdrop()
        {
            var bg = new GameObject("backdrop");
            _bgRoot = bg.transform;
            _bgRoot.SetParent(_cam.transform, false);
            _bgRoot.localPosition = new Vector3(0, 0, 10);

            var sky = Draw.FromSprite(_bgRoot, "sky", TextureFactory.Sky(_world), 0);
            sky.transform.localPosition = Px.V(360, 640);
            sky.transform.localScale = new Vector3(Px.WIDTH / 2f, Px.HEIGHT / 2f, 1f);

            _stars = ScrollingTiled.Create(_bgRoot, "stars", TextureFactory.Stars(),
                0, 0, Px.WIDTH, 900, 10, 0.7f);

            var sil = TextureFactory.Silhouette(_world);
            if ((Level - 1) % WorldData.LEVELS_PER_WORLD >= 2)
            {
                _sil2 = ScrollingTiled.Create(_bgRoot, "sil2", sil, 0, 335, Px.WIDTH / 0.7f, 320, 12, 0.3f);
                _sil2.transform.localScale = new Vector3(0.7f, 0.7f, 1f);
            }
            _sil = ScrollingTiled.Create(_bgRoot, "sil", sil, 0, 560, Px.WIDTH, 320, 20, 0.55f);

            var hazeP = new Painter(2, 64);
            for (int y = 0; y < 64; y++)
                hazeP.FillRect(0, y, 2, 1, _world.Haze, 0.35f * y / 63f);
            var haze = Draw.FromSprite(_bgRoot, "haze", hazeP.ToSprite(new Vector2(0, 1)), 30);
            haze.transform.localPosition = Px.V(0, 560);
            haze.transform.localScale = new Vector3(Px.WIDTH / 2f, 5f, 1f);

            var vig = Draw.FromSprite(_bgRoot, "vignette", TextureFactory.Vignette(), 95);
            vig.transform.localPosition = Px.V(360, 640);
            vig.transform.localScale = new Vector3(Px.WIDTH / 180f, Px.HEIGHT / 180f, 1f);
        }

        /// <summary>World-anchored ground: solid segments between gaps, with the
        /// neon accent edge; gaps are dark voids with warning-lit lips.</summary>
        private void BuildTrack()
        {
            var fadeP = new Painter(2, 64);
            for (int y = 0; y < 64; y++)
                fadeP.FillRect(0, y, 2, 1, 0x000000, 0.65f * y / 63f);
            var fadeSprite = fadeP.ToSprite(new Vector2(0, 1));
            var groundSprite = TextureFactory.Ground(_world);

            float xStart = -700, xEnd = _layout.LengthPx + 1800;
            var edges = new List<float> { xStart };
            foreach (var g in _layout.Gaps) { edges.Add(g.Start); edges.Add(g.End); }
            edges.Add(xEnd);

            for (int i = 0; i < edges.Count - 1; i += 2)
            {
                float x0 = edges[i], x1 = edges[i + 1];
                float w = x1 - x0;
                var seg = Draw.FromSprite(transform, "ground", groundSprite, 40);
                var sr = seg.GetComponent<SpriteRenderer>();
                sr.drawMode = SpriteDrawMode.Tiled;
                sr.tileMode = SpriteTileMode.Continuous;
                sr.size = new Vector2(w, 460);
                seg.transform.position = new Vector3(x0, 0, 0); // pivot top-left

                var fade = Draw.FromSprite(transform, "groundFade", fadeSprite, 41);
                fade.transform.position = new Vector3(x0, 0, 0);
                fade.transform.localScale = new Vector3(w / 2f, 460f / 64f, 1f);

                var neon = Draw.GlowSprite(transform, "edgeNeon", w + 40, 56, Accent, 0.45f, 50);
                neon.transform.position = new Vector3(x0 + w / 2, 2, 0);
                var edge = Draw.Quad(transform, "edge", w, 5, Accent, 51);
                edge.transform.position = new Vector3(x0 + w / 2, -2.5f, 0);
            }

            foreach (var g in _layout.Gaps)
            {
                var voidQuad = Draw.Quad(transform, "gapVoid", g.Width, 480, 0x05070c, 40);
                voidQuad.transform.position = new Vector3(g.Start + g.Width / 2, -240, 0);
                // Warning glow on both lips.
                foreach (float lipX in new[] { g.Start, g.End })
                {
                    var lip = Draw.GlowSprite(transform, "lip", 46, 26, Accent, 0.55f, 52);
                    lip.transform.position = new Vector3(lipX, 0, 0);
                }
            }
        }

        private void BuildObstacles()
        {
            foreach (var o in _layout.Obs) ObstacleArt.Build(transform, o);
            ObstacleArt.BuildPortal(transform, _layout.LengthPx, Accent);
        }

        private void BuildPlayer()
        {
            float s = Sim.PlayerSize;
            _playerRoot = new GameObject("player");
            _playerRoot.transform.SetParent(transform, false);
            var body = new GameObject("body");
            body.transform.SetParent(_playerRoot.transform, false);
            _playerBody = body.transform;

            Draw.GlowSprite(_playerBody, "rimGlow", s + 76, s + 76, _spec.AuraColor, 0.3f, 97);
            Auras.Attach(_playerBody, _spec, s, 99);
            CharacterFactory.BuildParts(_playerBody, _spec, s, 100);

            var shadow = Draw.FromSprite(transform, "playerShadow", TextureFactory.Shadow(), 60);
            _playerShadow = shadow.GetComponent<SpriteRenderer>();

            _trail = Fx.Trail(_playerBody, _spec.Trail);
            _dust = Fx.Dust(transform);
            _sparkle = Fx.Sparkle(transform);
            _burst = Fx.Burst(transform);
            SyncPlayerView();
        }

        private void BuildHud()
        {
            _canvas = UiFactory.EnsureCanvas("run-hud");
            _canvas.transform.SetParent(transform, false);
            var root = _canvas.transform;

            // Slim progress bar with a glowing tip.
            var barBg = UiFactory.Panel(root, 360, 34, 540, 6, 0x232b3e, 1f);
            barBg.raycastTarget = false;
            var fillGo = new GameObject("fill");
            _progressFill = fillGo.AddComponent<RectTransform>();
            _progressFill.SetParent(root, false);
            _progressFill.anchorMin = _progressFill.anchorMax = new Vector2(0.5f, 0.5f);
            _progressFill.pivot = new Vector2(0, 0.5f);
            _progressFill.sizeDelta = new Vector2(540, 6);
            _progressFill.anchoredPosition = new Vector2(90 - 360, 640 - 34);
            var fillImg = fillGo.AddComponent<Image>();
            fillImg.color = Px.C(Accent);
            fillImg.raycastTarget = false;
            _progressFill.localScale = new Vector3(0, 1, 1);

            var tipGo = new GameObject("tip");
            var tipRt = tipGo.AddComponent<RectTransform>();
            tipRt.SetParent(root, false);
            tipRt.anchorMin = tipRt.anchorMax = new Vector2(0.5f, 0.5f);
            tipRt.sizeDelta = new Vector2(34, 34);
            tipRt.anchoredPosition = new Vector2(90 - 360, 640 - 34);
            _progressTip = tipGo.AddComponent<Image>();
            _progressTip.sprite = Draw.Glow();
            _progressTip.color = Px.C(Accent, 0.9f);
            _progressTip.raycastTarget = false;

            _pctText = UiFactory.Label(root, "0%", 668, 34, 26, 0x8a93a8);
            UiFactory.Label(root, $"LVL {Level}", 52, 34, 26, Accent);

            UiFactory.TextButton(root, "II", 672, 96, 32, 0xffffff, 0x232b3e, TogglePause, 64, 64);
            _muteLabel = UiFactory.TextButton(root, MuteGlyph(), 48, 96, 22, 0xffffff, 0x232b3e,
                ToggleMute, 72, 64).GetComponentInChildren<Text>();

            _readyText = UiFactory.Label(root,
                $"{_world.Name}\nLEVEL {Level}   ·   ATTEMPT {SessionAttempts[Level]}\nTAP TO START",
                360, 660, 46, 0xa5d6a7);
            Tween.PopIn(_readyText.rectTransform, 0.4f);
        }

        private static string MuteGlyph() => Storage.GetBool("musicMuted", false) ? "off" : "on";

        // ------------------------------------------------------------------
        // Loop

        private void Update()
        {
            bool tap = (Input.GetMouseButtonDown(0) && !PointerOnUi())
                       || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.UpArrow);
            if (Input.GetKeyDown(KeyCode.Escape)) TogglePause();

            switch (_phase)
            {
                case Phase.Ready:
                    if (_readyText != null)
                    {
                        var c = _readyText.color;
                        c.a = 0.65f + 0.35f * Mathf.Sin(Time.time * 4f);
                        _readyText.color = c;
                    }
                    if (tap) StartRun();
                    return;
                case Phase.Dead:
                    if (tap && Time.unscaledTime > _deadAt + 0.45f) Retry();
                    return;
                case Phase.Paused:
                case Phase.Complete:
                    return;
            }

            // --- Playing ---
            float dt = Mathf.Min(Time.deltaTime, MaxDt);
            _elapsed += dt;
            _p.JumpHeld = Input.GetMouseButton(0) || Input.GetKey(KeyCode.Space) ||
                          Input.GetKey(KeyCode.UpArrow);
            if (tap && Sim.RequestJump(_p)) { /* fx via JustJumped below */ }

            _wasGrounded = _p.Grounded;
            Sim.Step(_p, dt, _speed, _layout.Obs, _layout.Gaps);

            if (_p.JustJumped)
            {
                _p.JustJumped = false;
                OnJumped();
            }
            if (_p.JustLanded)
            {
                _p.JustLanded = false;
                OnLanded();
            }
            if (_wasGrounded && !_p.Grounded && _playerBody != null && _p.Vy <= 0)
            {
                // Walked off an edge: start the flip from here, mid-arc.
                _rotStart = _playerBody.localEulerAngles.z;
                float prog = Mathf.Clamp01((Sim.JumpVelocity - _p.Vy) / (2 * Sim.JumpVelocity));
                _arcBase = prog * prog * (3f - 2f * prog);
            }

            SyncPlayerView();
            UpdateHud();

            if (_p.X >= _layout.LengthPx)
            {
                Complete();
                return;
            }
            if (Sim.CheckDeath(_p, _layout.Obs)) StartCoroutine(DeathSequence());
        }

        private void LateUpdate()
        {
            if (_cam == null) return;
            float targetX = _p.X + Sim.PlayerSize / 2 + (360 - PlayerScreenX - Sim.PlayerSize / 2);
            if (_p.Grounded) _standY = _p.Y;
            float wantY = CamBaseY + Mathf.Clamp(_standY * 0.5f, 0, 170);
            _camY = Mathf.SmoothDamp(_camY, wantY, ref _camYVel, 0.22f);
            float shake = 0;
            if (_shakeT > 0)
            {
                _shakeT -= Time.unscaledDeltaTime;
                shake = (Random.value - 0.5f) * 14f * Mathf.Clamp01(_shakeT / 0.25f);
            }
            _cam.transform.position = new Vector3(targetX, _camY + shake, -10);

            _stars.ScrollTo(targetX * 0.05f);
            _sil.ScrollTo(targetX * 0.22f);
            if (_sil2 != null) _sil2.ScrollTo(targetX * 0.1f);
        }

        private void SyncPlayerView()
        {
            float cx = _p.X + Sim.PlayerSize / 2;
            _playerRoot.transform.position = new Vector3(cx, _p.Y + Sim.PlayerSize / 2, 0);

            if (!_p.Grounded)
            {
                // Half flip per arc, GD-style: driven by arc progress, not time.
                float prog = Mathf.Clamp01((Sim.JumpVelocity - _p.Vy) / (2 * Sim.JumpVelocity));
                float eased = prog * prog * (3f - 2f * prog); // smoothstep
                float frac = _arcBase >= 1f ? 1f : (eased - _arcBase) / (1f - _arcBase);
                _playerBody.localRotation = Quaternion.Euler(0, 0, _rotStart - 180f * Mathf.Clamp01(frac));
            }

            float rawSupport = Sim.SupportAt(_p, _layout.Obs, _layout.Gaps);
            bool overVoid = float.IsNegativeInfinity(rawSupport);
            _playerShadow.enabled = !overVoid;
            if (!overVoid)
            {
                float support = rawSupport;
                float air = Mathf.Max(0, _p.Y - support);
                float f = Mathf.Max(0.25f, 1f - air / 500f);
                _playerShadow.transform.position = new Vector3(cx, support - 9, 0);
                _playerShadow.transform.localScale = new Vector3(1.25f * f, f, 1f);
                _playerShadow.color = new Color(1, 1, 1, 0.35f + 0.45f * f);
            }
        }

        private void UpdateHud()
        {
            _pctText.text = $"{ProgressPct}%";
            _progressFill.localScale = new Vector3(Progress01, 1, 1);
            var tip = _progressTip.rectTransform;
            tip.anchoredPosition = new Vector2(90 - 360 + 540 * Progress01, 640 - 34);
        }

        private void OnJumped()
        {
            _rotStart = Mathf.Round(_playerBody.localEulerAngles.z / 90f) * 90f;
            _arcBase = 0f;
            Tween.Punch(_playerRoot.transform, new Vector2(0.84f, 1.16f), 0.18f);
            AudioEngine.I.Jump();
        }

        private void OnLanded()
        {
            float z = _playerBody.localEulerAngles.z;
            float snapped = Mathf.Round(z / 90f) * 90f;
            Tween.Run(_playerBody, 0.08f, k => _playerBody.localRotation =
                Quaternion.Euler(0, 0, Mathf.LerpAngle(z, snapped, k)));
            Tween.Punch(_playerRoot.transform, new Vector2(1.22f, 0.8f), 0.14f);
            Fx.Explode(_dust, 6, _playerRoot.transform.position + Vector3.down * (Sim.PlayerSize / 2 - 4));
            AudioEngine.I.Land();
        }

        // ------------------------------------------------------------------
        // Phase transitions

        private void StartRun()
        {
            _phase = Phase.Playing;
            Destroy(_readyText.gameObject);
            _readyText = null;
            _trail.Play();
            if (!Storage.GetBool("musicMuted", false)) AudioEngine.I.PlayMusic(_world.Music);
        }

        private void Retry()
        {
            Time.timeScale = 1f;
            Flow.ToGame(Level);
        }

        private IEnumerator DeathSequence()
        {
            _phase = Phase.Dead;
            _deadAt = Time.unscaledTime;
            SessionAttempts[Level] = SessionAttempts.GetValueOrDefault(Level, 1) + 1;
            _trail.Stop();
            _playerRoot.SetActive(false);
            _playerShadow.enabled = false;
            AudioEngine.I.StopMusic();
            AudioEngine.I.Death();
            int pct = ProgressPct;
            int best = BumpBestPct(pct);

            // Hit-stop, burst, then brief slow-mo: deaths read clearly.
            Time.timeScale = 0f;
            yield return new WaitForSecondsRealtime(0.06f);
            Fx.Explode(_burst, 30, _playerRoot.transform.position);
            _shakeT = 0.25f;
            Time.timeScale = 0.3f;
            yield return new WaitForSecondsRealtime(0.3f);
            Time.timeScale = 1f;

            // Non-blocking overlay: any tap anywhere retries instantly.
            var rt = Overlay(0.55f, blockTaps: false);
            var title = UiFactory.Label(rt, $"{pct}%", 360, 460, 110, 0xffffff, bold: true);
            Tween.PopIn(title.rectTransform, 0.35f, unscaled: true);
            UiFactory.Label(rt, $"best {best}%   ·   attempt {SessionAttempts[Level] - 1}",
                360, 560, 34, 0xffd54f);
            UiFactory.Label(rt, "TAP TO RETRY", 360, 700, 46, 0xa5d6a7);
            UiFactory.TextButton(rt, "MENU", 360, 1280 * 0.83, 36, 0x90caf9, 0x16283d, Flow.ToMenu);
        }

        private void Complete()
        {
            _phase = Phase.Complete;
            _trail.Stop();
            BumpBestPct(100);
            int unlocked = Storage.GetInt("unlockedLevel", 1);
            if (Level + 1 > unlocked) Storage.SetInt("unlockedLevel", Level + 1);
            AudioEngine.I.StopMusic();
            AudioEngine.I.Complete();
            Fx.Explode(_sparkle, 40, _playerRoot.transform.position);

            var rt = Overlay(0.78f);
            var title = UiFactory.Label(rt, "LEVEL\nCOMPLETE!", 360, 1280 * 0.3, 84, Accent, bold: true);
            Tween.PopIn(title.rectTransform, 0.45f);
            UiFactory.Label(rt,
                $"cleared in {_elapsed:0.0}s   ·   attempt {SessionAttempts[Level]}\nLevel {Level + 1} unlocked!",
                360, 1280 * 0.46, 40, 0xffd54f);
            UiFactory.TextButton(rt, "NEXT LEVEL", 360, 1280 * 0.6, 52, 0xa5d6a7, 0x1e3320, () =>
            {
                SessionAttempts.Remove(Level + 1);
                Flow.ToGame(Level + 1);
            });
            UiFactory.TextButton(rt, "REPLAY", 360, 1280 * 0.7, 42, 0xffd54f, 0x332e1a,
                () => Flow.ToGame(Level));
            UiFactory.TextButton(rt, "MENU", 360, 1280 * 0.79, 38, 0x90caf9, 0x16283d, Flow.ToMenu);
        }

        private int BumpBestPct(int pct)
        {
            string key = $"bestPct:{Level}";
            int best = Mathf.Max(Storage.GetInt(key, 0), pct);
            Storage.SetInt(key, best);
            return best;
        }

        // ------------------------------------------------------------------
        // Pause / util

        private void TogglePause()
        {
            if (_phase == Phase.Playing) PauseGame();
            else if (_phase == Phase.Paused) ResumeGame();
        }

        private void PauseGame()
        {
            _phase = Phase.Paused;
            Time.timeScale = 0f;
            _trail.Stop();
            AudioEngine.I.StopMusic();
            var rt = Overlay(0.7f);
            _pauseOverlay = rt.gameObject;
            UiFactory.Label(rt, "PAUSED", 360, 1280 * 0.3, 80, 0xffffff, bold: true);
            UiFactory.Label(rt, $"Level {Level}  ·  {ProgressPct}%", 360, 1280 * 0.4, 40, 0xffd54f);
            UiFactory.TextButton(rt, "RESUME", 360, 1280 * 0.53, 52, 0xa5d6a7, 0x1e3320, ResumeGame);
            UiFactory.TextButton(rt, "RESTART", 360, 1280 * 0.63, 44, 0xffd54f, 0x332e1a, Retry);
            UiFactory.TextButton(rt, "MENU", 360, 1280 * 0.73, 44, 0x90caf9, 0x16283d, () =>
            {
                Time.timeScale = 1f;
                Flow.ToMenu();
            });
        }

        private void ResumeGame()
        {
            if (_pauseOverlay != null) Destroy(_pauseOverlay);
            Time.timeScale = 1f;
            _phase = Phase.Playing;
            _trail.Play();
            if (!Storage.GetBool("musicMuted", false)) AudioEngine.I.PlayMusic(_world.Music);
        }

        private void ToggleMute()
        {
            bool nowMuted = !Storage.GetBool("musicMuted", false);
            Storage.SetBool("musicMuted", nowMuted);
            _muteLabel.text = MuteGlyph();
            if (nowMuted) AudioEngine.I.StopMusic();
            else if (_phase == Phase.Playing) AudioEngine.I.PlayMusic(_world.Music);
        }

        private void OnApplicationFocus(bool focus)
        {
            if (!focus && _phase == Phase.Playing) PauseGame();
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused && _phase == Phase.Playing) PauseGame();
        }

        private RectTransform Overlay(float alpha, bool blockTaps = true)
        {
            var go = new GameObject("overlay");
            var rt = go.AddComponent<RectTransform>();
            rt.SetParent(_canvas.transform, false);
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            var img = go.AddComponent<Image>();
            img.color = new Color(0, 0, 0, alpha);
            img.raycastTarget = blockTaps;
            return rt;
        }

        private static bool PointerOnUi() =>
            UnityEngine.EventSystems.EventSystem.current != null &&
            UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject();

        private void SnapCamera()
        {
            float targetX = _p.X + Sim.PlayerSize / 2 + (360 - PlayerScreenX - Sim.PlayerSize / 2);
            _cam.transform.position = new Vector3(targetX, CamBaseY, -10);
            _camY = CamBaseY;
        }
    }
}
