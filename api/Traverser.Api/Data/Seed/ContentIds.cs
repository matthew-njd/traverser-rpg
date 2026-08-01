namespace Traverser.Api.Data.Seed;

/// <summary>
/// The manifest IDs (docs/traverser-data-manifest.md) as constants, so every cross-reference in the
/// seed — a drop pool naming an item, a gate naming an enemy, a Trinket naming the move it grants —
/// is checked by the compiler rather than by proofreading. Values are the manifest keys verbatim;
/// manifest rule 2 guarantees they never change once shipped.
/// <para>
/// These are seed-data identifiers only. Runtime lookups use the same keys read from the database,
/// never these constants — nothing outside the seed should reference a specific content row.
/// </para>
/// </summary>
internal static class Ids
{
    internal static class Type
    {
        internal const string Storm = "storm";
        internal const string War = "war";
        internal const string Trickery = "trickery";
        internal const string Underworld = "underworld";
        internal const string Sea = "sea";
        internal const string Wisdom = "wisdom";
    }

    internal static class Zone
    {
        internal const string Olympion = "olympion";
        internal const string Valheon = "valheon";
        internal const string Imperion = "imperion";
        internal const string EgyptTbd = "egypt_tbd";
    }

    internal static class Enemy
    {
        internal const string Harpy = "enemy_harpy";
        internal const string Satyr = "enemy_satyr";
        internal const string Cyclops = "enemy_cyclops";
        internal const string Cerberus = "enemy_cerberus";
        internal const string Draugr = "enemy_draugr";
        internal const string Valkyrie = "enemy_valkyrie";
        internal const string Fenrir = "enemy_fenrir";
        internal const string Jormungandr = "enemy_jormungandr";
        internal const string Strix = "enemy_strix";
        internal const string Lemures = "enemy_lemures";
        internal const string Griffin = "enemy_griffin";
        internal const string Cacus = "enemy_cacus";
        internal const string WaystoneWisp = "enemy_waystone_wisp";
    }

    /// <summary>Enemy moves. Savage Bite is two rows sharing a display name (manifest note).</summary>
    internal static class EMove
    {
        internal const string GustStrike = "emove_gust_strike";
        internal const string Buffet = "emove_buffet";
        internal const string ShadowLunge = "emove_shadow_lunge";
        internal const string QuickJab = "emove_quick_jab";
        internal const string BoulderHurl = "emove_boulder_hurl";
        internal const string WarShout = "emove_war_shout";
        internal const string DeathBreath = "emove_death_breath";
        internal const string ThreeFangedStrike = "emove_three_fanged_strike";
        internal const string SavageBiteCerberus = "emove_savage_bite_cerberus";
        internal const string GraveSwing = "emove_grave_swing";
        internal const string SoulDrain = "emove_soul_drain";
        internal const string StormLance = "emove_storm_lance";
        internal const string ShieldBash = "emove_shield_bash";
        internal const string SavageBiteFenrir = "emove_savage_bite_fenrir";
        internal const string WarHowl = "emove_war_howl";
        internal const string CrushingCoil = "emove_crushing_coil";
        internal const string VenomTide = "emove_venom_tide";
        internal const string WorldTremor = "emove_world_tremor";
        internal const string Nightcut = "emove_nightcut";
        internal const string TalonRake = "emove_talon_rake";
        internal const string RestlessGrasp = "emove_restless_grasp";
        internal const string GraveKnell = "emove_grave_knell";
        internal const string WingBuffet = "emove_wing_buffet";
        internal const string VigilantGaze = "emove_vigilant_gaze";
        internal const string ThunderousRoar = "emove_thunderous_roar";
        internal const string CinderGrip = "emove_cinder_grip";
        internal const string AshenGale = "emove_ashen_gale";
        internal const string ChillingGust = "emove_chilling_gust";
    }

