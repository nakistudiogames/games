using System;
using System.Collections.Generic;
using UnityEngine;

namespace CubeDash.Game
{
    /// <summary>
    /// Tiny lambda tween runner — the juice engine for squash & stretch, UI
    /// pop-ins and eased transitions. A tween dies silently if its target
    /// Object is destroyed mid-flight.
    /// </summary>
    public sealed class Tween : MonoBehaviour
    {
        public enum Ease { Linear, OutQuad, InQuad, OutCubic, OutBack, OutElastic }

        private sealed class Item
        {
            public float T, Dur;
            public Ease Ease;
            public Action<float> Apply;
            public Action Done;
            public UnityEngine.Object Target;
            public bool Unscaled;
        }

        private static Tween _i;
        private readonly List<Item> _items = new();

        private static Tween I
        {
            get
            {
                if (_i == null)
                {
                    var go = new GameObject("tween-runner");
                    DontDestroyOnLoad(go);
                    _i = go.AddComponent<Tween>();
                }
                return _i;
            }
        }

        public static float Evaluate(Ease ease, float t)
        {
            t = Mathf.Clamp01(t);
            switch (ease)
            {
                case Ease.OutQuad: return 1 - (1 - t) * (1 - t);
                case Ease.InQuad: return t * t;
                case Ease.OutCubic: return 1 - Mathf.Pow(1 - t, 3);
                case Ease.OutBack:
                {
                    const float c1 = 1.70158f, c3 = c1 + 1;
                    return 1 + c3 * Mathf.Pow(t - 1, 3) + c1 * Mathf.Pow(t - 1, 2);
                }
                case Ease.OutElastic:
                    return t is 0 or 1 ? t
                        : Mathf.Pow(2, -10 * t) * Mathf.Sin((t * 10 - 0.75f) * (2 * Mathf.PI / 3)) + 1;
                default: return t;
            }
        }

        /// <summary>Drives apply(eased01) over dur seconds. `target` guards
        /// against destroyed objects.</summary>
        public static void Run(UnityEngine.Object target, float dur, Action<float> apply,
            Ease ease = Ease.OutQuad, Action done = null, float delay = 0, bool unscaled = false)
        {
            I._items.Add(new Item
            {
                T = -delay, Dur = Mathf.Max(0.0001f, dur), Ease = ease,
                Apply = apply, Done = done, Target = target, Unscaled = unscaled,
            });
        }

        public static void ScaleTo(Transform t, Vector3 to, float dur, Ease ease = Ease.OutQuad)
        {
            Vector3 from = t.localScale;
            Run(t, dur, k => t.localScale = Vector3.LerpUnclamped(from, to, k), ease);
        }

        /// <summary>Squash/stretch impulse: jump to `punch`, spring back to base.</summary>
        public static void Punch(Transform t, Vector2 punch, float dur)
        {
            Run(t, dur, k => t.localScale = new Vector3(
                Mathf.LerpUnclamped(punch.x, 1f, k),
                Mathf.LerpUnclamped(punch.y, 1f, k), 1f), Ease.OutQuad);
        }

        /// <summary>UI pop-in: from small+transparent to full, eased back.</summary>
        public static void PopIn(RectTransform rt, float dur = 0.3f, float delay = 0,
            bool unscaled = false)
        {
            rt.localScale = Vector3.zero;
            Run(rt, dur, k => rt.localScale = Vector3.one * k, Ease.OutBack, delay: delay,
                unscaled: unscaled);
        }

        private void Update()
        {
            for (int i = _items.Count - 1; i >= 0; i--)
            {
                var it = _items[i];
                if (it.Target == null) // destroyed (Unity fake-null included)
                {
                    _items.RemoveAt(i);
                    continue;
                }
                it.T += it.Unscaled ? Time.unscaledDeltaTime : Time.deltaTime;
                if (it.T < 0) continue;
                float k = Evaluate(it.Ease, it.T / it.Dur);
                it.Apply(k);
                if (it.T >= it.Dur)
                {
                    _items.RemoveAt(i);
                    it.Done?.Invoke();
                }
            }
        }
    }
}
