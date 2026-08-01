using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class ContentSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "content_version",
                columns: new[] { "id", "generated_at", "version" },
                values: new object[] { 1, new DateTime(2026, 7, 31, 0, 0, 0, 0, DateTimeKind.Utc), 1 });

            migrationBuilder.InsertData(
                table: "drop_rate",
                columns: new[] { "encounter_kind", "reward_kind", "chance", "qty_max", "qty_min", "tier" },
                values: new object[,]
                {
                    { "daily_goal", "gear", 0.250m, 1, 1, "mortal" },
                    { "daily_goal", "item", 1.000m, 1, 1, null },
                    { "mini_boss", "gear", 0.600m, 1, 1, "heroic" },
                    { "mini_boss", "item", 0.750m, 2, 1, null },
                    { "mini_boss", "trinket", 1.000m, 1, 1, "heroic" },
                    { "wild", "gear", 0.200m, 1, 1, "mortal" },
                    { "wild", "item", 0.350m, 1, 1, null },
                    { "zone_boss_first", "gear", 1.000m, 1, 1, "divine" },
                    { "zone_boss_first", "item", 1.000m, 3, 2, null },
                    { "zone_boss_first", "trinket", 1.000m, 1, 1, "divine" },
                    { "zone_boss_repeat", "gear", 1.000m, 1, 1, "mythic" },
                    { "zone_boss_repeat", "item", 0.750m, 2, 1, null },
                    { "zone_boss_repeat", "trinket", 1.000m, 1, 1, "mythic" }
                });

            migrationBuilder.InsertData(
                table: "enemy",
                columns: new[] { "id", "display_name", "role", "type_id", "zone_id" },
                values: new object[] { "enemy_waystone_wisp", "Waystone Wisp", "tutorial", null, null });

            migrationBuilder.InsertData(
                table: "game_type",
                columns: new[] { "id", "cycle_ordinal", "display_name" },
                values: new object[,]
                {
                    { "sea", 4, "Sea" },
                    { "storm", 0, "Storm" },
                    { "trickery", 2, "Trickery" },
                    { "underworld", 3, "Underworld" },
                    { "war", 1, "War" },
                    { "wisdom", 5, "Wisdom" }
                });

            migrationBuilder.InsertData(
                table: "gear_def",
                columns: new[] { "id", "display_name", "flavor", "grants_move_id", "slot", "tier", "zone_id" },
                values: new object[,]
                {
                    { "gear_accessory_divine", "Ascendant's Band", null, null, "accessory", "divine", null },
                    { "gear_accessory_heroic", "Warden's Band", null, null, "accessory", "heroic", null },
                    { "gear_accessory_mortal", "Traveler's Band", null, null, "accessory", "mortal", null },
                    { "gear_accessory_mythic", "Paragon's Band", null, null, "accessory", "mythic", null },
                    { "gear_armor_divine", "Ascendant's Guard", null, null, "armor", "divine", null },
                    { "gear_armor_heroic", "Warden's Guard", null, null, "armor", "heroic", null },
                    { "gear_armor_mortal", "Traveler's Guard", null, null, "armor", "mortal", null },
                    { "gear_armor_mythic", "Paragon's Guard", null, null, "armor", "mythic", null },
                    { "gear_weapon_divine", "Ascendant's Blade", null, null, "weapon", "divine", null },
                    { "gear_weapon_heroic", "Warden's Blade", null, null, "weapon", "heroic", null },
                    { "gear_weapon_mortal", "Traveler's Blade", null, null, "weapon", "mortal", null },
                    { "gear_weapon_mythic", "Paragon's Blade", null, null, "weapon", "mythic", null }
                });

            migrationBuilder.InsertData(
                table: "gear_tier_bonus",
                columns: new[] { "tier", "flat", "rate", "trinket_split" },
                values: new object[,]
                {
                    { "divine", 4, 0.25m, 0.60m },
                    { "heroic", 2, 0.10m, 0.60m },
                    { "mortal", 1, 0.05m, 0.60m },
                    { "mythic", 3, 0.17m, 0.60m }
                });

            migrationBuilder.InsertData(
                table: "item_def",
                columns: new[] { "id", "battle_only", "category", "display_name", "effect", "flavor", "heal_pct", "max_stack", "rarity", "type_id" },
                values: new object[,]
                {
                    { "item_ambrosia_shard", false, "heal", "Ambrosia Shard", null, "A fragment of something that shouldn't exist in the mortal world. Use it carefully.", 100, 2, "rare", null },
                    { "item_fleet_omen", true, "buff", "Fleet Omen", "swift", "The tingling sense that you're about to move very quickly. Follow it.", null, 2, "rare", null },
                    { "item_heralds_draft", false, "heal", "Herald's Draft", null, "What gods' messengers drink between realms. Enough remains for mortals.", 40, 3, "uncommon", null },
                    { "item_ironhide_tincture", true, "buff", "Ironhide Tincture", "fortify", "Rubbed into the skin before a battle that might hurt. Usually does.", null, 3, "uncommon", null },
                    { "item_sunder_oil", true, "buff", "Sunder Oil", "weaken", "Coats a weapon or hand. The next blow it lands will land soft.", null, 3, "uncommon", null },
                    { "item_travelers_salve", false, "heal", "Traveler's Salve", null, "Found along every old road. Mixed from whatever grows near the path.", 20, 5, "common", null }
                });

            migrationBuilder.InsertData(
                table: "level_milestone",
                columns: new[] { "level", "reward_kind", "gear_tier", "item_def_id" },
                values: new object[,]
                {
                    { 15, "gear", "heroic", null },
                    { 25, "gear", "mythic", null },
                    { 35, "gear", "heroic", null },
                    { 45, "gear", "mythic", null },
                    { 55, "gear", "heroic", null }
                });

            migrationBuilder.InsertData(
                table: "player_skill_def",
                columns: new[] { "id", "category", "display_name", "power", "type_id", "unlock_level", "uses" },
                values: new object[,]
                {
                    { "skill_basic_attack", "physical", "Basic Attack", 40, null, 1, null },
                    { "skill_champions_surge", "physical", "Champion's Surge", 100, null, 56, 3 },
                    { "skill_iron_advance", "physical", "Iron Advance", 60, null, 4, 5 },
                    { "skill_titans_reach", "physical", "Titan's Reach", 80, null, 22, 4 }
                });

            migrationBuilder.InsertData(
                table: "streak_milestone",
                columns: new[] { "day", "slot", "tier" },
                values: new object[,]
                {
                    { 3, "armor", "mortal" },
                    { 7, "accessory", "mortal" },
                    { 14, "weapon", "heroic" },
                    { 25, "armor", "heroic" },
                    { 40, "accessory", "heroic" },
                    { 60, "weapon", "mythic" },
                    { 90, "armor", "mythic" },
                    { 120, "accessory", "mythic" }
                });

            migrationBuilder.InsertData(
                table: "xp_curve",
                columns: new[] { "level", "cumulative", "xp_to_next" },
                values: new object[,]
                {
                    { 1, 0, 100 },
                    { 2, 100, 207 },
                    { 3, 307, 317 },
                    { 4, 624, 429 },
                    { 5, 1053, 542 },
                    { 6, 1595, 656 },
                    { 7, 2251, 772 },
                    { 8, 3023, 888 },
                    { 9, 3911, 1005 },
                    { 10, 4916, 1122 },
                    { 11, 6038, 1240 },
                    { 12, 7278, 1359 },
                    { 13, 8637, 1478 },
                    { 14, 10115, 1597 },
                    { 15, 11712, 1717 },
                    { 16, 13429, 1838 },
                    { 17, 15267, 1959 },
                    { 18, 17226, 2080 },
                    { 19, 19306, 2201 },
                    { 20, 21507, 2323 },
                    { 21, 23830, 2445 },
                    { 22, 26275, 2568 },
                    { 23, 28843, 2690 },
                    { 24, 31533, 2813 },
                    { 25, 34346, 2937 },
                    { 26, 37283, 3060 },
                    { 27, 40343, 3184 },
                    { 28, 43527, 3308 },
                    { 29, 46835, 3432 },
                    { 30, 50267, 3556 },
                    { 31, 53823, 3681 },
                    { 32, 57504, 3805 },
                    { 33, 61309, 3930 },
                    { 34, 65239, 4056 },
                    { 35, 69295, 4181 },
                    { 36, 73476, 4306 },
                    { 37, 77782, 4432 },
                    { 38, 82214, 4558 },
                    { 39, 86772, 4684 },
                    { 40, 91456, 4810 },
                    { 41, 96266, 4937 },
                    { 42, 101203, 5063 },
                    { 43, 106266, 5190 },
                    { 44, 111456, 5316 },
                    { 45, 116772, 5443 },
                    { 46, 122215, 5571 },
                    { 47, 127786, 5698 },
                    { 48, 133484, 5825 },
                    { 49, 139309, 5953 },
                    { 50, 145262, 6080 },
                    { 51, 151342, 6208 },
                    { 52, 157550, 6336 },
                    { 53, 163886, 6464 },
                    { 54, 170350, 6592 },
                    { 55, 176942, 6720 },
                    { 56, 183662, 6849 },
                    { 57, 190511, 6977 },
                    { 58, 197488, 7106 },
                    { 59, 204594, 7234 },
                    { 60, 211828, null }
                });

            migrationBuilder.InsertData(
                table: "zone",
                columns: new[] { "id", "display_name", "ordinal" },
                values: new object[] { "egypt_tbd", "The Road Ahead", 3 });

            migrationBuilder.InsertData(
                table: "zone",
                columns: new[] { "id", "display_name", "is_released", "ordinal" },
                values: new object[,]
                {
                    { "imperion", "Imperion", true, 2 },
                    { "olympion", "Olympion", true, 0 },
                    { "valheon", "Valheon", true, 1 }
                });

            migrationBuilder.InsertData(
                table: "enemy",
                columns: new[] { "id", "display_name", "role", "type_id", "zone_id" },
                values: new object[,]
                {
                    { "enemy_cacus", "Cacus", "zone_boss", "storm", "imperion" },
                    { "enemy_cerberus", "Cerberus", "zone_boss", "underworld", "olympion" },
                    { "enemy_cyclops", "Cyclops", "mid_boss", "war", "olympion" },
                    { "enemy_draugr", "Draugr", "wild", "underworld", "valheon" },
                    { "enemy_fenrir", "Fenrir", "mid_boss", "war", "valheon" },
                    { "enemy_griffin", "Griffin", "mid_boss", "wisdom", "imperion" },
                    { "enemy_harpy", "Harpy", "wild", "storm", "olympion" },
                    { "enemy_jormungandr", "Jörmungandr", "zone_boss", "sea", "valheon" },
                    { "enemy_lemures", "Lemures", "wild", "underworld", "imperion" },
                    { "enemy_satyr", "Satyr", "wild", "trickery", "olympion" },
                    { "enemy_strix", "Strix", "wild", "trickery", "imperion" },
                    { "enemy_valkyrie", "Valkyrie", "wild", "storm", "valheon" }
                });

            migrationBuilder.InsertData(
                table: "enemy_move",
                columns: new[] { "id", "ai_weight", "category", "display_name", "enemy_id", "power", "type_id" },
                values: new object[] { "emove_chilling_gust", 100, "divine", "Chilling Gust", "enemy_waystone_wisp", 30, null });

            migrationBuilder.InsertData(
                table: "enemy_stat_scaling",
                columns: new[] { "enemy_id", "stat", "base", "rate" },
                values: new object[,]
                {
                    { "enemy_waystone_wisp", "aegis", 10m, 0m },
                    { "enemy_waystone_wisp", "favor", 12m, 0m },
                    { "enemy_waystone_wisp", "might", 10m, 0m },
                    { "enemy_waystone_wisp", "resolve", 8m, 0m },
                    { "enemy_waystone_wisp", "stride", 6m, 0m },
                    { "enemy_waystone_wisp", "vigor", 15m, 0m }
                });

            migrationBuilder.InsertData(
                table: "gear_def",
                columns: new[] { "id", "display_name", "flavor", "grants_move_id", "slot", "tier", "zone_id" },
                values: new object[,]
                {
                    { "gear_frostroad_sigil", "Frostroad Sigil", "Carried the length of the road through Asgard's coldest stretch.", null, "trinket", "heroic", "valheon" },
                    { "gear_skyroad_sigil", "Skyroad Sigil", "A fragment of the road as it climbed toward Olympus.", null, "trinket", "heroic", "olympion" },
                    { "gear_sunroad_sigil", "Sunroad Sigil", "Warmed by every mile of the road through Rome's long noon.", null, "trinket", "heroic", "imperion" }
                });

            migrationBuilder.InsertData(
                table: "gear_move",
                columns: new[] { "id", "display_name", "effect", "power", "type_id", "uses" },
                values: new object[,]
                {
                    { "move_coilbreakers_oath", "Coilbreaker's Oath", null, 80, "war", 4 },
                    { "move_coilbreakers_wrath", "Coilbreaker's Wrath", "weaken", 75, "war", 3 },
                    { "move_emberwise_verdict", "Emberwise Verdict", "fortify", 75, "wisdom", 3 },
                    { "move_emberwise_ward", "Emberwise Ward", null, 80, "wisdom", 4 },
                    { "move_gatekeepers_ruse", "Gatekeeper's Ruse", null, 80, "trickery", 4 },
                    { "move_gatekeepers_snare", "Gatekeeper's Snare", "rend", 75, "trickery", 3 }
                });

            migrationBuilder.InsertData(
                table: "item_def",
                columns: new[] { "id", "battle_only", "category", "display_name", "effect", "flavor", "heal_pct", "max_stack", "rarity", "type_id" },
                values: new object[,]
                {
                    { "item_battlebrand", true, "surge", "Battlebrand", null, "Mark yourself for war. The next blow strikes with a conqueror's weight.", null, 3, "common", "war" },
                    { "item_blindveil", true, "breach", "Blindveil", null, "A veil over their sight. What follows passes through unimpeded.", null, 3, "uncommon", "wisdom" },
                    { "item_brinestone", true, "surge", "Brinestone", null, "A sea-smoothed stone, still damp. The depths speak through it.", null, 3, "common", "sea" },
                    { "item_clearsight", true, "surge", "Clearsight", null, "Clarity you hold for a moment. Long enough for one precise strike.", null, 3, "common", "wisdom" },
                    { "item_gravemark", true, "breach", "Gravemark", null, "The mark of the cold dark. It opens what should have stayed closed.", null, 3, "uncommon", "underworld" },
                    { "item_pale_ash", true, "surge", "Pale Ash", null, "Ash from the cold dark below. Your next strike carries its chill.", null, 3, "common", "underworld" },
                    { "item_shadowbind", true, "breach", "Shadowbind", null, "Their senses blur. They won't see the strike they should have.", null, 3, "uncommon", "trickery" },
                    { "item_shadowblur", true, "surge", "Shadowblur", null, "Blur the line between you and shadow. Your next move blurs with it.", null, 3, "common", "trickery" },
                    { "item_stormveil", true, "surge", "Stormveil", null, "Charge the air around your next strike. Something vast will answer.", null, 3, "common", "storm" },
                    { "item_thundercrack", true, "breach", "Thundercrack", null, "Pressed to the enemy's path. The sky's wrath will find them.", null, 3, "uncommon", "storm" },
                    { "item_undertow", true, "breach", "Undertow", null, "Set loose in the current beneath them. The tide will pull them down.", null, 3, "uncommon", "sea" },
                    { "item_warhex", true, "breach", "Warhex", null, "A battlefield curse. Whatever hits them next will hit them harder.", null, 3, "uncommon", "war" }
                });

            migrationBuilder.InsertData(
                table: "level_milestone",
                columns: new[] { "level", "reward_kind", "gear_tier", "item_def_id" },
                values: new object[,]
                {
                    { 10, "item", null, "item_ironhide_tincture" },
                    { 20, "item", null, "item_sunder_oil" },
                    { 40, "item", null, "item_ironhide_tincture" },
                    { 60, "item", null, "item_sunder_oil" }
                });

            migrationBuilder.InsertData(
                table: "player_skill_def",
                columns: new[] { "id", "category", "display_name", "power", "type_id", "unlock_level", "uses" },
                values: new object[,]
                {
                    { "skill_pale_sentence", "divine", "Pale Sentence", 75, "underworld", 30, 3 },
                    { "skill_sages_verdict", "divine", "Sage's Verdict", 75, "wisdom", 44, 3 },
                    { "skill_shadowstep", "divine", "Shadowstep", 55, "trickery", 16, 5 },
                    { "skill_thunderers_wrath", "divine", "Thunderer's Wrath", 65, "storm", 6, 4 },
                    { "skill_tidecallers_grasp", "divine", "Tidecaller's Grasp", 65, "sea", 36, 4 },
                    { "skill_warlords_advance", "divine", "Warlord's Advance", 65, "war", 10, 4 }
                });

            migrationBuilder.InsertData(
                table: "type_effectiveness",
                columns: new[] { "attacker_type_id", "defender_type_id", "multiplier" },
                values: new object[,]
                {
                    { "sea", "sea", 1.0m },
                    { "sea", "storm", 2.0m },
                    { "sea", "trickery", 0.5m },
                    { "sea", "underworld", 0.5m },
                    { "sea", "war", 1.0m },
                    { "sea", "wisdom", 2.0m },
                    { "storm", "sea", 0.5m },
                    { "storm", "storm", 1.0m },
                    { "storm", "trickery", 2.0m },
                    { "storm", "underworld", 1.0m },
                    { "storm", "war", 2.0m },
                    { "storm", "wisdom", 0.5m },
                    { "trickery", "sea", 2.0m },
                    { "trickery", "storm", 0.5m },
                    { "trickery", "trickery", 1.0m },
                    { "trickery", "underworld", 2.0m },
                    { "trickery", "war", 0.5m },
                    { "trickery", "wisdom", 1.0m },
                    { "underworld", "sea", 2.0m },
                    { "underworld", "storm", 1.0m },
                    { "underworld", "trickery", 0.5m },
                    { "underworld", "underworld", 1.0m },
                    { "underworld", "war", 0.5m },
                    { "underworld", "wisdom", 2.0m },
                    { "war", "sea", 1.0m },
                    { "war", "storm", 0.5m },
                    { "war", "trickery", 2.0m },
                    { "war", "underworld", 2.0m },
                    { "war", "war", 1.0m },
                    { "war", "wisdom", 0.5m },
                    { "wisdom", "sea", 0.5m },
                    { "wisdom", "storm", 2.0m },
                    { "wisdom", "trickery", 1.0m },
                    { "wisdom", "underworld", 0.5m },
                    { "wisdom", "war", 2.0m },
                    { "wisdom", "wisdom", 1.0m }
                });

            migrationBuilder.InsertData(
                table: "enemy_drop_pool",
                columns: new[] { "encounter_kind", "enemy_id", "item_def_id", "weight" },
                values: new object[,]
                {
                    { "zone_boss_first", "enemy_cacus", "item_ambrosia_shard", 1 },
                    { "zone_boss_first", "enemy_cacus", "item_stormveil", 1 },
                    { "zone_boss_first", "enemy_cacus", "item_thundercrack", 1 },
                    { "zone_boss_repeat", "enemy_cacus", "item_blindveil", 1 },
                    { "zone_boss_repeat", "enemy_cacus", "item_stormveil", 1 },
                    { "zone_boss_repeat", "enemy_cacus", "item_thundercrack", 1 },
                    { "zone_boss_repeat", "enemy_cacus", "item_travelers_salve", 1 },
                    { "zone_boss_first", "enemy_cerberus", "item_fleet_omen", 1 },
                    { "zone_boss_first", "enemy_cerberus", "item_gravemark", 1 },
                    { "zone_boss_first", "enemy_cerberus", "item_pale_ash", 1 },
                    { "zone_boss_repeat", "enemy_cerberus", "item_gravemark", 1 },
                    { "zone_boss_repeat", "enemy_cerberus", "item_pale_ash", 1 },
                    { "zone_boss_repeat", "enemy_cerberus", "item_shadowblur", 1 },
                    { "zone_boss_repeat", "enemy_cerberus", "item_travelers_salve", 1 },
                    { "zone_boss_repeat", "enemy_cerberus", "item_warhex", 1 },
                    { "mini_boss", "enemy_cyclops", "item_battlebrand", 1 },
                    { "mini_boss", "enemy_cyclops", "item_ironhide_tincture", 1 },
                    { "mini_boss", "enemy_cyclops", "item_stormveil", 1 },
                    { "mini_boss", "enemy_cyclops", "item_warhex", 1 },
                    { "wild", "enemy_draugr", "item_pale_ash", 1 },
                    { "wild", "enemy_draugr", "item_travelers_salve", 1 },
                    { "mini_boss", "enemy_fenrir", "item_battlebrand", 1 },
                    { "mini_boss", "enemy_fenrir", "item_ironhide_tincture", 1 },
                    { "mini_boss", "enemy_fenrir", "item_stormveil", 1 },
                    { "mini_boss", "enemy_fenrir", "item_warhex", 1 },
                    { "mini_boss", "enemy_griffin", "item_clearsight", 1 },
                    { "mini_boss", "enemy_griffin", "item_ironhide_tincture", 1 },
                    { "mini_boss", "enemy_griffin", "item_undertow", 1 },
                    { "wild", "enemy_harpy", "item_stormveil", 1 },
                    { "wild", "enemy_harpy", "item_travelers_salve", 1 },
                    { "zone_boss_first", "enemy_jormungandr", "item_ambrosia_shard", 1 },
                    { "zone_boss_first", "enemy_jormungandr", "item_brinestone", 1 },
                    { "zone_boss_first", "enemy_jormungandr", "item_shadowbind", 1 },
                    { "zone_boss_repeat", "enemy_jormungandr", "item_brinestone", 1 },
                    { "zone_boss_repeat", "enemy_jormungandr", "item_shadowbind", 1 },
                    { "zone_boss_repeat", "enemy_jormungandr", "item_travelers_salve", 1 },
                    { "zone_boss_repeat", "enemy_jormungandr", "item_undertow", 1 },
                    { "wild", "enemy_lemures", "item_pale_ash", 1 },
                    { "wild", "enemy_lemures", "item_travelers_salve", 1 },
                    { "wild", "enemy_satyr", "item_battlebrand", 1 },
                    { "wild", "enemy_satyr", "item_shadowblur", 1 },
                    { "wild", "enemy_satyr", "item_travelers_salve", 1 },
                    { "wild", "enemy_strix", "item_battlebrand", 1 },
                    { "wild", "enemy_strix", "item_shadowblur", 1 },
                    { "wild", "enemy_strix", "item_travelers_salve", 1 },
                    { "wild", "enemy_valkyrie", "item_stormveil", 1 },
                    { "wild", "enemy_valkyrie", "item_travelers_salve", 1 }
                });

            migrationBuilder.InsertData(
                table: "enemy_move",
                columns: new[] { "id", "ai_weight", "category", "display_name", "enemy_id", "power", "type_id" },
                values: new object[,]
                {
                    { "emove_ashen_gale", 25, "divine", "Ashen Gale", "enemy_cacus", 45, "storm" },
                    { "emove_boulder_hurl", 60, "physical", "Boulder Hurl", "enemy_cyclops", 40, null },
                    { "emove_buffet", 30, "physical", "Buffet", "enemy_harpy", 25, null },
                    { "emove_cinder_grip", 35, "physical", "Cinder Grip", "enemy_cacus", 60, null },
                    { "emove_crushing_coil", 30, "physical", "Crushing Coil", "enemy_jormungandr", 55, null },
                    { "emove_death_breath", 45, "divine", "Death Breath", "enemy_cerberus", 60, "underworld" },
                    { "emove_grave_knell", 40, "divine", "Grave Knell", "enemy_lemures", 40, "underworld" },
                    { "emove_grave_swing", 60, "physical", "Grave Swing", "enemy_draugr", 50, null },
                    { "emove_gust_strike", 70, "divine", "Gust Strike", "enemy_harpy", 40, "storm" },
                    { "emove_nightcut", 60, "divine", "Nightcut", "enemy_strix", 45, "trickery" },
                    { "emove_quick_jab", 40, "physical", "Quick Jab", "enemy_satyr", 30, null },
                    { "emove_restless_grasp", 60, "physical", "Restless Grasp", "enemy_lemures", 50, null },
                    { "emove_savage_bite_cerberus", 20, "physical", "Savage Bite", "enemy_cerberus", 40, null },
                    { "emove_savage_bite_fenrir", 50, "physical", "Savage Bite", "enemy_fenrir", 40, null },
                    { "emove_shadow_lunge", 60, "divine", "Shadow Lunge", "enemy_satyr", 45, "trickery" },
                    { "emove_shield_bash", 20, "physical", "Shield Bash", "enemy_valkyrie", 20, null },
                    { "emove_soul_drain", 40, "divine", "Soul Drain", "enemy_draugr", 40, "underworld" },
                    { "emove_storm_lance", 80, "divine", "Storm Lance", "enemy_valkyrie", 50, "storm" },
                    { "emove_talon_rake", 40, "physical", "Talon Rake", "enemy_strix", 30, null },
                    { "emove_three_fanged_strike", 35, "physical", "Three-Fanged Strike", "enemy_cerberus", 50, null },
                    { "emove_thunderous_roar", 40, "divine", "Thunderous Roar", "enemy_cacus", 70, "storm" },
                    { "emove_venom_tide", 45, "divine", "Venom Tide", "enemy_jormungandr", 65, "sea" },
                    { "emove_vigilant_gaze", 50, "divine", "Vigilant Gaze", "enemy_griffin", 55, "wisdom" },
                    { "emove_war_howl", 50, "divine", "War Howl", "enemy_fenrir", 50, "war" },
                    { "emove_war_shout", 40, "divine", "War Shout", "enemy_cyclops", 55, "war" },
                    { "emove_wing_buffet", 50, "physical", "Wing Buffet", "enemy_griffin", 50, null },
                    { "emove_world_tremor", 25, "physical", "World Tremor", "enemy_jormungandr", 40, null }
                });

            migrationBuilder.InsertData(
                table: "enemy_stat_scaling",
                columns: new[] { "enemy_id", "stat", "base", "rate" },
                values: new object[,]
                {
                    { "enemy_cacus", "aegis", 9m, 0.6m },
                    { "enemy_cacus", "favor", 13m, 0.95m },
                    { "enemy_cacus", "might", 11m, 0.9m },
                    { "enemy_cacus", "resolve", 8m, 0.55m },
                    { "enemy_cacus", "stride", 7m, 0.32m },
                    { "enemy_cacus", "vigor", 22m, 2.2m },
                    { "enemy_cerberus", "aegis", 8m, 0.5m },
                    { "enemy_cerberus", "favor", 8m, 0.75m },
                    { "enemy_cerberus", "might", 9m, 0.75m },
                    { "enemy_cerberus", "resolve", 7m, 0.5m },
                    { "enemy_cerberus", "stride", 5m, 0.25m },
                    { "enemy_cerberus", "vigor", 20m, 5.5m },
                    { "enemy_cyclops", "aegis", 7m, 0.5m },
                    { "enemy_cyclops", "favor", 7m, 0.5m },
                    { "enemy_cyclops", "might", 10m, 1.0m },
                    { "enemy_cyclops", "resolve", 8m, 0.75m },
                    { "enemy_cyclops", "stride", 5m, 0.25m },
                    { "enemy_cyclops", "vigor", 15m, 4.5m },
                    { "enemy_draugr", "aegis", 6m, 0.5m },
                    { "enemy_draugr", "favor", 5m, 0.5m },
                    { "enemy_draugr", "might", 8m, 0.75m },
                    { "enemy_draugr", "resolve", 7m, 0.6m },
                    { "enemy_draugr", "stride", 5m, 0.5m },
                    { "enemy_draugr", "vigor", 8m, 2.5m },
                    { "enemy_fenrir", "aegis", 7m, 0.5m },
                    { "enemy_fenrir", "favor", 9m, 0.6m },
                    { "enemy_fenrir", "might", 10m, 0.8m },
                    { "enemy_fenrir", "resolve", 8m, 0.6m },
                    { "enemy_fenrir", "stride", 8m, 0.6m },
                    { "enemy_fenrir", "vigor", 22m, 4.0m },
                    { "enemy_griffin", "aegis", 9m, 0.65m },
                    { "enemy_griffin", "favor", 11m, 0.75m },
                    { "enemy_griffin", "might", 10m, 0.85m },
                    { "enemy_griffin", "resolve", 9m, 0.7m },
                    { "enemy_griffin", "stride", 10m, 0.7m },
                    { "enemy_griffin", "vigor", 20m, 2.5m },
                    { "enemy_harpy", "aegis", 5m, 0.5m },
                    { "enemy_harpy", "favor", 7m, 0.75m },
                    { "enemy_harpy", "might", 5m, 0.25m },
                    { "enemy_harpy", "resolve", 5m, 0.25m },
                    { "enemy_harpy", "stride", 10m, 1.0m },
                    { "enemy_harpy", "vigor", 8m, 3.0m },
                    { "enemy_jormungandr", "aegis", 8m, 0.6m },
                    { "enemy_jormungandr", "favor", 10m, 0.8m },
                    { "enemy_jormungandr", "might", 8m, 0.6m },
                    { "enemy_jormungandr", "resolve", 5m, 0.3m },
                    { "enemy_jormungandr", "stride", 5m, 0.25m },
                    { "enemy_jormungandr", "vigor", 18m, 4.0m },
                    { "enemy_lemures", "aegis", 7m, 0.6m },
                    { "enemy_lemures", "favor", 6m, 0.6m },
                    { "enemy_lemures", "might", 9m, 0.85m },
                    { "enemy_lemures", "resolve", 8m, 0.7m },
                    { "enemy_lemures", "stride", 6m, 0.55m },
                    { "enemy_lemures", "vigor", 10m, 2.7m },
                    { "enemy_satyr", "aegis", 6m, 0.5m },
                    { "enemy_satyr", "favor", 7m, 0.75m },
                    { "enemy_satyr", "might", 6m, 0.5m },
                    { "enemy_satyr", "resolve", 6m, 0.5m },
                    { "enemy_satyr", "stride", 8m, 0.75m },
                    { "enemy_satyr", "vigor", 8m, 2.5m },
                    { "enemy_strix", "aegis", 6m, 0.5m },
                    { "enemy_strix", "favor", 8m, 0.9m },
                    { "enemy_strix", "might", 6m, 0.5m },
                    { "enemy_strix", "resolve", 6m, 0.5m },
                    { "enemy_strix", "stride", 9m, 0.8m },
                    { "enemy_strix", "vigor", 10m, 2.6m },
                    { "enemy_valkyrie", "aegis", 6m, 0.5m },
                    { "enemy_valkyrie", "favor", 9m, 0.9m },
                    { "enemy_valkyrie", "might", 5m, 0.3m },
                    { "enemy_valkyrie", "resolve", 5m, 0.3m },
                    { "enemy_valkyrie", "stride", 11m, 1.0m },
                    { "enemy_valkyrie", "vigor", 6m, 2.0m }
                });

            migrationBuilder.InsertData(
                table: "gear_def",
                columns: new[] { "id", "display_name", "flavor", "grants_move_id", "slot", "tier", "zone_id" },
                values: new object[,]
                {
                    { "gear_coilbreakers_oath", "Coilbreaker's Oath", "You broke the coils that broke gods. Nothing mortal feels as dangerous again.", "move_coilbreakers_oath", "trinket", "mythic", "valheon" },
                    { "gear_coilbreakers_wrath", "Coilbreaker's Wrath", "It struck once, at everything. It won't get to again.", "move_coilbreakers_wrath", "trinket", "divine", "valheon" },
                    { "gear_emberwise_verdict", "Emberwise Verdict", "The fire's lesson, finally learned: guard yourself before you strike.", "move_emberwise_verdict", "trinket", "divine", "imperion" },
                    { "gear_emberwise_ward", "Emberwise Ward", "What the fire-giant never understood, you now carry.", "move_emberwise_ward", "trinket", "mythic", "imperion" },
                    { "gear_gatekeepers_ruse", "Gatekeeper's Ruse", "Slip past what should have stopped you. It worked once.", "move_gatekeepers_ruse", "trinket", "mythic", "olympion" },
                    { "gear_gatekeepers_snare", "Gatekeeper's Snare", "The guardian's own trick, turned outward. Something is left marked.", "move_gatekeepers_snare", "trinket", "divine", "olympion" }
                });

            migrationBuilder.InsertData(
                table: "level_milestone",
                columns: new[] { "level", "reward_kind", "gear_tier", "item_def_id" },
                values: new object[,]
                {
                    { 30, "item", null, "item_warhex" },
                    { 50, "item", null, "item_thundercrack" }
                });

            migrationBuilder.InsertData(
                table: "zone_gate",
                columns: new[] { "id", "enemy_id", "gate_kind", "is_hard_gate", "league_threshold", "unlocks_zone_id", "zone_id" },
                values: new object[,]
                {
                    { "gate_cacus", "enemy_cacus", "final_boss", true, 2900, "egypt_tbd", "imperion" },
                    { "gate_cerberus", "enemy_cerberus", "final_boss", true, 220, "valheon", "olympion" },
                    { "gate_cyclops", "enemy_cyclops", "mid_boss", false, 90, null, "olympion" },
                    { "gate_fenrir", "enemy_fenrir", "mid_boss", false, 380, null, "valheon" },
                    { "gate_griffin", "enemy_griffin", "mid_boss", false, 1850, null, "imperion" },
                    { "gate_jormungandr", "enemy_jormungandr", "final_boss", true, 900, "imperion", "valheon" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "daily_goal", "gear" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "daily_goal", "item" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "mini_boss", "gear" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "mini_boss", "item" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "mini_boss", "trinket" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "wild", "gear" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "wild", "item" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "zone_boss_first", "gear" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "zone_boss_first", "item" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "zone_boss_first", "trinket" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "zone_boss_repeat", "gear" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "zone_boss_repeat", "item" });

            migrationBuilder.DeleteData(
                table: "drop_rate",
                keyColumns: new[] { "encounter_kind", "reward_kind" },
                keyValues: new object[] { "zone_boss_repeat", "trinket" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cacus", "item_ambrosia_shard" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cacus", "item_stormveil" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cacus", "item_thundercrack" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_blindveil" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_stormveil" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_thundercrack" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cerberus", "item_fleet_omen" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cerberus", "item_gravemark" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cerberus", "item_pale_ash" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_gravemark" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_pale_ash" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_shadowblur" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_warhex" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_battlebrand" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_ironhide_tincture" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_stormveil" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_warhex" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_draugr", "item_pale_ash" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_draugr", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_battlebrand" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_ironhide_tincture" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_stormveil" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_warhex" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_griffin", "item_clearsight" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_griffin", "item_ironhide_tincture" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_griffin", "item_undertow" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_harpy", "item_stormveil" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_harpy", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_jormungandr", "item_ambrosia_shard" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_jormungandr", "item_brinestone" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_jormungandr", "item_shadowbind" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_brinestone" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_shadowbind" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_undertow" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_lemures", "item_pale_ash" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_lemures", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_satyr", "item_battlebrand" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_satyr", "item_shadowblur" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_satyr", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_strix", "item_battlebrand" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_strix", "item_shadowblur" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_strix", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_valkyrie", "item_stormveil" });

            migrationBuilder.DeleteData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_valkyrie", "item_travelers_salve" });

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_ashen_gale");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_boulder_hurl");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_buffet");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_chilling_gust");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_cinder_grip");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_crushing_coil");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_death_breath");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_grave_knell");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_grave_swing");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_gust_strike");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_nightcut");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_quick_jab");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_restless_grasp");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_savage_bite_cerberus");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_savage_bite_fenrir");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_shadow_lunge");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_shield_bash");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_soul_drain");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_storm_lance");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_talon_rake");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_three_fanged_strike");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_thunderous_roar");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_venom_tide");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_vigilant_gaze");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_war_howl");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_war_shout");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_wing_buffet");

            migrationBuilder.DeleteData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_world_tremor");

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "vigor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_waystone_wisp", "aegis" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_waystone_wisp", "favor" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_waystone_wisp", "might" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_waystone_wisp", "resolve" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_waystone_wisp", "stride" });

            migrationBuilder.DeleteData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_waystone_wisp", "vigor" });

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_accessory_divine");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_accessory_heroic");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_accessory_mortal");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_accessory_mythic");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_armor_divine");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_armor_heroic");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_armor_mortal");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_armor_mythic");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_coilbreakers_oath");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_coilbreakers_wrath");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_emberwise_verdict");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_emberwise_ward");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_frostroad_sigil");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_gatekeepers_ruse");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_gatekeepers_snare");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_skyroad_sigil");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_sunroad_sigil");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_weapon_divine");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_weapon_heroic");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_weapon_mortal");

            migrationBuilder.DeleteData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_weapon_mythic");

            migrationBuilder.DeleteData(
                table: "gear_tier_bonus",
                keyColumn: "tier",
                keyValue: "divine");

            migrationBuilder.DeleteData(
                table: "gear_tier_bonus",
                keyColumn: "tier",
                keyValue: "heroic");

            migrationBuilder.DeleteData(
                table: "gear_tier_bonus",
                keyColumn: "tier",
                keyValue: "mortal");

            migrationBuilder.DeleteData(
                table: "gear_tier_bonus",
                keyColumn: "tier",
                keyValue: "mythic");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_heralds_draft");

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 10, "item" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 15, "gear" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 20, "item" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 25, "gear" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 30, "item" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 35, "gear" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 40, "item" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 45, "gear" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 50, "item" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 55, "gear" });

            migrationBuilder.DeleteData(
                table: "level_milestone",
                keyColumns: new[] { "level", "reward_kind" },
                keyValues: new object[] { 60, "item" });

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_basic_attack");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_champions_surge");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_iron_advance");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_pale_sentence");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_sages_verdict");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_shadowstep");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_thunderers_wrath");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_tidecallers_grasp");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_titans_reach");

            migrationBuilder.DeleteData(
                table: "player_skill_def",
                keyColumn: "id",
                keyValue: "skill_warlords_advance");

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 25);

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 40);

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 60);

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 90);

            migrationBuilder.DeleteData(
                table: "streak_milestone",
                keyColumn: "day",
                keyValue: 120);

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "sea", "sea" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "sea", "storm" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "sea", "trickery" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "sea", "underworld" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "sea", "war" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "sea", "wisdom" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "storm", "sea" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "storm", "storm" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "storm", "trickery" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "storm", "underworld" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "storm", "war" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "storm", "wisdom" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "trickery", "sea" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "trickery", "storm" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "trickery", "trickery" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "trickery", "underworld" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "trickery", "war" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "trickery", "wisdom" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "underworld", "sea" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "underworld", "storm" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "underworld", "trickery" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "underworld", "underworld" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "underworld", "war" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "underworld", "wisdom" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "war", "sea" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "war", "storm" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "war", "trickery" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "war", "underworld" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "war", "war" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "war", "wisdom" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "wisdom", "sea" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "wisdom", "storm" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "wisdom", "trickery" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "wisdom", "underworld" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "wisdom", "war" });

            migrationBuilder.DeleteData(
                table: "type_effectiveness",
                keyColumns: new[] { "attacker_type_id", "defender_type_id" },
                keyValues: new object[] { "wisdom", "wisdom" });

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 16);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 17);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 18);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 19);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 20);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 21);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 22);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 23);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 24);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 25);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 26);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 27);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 28);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 29);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 30);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 31);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 32);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 33);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 34);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 35);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 36);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 37);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 38);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 39);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 40);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 41);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 42);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 43);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 44);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 45);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 46);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 47);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 48);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 49);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 50);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 51);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 52);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 53);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 54);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 55);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 56);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 57);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 58);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 59);

            migrationBuilder.DeleteData(
                table: "xp_curve",
                keyColumn: "level",
                keyValue: 60);

            migrationBuilder.DeleteData(
                table: "zone_gate",
                keyColumn: "id",
                keyValue: "gate_cacus");

            migrationBuilder.DeleteData(
                table: "zone_gate",
                keyColumn: "id",
                keyValue: "gate_cerberus");

            migrationBuilder.DeleteData(
                table: "zone_gate",
                keyColumn: "id",
                keyValue: "gate_cyclops");

            migrationBuilder.DeleteData(
                table: "zone_gate",
                keyColumn: "id",
                keyValue: "gate_fenrir");

            migrationBuilder.DeleteData(
                table: "zone_gate",
                keyColumn: "id",
                keyValue: "gate_griffin");

            migrationBuilder.DeleteData(
                table: "zone_gate",
                keyColumn: "id",
                keyValue: "gate_jormungandr");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_cacus");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_cerberus");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_cyclops");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_draugr");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_fenrir");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_griffin");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_harpy");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_jormungandr");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_lemures");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_satyr");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_strix");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_valkyrie");

            migrationBuilder.DeleteData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_waystone_wisp");

            migrationBuilder.DeleteData(
                table: "gear_move",
                keyColumn: "id",
                keyValue: "move_coilbreakers_oath");

            migrationBuilder.DeleteData(
                table: "gear_move",
                keyColumn: "id",
                keyValue: "move_coilbreakers_wrath");

            migrationBuilder.DeleteData(
                table: "gear_move",
                keyColumn: "id",
                keyValue: "move_emberwise_verdict");

            migrationBuilder.DeleteData(
                table: "gear_move",
                keyColumn: "id",
                keyValue: "move_emberwise_ward");

            migrationBuilder.DeleteData(
                table: "gear_move",
                keyColumn: "id",
                keyValue: "move_gatekeepers_ruse");

            migrationBuilder.DeleteData(
                table: "gear_move",
                keyColumn: "id",
                keyValue: "move_gatekeepers_snare");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_ambrosia_shard");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_battlebrand");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_blindveil");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_brinestone");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_clearsight");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_fleet_omen");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_gravemark");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_ironhide_tincture");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_pale_ash");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_shadowbind");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_shadowblur");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_stormveil");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_sunder_oil");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_thundercrack");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_travelers_salve");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_undertow");

            migrationBuilder.DeleteData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_warhex");

            migrationBuilder.DeleteData(
                table: "zone",
                keyColumn: "id",
                keyValue: "egypt_tbd");

            migrationBuilder.DeleteData(
                table: "game_type",
                keyColumn: "id",
                keyValue: "sea");

            migrationBuilder.DeleteData(
                table: "game_type",
                keyColumn: "id",
                keyValue: "storm");

            migrationBuilder.DeleteData(
                table: "game_type",
                keyColumn: "id",
                keyValue: "trickery");

            migrationBuilder.DeleteData(
                table: "game_type",
                keyColumn: "id",
                keyValue: "underworld");

            migrationBuilder.DeleteData(
                table: "game_type",
                keyColumn: "id",
                keyValue: "war");

            migrationBuilder.DeleteData(
                table: "game_type",
                keyColumn: "id",
                keyValue: "wisdom");

            migrationBuilder.DeleteData(
                table: "zone",
                keyColumn: "id",
                keyValue: "imperion");

            migrationBuilder.DeleteData(
                table: "zone",
                keyColumn: "id",
                keyValue: "olympion");

            migrationBuilder.DeleteData(
                table: "zone",
                keyColumn: "id",
                keyValue: "valheon");
        }
    }
}
