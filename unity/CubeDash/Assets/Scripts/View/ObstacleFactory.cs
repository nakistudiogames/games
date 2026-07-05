using System.Collections.Generic;
using CubeDash.Logic;
using UnityEngine;

namespace CubeDash.View
{
    /// <summary>
    /// Port of GameScene.buildObstacleView: same shapes, same hex colors, same
    /// 2.5D light direction (top-left). Each obstacle body is one runtime
    /// texture (cached per size) plus small animation behaviours.
    /// </summary>
    public static class ObstacleFactory
    {
        public const int ORDER = 80; // Phaser depth 8

        private static readonly Dictionary<string, Sprite> Cache = new();
        private static readonly Vector2 TopLeft = new(0f, 1f);

        private static Sprite Cached(string key, System.Func<Sprite> make)
        {
            if (!Cache.TryGetValue(key, out var s))
            {
                s = make();
                Cache[key] = s;
            }
            return s;
        }

        /// <summary>Root pivot = the obstacle's top-left (Phaser container origin).
        /// The controller positions it each frame; swing roots also move in y.</summary>
        public static GameObject Build(Transform parent, Obstacle o)
        {
            var root = new GameObject($"obs-{o.Kind}");
            root.transform.SetParent(parent, false);
            float w = (float)o.W, h = (float)o.H, elev = (float)o.Elev;

            // Ground shadow (grounded solid kinds only — pits are holes, swing
            // mines move, lasers glow).
            if (o.Kind == ObstacleKind.Spike || o.Kind == ObstacleKind.Block || o.Kind == ObstacleKind.Saw)
            {
                bool floating = elev > 0;
                var shadow = Draw.FromSprite(root.transform, "shadow", TextureFactory.Shadow(), ORDER - 1);
                shadow.transform.localPosition = Px.L(w / 2 + 8, h + elev + 7);
                shadow.transform.localScale = new Vector3(
                    (w + 36) / 96f * (floating ? 0.7f : 1f), floating ? 0.55f : 0.8f, 1f);
                var sr = shadow.GetComponent<SpriteRenderer>();
                sr.color = new Color(1, 1, 1, floating ? 0.3f : 0.55f);
            }

            switch (o.Kind)
            {
                case ObstacleKind.Spike: BuildSpike(root.transform, w, h, elev > 0); break;
                case ObstacleKind.Block: BuildBlock(root.transform, w, h); break;
                case ObstacleKind.Saw: BuildSaw(root.transform, w); break;
                case ObstacleKind.Pit: BuildPit(root.transform, w, h); break;
                case ObstacleKind.Swing: BuildSwing(root.transform, w); break;
                case ObstacleKind.Laser: BuildLaser(root.transform, w, h); break;
            }
            return root;
        }

        private static void BuildSpike(Transform root, float w, float h, bool floating)
        {
            var sprite = Cached($"spike-{w}x{h}-{floating}", () =>
            {
                var p = new Painter((int)w, (int)h);
                if (floating)
                {
                    // Air mine: inverted spike hanging in the flight path.
                    p.FillTriangle(0, 0, w / 2, 0, w / 2, h, 0xef5350);
                    p.FillTriangle(w / 2, 0, w, 0, w / 2, h, 0x8e2320);
                    p.Line(0, 1, w, 1, 3, 0xff8a80);
                    p.Line(w, 1, w / 2, h, 3, 0xff8a80);
                    p.Line(w / 2, h, 0, 1, 3, 0xff8a80);
                }
                else
                {
                    // Two-tone faces: lit left, shaded right — light from top-left.
                    p.FillTriangle(0, h, w / 2, 0, w / 2, h, 0xef5350);
                    p.FillTriangle(w / 2, 0, w, h, w / 2, h, 0x8e2320);
                    p.Line(0, h - 1, w / 2, 0, 3, 0xff8a80);
                    p.Line(w / 2, 0, w, h - 1, 3, 0xff8a80);
                }
                return p.ToSprite(TopLeft);
            });
            Draw.FromSprite(root, "body", sprite, ORDER);
        }

        private static void BuildBlock(Transform root, float w, float h)
        {
            const int d = 14; // extrusion up-right
            var sprite = Cached($"block-{w}x{h}", () =>
            {
                var p = new Painter((int)w + d, (int)h + d);
                // Canvas y=0 is d above the block top (extrusion sticks up).
                p.FillTriangle(w, d, w + d, 0, w + d, h, 0x252e6e); // right face
                p.FillRect(w, d, d, h - d, 0x252e6e);
                p.FillTriangle(w, d + h, w + d, h, w, h, 0x252e6e);
                p.FillTriangle(0, d, d, 0, w + d, 0, 0x8d97dd); // lit top face
                p.FillTriangle(0, d, w + d, 0, w, d, 0x8d97dd);
                p.FillRect(0, d, w, h, 0x3949ab); // front
                p.FillRect(0, d, w, 7, 0x5262c4);
                p.FillRect(0, d, w, 2, 0x171d45); // outline
                p.FillRect(0, d + h - 2, w, 2, 0x171d45);
                p.FillRect(0, d, 2, h, 0x171d45);
                p.FillRect(w - 2, d, 2, h, 0x171d45);
                return p.ToSprite(TopLeft);
            });
            // Shift up by d so the front face's top-left lands on the root origin.
            Draw.FromSprite(root, "body", sprite, ORDER).transform.localPosition = Px.L(0, -d);
        }

