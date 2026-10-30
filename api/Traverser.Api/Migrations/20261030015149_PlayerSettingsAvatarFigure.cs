using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class PlayerSettingsAvatarFigure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatar_figure",
                table: "player_settings",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "male");

            migrationBuilder.AddCheckConstraint(
                name: "ck_player_settings_avatar_figure",
                table: "player_settings",
                sql: "avatar_figure in ('male', 'female')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_player_settings_avatar_figure",
                table: "player_settings");

            migrationBuilder.DropColumn(
                name: "avatar_figure",
                table: "player_settings");
        }
    }
}
