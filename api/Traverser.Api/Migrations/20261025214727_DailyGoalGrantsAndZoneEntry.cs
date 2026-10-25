using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class DailyGoalGrantsAndZoneEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_milestone_grant_milestone_kind",
                table: "milestone_grant");

            migrationBuilder.CreateTable(
                name: "zone_entry_reward",
                columns: table => new
                {
                    zone_id = table.Column<string>(type: "text", nullable: false),
                    item_def_id = table.Column<string>(type: "text", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_zone_entry_reward", x => new { x.zone_id, x.item_def_id });
                    table.CheckConstraint("ck_zone_entry_reward_quantity", "quantity >= 1");
                    table.ForeignKey(
                        name: "fk_zone_entry_reward_item_def_item_def_id",
                        column: x => x.item_def_id,
                        principalTable: "item_def",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_zone_entry_reward_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "id");
                });

            migrationBuilder.InsertData(
                table: "zone_entry_reward",
                columns: new[] { "item_def_id", "zone_id", "quantity" },
                values: new object[,]
                {
                    { "item_blindveil", "imperion", 1 },
                    { "item_heralds_draft", "imperion", 1 },
                    { "item_undertow", "imperion", 1 },
                    { "item_heralds_draft", "valheon", 1 },
                    { "item_shadowbind", "valheon", 1 },
                    { "item_thundercrack", "valheon", 1 }
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_milestone_grant_milestone_kind",
                table: "milestone_grant",
                sql: "milestone_kind in ('level_item', 'level_gear', 'streak_day', 'zone_entry', 'tutorial', 'daily_goal')");

            migrationBuilder.CreateIndex(
                name: "ix_zone_entry_reward_item_def_id",
                table: "zone_entry_reward",
                column: "item_def_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "zone_entry_reward");

            migrationBuilder.DropCheckConstraint(
                name: "ck_milestone_grant_milestone_kind",
                table: "milestone_grant");

            migrationBuilder.AddCheckConstraint(
                name: "ck_milestone_grant_milestone_kind",
                table: "milestone_grant",
                sql: "milestone_kind in ('level_item', 'level_gear', 'streak_day', 'zone_entry', 'tutorial')");
        }
    }
}
