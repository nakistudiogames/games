using CubeDash.Logic;
using UnityEngine;

namespace CubeDash.View
{
    /// <summary>
    /// Port of characterView.ts attachAura: each skin's signature effect lives
    /// AROUND the body — hollow outlines, orbiting satellites, sparks — never
    /// filled shapes over it. Same styles, radii, timings as the web build.
    /// </summary>
    public static class Auras
    {
        public static void Attach(Transform parent, CharacterSpec spec, float s, int order)
        {
            switch (spec.Aura)
            {
                case AuraStyle.Pulse: Add<PulseAura>(parent, spec, s, order); break;
                case AuraStyle.Flicker: Add<FlickerAura>(parent, spec, s, order); break;
                case AuraStyle.Rings: Add<RingsAura>(parent, spec, s, order); break;
                case AuraStyle.Spin: Add<SpinAura>(parent, spec, s, order); break;
                case AuraStyle.Crackle: Add<CrackleAura>(parent, spec, s, order); break;
            }
        }

        private static void Add<T>(Transform parent, CharacterSpec spec, float s, int order)
            where T : AuraBase
        {
            var go = new GameObject("aura");
            go.transform.SetParent(parent, false);
            var aura = go.AddComponent<T>();
            aura.Spec = spec;
            aura.S = s;
            aura.Order = order;
        }

        /// <summary>Hollow outline in the character's silhouette (4 quads for
        /// cube/diamond, a ring sprite for ball), offset outside the body.</summary>
        internal static Outline MakeOutline(Transform parent, CharacterSpec spec, float size,
            float stroke, float alpha, int order)
        {
            var go = new GameObject("outline");
            go.transform.SetParent(parent, false);
            var o = new Outline { Go = go };
            if (spec.Shape == CharacterShape.Ball)
            {
                var ring = Draw.FromSprite(go.transform, "ring", Draw.Ring((int)size, (int)stroke), order);
                o.Srs = new[] { ring.GetComponent<SpriteRenderer>() };
            }
            else
            {
                if (spec.Shape == CharacterShape.Diamond)
                    go.transform.localRotation = Quaternion.Euler(0, 0, 45);
                var t = Draw.Quad(go.transform, "t", size, stroke, spec.AuraColor, order);
                t.transform.localPosition = Px.L(0, -size / 2);
                var b = Draw.Quad(go.transform, "b", size, stroke, spec.AuraColor, order);
                b.transform.localPosition = Px.L(0, size / 2);
                var l = Draw.Quad(go.transform, "l", stroke, size, spec.AuraColor, order);
                l.transform.localPosition = Px.L(-size / 2, 0);
                var r = Draw.Quad(go.transform, "r", stroke, size, spec.AuraColor, order);
                r.transform.localPosition = Px.L(size / 2, 0);
                o.Srs = new[]
                {
                    t.GetComponent<SpriteRenderer>(), b.GetComponent<SpriteRenderer>(),
                    l.GetComponent<SpriteRenderer>(), r.GetComponent<SpriteRenderer>(),
                };
            }
            o.SetColor(Px.C(spec.AuraColor, alpha));
            o.BaseAlpha = alpha;
            return o;
        }

        internal sealed class Outline
        {
            public GameObject Go;
            public SpriteRenderer[] Srs;
            public float BaseAlpha;

            public void SetColor(Color c)
            {
                foreach (var sr in Srs) sr.color = c;
            }

            public void SetAlpha(float a)
            {
                foreach (var sr in Srs)
                {
                    var c = sr.color;
                    c.a = a;
                    sr.color = c;
                }
            }
        }
    }

    public abstract class AuraBase : MonoBehaviour
    {
        public CharacterSpec Spec;
        public float S;
        public int Order;
        private bool _built;

        private void Update()
        {
            if (!_built)
            {
                Build();
                _built = true;
            }
            Animate(Time.time);
        }

        protected abstract void Build();
        protected abstract void Animate(float t);

        /// <summary>Smooth 0..1..0 oscillation like a Sine.easeInOut yoyo tween.</summary>
        protected static float Yoyo(float t, float halfDurationSec, float phase = 0) =>
            0.5f - 0.5f * Mathf.Cos(Mathf.PI * ((t + phase) / halfDurationSec));
    }

    /// <summary>Double halo: crisp inner outline breathing against a faint outer one.</summary>
    public sealed class PulseAura : AuraBase
    {
        private Auras.Outline _inner, _outer;

        protected override void Build()
        {
            _outer = Auras.MakeOutline(transform, Spec, S + 46, 2, 0.3f, Order);
            _inner = Auras.MakeOutline(transform, Spec, S + 26, 4, 0.85f, Order);
        }

        protected override void Animate(float t)
        {
            float k = Yoyo(t, 0.9f);
            _inner.Go.transform.localScale = Vector3.one * Mathf.Lerp(1f, 1.12f, k);
            _inner.SetAlpha(Mathf.Lerp(0.85f, 0.35f, k));
            _outer.Go.transform.localScale = Vector3.one * Mathf.Lerp(1f, 0.92f, k);
            _outer.SetAlpha(Mathf.Lerp(0.3f, 0.6f, k));
        }
    }

    /// <summary>Embers circling the body, flickering at different rates.</summary>
    public sealed class FlickerAura : AuraBase
    {
        private Transform _orbit;
        private SpriteRenderer[] _embers;

