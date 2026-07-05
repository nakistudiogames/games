using System.Collections.Generic;
using UnityEngine;

namespace CubeDash.View
{
    /// <summary>
    /// Coordinate bridge: ALL game logic runs in the web build's pixel space
    /// (720x1280, y-down, origin top-left). The view flips y exactly once,
    /// here. Camera sits at (0,0) with orthographicSize 640, so 1 unit = 1 px.
    /// </summary>
    public static class Px
    {
        public const float WIDTH = 720f;
        public const float HEIGHT = 1280f;

        /// <summary>Phaser-space point (x right, y down) to Unity world.</summary>
        public static Vector3 V(double x, double y, float z = 0) =>
            new((float)x - WIDTH / 2f, HEIGHT / 2f - (float)y, z);

        /// <summary>Phaser-space local offset (dy down) to a Unity local offset.</summary>
        public static Vector3 L(double dx, double dy, float z = 0) =>
            new((float)dx, -(float)dy, z);

        public static Color C(uint hex, float a = 1f) => new(
            ((hex >> 16) & 0xff) / 255f,
            ((hex >> 8) & 0xff) / 255f,
            (hex & 0xff) / 255f,
            a);
    }

    /// <summary>
    /// CPU pixel canvas — the stand-in for Phaser's Graphics.generateTexture:
    /// every texture in the game is drawn at runtime, no assets on disk.
    /// Canvas coordinates are y-DOWN like the web code it ports.
    /// </summary>
    public sealed class Painter
    {
        public readonly int W, H;
        private readonly Color[] _buf;

        public Painter(int w, int h)
        {
            W = w; H = h;
            _buf = new Color[w * h]; // transparent black
        }

        private void Blend(int x, int y, Color c)
        {
            if (x < 0 || y < 0 || x >= W || y >= H) return;
            int i = (H - 1 - y) * W + x; // flip to Unity's bottom-up rows
            Color d = _buf[i];
            float a = c.a + d.a * (1 - c.a);
            _buf[i] = a <= 0 ? Color.clear
                : new Color(
                    (c.r * c.a + d.r * d.a * (1 - c.a)) / a,
                    (c.g * c.a + d.g * d.a * (1 - c.a)) / a,
                    (c.b * c.a + d.b * d.a * (1 - c.a)) / a,
                    a);
        }

        public void FillRect(double x, double y, double w, double h, uint color, float alpha = 1f)
        {
            Color c = Px.C(color, alpha);
            for (int yy = (int)y; yy < (int)(y + h); yy++)
                for (int xx = (int)x; xx < (int)(x + w); xx++)
                    Blend(xx, yy, c);
        }

        public void FillTriangle(double x1, double y1, double x2, double y2, double x3, double y3,
            uint color, float alpha = 1f)
        {
            Color c = Px.C(color, alpha);
            int minX = Mathf.FloorToInt(Mathf.Min((float)x1, (float)x2, (float)x3));
            int maxX = Mathf.CeilToInt(Mathf.Max((float)x1, (float)x2, (float)x3));
            int minY = Mathf.FloorToInt(Mathf.Min((float)y1, (float)y2, (float)y3));
            int maxY = Mathf.CeilToInt(Mathf.Max((float)y1, (float)y2, (float)y3));
            double d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
            if (System.Math.Abs(d) < 1e-9) return;
            for (int yy = minY; yy <= maxY; yy++)
                for (int xx = minX; xx <= maxX; xx++)
                {
                    double px = xx + 0.5, py = yy + 0.5;
                    double a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / d;
                    double b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / d;
                    double g = 1 - a - b;
                    if (a >= 0 && b >= 0 && g >= 0) Blend(xx, yy, c);
                }
        }

        public void FillCircle(double cx, double cy, double r, uint color, float alpha = 1f)
        {
            Color c = Px.C(color, alpha);
            for (int yy = (int)(cy - r) - 1; yy <= cy + r + 1; yy++)
                for (int xx = (int)(cx - r) - 1; xx <= cx + r + 1; xx++)
                {
                    double dx = xx + 0.5 - cx, dy = yy + 0.5 - cy;
                    double dist = System.Math.Sqrt(dx * dx + dy * dy);
                    if (dist <= r - 0.5) Blend(xx, yy, c);
                    else if (dist < r + 0.5) Blend(xx, yy, new Color(c.r, c.g, c.b, c.a * (float)(r + 0.5 - dist)));
                }
        }

