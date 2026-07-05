using System.Collections.Generic;
using CubeDash.Logic;
using UnityEngine;

namespace CubeDash.View
{
    /// <summary>
    /// Port of GameScene.ensureTextures(): every background texture is drawn at
    /// runtime with the exact colors of the web build. Cached per world id.
    /// </summary>
    public static class TextureFactory
    {
        private static readonly Dictionary<string, Sprite> Cache = new();

        private static Sprite Cached(string key, System.Func<Sprite> make)
        {
            if (!Cache.TryGetValue(key, out var s))
            {
                s = make();
                Cache[key] = s;
            }
            return s;
        }

        /// <summary>4-corner gradient stretched over the sky — bilinear filtering
        /// on a 2x2 texture is exactly Phaser's fillGradientStyle.</summary>
        public static Sprite Sky(WorldTheme w) => Cached($"sky-{w.Id}", () =>
        {
            var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
            };
            // Bottom row first (Unity rows go bottom-up): bottomA, bottomB.
            tex.SetPixels(new[]
            {
                Px.C(w.SkyBottomA), Px.C(w.SkyBottomB),
                Px.C(w.SkyTop), Px.C(w.SkyTop),
            });
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, 2, 2), new Vector2(0.5f, 0.5f), 1f,
                0, SpriteMeshType.FullRect);
        });

        public static Sprite Stars() => Cached("stars", () =>
        {
            var p = new Painter(160, 160);
            (int x, int y, int s, float a)[] pts =
            {
                (14, 30, 2, 0.9f), (70, 12, 3, 0.5f), (120, 55, 2, 0.7f), (40, 90, 2, 0.4f),
                (95, 120, 3, 0.8f), (150, 100, 2, 0.5f), (25, 140, 2, 0.6f), (130, 20, 2, 0.35f),
            };
            foreach (var (x, y, s, a) in pts) p.FillRect(x, y, s, s, 0xffffff, a);
            return p.ToSprite(new Vector2(0f, 1f));
        });

        /// <summary>World silhouette strip, 400x320: city buildings / crystal
        /// shards / magma rocks — same vertex tables as the web build.</summary>
        public static Sprite Silhouette(WorldTheme w) => Cached($"sil-{w.Id}", () =>
        {
            var p = new Painter(400, 320);
            if (w.Silhouette == SilhouetteStyle.City)
            {
                (int x, int wid, int h)[] buildings =
                    { (0, 70, 190), (80, 60, 260), (150, 90, 140), (250, 70, 300), (330, 55, 210) };
                foreach (var (x, wid, h) in buildings)
                {
                    p.FillRect(x, 320 - h, wid, h, w.SilDark);
                    p.FillRect(x, 320 - h, wid, 6, w.SilLight);
                }
            }
            else if (w.Silhouette == SilhouetteStyle.Crystals)
            {
                (int x, int wid, int h)[] shards =
                {
                    (0, 70, 220), (50, 50, 300), (110, 80, 170), (180, 55, 260),
                    (240, 90, 200), (310, 60, 310), (360, 50, 150),
                };
                foreach (var (x, wid, h) in shards)
                {
                    p.FillTriangle(x, 320, x + wid / 2.0, 320 - h, x + wid, 320, w.SilDark);
                    p.FillTriangle(x + wid / 2.0, 320 - h, x + wid / 2.0 + 8, 320 - h + 40,
                        x + wid / 2.0 - 8, 320 - h + 40, w.SilLight, 0.8f);
                }
            }
            else
            {
                (int x, int wid, int h)[] rocks =
                    { (0, 160, 140), (100, 190, 210), (240, 170, 160), (320, 160, 120) };
                foreach (var (x, wid, h) in rocks)
                {
                    p.FillTriangle(x, 320, x + wid * 0.45, 320 - h, x + wid, 320, w.SilDark);
                    p.FillTriangle(x + wid * 0.45, 320 - h, x + wid * 0.62, 320 - h * 0.55,
                        x + wid * 0.3, 320 - h * 0.55, w.SilLight, 0.55f);
                }
            }
            return p.ToSprite(new Vector2(0f, 1f));
        });

        public static Sprite Ground(WorldTheme w) => Cached($"ground-{w.Id}", () =>
        {
            var p = new Painter(80, 280);
            p.FillRect(0, 0, 80, 280, w.GroundBase);
            p.FillRect(0, 0, 2, 280, w.GroundGrid); // vertical grid line
            p.FillRect(0, 56, 80, 1, w.GroundGrid); // faint horizontals
            p.FillRect(0, 140, 80, 1, w.GroundGrid);
            return p.ToSprite(new Vector2(0f, 1f));
        });

        /// <summary>Soft layered-ellipse shadow, 96x28.</summary>
        public static Sprite Shadow() => Cached("shadow", () =>
        {
            var p = new Painter(96, 28);
            FillEllipse(p, 48, 14, 48, 14, 0x000000, 0.1f);
            FillEllipse(p, 48, 14, 37, 10.5, 0x000000, 0.14f);
            FillEllipse(p, 48, 14, 25, 7, 0x000000, 0.2f);
            return p.ToSprite(filter: FilterMode.Bilinear);
        });

        private static void FillEllipse(Painter p, double cx, double cy, double rx, double ry,
            uint color, float alpha)
        {
            for (int y = 0; y < p.H; y++)
                for (int x = 0; x < p.W; x++)
                {
                    double dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                    if (dx * dx + dy * dy <= 1) p.FillRect(x, y, 1, 1, color, alpha);
                }
        }
    }

    /// <summary>TileSprite equivalent: a horizontally-tiled sprite scrolled by
    /// adjusting position and wrapping every tile width.</summary>
    public sealed class ScrollingTiled : MonoBehaviour
    {
        private float _tileW;
        private float _offset;

        /// <summary>Anchor = top-left in Phaser space; height stretches the tile.</summary>
        public static ScrollingTiled Create(Transform parent, string name, Sprite sprite,
            double x, double y, double width, double height, int order, float alpha = 1f)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.drawMode = SpriteDrawMode.Tiled;
            sr.tileMode = SpriteTileMode.Continuous;
            float texW = sprite.rect.width;
            // Tiles in BOTH axes (like Phaser's TileSprite); one extra tile of
            // width so the wrap-around never shows a gap.
            sr.size = new Vector2((float)width + texW, (float)height);
            sr.sortingOrder = order;
            sr.color = new Color(1, 1, 1, alpha);
            go.transform.position = Px.V(x, y);
            var st = go.AddComponent<ScrollingTiled>();
            st._tileW = texW;
            st._basePos = go.transform.position;
            return st;
        }

        private Vector3 _basePos;

        /// <summary>Equivalent of `tilePositionX += d`. Wraps at one tile width
        /// (in world units, so scaled layers wrap correctly too).</summary>
        public void Scroll(float d)
        {
            float tileWorldW = _tileW * transform.lossyScale.x;
            _offset = (_offset + d) % tileWorldW;
            if (_offset < 0) _offset += tileWorldW;
            transform.position = _basePos - new Vector3(_offset, 0, 0);
        }
    }
}
