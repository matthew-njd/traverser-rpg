using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Traverser.Api.Migrations
{
    /// <summary>
    /// Credits the days played before step 9 existed, then sets each player's longest run. Only adds
    /// credit, never changes one — so it is safe to run twice. <c>current_streak</c> is left to the
    /// next sync, which counts it back from the device's today.
    /// </summary>
    public partial class StreakBackfill : Migration
    {
        public const string Sql = """
            UPDATE activity_day
            SET streak_credit_method =
                CASE WHEN rest_tagged_at IS NOT NULL THEN 'rest_day_tag' ELSE 'goal_hit' END
            WHERE streak_credit_method IS NULL AND (rest_tagged_at IS NOT NULL OR goal_met);

            UPDATE streak_state s
            SET longest_streak = GREATEST(s.longest_streak, r.longest)
            FROM (
                SELECT player_id, MAX(n) AS longest
                FROM (
                    SELECT player_id, COUNT(*) AS n
                    FROM (
                        -- Consecutive dates minus their row number share one value per run.
                        SELECT player_id,
                               activity_date - (ROW_NUMBER() OVER (
                                   PARTITION BY player_id ORDER BY activity_date))::int AS run
                        FROM activity_day
                        WHERE streak_credit_method IS NOT NULL
                    ) dated
                    GROUP BY player_id, run
                ) runs
                GROUP BY player_id
            ) r
            WHERE s.player_id = r.player_id;
            """;

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(Sql);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