    internal static class Skill
    {
        internal const string BasicAttack = "skill_basic_attack";
        internal const string IronAdvance = "skill_iron_advance";
        internal const string ThunderersWrath = "skill_thunderers_wrath";
        internal const string WarlordsAdvance = "skill_warlords_advance";
        internal const string Shadowstep = "skill_shadowstep";
        internal const string TitansReach = "skill_titans_reach";
        internal const string PaleSentence = "skill_pale_sentence";
        internal const string TidecallersGrasp = "skill_tidecallers_grasp";
        internal const string SagesVerdict = "skill_sages_verdict";
        internal const string ChampionsSurge = "skill_champions_surge";
    }

    /// <summary>Trinket-granted moves (GDD 8 §4.3).</summary>
    internal static class GMove
    {
        internal const string GatekeepersRuse = "move_gatekeepers_ruse";
        internal const string GatekeepersSnare = "move_gatekeepers_snare";
        internal const string CoilbreakersOath = "move_coilbreakers_oath";
        internal const string CoilbreakersWrath = "move_coilbreakers_wrath";
        internal const string EmberwiseWard = "move_emberwise_ward";
        internal const string EmberwiseVerdict = "move_emberwise_verdict";
    }

    internal static class Item
    {
        internal const string TravelersSalve = "item_travelers_salve";
        internal const string HeraldsDraft = "item_heralds_draft";
        internal const string AmbrosiaShard = "item_ambrosia_shard";
        internal const string IronhideTincture = "item_ironhide_tincture";
        internal const string SunderOil = "item_sunder_oil";
        internal const string FleetOmen = "item_fleet_omen";
        internal const string Stormveil = "item_stormveil";
        internal const string Battlebrand = "item_battlebrand";
        internal const string Shadowblur = "item_shadowblur";
        internal const string PaleAsh = "item_pale_ash";
        internal const string Brinestone = "item_brinestone";
        internal const string Clearsight = "item_clearsight";
        internal const string Thundercrack = "item_thundercrack";
        internal const string Warhex = "item_warhex";
        internal const string Shadowbind = "item_shadowbind";
        internal const string Gravemark = "item_gravemark";
        internal const string Undertow = "item_undertow";
        internal const string Blindveil = "item_blindveil";
    }

    internal static class Gear
    {
        internal const string WeaponMortal = "gear_weapon_mortal";
        internal const string WeaponHeroic = "gear_weapon_heroic";
        internal const string WeaponMythic = "gear_weapon_mythic";
        internal const string WeaponDivine = "gear_weapon_divine";
        internal const string ArmorMortal = "gear_armor_mortal";
        internal const string ArmorHeroic = "gear_armor_heroic";
        internal const string ArmorMythic = "gear_armor_mythic";
        internal const string ArmorDivine = "gear_armor_divine";
        internal const string AccessoryMortal = "gear_accessory_mortal";
        internal const string AccessoryHeroic = "gear_accessory_heroic";
        internal const string AccessoryMythic = "gear_accessory_mythic";
        internal const string AccessoryDivine = "gear_accessory_divine";
        internal const string SkyroadSigil = "gear_skyroad_sigil";
        internal const string FrostroadSigil = "gear_frostroad_sigil";
        internal const string SunroadSigil = "gear_sunroad_sigil";
        internal const string GatekeepersRuse = "gear_gatekeepers_ruse";
        internal const string GatekeepersSnare = "gear_gatekeepers_snare";
        internal const string CoilbreakersOath = "gear_coilbreakers_oath";
        internal const string CoilbreakersWrath = "gear_coilbreakers_wrath";
        internal const string EmberwiseWard = "gear_emberwise_ward";
        internal const string EmberwiseVerdict = "gear_emberwise_verdict";
    }

    internal static class Gate
    {
        internal const string Cyclops = "gate_cyclops";
        internal const string Cerberus = "gate_cerberus";
        internal const string Fenrir = "gate_fenrir";
        internal const string Jormungandr = "gate_jormungandr";
        internal const string Griffin = "gate_griffin";
        internal const string Cacus = "gate_cacus";
    }
}
