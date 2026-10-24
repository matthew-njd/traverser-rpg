using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class CanadianSpelling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 10, 24, 0, 0, 0, 0, DateTimeKind.Utc), 4 });

            migrationBuilder.UpdateData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_accessory_mortal",
                column: "display_name",
                value: "Traveller's Band");

            migrationBuilder.UpdateData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_armor_mortal",
                column: "display_name",
                value: "Traveller's Guard");

            migrationBuilder.UpdateData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_weapon_mortal",
                column: "display_name",
                value: "Traveller's Blade");

            migrationBuilder.UpdateData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_travelers_salve",
                column: "display_name",
                value: "Traveller's Salve");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 8, 29, 0, 0, 0, 0, DateTimeKind.Utc), 3 });

            migrationBuilder.UpdateData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_accessory_mortal",
                column: "display_name",
                value: "Traveler's Band");

            migrationBuilder.UpdateData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_armor_mortal",
                column: "display_name",
                value: "Traveler's Guard");

            migrationBuilder.UpdateData(
                table: "gear_def",
                keyColumn: "id",
                keyValue: "gear_weapon_mortal",
                column: "display_name",
                value: "Traveler's Blade");

            migrationBuilder.UpdateData(
                table: "item_def",
                keyColumn: "id",
                keyValue: "item_travelers_salve",
                column: "display_name",
                value: "Traveler's Salve");
        }
    }
}