        public void StrokeCircle(double cx, double cy, double r, double width, uint color, float alpha = 1f)
        {
            Color c = Px.C(color, alpha);
            double half = width / 2;
            for (int yy = (int)(cy - r - half) - 1; yy <= cy + r + half + 1; yy++)
                for (int xx = (int)(cx - r - half) - 1; xx <= cx + r + half + 1; xx++)
                {
                    double dx = xx + 0.5 - cx, dy = yy + 0.5 - cy;
                    double dist = System.Math.Abs(System.Math.Sqrt(dx * dx + dy * dy) - r);
                    if (dist <= half - 0.5) Blend(xx, yy, c);
                    else if (dist < half + 0.5) Blend(xx, yy, new Color(c.r, c.g, c.b, c.a * (float)(half + 0.5 - dist)));
                }
        }

        /// <summary>Thick line segment (for lightning arcs, spike outlines).
        /// Stamps opaque squares along the segment; intended for alpha=1 strokes
        /// (repeated blending of an opaque color is idempotent).</summary>
        public void Line(double x1, double y1, double x2, double y2, double width, uint color)
        {
            Color c = Px.C(color, 1f);
            double len = System.Math.Max(1, System.Math.Sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)));
            for (double t = 0; t <= len; t += 0.5)
            {
                double px = x1 + (x2 - x1) * t / len;
                double py = y1 + (y2 - y1) * t / len;
                for (int yy = (int)(py - width / 2); yy <= py + width / 2; yy++)
                    for (int xx = (int)(px - width / 2); xx <= px + width / 2; xx++)
                        Blend(xx, yy, c);
            }
        }

        public Texture2D ToTexture(FilterMode filter = FilterMode.Point)
        {
            var tex = new Texture2D(W, H, TextureFormat.RGBA32, false)
            {
                filterMode = filter,
                wrapMode = TextureWrapMode.Repeat,
            };
            tex.SetPixels(_buf);
            tex.Apply();
            return tex;
        }

        /// <summary>Pivot in normalized (0-1), y-up like Unity expects.</summary>
        public Sprite ToSprite(Vector2? pivot = null, FilterMode filter = FilterMode.Point) =>
            Sprite.Create(ToTexture(filter), new Rect(0, 0, W, H),
                pivot ?? new Vector2(0.5f, 0.5f), 1f, 0, SpriteMeshType.FullRect);
    }

    /// <summary>Shared primitive sprites + sprite object helpers.</summary>
    public static class Draw
    {
        private static Sprite _white;
        private static Sprite _circle;
        private static readonly Dictionary<string, Sprite> Cache = new();

        public static Sprite White()
        {
            if (_white == null)
            {
                var p = new Painter(4, 4);
                p.FillRect(0, 0, 4, 4, 0xffffff);
                _white = p.ToSprite();
            }
            return _white;
        }

        /// <summary>Anti-aliased white disc, tint + scale for any circle.</summary>
        public static Sprite Circle()
        {
            if (_circle == null)
            {
                var p = new Painter(64, 64);
                p.FillCircle(32, 32, 31, 0xffffff);
                _circle = p.ToSprite(filter: FilterMode.Bilinear);
            }
            return _circle;
        }

        public static Sprite Ring(int diameter, int stroke)
        {
            string key = $"ring{diameter}-{stroke}";
            if (!Cache.TryGetValue(key, out var s))
            {
                var p = new Painter(diameter + stroke * 2, diameter + stroke * 2);
                p.StrokeCircle(p.W / 2.0, p.H / 2.0, diameter / 2.0, stroke, 0xffffff);
                s = p.ToSprite(filter: FilterMode.Bilinear);
                Cache[key] = s;
            }
            return s;
        }

        /// <summary>Solid-color quad; w/h in px, position set by caller.</summary>
        public static GameObject Quad(Transform parent, string name, double w, double h,
            uint color, int order, float alpha = 1f)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = White();
            sr.color = Px.C(color, alpha);
            sr.sortingOrder = order;
            go.transform.localScale = new Vector3((float)w / 4f, (float)h / 4f, 1f);
            return go;
        }

        public static GameObject Disc(Transform parent, string name, double diameter,
            uint color, int order, float alpha = 1f)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = Circle();
            sr.color = Px.C(color, alpha);
            sr.sortingOrder = order;
            go.transform.localScale = new Vector3((float)diameter / 64f, (float)diameter / 64f, 1f);
            return go;
        }

        public static GameObject FromSprite(Transform parent, string name, Sprite sprite, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = order;
            return go;
        }
    }
}
