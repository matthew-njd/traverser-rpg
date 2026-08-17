using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnemyOrdinals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ordinal",
                table: "enemy_move",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ordinal",
                table: "enemy_drop_pool",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 8, 17, 0, 0, 0, 0, DateTimeKind.Utc), 2 });

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cacus", "item_ambrosia_shard" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cacus", "item_stormveil" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cacus", "item_thundercrack" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_blindveil" },
                column: "ordinal",
                value: 3);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_stormveil" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_thundercrack" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cacus", "item_travelers_salve" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cerberus", "item_fleet_omen" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cerberus", "item_gravemark" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_cerberus", "item_pale_ash" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_gravemark" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_pale_ash" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_shadowblur" },
                column: "ordinal",
                value: 4);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_travelers_salve" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_cerberus", "item_warhex" },
                column: "ordinal",
                value: 3);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_battlebrand" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_ironhide_tincture" },
                column: "ordinal",
                value: 3);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_stormveil" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_cyclops", "item_warhex" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_draugr", "item_pale_ash" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_draugr", "item_travelers_salve" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_battlebrand" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_ironhide_tincture" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_stormveil" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_fenrir", "item_warhex" },
                column: "ordinal",
                value: 3);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_griffin", "item_clearsight" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_griffin", "item_ironhide_tincture" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "mini_boss", "enemy_griffin", "item_undertow" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_harpy", "item_stormveil" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_harpy", "item_travelers_salve" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_jormungandr", "item_ambrosia_shard" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_jormungandr", "item_brinestone" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_first", "enemy_jormungandr", "item_shadowbind" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_brinestone" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_shadowbind" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_travelers_salve" },
                column: "ordinal",
                value: 3);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "zone_boss_repeat", "enemy_jormungandr", "item_undertow" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_lemures", "item_pale_ash" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_lemures", "item_travelers_salve" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_satyr", "item_battlebrand" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_satyr", "item_shadowblur" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_satyr", "item_travelers_salve" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_strix", "item_battlebrand" },
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_strix", "item_shadowblur" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_strix", "item_travelers_salve" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_valkyrie", "item_stormveil" },
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_drop_pool",
                keyColumns: new[] { "encounter_kind", "enemy_id", "item_def_id" },
                keyValues: new object[] { "wild", "enemy_valkyrie", "item_travelers_salve" },
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_ashen_gale",
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_boulder_hurl",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_buffet",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_chilling_gust",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_cinder_grip",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_crushing_coil",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_death_breath",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_grave_knell",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_grave_swing",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_gust_strike",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_nightcut",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_quick_jab",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_restless_grasp",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_savage_bite_cerberus",
                column: "ordinal",
                value: 2);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_savage_bite_fenrir",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_shadow_lunge",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_shield_bash",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_soul_drain",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_storm_lance",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_talon_rake",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_three_fanged_strike",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_thunderous_roar",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_venom_tide",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_vigilant_gaze",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_war_howl",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_war_shout",
                column: "ordinal",
                value: 1);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_wing_buffet",
                column: "ordinal",
                value: 0);

            migrationBuilder.UpdateData(
                table: "enemy_move",
                keyColumn: "id",
                keyValue: "emove_world_tremor",
                column: "ordinal",
                value: 2);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ordinal",
                table: "enemy_move");

            migrationBuilder.DropColumn(
                name: "ordinal",
                table: "enemy_drop_pool");

            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 7, 31, 0, 0, 0, 0, DateTimeKind.Utc), 1 });
        }
    }
}
