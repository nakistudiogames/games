using CubeDash.Logic;
using UnityEngine;

namespace CubeDash.View
{
    /// <summary>
    /// Port of characterView.ts buildCharacterParts: body drawn from stacked
    /// primitives, centered on the parent, sized to the player box. Used by
    /// the game (inside the rotating player container) and the menu preview.
    /// Stroke rectangles are approximated by a slightly larger backing quad.
    /// </summary>
    public static class CharacterFactory
    {
        public static void BuildParts(Transform parent, CharacterSpec spec, float s, int order)
        {
            if (spec.Shape == CharacterShape.Cube)
            {
                Draw.Quad(parent, "stroke", s + 5, s + 5, spec.Dark, order + 1);
                Draw.Quad(parent, "body", s - 5, s - 5, spec.Color, order + 2);
                // Bevel: lit top/left, shaded bottom/right — light from top-left.
                Draw.Quad(parent, "bevelT", s - 12, 5, spec.Light, order + 3)
                    .transform.localPosition = Px.L(0, -s / 2 + 7);
                Draw.Quad(parent, "bevelL", 5, s - 12, spec.Light, order + 3)
                    .transform.localPosition = Px.L(-s / 2 + 7, 0);
                Draw.Quad(parent, "bevelB", s - 12, 5, spec.Dark, order + 3)
                    .transform.localPosition = Px.L(0, s / 2 - 7);
                Draw.Quad(parent, "bevelR", 5, s - 12, spec.Dark, order + 3)
                    .transform.localPosition = Px.L(s / 2 - 7, 0);
                Draw.Quad(parent, "face", s - 26, s - 26, spec.Face, order + 4);
            }
            else if (spec.Shape == CharacterShape.Ball)
            {
                Draw.Disc(parent, "stroke", s + 5, spec.Dark, order + 1);
                Draw.Disc(parent, "body", s - 5, spec.Color, order + 2);
                Draw.Disc(parent, "face", s - 24, spec.Face, order + 3);
                // Specular highlight sells the sphere.
                Draw.Disc(parent, "spec", 2f * s / 7f, 0xffffff, order + 4, 0.55f)
                    .transform.localPosition = Px.L(-s / 5, -s / 5);
            }
            else // Diamond
            {
                float d = s * 0.78f;
                var stroke = Draw.Quad(parent, "stroke", d + 5, d + 5, spec.Dark, order + 1);
                stroke.transform.localRotation = Quaternion.Euler(0, 0, 45);
                var body = Draw.Quad(parent, "body", d - 5, d - 5, spec.Color, order + 2);
                body.transform.localRotation = Quaternion.Euler(0, 0, 45);
                var face = Draw.Quad(parent, "face", d - 20, d - 20, spec.Face, order + 3);
                face.transform.localRotation = Quaternion.Euler(0, 0, 45);
                var tip = Draw.Quad(parent, "tip", 10, 10, spec.Light, order + 4);
                tip.transform.localPosition = Px.L(0, -d / 2 + 4);
                tip.transform.localRotation = Quaternion.Euler(0, 0, 45);
            }

            // Face: eyes + mouth, same dark ink as the web build (0x0a1518).
            const uint ink = 0x0a1518;
            var eyeL = Draw.Quad(parent, "eyeL", 9, 14, ink, order + 5);
            eyeL.transform.localPosition = Px.L(-9, -6);
            var eyeR = Draw.Quad(parent, "eyeR", 9, 14, ink, order + 5);
            eyeR.transform.localPosition = Px.L(11, -6);
            if (spec.Mouth == CharacterMouth.Angry)
            {
                eyeL.transform.localRotation = Quaternion.Euler(0, 0, 18);
                eyeR.transform.localRotation = Quaternion.Euler(0, 0, -18);
                Draw.Quad(parent, "mouth", 26, 5, ink, order + 5)
                    .transform.localPosition = Px.L(1, 13);
            }
            else if (spec.Mouth == CharacterMouth.Zap)
            {
                // Lightning-bolt mouth drawn as pixels (emoji fonts are
                // unreliable in Unity's built-in text).
                var p = new Painter(20, 22);
                p.FillTriangle(12, 0, 4, 12, 10, 12, 0xffd54f);
                p.FillTriangle(10, 12, 16, 10, 6, 22, 0xffd54f);
                p.Line(12, 0, 4, 12, 1.6, ink);
                p.Line(16, 10, 6, 22, 1.6, ink);
                Draw.FromSprite(parent, "mouth", p.ToSprite(), order + 5)
                    .transform.localPosition = Px.L(1, 13);
            }
            else
            {
                Draw.Quad(parent, "mouth", 22, 6, ink, order + 5)
                    .transform.localPosition = Px.L(1, 12);
            }
        }
    }
}
