using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class ContentValidationConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_enemy_move_ai_weight",
                table: "enemy_move");

            migrationBuilder.AddCheckConstraint(
                name: "ck_gear_def_grants_move_trinket_only",
                table: "gear_def",
                sql: "grants_move_id is null or slot in ('trinket')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_enemy_move_ai_weight",
                table: "enemy_move",
                sql: "ai_weight between 1 and 100");

            migrationBuilder.AddCheckConstraint(
                name: "ck_enemy_drop_pool_weight",
                table: "enemy_drop_pool",
                sql: "weight > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_drop_rate_chance",
                table: "drop_rate",
                sql: "chance > 0 and chance <= 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_gear_def_grants_move_trinket_only",
                table: "gear_def");

            migrationBuilder.DropCheckConstraint(
                name: "ck_enemy_move_ai_weight",
                table: "enemy_move");

            migrationBuilder.DropCheckConstraint(
                name: "ck_enemy_drop_pool_weight",
                table: "enemy_drop_pool");

            migrationBuilder.DropCheckConstraint(
                name: "ck_drop_rate_chance",
                table: "drop_rate");

            migrationBuilder.AddCheckConstraint(
                name: "ck_enemy_move_ai_weight",
                table: "enemy_move",
                sql: "ai_weight between 0 and 100");
        }
    }
}
