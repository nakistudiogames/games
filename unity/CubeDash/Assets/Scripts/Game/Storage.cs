using UnityEngine;

namespace CubeDash.Game
{
    /// <summary>
    /// PlayerPrefs wrapper using the SAME keys as the web build's GameStorage
    /// ("unlockedLevel", "lastPlayed", "bestPct:<n>", "character", "musicMuted")
    /// so save semantics match across the comparison.
    /// </summary>
    public static class Storage
    {
        public static int GetInt(string key, int fallback) => PlayerPrefs.GetInt(key, fallback);

        public static void SetInt(string key, int value)
        {
            PlayerPrefs.SetInt(key, value);
            PlayerPrefs.Save();
        }

        public static string GetString(string key, string fallback) =>
            PlayerPrefs.GetString(key, fallback);

        public static void SetString(string key, string value)
        {
            PlayerPrefs.SetString(key, value);
            PlayerPrefs.Save();
        }

        public static bool GetBool(string key, bool fallback) =>
            PlayerPrefs.GetInt(key, fallback ? 1 : 0) != 0;

        public static void SetBool(string key, bool value) => SetInt(key, value ? 1 : 0);
    }
}
