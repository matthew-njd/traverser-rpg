using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class T1AmendmentTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "birth_year",
                table: "player_settings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "grant_id",
                table: "battle",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "auth_token",
                columns: table => new
                {
                    token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    last_used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_auth_token", x => x.token_hash);
                    table.ForeignKey(
                        name: "fk_auth_token_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_operation",
                columns: table => new
                {
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    endpoint = table.Column<string>(type: "text", nullable: false),
                    applied_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_client_operation", x => new { x.player_id, x.operation_id });
                    table.ForeignKey(
                        name: "fk_client_operation_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "encounter_grant",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    player_id = table.Column<Guid>(type: "uuid", nullable: false),
                    zone_id = table.Column<string>(type: "text", nullable: false),
                    enemy_id = table.Column<string>(type: "text", nullable: false),
                    source = table.Column<string>(type: "text", nullable: false),
                    activity_date = table.Column<DateOnly>(type: "date", nullable: false),
                    issued_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_encounter_grant", x => x.id);
                    table.CheckConstraint("ck_encounter_grant_source", "source in ('travel', 'workout', 'explore')");
                    table.ForeignKey(
                        name: "fk_encounter_grant_activity_day_player_id_activity_date",
                        columns: x => new { x.player_id, x.activity_date },
                        principalTable: "activity_day",
                        principalColumns: new[] { "player_id", "activity_date" });
                    table.ForeignKey(
                        name: "fk_encounter_grant_enemy_enemy_id",
                        column: x => x.enemy_id,
                        principalTable: "enemy",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_encounter_grant_player_player_id",
                        column: x => x.player_id,
                        principalTable: "player",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_encounter_grant_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "id");
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_player_settings_birth_year",
                table: "player_settings",
                sql: "birth_year between 1900 and 2100");

            migrationBuilder.CreateIndex(
                name: "ix_battle_grant_id",
                table: "battle",
                column: "grant_id",
                unique: true,
                filter: "grant_id is not null");

            migrationBuilder.CreateIndex(
                name: "ix_auth_token_player_id",
                table: "auth_token",
                column: "player_id");

            migrationBuilder.CreateIndex(
                name: "ix_encounter_grant_enemy_id",
                table: "encounter_grant",
                column: "enemy_id");

            migrationBuilder.CreateIndex(
                name: "ix_encounter_grant_player_id_activity_date",
                table: "encounter_grant",
                columns: new[] { "player_id", "activity_date" });

            migrationBuilder.CreateIndex(
                name: "ix_encounter_grant_zone_id",
                table: "encounter_grant",
                column: "zone_id");

            migrationBuilder.AddForeignKey(
                name: "fk_battle_encounter_grant_grant_id",
                table: "battle",
                column: "grant_id",
                principalTable: "encounter_grant",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_battle_encounter_grant_grant_id",
                table: "battle");

            migrationBuilder.DropTable(
                name: "auth_token");

            migrationBuilder.DropTable(
                name: "client_operation");

            migrationBuilder.DropTable(
                name: "encounter_grant");

            migrationBuilder.DropCheckConstraint(
                name: "ck_player_settings_birth_year",
                table: "player_settings");

            migrationBuilder.DropIndex(
                name: "ix_battle_grant_id",
                table: "battle");

            migrationBuilder.DropColumn(
                name: "birth_year",
                table: "player_settings");

            migrationBuilder.DropColumn(
                name: "grant_id",
                table: "battle");
        }
    }
}
