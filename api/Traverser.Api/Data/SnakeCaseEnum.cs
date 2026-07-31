using System.Text;

namespace Traverser.Api.Data;

/// <summary>
/// The single mapping between a closed-set enum member and the snake_case text stored in Postgres.
/// Both the value converter and the generated CHECK constraint lists read from here, so a member
/// added to an enum without a migration shows up as a failing constraint rather than silent drift.
/// </summary>
internal static class SnakeCaseEnum<TEnum> where TEnum : struct, Enum
{
    private static readonly Dictionary<TEnum, string> ToTextMap;
    private static readonly Dictionary<string, TEnum> FromTextMap;

    static SnakeCaseEnum()
    {
        var values = Enum.GetValues<TEnum>();
        ToTextMap = new Dictionary<TEnum, string>(values.Length);
        FromTextMap = new Dictionary<string, TEnum>(values.Length, StringComparer.Ordinal);

        foreach (var value in values)
        {
            var text = ToSnakeCase(value.ToString());
            ToTextMap.Add(value, text);
            FromTextMap.Add(text, value);
        }

        AllText = values.Select(v => ToTextMap[v]).ToArray();
    }

    /// <summary>Every stored value, in declaration order. Used to build CHECK constraints.</summary>
    public static IReadOnlyList<string> AllText { get; }

    public static string ToText(TEnum value)
        => ToTextMap.TryGetValue(value, out var text)
            ? text
            : throw new ArgumentOutOfRangeException(nameof(value), value, $"Not a member of {typeof(TEnum).Name}.");

    public static TEnum FromText(string text)
        => FromTextMap.TryGetValue(text, out var value)
            ? value
            : throw new ArgumentOutOfRangeException(nameof(text), text, $"Not a stored value of {typeof(TEnum).Name}.");

    private static string ToSnakeCase(string name)
    {
        var builder = new StringBuilder(name.Length + 4);

        for (var i = 0; i < name.Length; i++)
        {
            if (i > 0 && char.IsUpper(name[i]))
            {
                builder.Append('_');
            }

            builder.Append(char.ToLowerInvariant(name[i]));
        }

        return builder.ToString();
    }
}