        private static void BuildSaw(Transform root, float w)
        {
            float r = w / 2;
            var sprite = Cached($"saw-{w}", () =>
            {
                var p = new Painter((int)w, (int)w);
                for (int i = 0; i < 12; i++)
                {
                    double a = i / 12.0 * Mathf.PI * 2;
                    double b = a + 0.22;
                    p.FillTriangle(
                        r + System.Math.Cos(a) * (r - 12), r + System.Math.Sin(a) * (r - 12),
                        r + System.Math.Cos(b) * (r - 12), r + System.Math.Sin(b) * (r - 12),
                        r + System.Math.Cos((a + b) / 2) * (r - 1), r + System.Math.Sin((a + b) / 2) * (r - 1),
                        0x78909c);
                }
                p.FillCircle(r, r, r - 12, 0xb0bec5);
                p.FillCircle(r, r, r - 24, 0x546e7a);
                for (int i = 0; i < 4; i++)
                {
                    double a = i / 4.0 * Mathf.PI * 2;
                    p.FillCircle(r + System.Math.Cos(a) * (r - 18), r + System.Math.Sin(a) * (r - 18), 4, 0xcfd8dc);
                }
                p.FillCircle(r, r, 7, 0xcfd8dc);
                return p.ToSprite(); // center pivot: it spins
            });
            var body = Draw.FromSprite(root, "body", sprite, ORDER);
            body.transform.localPosition = Px.L(r, r);
            body.AddComponent<SpinBehaviour>().DegreesPerSec = -360f / 0.7f;
        }

        private static void BuildPit(Transform root, float w, float h)
        {
            var sprite = Cached($"pit-{w}", () =>
            {
                var p = new Painter((int)w, (int)h + 150);
                p.FillRect(0, h, w, 150, 0x140a06);         // pit walls fading down
                p.FillRect(3, h + 3, w - 6, 26, 0xd84315);  // molten pool
                p.FillRect(3, h + 3, w - 6, 6, 0xff8a65);   // glowing surface
                p.FillRect(3, h + 3, w - 6, 2, 0xffccbc, 0.8f);
                p.FillRect(0, h, 6, 8, 0x000000, 0.55f);    // charred lips
                p.FillRect(w - 6, h, 6, 8, 0x000000, 0.55f);
                return p.ToSprite(TopLeft);
            });
            Draw.FromSprite(root, "body", sprite, ORDER);
            // Heat shimmer rising out of the trench.
            var glow = Draw.Quad(root, "glow", w - 10, 10, 0xff7043, ORDER + 1, 0.35f);
            glow.transform.localPosition = Px.L(w / 2, h - 2);
            var pulse = glow.AddComponent<PulseBehaviour>();
            pulse.FromAlpha = 0.35f; pulse.ToAlpha = 0.1f;
            pulse.FromScaleY = 1f; pulse.ToScaleY = 1.8f;
            pulse.HalfPeriod = 0.52f;
        }

        private static void BuildSwing(Transform root, float w)
        {
            float r = w / 2;
            var sprite = Cached($"swing-{w}", () =>
            {
                var p = new Painter((int)w + 12, (int)w + 12);
                double c = r + 6;
                for (int i = 0; i < 8; i++)
                {
                    double a = i / 8.0 * Mathf.PI * 2;
                    p.FillTriangle(
                        c + System.Math.Cos(a - 0.28) * (r - 10), c + System.Math.Sin(a - 0.28) * (r - 10),
                        c + System.Math.Cos(a + 0.28) * (r - 10), c + System.Math.Sin(a + 0.28) * (r - 10),
                        c + System.Math.Cos(a) * (r + 4), c + System.Math.Sin(a) * (r + 4),
                        0xab47bc);
                }
                p.FillCircle(c, c, r - 8, 0x8e24aa);
                p.FillCircle(c - 4, c - 4, r - 15, 0xce93d8); // lit from top-left
                p.FillCircle(c + 2, c + 2, r - 21, 0x4a148c);
                return p.ToSprite(); // center pivot: it spins
            });
            var body = Draw.FromSprite(root, "body", sprite, ORDER);
            body.transform.localPosition = Px.L(r, r);
            body.AddComponent<SpinBehaviour>().DegreesPerSec = -360f / 2.6f;
            // Warning ring pulse — telegraphs "hazard" while it bobs.
            var ring = Draw.FromSprite(root, "ring", Draw.Ring((int)w + 16, 3), ORDER);
            ring.transform.localPosition = Px.L(r, r);
            ring.GetComponent<SpriteRenderer>().color = Px.C(0xce93d8, 0.5f);
            var rp = ring.AddComponent<RingPulseBehaviour>();
            rp.Period = 0.8f; rp.FromAlpha = 0.5f; rp.ToScale = 1.25f;
        }

