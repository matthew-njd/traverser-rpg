using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <inheritdoc />
    public partial class LoreText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "entry_narrative",
                table: "zone",
                type: "text[]",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "defeat_first",
                table: "enemy",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "defeat_repeat",
                table: "enemy",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "flavor",
                table: "enemy",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "intro",
                table: "enemy",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Utc), 5 });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_cacus",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { "The roaring wind dies with him, and the ash he carried settles for the first time in longer than the road can remember.\nWhat the fire-giant never understood, you now carry. And somewhere past where this road ends, in a direction it hasn't opened yet, something old is already listening.", "The ash has barely settled. He rises to guard it again anyway.", null, "Smoke rolls off the cave mouth before he does — and when he finally steps out, the wind that follows him is hot enough to taste like fire.\n\"Every road that reaches this far ends in my hoard. Yours is no different.\"" });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_cerberus",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { "All three heads go still. The gate behind them, sealed since before memory, groans open.\nIt guarded this gate faithfully, long after anyone came to open it. In its wake, something is left behind — a trick worth carrying north.", "The gate remembers you. It opens without a fight.", null, "Three heads turn toward you at once — the gate they've guarded for an age finally has a visitor.\n\"The road ends here. It has ended here for longer than you can imagine.\"" });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_cyclops",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { "The great shape falls, and the pass is quiet for the first time in longer than either of you have lived.\n\"None have,\" it said. It was wrong once. That's enough.", "The pass remembers you now. It doesn't put up much of a fight.", null, "A single eye finds you across the ruined pass. It doesn't blink.\n\"You will not pass. None have. None will.\"" });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_draugr",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { null, null, "It was buried with its grudges, and the ground never quite closed over either.", null });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_fenrir",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { "The great wolf finally slows. Something like respect, or something close enough to it, passes between you.\nIt was bound here once. It chose to stay bound to something — the gate, if nothing else. That's over now.", "It knows your stride before you take it. The fight is shorter this time.", null, "A shape too large to be a wolf and too fast to be anything else circles once before it charges.\n\"You walk where the bound should not be woken.\"" });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_griffin",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { "It yields the high ground the way something proud yields — without conceding it was ever truly beaten.\nThe first thing on this road that answered to neither storm nor blade nor tide, but to something quieter. Worth remembering.", "It watches you climb again, already knowing how this ends.", null, "Lion and eagle in the same silhouette, and neither half of it seems inclined to let you pass.\n\"The high roads are not walked. They are earned.\"" });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_harpy",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { null, null, "\"Harpyiai\" means \"the snatchers\" — but older still, they were the sudden violence of a storm made into something with wings. The gust that arrives before you see the clouds. That part of the myth was never a stretch at all.", null });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_jormungandr",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { "The Serpent uncoils, and for the first time, the sea it wound itself around is only sea.\nIt fought like something that had never once needed to consider losing. Something of that certainty is worth taking with you — a war learned from the Serpent's own fury.", "The sea remembers the shape it used to hold. It doesn't hold it for long.", null, "The water doesn't ripple so much as it simply stops being water, and becomes something enormous instead.\n\"Even the roads that reach the sea end at me.\"" });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_lemures",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { null, null, "Restless dead who never got the burial rites owed to them. They don't want your road. They want to stop being forgotten.", null });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_satyr",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { null, null, "It grins before it's decided whether to fight you or trade with you. Usually both.", null });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_strix",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { null, null, "It watches from just outside the torchlight — patient in the particular way that only something that used to be a person can be patient.", null });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_valkyrie",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { null, null, "She doesn't announce herself before she decides whether you're worth carrying — and she decides fast, before you've finished deciding anything yourself. No trick of the type chart changes her mind.", null });

            migrationBuilder.UpdateData(
                table: "enemy",
                keyColumn: "id",
                keyValue: "enemy_waystone_wisp",
                columns: new[] { "defeat_first", "defeat_repeat", "flavor", "intro" },
                values: new object[] { null, null, null, null });

            migrationBuilder.UpdateData(
                table: "zone",
                keyColumn: "id",
                keyValue: "egypt_tbd",
                column: "entry_narrative",
                value: null);

            migrationBuilder.UpdateData(
                table: "zone",
                keyColumn: "id",
                keyValue: "imperion",
                column: "entry_narrative",
                value: new[] { "The World Serpent's coils are still, for the first time in longer than the roads remember.", "Imperion: where the road was built to last — stone laid over stone, arch over arch, an empire's answer to roads that used to just happen.", "An empire builds walls as readily as roads. Not everything here wants to be found.", "The road continues. Keep walking." });

            migrationBuilder.UpdateData(
                table: "zone",
                keyColumn: "id",
                keyValue: "olympion",
                column: "entry_narrative",
                value: null);

            migrationBuilder.UpdateData(
                table: "zone",
                keyColumn: "id",
                keyValue: "valheon",
                column: "entry_narrative",
                value: new[] { "Cerberus kept its gate long after anyone came to open it. Now the gate is open — and the road beyond it is colder than the one behind.", "Valheon: where the roads were paved in frost and timber, and the sky itself once carried messengers between worlds.", "Something here has been waiting even longer than the Greek roads did. It hasn't forgotten how to fight.", "The road continues. Keep walking." });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "entry_narrative",
                table: "zone");

            migrationBuilder.DropColumn(
                name: "defeat_first",
                table: "enemy");

            migrationBuilder.DropColumn(
                name: "defeat_repeat",
                table: "enemy");

            migrationBuilder.DropColumn(
                name: "flavor",
                table: "enemy");

            migrationBuilder.DropColumn(
                name: "intro",
                table: "enemy");

            migrationBuilder.UpdateData(
                table: "content_version",
                keyColumn: "id",
                keyValue: 1,
                columns: new[] { "generated_at", "version" },
                values: new object[] { new DateTime(2026, 10, 24, 0, 0, 0, 0, DateTimeKind.Utc), 4 });
        }
    }
}
