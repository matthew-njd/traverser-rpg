using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "content_version",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    version = table.Column<int>(type: "integer", nullable: false),
                    generated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_content_version", x => x.id);
                    table.CheckConstraint("ck_content_version_singleton", "id = 1");
                });

            migrationBuilder.CreateTable(
                name: "drop_rate",
                columns: table => new
                {
                    encounter_kind = table.Column<string>(type: "text", nullable: false),
                    reward_kind = table.Column<string>(type: "text", nullable: false),
                    chance = table.Column<decimal>(type: "numeric(4,3)", precision: 4, scale: 3, nullable: false),
                    qty_min = table.Column<int>(type: "integer", nullable: false),
                    qty_max = table.Column<int>(type: "integer", nullable: false),
                    tier = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drop_rate", x => new { x.encounter_kind, x.reward_kind });
                    table.CheckConstraint("ck_drop_rate_encounter_kind", "encounter_kind in ('wild', 'mini_boss', 'zone_boss_first', 'zone_boss_repeat', 'daily_goal')");
                    table.CheckConstraint("ck_drop_rate_reward_kind", "reward_kind in ('item', 'gear', 'trinket')");
                });

            migrationBuilder.CreateTable(
                name: "game_type",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    cycle_ordinal = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_game_type", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "gear_tier_bonus",
                columns: table => new
                {
                    tier = table.Column<string>(type: "text", nullable: false),
                    rate = table.Column<decimal>(type: "numeric(4,3)", precision: 4, scale: 3, nullable: false),
                    flat = table.Column<int>(type: "integer", nullable: false),
                    trinket_split = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gear_tier_bonus", x => x.tier);
                    table.CheckConstraint("ck_gear_tier_bonus_tier", "tier in ('mortal', 'heroic', 'mythic', 'divine')");
                });

            migrationBuilder.CreateTable(
                name: "player",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    traverser_name = table.Column<string>(type: "text", nullable: false),
                    timezone = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    level = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    xp_current = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    xp_lifetime = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    unspent_stat_points = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    alloc_vigor = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    alloc_might = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    alloc_resolve = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    alloc_favor = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    alloc_aegis = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    alloc_stride = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    vigor_current = table.Column<int>(type: "integer", nullable: false),
                    vigor_anchor_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    lifetime_steps = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    daily_step_goal = table.Column<int>(type: "integer", nullable: false, defaultValue: 7000),
                    tutorial_completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player", x => x.id);
                    table.CheckConstraint("ck_player_daily_step_goal", "daily_step_goal >= 3000");
                    table.CheckConstraint("ck_player_level", "level between 1 and 60");
                });

            migrationBuilder.CreateTable(
                name: "streak_milestone",
                columns: table => new
                {
                    day = table.Column<int>(type: "integer", nullable: false),
                    slot = table.Column<string>(type: "text", nullable: false),
                    tier = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_streak_milestone", x => x.day);
                    table.CheckConstraint("ck_streak_milestone_slot", "slot in ('weapon', 'armor', 'accessory')");
                    table.CheckConstraint("ck_streak_milestone_tier", "tier in ('mortal', 'heroic', 'mythic')");
                });

            migrationBuilder.CreateTable(
                name: "xp_curve",
                columns: table => new
                {
                    level = table.Column<int>(type: "integer", nullable: false),
                    xp_to_next = table.Column<int>(type: "integer", nullable: true),
                    cumulative = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_xp_curve", x => x.level);
                    table.CheckConstraint("ck_xp_curve_level", "level between 1 and 60");
                });

            migrationBuilder.CreateTable(
                name: "zone",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    ordinal = table.Column<int>(type: "integer", nullable: false),
                    is_released = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_zone", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "gear_move",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    type_id = table.Column<string>(type: "text", nullable: false),
                    power = table.Column<int>(type: "integer", nullable: false),
                    uses = table.Column<int>(type: "integer", nullable: false),
                    effect = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gear_move", x => x.id);
                    table.CheckConstraint("ck_gear_move_effect", "effect in ('weaken', 'fortify', 'swift', 'rend')");
                    table.ForeignKey(
                        name: "fk_gear_move_game_type_type_id",
                        column: x => x.type_id,
                        principalTable: "game_type",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "item_def",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "text", nullable: false),
                    rarity = table.Column<string>(type: "text", nullable: false),
                    type_id = table.Column<string>(type: "text", nullable: true),
                    heal_pct = table.Column<int>(type: "integer", nullable: true),
                    effect = table.Column<string>(type: "text", nullable: true),
                    max_stack = table.Column<int>(type: "integer", nullable: false),
                    battle_only = table.Column<bool>(type: "boolean", nullable: false),
                    flavor = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_item_def", x => x.id);
                    table.CheckConstraint("ck_item_def_category", "category in ('heal', 'buff', 'surge', 'breach')");
                    table.CheckConstraint("ck_item_def_effect", "effect in ('weaken', 'fortify', 'swift', 'rend')");
                    table.CheckConstraint("ck_item_def_rarity", "rarity in ('common', 'uncommon', 'rare')");
                    table.ForeignKey(
                        name: "fk_item_def_game_type_type_id",
                        column: x => x.type_id,
                        principalTable: "game_type",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "player_skill_def",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "text", nullable: false),
                    type_id = table.Column<string>(type: "text", nullable: true),
                    power = table.Column<int>(type: "integer", nullable: false),
                    uses = table.Column<int>(type: "integer", nullable: true),
                    unlock_level = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_skill_def", x => x.id);
                    table.CheckConstraint("ck_player_skill_def_category", "category in ('physical', 'divine')");
                    table.ForeignKey(
                        name: "fk_player_skill_def_game_type_type_id",
                        column: x => x.type_id,
                        principalTable: "game_type",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "type_effectiveness",
                columns: table => new
                {
                    attacker_type_id = table.Column<string>(type: "text", nullable: false),
                    defender_type_id = table.Column<string>(type: "text", nullable: false),
                    multiplier = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_type_effectiveness", x => new { x.attacker_type_id, x.defender_type_id });
                    table.ForeignKey(
                        name: "fk_type_effectiveness_game_types_attacker_type_id",
                        column: x => x.attacker_type_id,
                        principalTable: "game_type",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_type_effectiveness_game_types_defender_type_id",
                        column: x => x.defender_type_id,
                        principalTable: "game_type",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "activity_day",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    activity_date = table.Column<DateOnly>(type: "date", nullable: false),
                    steps = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    tier1_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    tier2_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    tier3_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    xp_awarded = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    step_goal_snapshot = table.Column<int>(type: "integer", nullable: false),
                    goal_met = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    streak_credit_method = table.Column<string>(type: "text", nullable: true),
                    rest_tagged_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    encounters_used = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    daily_item_claimed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    daily_gear_rolled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_day", x => new { x.player_id, x.activity_date });
                    table.CheckConstraint("ck_activity_day_encounters_used", "encounters_used <= 5");
                    table.CheckConstraint("ck_activity_day_streak_credit_method", "streak_credit_method in ('goal_hit', 'rest_day_tag', 'auto_sync_grace')");
                    table.ForeignKey(
                        name: "fk_activity_day_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "hr_session",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    external_session_id = table.Column<string>(type: "text", nullable: true),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ended_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    tier1_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    tier2_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    tier3_minutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    overactivity_warned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    encounter_rolls_granted = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hr_session", x => x.id);
                    table.CheckConstraint("ck_hr_session_encounter_rolls_granted", "encounter_rolls_granted <= 2");
                    table.ForeignKey(
                        name: "fk_hr_session_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "milestone_grant",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    milestone_kind = table.Column<string>(type: "text", nullable: false),
                    milestone_key = table.Column<string>(type: "text", nullable: false),
                    granted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    overflow_fallback = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_milestone_grant", x => new { x.player_id, x.milestone_kind, x.milestone_key });
                    table.CheckConstraint("ck_milestone_grant_milestone_kind", "milestone_kind in ('level_item', 'level_gear', 'streak_day', 'zone_entry', 'tutorial')");
                    table.ForeignKey(
                        name: "fk_milestone_grant_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "player_settings",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    daily_reminder_time = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    music_volume = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false, defaultValue: 1.0m),
                    sfx_volume = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: false, defaultValue: 1.0m)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_settings", x => x.player_id);
                    table.ForeignKey(
                        name: "fk_player_settings_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "streak_state",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_streak = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    longest_streak = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    last_credited_date = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_streak_state", x => x.player_id);
                    table.ForeignKey(
                        name: "fk_streak_state_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sync_delta",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_delta_id = table.Column<Guid>(type: "uuid", nullable: false),
                    activity_date = table.Column<DateOnly>(type: "date", nullable: false),
                    source = table.Column<string>(type: "text", nullable: false),
                    steps_delta = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    minutes_delta = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    hr_tier = table.Column<int>(type: "integer", nullable: true),
                    xp_delta = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    recorded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    applied_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sync_delta", x => x.id);
                    table.CheckConstraint("ck_sync_delta_hr_tier", "hr_tier between 1 and 3");
                    table.CheckConstraint("ck_sync_delta_source", "source in ('steps', 'hr', 'battle', 'manual')");
                    table.ForeignKey(
                        name: "fk_sync_delta_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "enemy",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    zone_id = table.Column<string>(type: "text", nullable: true),
                    type_id = table.Column<string>(type: "text", nullable: true),
                    role = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_enemy", x => x.id);
                    table.CheckConstraint("ck_enemy_role", "role in ('wild', 'mid_boss', 'zone_boss', 'tutorial')");
                    table.ForeignKey(
                        name: "fk_enemy_game_type_type_id",
                        column: x => x.type_id,
                        principalTable: "game_type",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_enemy_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "player_zone_progress",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<string>(type: "text", nullable: false),
                    unlocked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_zone_progress", x => new { x.player_id, x.zone_id });
                    table.ForeignKey(
                        name: "fk_player_zone_progress_players_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_player_zone_progress_zones_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "gear_def",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    slot = table.Column<string>(type: "text", nullable: false),
                    tier = table.Column<string>(type: "text", nullable: false),
                    zone_id = table.Column<string>(type: "text", nullable: true),
                    grants_move_id = table.Column<string>(type: "text", nullable: true),
                    flavor = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gear_def", x => x.id);
                    table.CheckConstraint("ck_gear_def_slot", "slot in ('weapon', 'armor', 'accessory', 'trinket')");
                    table.CheckConstraint("ck_gear_def_tier", "tier in ('mortal', 'heroic', 'mythic', 'divine')");
                    table.ForeignKey(
                        name: "fk_gear_def_gear_move_grants_move_id",
                        column: x => x.grants_move_id,
                        principalTable: "gear_move",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_gear_def_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "level_milestone",
                columns: table => new
                {
                    level = table.Column<int>(type: "integer", nullable: false),
                    reward_kind = table.Column<string>(type: "text", nullable: false),
                    item_def_id = table.Column<string>(type: "text", nullable: true),
                    gear_tier = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_level_milestone", x => new { x.level, x.reward_kind });
                    table.CheckConstraint("ck_level_milestone_reward_kind", "reward_kind in ('item', 'gear')");
                    table.ForeignKey(
                        name: "fk_level_milestone_item_def_item_def_id",
                        column: x => x.item_def_id,
                        principalTable: "item_def",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "player_item",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_def_id = table.Column<string>(type: "text", nullable: false),
                    acquired_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    source = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_item", x => x.id);
                    table.CheckConstraint("ck_player_item_source", "source in ('wild_drop', 'miniboss_drop', 'boss_drop', 'daily_goal', 'level_milestone', 'streak_overflow', 'zone_entry', 'tutorial')");
                    table.ForeignKey(
                        name: "fk_player_item_item_def_item_def_id",
                        column: x => x.item_def_id,
                        principalTable: "item_def",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_player_item_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "player_equipped_skill",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slot = table.Column<int>(type: "integer", nullable: false),
                    skill_id = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_equipped_skill", x => new { x.player_id, x.slot });
                    table.CheckConstraint("ck_player_equipped_skill_slot", "slot between 1 and 4");
                    table.ForeignKey(
                        name: "fk_player_equipped_skill_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_player_equipped_skill_player_skill_def_skill_id",
                        column: x => x.skill_id,
                        principalTable: "player_skill_def",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "battle",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_battle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    enemy_id = table.Column<string>(type: "text", nullable: false),
                    encounter_kind = table.Column<string>(type: "text", nullable: false),
                    enemy_level = table.Column<int>(type: "integer", nullable: false),
                    outcome = table.Column<string>(type: "text", nullable: false),
                    xp_awarded = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ended_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_battle", x => x.id);
                    table.CheckConstraint("ck_battle_encounter_kind", "encounter_kind in ('wild', 'mini_boss', 'zone_boss', 'tutorial', 'explore')");
                    table.CheckConstraint("ck_battle_outcome", "outcome in ('win', 'loss', 'flee')");
                    table.ForeignKey(
                        name: "fk_battle_enemy_enemy_id",
                        column: x => x.enemy_id,
                        principalTable: "enemy",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_battle_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "enemy_drop_pool",
                columns: table => new
                {
                    enemy_id = table.Column<string>(type: "text", nullable: false),
                    encounter_kind = table.Column<string>(type: "text", nullable: false),
                    item_def_id = table.Column<string>(type: "text", nullable: false),
                    weight = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_enemy_drop_pool", x => new { x.enemy_id, x.encounter_kind, x.item_def_id });
                    table.ForeignKey(
                        name: "fk_enemy_drop_pool_enemy_enemy_id",
                        column: x => x.enemy_id,
                        principalTable: "enemy",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_enemy_drop_pool_item_def_item_def_id",
                        column: x => x.item_def_id,
                        principalTable: "item_def",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "enemy_move",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    enemy_id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "text", nullable: false),
                    type_id = table.Column<string>(type: "text", nullable: true),
                    power = table.Column<int>(type: "integer", nullable: false),
                    ai_weight = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_enemy_move", x => x.id);
                    table.CheckConstraint("ck_enemy_move_ai_weight", "ai_weight between 0 and 100");
                    table.CheckConstraint("ck_enemy_move_category", "category in ('physical', 'divine')");
                    table.ForeignKey(
                        name: "fk_enemy_move_enemy_enemy_id",
                        column: x => x.enemy_id,
                        principalTable: "enemy",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_enemy_move_game_type_type_id",
                        column: x => x.type_id,
                        principalTable: "game_type",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "enemy_stat_scaling",
                columns: table => new
                {
                    enemy_id = table.Column<string>(type: "text", nullable: false),
                    stat = table.Column<string>(type: "text", nullable: false),
                    @base = table.Column<decimal>(name: "base", type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    rate = table.Column<decimal>(type: "numeric(6,3)", precision: 6, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_enemy_stat_scaling", x => new { x.enemy_id, x.stat });
                    table.CheckConstraint("ck_enemy_stat_scaling_stat", "stat in ('vigor', 'might', 'resolve', 'favor', 'aegis', 'stride')");
                    table.ForeignKey(
                        name: "fk_enemy_stat_scaling_enemies_enemy_id",
                        column: x => x.enemy_id,
                        principalTable: "enemy",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "player_bestiary",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    enemy_id = table.Column<string>(type: "text", nullable: false),
                    first_seen_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    encounter_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    defeat_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_bestiary", x => new { x.player_id, x.enemy_id });
                    table.ForeignKey(
                        name: "fk_player_bestiary_enemies_enemy_id",
                        column: x => x.enemy_id,
                        principalTable: "enemy",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_player_bestiary_players_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "zone_gate",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    zone_id = table.Column<string>(type: "text", nullable: false),
                    enemy_id = table.Column<string>(type: "text", nullable: false),
                    gate_kind = table.Column<string>(type: "text", nullable: false),
                    league_threshold = table.Column<int>(type: "integer", nullable: false),
                    unlocks_zone_id = table.Column<string>(type: "text", nullable: true),
                    is_hard_gate = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_zone_gate", x => x.id);
                    table.CheckConstraint("ck_zone_gate_gate_kind", "gate_kind in ('mid_boss', 'final_boss')");
                    table.ForeignKey(
                        name: "fk_zone_gate_enemy_enemy_id",
                        column: x => x.enemy_id,
                        principalTable: "enemy",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_zone_gate_zone_unlocks_zone_id",
                        column: x => x.unlocks_zone_id,
                        principalTable: "zone",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_zone_gate_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "pending_reward",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    item_def_id = table.Column<string>(type: "text", nullable: true),
                    gear_def_id = table.Column<string>(type: "text", nullable: true),
                    level_at_drop = table.Column<int>(type: "integer", nullable: true),
                    bonus_primary = table.Column<int>(type: "integer", nullable: true),
                    bonus_secondary = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    resolved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    resolution = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pending_reward", x => x.id);
                    table.CheckConstraint("ck_pending_reward_kind", "kind in ('item', 'gear')");
                    table.CheckConstraint("ck_pending_reward_resolution", "resolution in ('kept', 'discarded')");
                    table.ForeignKey(
                        name: "fk_pending_reward_gear_def_gear_def_id",
                        column: x => x.gear_def_id,
                        principalTable: "gear_def",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_pending_reward_item_def_item_def_id",
                        column: x => x.item_def_id,
                        principalTable: "item_def",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_pending_reward_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "player_gear",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gear_def_id = table.Column<string>(type: "text", nullable: false),
                    level_at_drop = table.Column<int>(type: "integer", nullable: false),
                    bonus_primary = table.Column<int>(type: "integer", nullable: false),
                    bonus_secondary = table.Column<int>(type: "integer", nullable: true),
                    equipped_slot = table.Column<string>(type: "text", nullable: true),
                    acquired_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    source = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_gear", x => x.id);
                    table.CheckConstraint("ck_player_gear_equipped_slot", "equipped_slot in ('weapon', 'armor', 'accessory', 'trinket')");
                    table.ForeignKey(
                        name: "fk_player_gear_gear_defs_gear_def_id",
                        column: x => x.gear_def_id,
                        principalTable: "gear_def",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_player_gear_players_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_battle_enemy_id",
                table: "battle",
                column: "enemy_id");

            migrationBuilder.CreateIndex(
                name: "ix_battle_player_id_client_battle_id",
                table: "battle",
                columns: new[] { "player_id", "client_battle_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_enemy_type_id",
                table: "enemy",
                column: "type_id");

            migrationBuilder.CreateIndex(
                name: "ix_enemy_zone_id",
                table: "enemy",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "ix_enemy_drop_pool_item_def_id",
                table: "enemy_drop_pool",
                column: "item_def_id");

            migrationBuilder.CreateIndex(
                name: "ix_enemy_move_enemy_id",
                table: "enemy_move",
                column: "enemy_id");

            migrationBuilder.CreateIndex(
                name: "ix_enemy_move_type_id",
                table: "enemy_move",
                column: "type_id");

            migrationBuilder.CreateIndex(
                name: "ix_game_type_cycle_ordinal",
                table: "game_type",
                column: "cycle_ordinal",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_gear_def_grants_move_id",
                table: "gear_def",
                column: "grants_move_id");

            migrationBuilder.CreateIndex(
                name: "ix_gear_def_zone_id",
                table: "gear_def",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "ix_gear_move_type_id",
                table: "gear_move",
                column: "type_id");

            migrationBuilder.CreateIndex(
                name: "ix_hr_session_player_id_external_session_id",
                table: "hr_session",
                columns: new[] { "player_id", "external_session_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_item_def_type_id",
                table: "item_def",
                column: "type_id");

            migrationBuilder.CreateIndex(
                name: "ix_level_milestone_item_def_id",
                table: "level_milestone",
                column: "item_def_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_reward_gear_def_id",
                table: "pending_reward",
                column: "gear_def_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_reward_item_def_id",
                table: "pending_reward",
                column: "item_def_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_reward_player_id",
                table: "pending_reward",
                column: "player_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_bestiary_enemy_id",
                table: "player_bestiary",
                column: "enemy_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_equipped_skill_player_id_skill_id",
                table: "player_equipped_skill",
                columns: new[] { "player_id", "skill_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_player_equipped_skill_skill_id",
                table: "player_equipped_skill",
                column: "skill_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_gear_gear_def_id",
                table: "player_gear",
                column: "gear_def_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_gear_player_id_equipped_slot",
                table: "player_gear",
                columns: new[] { "player_id", "equipped_slot" },
                unique: true,
                filter: "equipped_slot is not null");

            migrationBuilder.CreateIndex(
                name: "ix_player_item_item_def_id",
                table: "player_item",
                column: "item_def_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_item_player_id_item_def_id",
                table: "player_item",
                columns: new[] { "player_id", "item_def_id" });

            migrationBuilder.CreateIndex(
                name: "ix_player_skill_def_type_id",
                table: "player_skill_def",
                column: "type_id");

            migrationBuilder.CreateIndex(
                name: "ix_player_zone_progress_zone_id",
                table: "player_zone_progress",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "ix_sync_delta_player_id_activity_date",
                table: "sync_delta",
                columns: new[] { "player_id", "activity_date" });

            migrationBuilder.CreateIndex(
                name: "ix_sync_delta_player_id_client_delta_id",
                table: "sync_delta",
                columns: new[] { "player_id", "client_delta_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_type_effectiveness_defender_type_id",
                table: "type_effectiveness",
                column: "defender_type_id");

            migrationBuilder.CreateIndex(
                name: "ix_zone_ordinal",
                table: "zone",
                column: "ordinal",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_zone_gate_enemy_id",
                table: "zone_gate",
                column: "enemy_id");

            migrationBuilder.CreateIndex(
                name: "ix_zone_gate_unlocks_zone_id",
                table: "zone_gate",
                column: "unlocks_zone_id");

            migrationBuilder.CreateIndex(
                name: "ix_zone_gate_zone_id",
                table: "zone_gate",
                column: "zone_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activity_day");

            migrationBuilder.DropTable(
                name: "battle");

            migrationBuilder.DropTable(
                name: "content_version");

            migrationBuilder.DropTable(
                name: "drop_rate");

            migrationBuilder.DropTable(
                name: "enemy_drop_pool");

            migrationBuilder.DropTable(
                name: "enemy_move");

            migrationBuilder.DropTable(
                name: "enemy_stat_scaling");

            migrationBuilder.DropTable(
                name: "gear_tier_bonus");

            migrationBuilder.DropTable(
                name: "hr_session");

            migrationBuilder.DropTable(
                name: "level_milestone");

            migrationBuilder.DropTable(
                name: "milestone_grant");

            migrationBuilder.DropTable(
                name: "pending_reward");

            migrationBuilder.DropTable(
                name: "player_bestiary");

            migrationBuilder.DropTable(
                name: "player_equipped_skill");

            migrationBuilder.DropTable(
                name: "player_gear");

            migrationBuilder.DropTable(
                name: "player_item");

            migrationBuilder.DropTable(
                name: "player_settings");

            migrationBuilder.DropTable(
                name: "player_zone_progress");

            migrationBuilder.DropTable(
                name: "streak_milestone");

            migrationBuilder.DropTable(
                name: "streak_state");

            migrationBuilder.DropTable(
                name: "sync_delta");

            migrationBuilder.DropTable(
                name: "type_effectiveness");

            migrationBuilder.DropTable(
                name: "xp_curve");

            migrationBuilder.DropTable(
                name: "zone_gate");

            migrationBuilder.DropTable(
                name: "player_skill_def");

            migrationBuilder.DropTable(
                name: "gear_def");

            migrationBuilder.DropTable(
                name: "item_def");

            migrationBuilder.DropTable(
                name: "player");

            migrationBuilder.DropTable(
                name: "enemy");

            migrationBuilder.DropTable(
                name: "gear_move");

            migrationBuilder.DropTable(
                name: "zone");

            migrationBuilder.DropTable(
                name: "game_type");
        }
    }
}
