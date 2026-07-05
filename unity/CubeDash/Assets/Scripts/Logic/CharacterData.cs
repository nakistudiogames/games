namespace CubeDash.Logic
{
    // Direct port of games/cube-dash/src/characters.ts — identical roster,
    // colors, unlock rules. Cosmetic only; physics/hitboxes never change.

    public enum CharacterShape { Cube, Ball, Diamond }
    public enum CharacterMouth { Smile, Angry, Zap }
    public enum AuraStyle { Pulse, Flicker, Rings, Spin, Crackle }

    public sealed class CharacterSpec
    {
        public string Id = "";
        public string Name = "";
        public CharacterShape Shape;
        public CharacterMouth Mouth;
        /// <summary>Unlocked once the player's unlockedLevel reaches this.</summary>
        public int MinLevel;
        public uint Color, Light, Dark, Face;
        public uint[] Trail = System.Array.Empty<uint>();
        public uint AuraColor;
        public AuraStyle Aura;
    }

    public static class CharacterData
    {
        public static readonly CharacterSpec[] CHARACTERS =
        {
            new()
            {
                Id = "dash", Name = "Dash", Shape = CharacterShape.Cube,
                Mouth = CharacterMouth.Smile, MinLevel = 1,
                Color = 0x26c6da, Light = 0x9ef3fc, Dark = 0x0d7d8f, Face = 0x63e5f5,
                Trail = new uint[] { 0x26c6da, 0x4dd0e1, 0xffffff },
                AuraColor = 0x4dd0e1, Aura = AuraStyle.Pulse,
            },
            new()
            {
                Id = "blaze", Name = "Blaze", Shape = CharacterShape.Cube,
                Mouth = CharacterMouth.Angry, MinLevel = 2,
                Color = 0xff7043, Light = 0xffab91, Dark = 0xbf360c, Face = 0xff8a65,
                Trail = new uint[] { 0xff7043, 0xffab40, 0xffffff },
                AuraColor = 0xff5722, Aura = AuraStyle.Flicker,
            },
            new()
            {
                Id = "orb", Name = "Orb", Shape = CharacterShape.Ball,
                Mouth = CharacterMouth.Smile, MinLevel = 3,
                Color = 0x66bb6a, Light = 0xa5d6a7, Dark = 0x2e7031, Face = 0x81c784,
                Trail = new uint[] { 0x66bb6a, 0xa5d6a7, 0xffffff },
                AuraColor = 0x81c784, Aura = AuraStyle.Rings,
            },
            new()
            {
                Id = "prism", Name = "Prism", Shape = CharacterShape.Diamond,
                Mouth = CharacterMouth.Smile, MinLevel = 4,
                Color = 0xab47bc, Light = 0xce93d8, Dark = 0x6a1b7a, Face = 0xba68c8,
                Trail = new uint[] { 0xab47bc, 0xce93d8, 0xffffff },
                AuraColor = 0xce93d8, Aura = AuraStyle.Spin,
            },
            new()
            {
                Id = "bolt", Name = "Bolt", Shape = CharacterShape.Cube,
                Mouth = CharacterMouth.Zap, MinLevel = 5,
                Color = 0xffca28, Light = 0xfff59d, Dark = 0xb28704, Face = 0xffd54f,
                Trail = new uint[] { 0xffca28, 0xfff59d, 0xffffff },
                AuraColor = 0xffee58, Aura = AuraStyle.Crackle,
            },
        };

        public static CharacterSpec ById(string id)
        {
            foreach (var c in CHARACTERS)
                if (c.Id == id) return c;
            return CHARACTERS[0];
        }

        public static bool IsUnlocked(CharacterSpec spec, int unlockedLevel) =>
            unlockedLevel >= spec.MinLevel;
    }
}
