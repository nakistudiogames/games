using System.Collections.Generic;
using CubeDash.Logic;
using UnityEngine;

namespace CubeDash.View
{
    /// <summary>
    /// Obstacle visuals for the native rebuild. World is y-UP; every view's
    /// root sits at the obstacle's BOTTOM-LEFT (o.X, o.Y), children in y-up
    /// local coordinates. Art style carries over from the original: top-left
    /// key light, two-tone hazards, additive glows.
    /// </summary>
    public static class ObstacleArt
    {
        public const int ORDER = 80;

        private static readonly Dictionary<string, Sprite> Cache = new();
        private static readonly Vector2 BottomLeft = new(0f, 0f);

        private static Sprite Cached(string key, System.Func<Sprite> make)
        {
            if (!Cache.TryGetValue(key, out var s))
            {
                s = make();
                Cache[key] = s;
            }
            return s;
        }

        public static GameObject Build(Transform parent, Ob o)
        {
            var root = new GameObject($"ob-{o.Kind}");
            root.transform.SetParent(parent, false);
            root.transform.position = new Vector3(o.X, o.Y, 0);

            // Grounded solids cast a soft shadow on the track.
            if (o.Y == 0 && o.Kind != ObKind.Beam)
            {
                var sh = Draw.FromSprite(root.transform, "shadow", TextureFactory.Shadow(), ORDER - 2);
                sh.transform.localPosition = new Vector3(o.W / 2 + 8, -7, 0);
                sh.transform.localScale = new Vector3((o.W + 36) / 96f, 0.8f, 1f);
                sh.GetComponent<SpriteRenderer>().color = new Color(1, 1, 1, 0.55f);
            }

            switch (o.Kind)
            {
                case ObKind.Spike: Spike(root.transform, o.W, o.H); break;
                case ObKind.Block: Block(root.transform, o.W, o.H); break;
                case ObKind.Saw: Saw(root.transform, o.W); break;
                case ObKind.Mine: Mine(root.transform, o.W); break;
                case ObKind.Beam: Beam(root.transform, o.W, o.H); break;
                case ObKind.Slab: Slab(root.transform, o.W, o.H); break;
            }
            return root;
        }

        private static void Spike(Transform root, float w, float h)
        {
            var sprite = Cached($"spike-{w}x{h}", () =>
            {
                var p = new Painter((int)w, (int)h);
                // Lit left face, shaded right — key light from top-left.
                p.FillTriangle(0, h, w / 2, 0, w / 2, h, 0xef5350);
                p.FillTriangle(w / 2, 0, w, h, w / 2, h, 0x8e2320);
                p.Line(0, h - 1, w / 2, 0, 3, 0xff8a80);
                p.Line(w / 2, 0, w, h - 1, 3, 0xff8a80);
                return p.ToSprite(BottomLeft);
            });
            Draw.FromSprite(root, "body", sprite, ORDER);
        }

        private static void Block(Transform root, float w, float h)
        {
            const int d = 14; // 2.5D extrusion up-right
            var sprite = Cached($"block-{w}x{h}", () =>
            {
                var p = new Painter((int)w + d, (int)h + d);
                p.FillTriangle(w, d, w + d, 0, w + d, h, 0x252e6e); // shaded right
                p.FillRect(w, d, d, h - d, 0x252e6e);
                p.FillTriangle(w, d + h, w + d, h, w, h, 0x252e6e);
                p.FillTriangle(0, d, d, 0, w + d, 0, 0x8d97dd);     // lit top
                p.FillTriangle(0, d, w + d, 0, w, d, 0x8d97dd);
                p.FillRect(0, d, w, h, 0x3949ab);                   // front
                p.FillRect(0, d, w, 7, 0x5262c4);
                p.FillRect(0, d, w, 2, 0x171d45);
                p.FillRect(0, d + h - 2, w, 2, 0x171d45);
                p.FillRect(0, d, 2, h, 0x171d45);
                p.FillRect(w - 2, d, 2, h, 0x171d45);
                return p.ToSprite(BottomLeft);
            });
            Draw.FromSprite(root, "body", sprite, ORDER);
        }

        private static void Saw(Transform root, float w)
        {
            float r = w / 2;
            var sprite = Cached($"saw-{w}", () =>
            {
                var p = new Painter((int)w, (int)w);
                for (int i = 0; i < 12; i++)
                {
                    double a = i / 12.0 * Mathf.PI * 2, b = a + 0.22;
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
                return p.ToSprite();
            });
            var body = Draw.FromSprite(root, "body", sprite, ORDER);
            body.transform.localPosition = new Vector3(r, r, 0);
            body.AddComponent<SpinBehaviour>().DegreesPerSec = -520f;
        }

        private static void Mine(Transform root, float w)
        {
            float r = w / 2;
            Draw.GlowSprite(root, "glow", w + 46, w + 46, 0xab47bc, 0.4f, ORDER - 1)
                .transform.localPosition = new Vector3(r, r, 0);
            var sprite = Cached($"mine-{w}", () =>
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
                p.FillCircle(c - 4, c - 4, r - 15, 0xce93d8);
                p.FillCircle(c + 2, c + 2, r - 21, 0x4a148c);
                return p.ToSprite();
            });
            var body = Draw.FromSprite(root, "body", sprite, ORDER);
            body.transform.localPosition = new Vector3(r, r, 0);
            body.AddComponent<SpinBehaviour>().DegreesPerSec = -138f;
            var ring = Draw.FromSprite(root, "ring", Draw.Ring((int)w + 16, 3), ORDER);
            ring.transform.localPosition = new Vector3(r, r, 0);
            ring.GetComponent<SpriteRenderer>().color = Px.C(0xce93d8, 0.5f);
            var rp = ring.AddComponent<RingPulseBehaviour>();
            rp.Period = 0.8f; rp.FromAlpha = 0.5f; rp.ToScale = 1.25f;
        }

