namespace Traverser.Api.Data.Seed;

/// <summary>
/// GDD 12's text, verbatim. Lines within one beat are separated by <c>\n</c>; a zone's entry
/// narrative is one element per tap-through screen.
/// </summary>
internal static partial class ContentSeed
{
    private sealed record Lore(string? Flavor = null, string? Intro = null, string? DefeatFirst = null, string? DefeatRepeat = null);

    private static readonly Dictionary<string, Lore> EnemyLore = new()
    {
        // GDD 12 §8.1
        [Ids.Enemy.Harpy] = new(Flavor: "\"Harpyiai\" means \"the snatchers\" — but older still, they were the sudden violence of a storm made into something with wings. The gust that arrives before you see the clouds. That part of the myth was never a stretch at all."),
        [Ids.Enemy.Satyr] = new(Flavor: "It grins before it's decided whether to fight you or trade with you. Usually both."),

        // GDD 12 §5
        [Ids.Enemy.Cyclops] = new(
            Intro: "A single eye finds you across the ruined pass. It doesn't blink.\n\"You will not pass. None have. None will.\"",
            DefeatFirst: "The great shape falls, and the pass is quiet for the first time in longer than either of you have lived.\n\"None have,\" it said. It was wrong once. That's enough.",
            DefeatRepeat: "The pass remembers you now. It doesn't put up much of a fight."),
        [Ids.Enemy.Cerberus] = new(
            Intro: "Three heads turn toward you at once — the gate they've guarded for an age finally has a visitor.\n\"The road ends here. It has ended here for longer than you can imagine.\"",
            DefeatFirst: "All three heads go still. The gate behind them, sealed since before memory, groans open.\nIt guarded this gate faithfully, long after anyone came to open it. In its wake, something is left behind — a trick worth carrying north.",
            DefeatRepeat: "The gate remembers you. It opens without a fight."),

        // GDD 12 §8.2
        [Ids.Enemy.Draugr] = new(Flavor: "It was buried with its grudges, and the ground never quite closed over either."),
        [Ids.Enemy.Valkyrie] = new(Flavor: "She doesn't announce herself before she decides whether you're worth carrying — and she decides fast, before you've finished deciding anything yourself. No trick of the type chart changes her mind."),

        // GDD 12 §6
        [Ids.Enemy.Fenrir] = new(
            Intro: "A shape too large to be a wolf and too fast to be anything else circles once before it charges.\n\"You walk where the bound should not be woken.\"",
            DefeatFirst: "The great wolf finally slows. Something like respect, or something close enough to it, passes between you.\nIt was bound here once. It chose to stay bound to something — the gate, if nothing else. That's over now.",
            DefeatRepeat: "It knows your stride before you take it. The fight is shorter this time."),
        [Ids.Enemy.Jormungandr] = new(
            Intro: "The water doesn't ripple so much as it simply stops being water, and becomes something enormous instead.\n\"Even the roads that reach the sea end at me.\"",
            DefeatFirst: "The Serpent uncoils, and for the first time, the sea it wound itself around is only sea.\nIt fought like something that had never once needed to consider losing. Something of that certainty is worth taking with you — a war learned from the Serpent's own fury.",
            DefeatRepeat: "The sea remembers the shape it used to hold. It doesn't hold it for long."),

        // GDD 12 §8.3
        [Ids.Enemy.Strix] = new(Flavor: "It watches from just outside the torchlight — patient in the particular way that only something that used to be a person can be patient."),
        [Ids.Enemy.Lemures] = new(Flavor: "Restless dead who never got the burial rites owed to them. They don't want your road. They want to stop being forgotten."),

        // GDD 12 §7
        [Ids.Enemy.Griffin] = new(
            Intro: "Lion and eagle in the same silhouette, and neither half of it seems inclined to let you pass.\n\"The high roads are not walked. They are earned.\"",
            DefeatFirst: "It yields the high ground the way something proud yields — without conceding it was ever truly beaten.\nThe first thing on this road that answered to neither storm nor blade nor tide, but to something quieter. Worth remembering.",
            DefeatRepeat: "It watches you climb again, already knowing how this ends."),
        [Ids.Enemy.Cacus] = new(
            Intro: "Smoke rolls off the cave mouth before he does — and when he finally steps out, the wind that follows him is hot enough to taste like fire.\n\"Every road that reaches this far ends in my hoard. Yours is no different.\"",
            DefeatFirst: "The roaring wind dies with him, and the ash he carried settles for the first time in longer than the road can remember.\nWhat the fire-giant never understood, you now carry. And somewhere past where this road ends, in a direction it hasn't opened yet, something old is already listening.",
            DefeatRepeat: "The ash has barely settled. He rises to guard it again anyway."),
    };

    /// <summary>GDD 12 §4. Olympion has none: onboarding's story intro already serves (§2).</summary>
    private static readonly Dictionary<string, string[]> EntryNarratives = new()
    {
        [Ids.Zone.Valheon] =
        [
            "Cerberus kept its gate long after anyone came to open it. Now the gate is open — and the road beyond it is colder than the one behind.",
            "Valheon: where the roads were paved in frost and timber, and the sky itself once carried messengers between worlds.",
            "Something here has been waiting even longer than the Greek roads did. It hasn't forgotten how to fight.",
            "The road continues. Keep walking.",
        ],
        [Ids.Zone.Imperion] =
        [
            "The World Serpent's coils are still, for the first time in longer than the roads remember.",
            "Imperion: where the road was built to last — stone laid over stone, arch over arch, an empire's answer to roads that used to just happen.",
            "An empire builds walls as readily as roads. Not everything here wants to be found.",
            "The road continues. Keep walking.",
        ],
    };
}