        protected override void Build()
        {
            var orbit = new GameObject("orbit");
            orbit.transform.SetParent(transform, false);
            _orbit = orbit.transform;
            _embers = new SpriteRenderer[5];
            float radius = S / 2 + 20;
            for (int i = 0; i < 5; i++)
            {
                float angle = i / 5f * Mathf.PI * 2;
                float r = radius + i % 2 * 8;
                var ember = Draw.Disc(_orbit, $"ember{i}", i % 2 == 0 ? 10 : 6,
                    i % 2 == 0 ? Spec.AuraColor : Spec.Light, Order);
                ember.transform.localPosition = Px.L(Mathf.Cos(angle) * r, Mathf.Sin(angle) * r);
                _embers[i] = ember.GetComponent<SpriteRenderer>();
            }
        }

        protected override void Animate(float t)
        {
            _orbit.localRotation = Quaternion.Euler(0, 0, -t / 1.4f * 360f);
            for (int i = 0; i < _embers.Length; i++)
            {
                var c = _embers[i].color;
                c.a = Mathf.Lerp(1f, 0.25f, Yoyo(t, 0.09f + i * 0.035f));
                _embers[i].color = c;
            }
        }
    }

    /// <summary>Sonar: rings born just outside the body, expanding and fading.</summary>
    public sealed class RingsAura : AuraBase
    {
        private Auras.Outline[] _rings;
        private static readonly float[] Delays = { 0f, 0.65f };

        protected override void Build()
        {
            _rings = new Auras.Outline[2];
            for (int i = 0; i < 2; i++)
                _rings[i] = Auras.MakeOutline(transform, Spec, S + 18, 3, 0.8f, Order);
        }

        protected override void Animate(float t)
        {
            for (int i = 0; i < _rings.Length; i++)
            {
                float local = t - Delays[i];
                if (local < 0)
                {
                    _rings[i].SetAlpha(0);
                    continue;
                }
                float k = local % 1.3f / 1.3f;
                float eased = 1 - (1 - k) * (1 - k); // Quad.easeOut
                _rings[i].Go.transform.localScale = Vector3.one * Mathf.Lerp(1f, 1.9f, eased);
                _rings[i].SetAlpha(Mathf.Lerp(0.8f, 0f, eased));
            }
        }
    }

    /// <summary>Four gem satellites orbiting inside a slow counter-rotating frame.</summary>
    public sealed class SpinAura : AuraBase
    {
        private Transform _orbit;
        private SpriteRenderer[] _gems;
        private Auras.Outline _frame;

        protected override void Build()
        {
            var orbit = new GameObject("orbit");
            orbit.transform.SetParent(transform, false);
            _orbit = orbit.transform;
            _gems = new SpriteRenderer[4];
            float radius = S / 2 + 22;
            for (int i = 0; i < 4; i++)
            {
                float angle = i / 4f * Mathf.PI * 2;
                var gemGo = new GameObject($"gem{i}");
                gemGo.transform.SetParent(_orbit, false);
                gemGo.transform.localPosition = Px.L(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius);
                gemGo.transform.localRotation = Quaternion.Euler(0, 0, 45);
                Draw.Quad(gemGo.transform, "edge", 15, 15, Spec.Light, Order);
                var fill = Draw.Quad(gemGo.transform, "fill", 11, 11, Spec.AuraColor, Order + 1);
                _gems[i] = fill.GetComponent<SpriteRenderer>();
            }
            _frame = Auras.MakeOutline(transform, Spec, S + 48, 2, 0.35f, Order);
        }

        protected override void Animate(float t)
        {
            _orbit.localRotation = Quaternion.Euler(0, 0, -t / 2.2f * 360f);
            _frame.Go.transform.localRotation = Quaternion.Euler(0, 0, t / 5.2f * 360f);
            for (int i = 0; i < _gems.Length; i++)
            {
                var c = _gems[i].color;
                c.a = Mathf.Lerp(1f, 0.45f, Yoyo(t, 0.7f, i * 0.175f));
                _gems[i].color = c;
            }
        }
    }

    /// <summary>Lightning arcs discharging around the body at staggered rhythms.</summary>
    public sealed class CrackleAura : AuraBase
    {
        private SpriteRenderer[] _bolts;
        private float[] _periods, _delays;

        protected override void Build()
        {
            _bolts = new SpriteRenderer[4];
            _periods = new float[4];
            _delays = new float[4];
            float radius = S / 2 + 16;
            for (int i = 0; i < 4; i++)
            {
                uint color = i % 2 == 0 ? Spec.AuraColor : 0xffffff;
                var p = new Painter(14, 22);
                p.Line(3, 2, 8, 9, 3, color);
                p.Line(8, 9, 1, 13, 3, color);
                p.Line(1, 13, 7, 20, 3, color);
                var bolt = Draw.FromSprite(transform, $"bolt{i}", p.ToSprite(), Order);
                float angle = i / 4f * Mathf.PI * 2 + Mathf.PI / 4;
                bolt.transform.localPosition = Px.L(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius);
                bolt.transform.localRotation = Quaternion.Euler(0, 0, -(angle + Mathf.PI / 2) * Mathf.Rad2Deg);
                _bolts[i] = bolt.GetComponent<SpriteRenderer>();
                _periods[i] = 0.14f + 0.26f + i * 0.13f;
                _delays[i] = i * 0.09f;
            }
        }

        protected override void Animate(float t)
        {
            for (int i = 0; i < _bolts.Length; i++)
            {
                float local = t - _delays[i];
                var c = _bolts[i].color;
                c.a = local < 0 ? 0 : Mathf.Max(0f, 1f - local % _periods[i] / 0.14f);
                _bolts[i].color = c;
            }
        }
    }
}