        private static void Beam(Transform root, float w, float h)
        {
            Draw.GlowSprite(root, "halo", 80, h + 40, 0x76ff03, 0.6f, ORDER - 1)
                .transform.localPosition = new Vector3(w / 2, h / 2, 0);
            var beamSprite = Cached($"beam-{w}x{h}", () =>
            {
                var p = new Painter((int)w + 8, (int)h);
                p.FillRect(0, 0, w + 8, h, 0x76ff03, 0.35f);
                p.FillRect(8, 0, w - 8, h, 0x76ff03, 0.9f);
                p.FillRect(w / 2 + 2, 0, 4, h, 0xf1ffdd);
                return p.ToSprite(BottomLeft);
            });
            var beam = Draw.FromSprite(root, "beam", beamSprite, ORDER);
            beam.transform.localPosition = new Vector3(-4, 0, 0);
            var pulse = beam.AddComponent<PulseBehaviour>();
            pulse.FromAlpha = 1f; pulse.ToAlpha = 0.55f; pulse.HalfPeriod = 0.22f;

            var fixture = Cached($"beamFix-{w}x{h}", () =>
            {
                var p = new Painter((int)w + 20, (int)h);
                p.FillRect(0, h - 12, w + 20, 12, 0x263238);
                p.FillRect(0, h - 12, w + 20, 4, 0x455a64);
                p.FillCircle((w + 20) / 2.0, 6, 9, 0xccff90);
                return p.ToSprite(BottomLeft);
            });
            Draw.FromSprite(root, "fixture", fixture, ORDER + 1)
                .transform.localPosition = new Vector3(-10, 0, 0);
        }

        private static void Slab(Transform root, float w, float h)
        {
            var sprite = Cached($"slab-{w}x{h}", () =>
            {
                var p = new Painter((int)w, (int)h);
                p.FillRect(0, 0, w, h, 0x3949ab);
                p.FillRect(0, 0, w, 5, 0x8d97dd);  // lit top edge (canvas y-down)
                p.FillRect(0, h - 4, w, 4, 0x171d45);
                p.FillRect(0, 0, 2, h, 0x171d45);
                p.FillRect(w - 2, 0, 2, h, 0x171d45);
                return p.ToSprite(BottomLeft);
            });
            Draw.FromSprite(root, "body", sprite, ORDER);
            // Faint under-glow marks the run-under lane.
            Draw.GlowSprite(root, "under", w, 40, 0x5262c4, 0.25f, ORDER - 1)
                .transform.localPosition = new Vector3(w / 2, -6, 0);
        }

        /// <summary>Finish portal: two glowing pylons + shimmer, at x = level end.</summary>
        public static GameObject BuildPortal(Transform parent, float x, uint accent)
        {
            var root = new GameObject("portal");
            root.transform.SetParent(parent, false);
            root.transform.position = new Vector3(x, 0, 0);
            for (int side = 0; side < 2; side++)
            {
                float px = side * 110 - 55;
                Draw.GlowSprite(root.transform, "glow", 70, 480, accent, 0.5f, ORDER - 1)
                    .transform.localPosition = new Vector3(px, 210, 0);
                var pole = Draw.Quad(root.transform, "pylon", 14, 420, accent, ORDER);
                pole.transform.localPosition = new Vector3(px, 210, 0);
                var cap = Draw.Disc(root.transform, "cap", 30, 0xffffff, ORDER + 1);
                cap.transform.localPosition = new Vector3(px, 424, 0);
            }
            var shimmer = Draw.GlowSprite(root.transform, "shimmer", 120, 400, accent, 0.3f, ORDER - 1);
            shimmer.transform.localPosition = new Vector3(0, 200, 0);
            var pulse = shimmer.AddComponent<PulseBehaviour>();
            pulse.FromAlpha = 0.3f; pulse.ToAlpha = 0.12f; pulse.HalfPeriod = 0.6f;
            return root;
        }
    }

    public sealed class SpinBehaviour : MonoBehaviour
    {
        public float DegreesPerSec;
        private void Update() =>
            transform.localRotation = Quaternion.Euler(0, 0, DegreesPerSec * Time.time);
    }

    /// <summary>Alpha (and optional scale-y) yoyo on a SpriteRenderer.</summary>
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
