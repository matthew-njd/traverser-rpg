using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class BalanceTrims : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 10, 26, 0, 0, 0, 0, DateTimeKind.Utc), 6 });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "favor" },
                column: "rate",
                value: 0.3m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "vigor" },
                column: "rate",
                value: 1.0m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "resolve" },
                column: "rate",
                value: 0.65m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "vigor" },
                column: "rate",
                value: 0.5m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Utc), 5 });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "favor" },
                column: "rate",
                value: 0.35m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "vigor" },
                column: "rate",
                value: 1.1m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "resolve" },
                column: "rate",
                value: 0.7m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "vigor" },
                column: "rate",
                value: 0.55m);
        }
    }
}