        private static void BuildLaser(Transform root, float w, float h)
        {
            var beamSprite = Cached($"laserBeam-{w}x{h}", () =>
            {
                var p = new Painter((int)w + 8, (int)h);
                p.FillRect(0, 0, w + 8, h, 0x76ff03, 0.35f); // outer glow
                p.FillRect(8, 0, w - 8, h, 0x76ff03, 0.9f);  // core beam
                p.FillRect(w / 2 + 2, 0, 4, h, 0xf1ffdd);    // white-hot line
                return p.ToSprite(TopLeft);
            });
            var beam = Draw.FromSprite(root, "beam", beamSprite, ORDER);
            beam.transform.localPosition = Px.L(-4, 0);
            var pulse = beam.AddComponent<PulseBehaviour>();
            pulse.FromAlpha = 1f; pulse.ToAlpha = 0.55f; pulse.HalfPeriod = 0.22f;

            // Emitter base and tip orb are steady — the hitbox never blinks.
            var fixture = Cached($"laserFix-{w}x{h}", () =>
            {
                var p = new Painter((int)w + 20, (int)h);
                p.FillRect(0, h - 12, w + 20, 12, 0x263238);
                p.FillRect(0, h - 12, w + 20, 4, 0x455a64);
                p.FillCircle((w + 20) / 2.0, 6, 9, 0xccff90);
                return p.ToSprite(TopLeft);
            });
            Draw.FromSprite(root, "fixture", fixture, ORDER + 1)
                .transform.localPosition = Px.L(-10, 0);
        }

        /// <summary>Checkered finish pole (buildFinishView port). Root x is set
        /// by the controller; contents hang from y=GROUND_Y downward-up.</summary>
        public static GameObject BuildFinish(Transform parent)
        {
            var root = new GameObject("finish");
            root.transform.SetParent(parent, false);
            var back = Draw.Quad(root.transform, "poleBack", 26, 420, 0x0c0e14, ORDER, 0.6f);
            back.transform.localPosition = Px.L(0, -210); // pole rises from ground
            var pole = Draw.Quad(root.transform, "pole", 8, 420, RunnerLogic.LevelColor(1), ORDER + 1);
            pole.transform.localPosition = Px.L(0, -210);
            const int cell = 16;
            for (int r = 0; r < 4; r++)
                for (int c = 0; c < 2; c++)
                {
                    bool dark = (r + c) % 2 == 0;
                    var q = Draw.Quad(root.transform, "cell", cell, cell,
                        dark ? 0x111111u : 0xffffffu, ORDER + 2);
                    q.transform.localPosition = Px.L(8 + c * cell + cell / 2.0, -420 + r * cell + cell / 2.0);
                }
            return root;
        }

        public static void TintFinishPole(GameObject finish, uint accent)
        {
            var pole = finish.transform.Find("pole");
            if (pole != null) pole.GetComponent<SpriteRenderer>().color = Px.C(accent);
        }
    }

    public sealed class SpinBehaviour : MonoBehaviour
    {
        public float DegreesPerSec;
        private void Update() =>
            transform.localRotation = Quaternion.Euler(0, 0, DegreesPerSec * Time.time);
    }

    /// <summary>Alpha (and optional scale-y) yoyo, like a Phaser sine tween.</summary>
    public sealed class PulseBehaviour : MonoBehaviour
    {
        public float FromAlpha = 1f, ToAlpha = 0.5f, HalfPeriod = 0.5f;
        public float FromScaleY = 1f, ToScaleY = 1f;
        private SpriteRenderer _sr;
        private Vector3 _baseScale;

        private void Start()
        {
            _sr = GetComponent<SpriteRenderer>();
            _baseScale = transform.localScale;
        }

        private void Update()
        {
            float k = 0.5f - 0.5f * Mathf.Cos(Mathf.PI * Time.time / HalfPeriod);
            var c = _sr.color;
            c.a = Mathf.Lerp(FromAlpha, ToAlpha, k);
            _sr.color = c;
            if (!Mathf.Approximately(FromScaleY, ToScaleY))
                transform.localScale = new Vector3(_baseScale.x,
                    _baseScale.y * Mathf.Lerp(FromScaleY, ToScaleY, k), 1f);
        }
    }

    /// <summary>Expanding, fading ring (ease-out, restarts each period).</summary>
    public sealed class RingPulseBehaviour : MonoBehaviour
    {
        public float Period = 0.8f, FromAlpha = 0.5f, ToScale = 1.25f;
        private SpriteRenderer _sr;

        private void Start() => _sr = GetComponent<SpriteRenderer>();

        private void Update()
        {
            float k = Time.time % Period / Period;
            float eased = 1 - (1 - k) * (1 - k);
            transform.localScale = Vector3.one * Mathf.Lerp(1f, ToScale, eased);
            var c = _sr.color;
            c.a = Mathf.Lerp(FromAlpha, 0.1f, eased);
            _sr.color = c;
        }
    }
}
