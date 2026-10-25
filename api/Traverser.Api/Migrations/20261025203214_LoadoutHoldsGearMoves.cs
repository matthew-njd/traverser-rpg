using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class LoadoutHoldsGearMoves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_player_equipped_skill_player_skill_def_skill_id",
                table: "player_equipped_skill");

            migrationBuilder.DropIndex(
                name: "ix_player_equipped_skill_skill_id",
                table: "player_equipped_skill");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_player_equipped_skill_skill_id",
                table: "player_equipped_skill",
                column: "skill_id");

            migrationBuilder.AddForeignKey(
                name: "fk_player_equipped_skill_player_skill_def_skill_id",
                table: "player_equipped_skill",
                column: "skill_id",
                principalTable: "player_skill_def",
                principalColumn: "id");
        }
    }
}
