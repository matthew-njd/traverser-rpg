using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class M3BalancePass : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 8, 29, 0, 0, 0, 0, DateTimeKind.Utc), 3 });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 12m, 0.45m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 10m, 0.45m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 54m, 1.1m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "favor" },
                column: "rate",
                value: 0.35m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 8m, 0.35m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 46m, 1.05m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "favor" },
                column: "rate",
                value: 0.35m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 9m, 0.35m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "resolve" },
                column: "rate",
                value: 0.5m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 36m, 0.9m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "favor" },
                column: "rate",
                value: 0.35m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 7m, 0.25m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 24m, 0.5m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "favor" },
                column: "rate",
                value: 0.4m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "might" },
                column: "rate",
                value: 0.45m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 48m, 1.1m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 10m, 0.4m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 9m, 0.4m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "resolve" },
                column: "rate",
                value: 0.55m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 42m, 0.85m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "favor" },
                column: "rate",
                value: 0.45m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 22m, 0.8m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "favor" },
                column: "rate",
                value: 0.5m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "might" },
                column: "rate",
                value: 0.4m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 55m, 1.3m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 5m, 0.35m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 7m, 0.25m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 24m, 0.5m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 6m, 0.4m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "might" },
                column: "rate",
                value: 0.35m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 20m, 0.65m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "favor" },
                column: "rate",
                value: 0.45m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "might" },
                column: "rate",
                value: 0.35m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 26m, 0.65m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "favor" },
                column: "rate",
                value: 0.5m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 22m, 0.55m });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 8, 17, 0, 0, 0, 0, DateTimeKind.Utc), 2 });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 13m, 0.95m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 11m, 0.9m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cacus", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 22m, 2.2m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "favor" },
                column: "rate",
                value: 0.75m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 9m, 0.75m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cerberus", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 20m, 5.5m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "favor" },
                column: "rate",
                value: 0.5m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 10m, 1.0m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "resolve" },
                column: "rate",
                value: 0.75m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_cyclops", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 15m, 4.5m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "favor" },
                column: "rate",
                value: 0.5m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 8m, 0.75m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_draugr", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 8m, 2.5m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "favor" },
                column: "rate",
                value: 0.6m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "might" },
                column: "rate",
                value: 0.8m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_fenrir", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 22m, 4.0m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 11m, 0.75m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 10m, 0.85m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "resolve" },
                column: "rate",
                value: 0.7m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_griffin", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 20m, 2.5m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "favor" },
                column: "rate",
                value: 0.75m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_harpy", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 8m, 3.0m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "favor" },
                column: "rate",
                value: 0.8m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "might" },
                column: "rate",
                value: 0.6m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_jormungandr", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 18m, 4.0m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 6m, 0.6m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "might" },
                columns: new[] { "base", "rate" },
                values: new object[] { 9m, 0.85m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_lemures", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 10m, 2.7m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "favor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 7m, 0.75m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "might" },
                column: "rate",
                value: 0.5m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_satyr", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 8m, 2.5m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "favor" },
                column: "rate",
                value: 0.9m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "might" },
                column: "rate",
                value: 0.5m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_strix", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 10m, 2.6m });

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "favor" },
                column: "rate",
                value: 0.9m);

            migrationBuilder.UpdateData(
                table: "enemy_stat_scaling",
                keyColumns: new[] { "enemy_id", "stat" },
                keyValues: new object[] { "enemy_valkyrie", "vigor" },
                columns: new[] { "base", "rate" },
                values: new object[] { 6m, 2.0m });
        }
    }
}
