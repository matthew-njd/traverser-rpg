using System.Text.RegularExpressions;

namespace Traverser.Tests.Seed;

/// <summary>
/// The set of IDs registered in <c>docs/traverser-data-manifest.md</c>, read from the file itself.
/// <para>
/// Parsed rather than transcribed, unlike <see cref="Fixtures"/>. The fixtures are ~50 numbers whose
/// whole purpose is to be an independent second copy, so hand-transcription is the point. This is
/// ~200 identifiers whose purpose is to be *the same* copy — a transcribed second list would drift
/// from the manifest and start reporting the transcription's mistakes as seed errors.
/// </para>
/// </summary>
internal static partial class ManifestKeys
{
    private static readonly Lazy<IReadOnlySet<string>> Keys = new(Load);

    /// <summary>Every snake_case ID the manifest registers, in any section.</summary>
    public static IReadOnlySet<string> All => Keys.Value;

    private static IReadOnlySet<string> Load()
    {
        var path = Path.Combine(RepoRoot(), "docs", "traverser-data-manifest.md");
        var text = File.ReadAllText(path);

        // Every backticked single-token lowercase identifier. The manifest marks IDs this way
        // everywhere — table cells and prose alike — and the single-token restriction is what
        // excludes the non-ID backticked spans it also contains: `mortal|heroic|mythic|divine`
        // (alternations) and `{key}.png` (patterns) both fail to match.
        var keys = IdentifierInBackticks()
            .Matches(text)
            .Select(m => m.Groups[1].Value)
            .ToHashSet(StringComparer.Ordinal);

        return keys.Count > 0
            ? keys
            : throw new InvalidOperationException($"Parsed no IDs out of {path} — the format changed.");
    }

    /// <summary>
    /// Walks up from the test assembly to the repo root. The tests read a doc rather than an
    /// embedded copy on purpose: the manifest is the registry, and a copy checked into the test
    /// project would be a second place to update.
    /// </summary>
    private static string RepoRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "docs", "traverser-data-manifest.md")))
            {
                return dir.FullName;
            }
        }

        throw new InvalidOperationException(
            $"No docs/traverser-data-manifest.md above {AppContext.BaseDirectory}.");
    }

    [GeneratedRegex("`([a-z][a-z0-9_]*)`")]
    private static partial Regex IdentifierInBackticks();
}
