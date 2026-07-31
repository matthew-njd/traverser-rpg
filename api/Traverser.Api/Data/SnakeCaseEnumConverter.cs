using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Traverser.Api.Data;

/// <summary>
/// Maps a closed-set enum to the snake_case `text` column tech-01 §2 specifies. Not
/// <c>EnumToStringConverter</c>, which would store PascalCase and break every hand-written query.
/// </summary>
public sealed class SnakeCaseEnumConverter<TEnum>()
    : ValueConverter<TEnum, string>(
        value => SnakeCaseEnum<TEnum>.ToText(value),
        text => SnakeCaseEnum<TEnum>.FromText(text))
    where TEnum : struct, Enum;

/// <summary>Builds the CHECK constraint bodies for closed-set columns from the enum itself.</summary>
public static class Check
{
    /// <summary>`column in ('a','b',...)` over every member of <typeparamref name="TEnum"/>.</summary>
    public static string In<TEnum>(string column) where TEnum : struct, Enum
        => Sql(column, SnakeCaseEnum<TEnum>.AllText);

    /// <summary>
    /// `column in ('a','b')` over an explicit subset — for the columns whose set is deliberately
    /// narrower than the enum, e.g. `streak_milestone` excluding Trinket and Divine (GDD 11 §5.1).
    /// </summary>
    public static string In<TEnum>(string column, params TEnum[] allowed) where TEnum : struct, Enum
        => Sql(column, allowed.Select(SnakeCaseEnum<TEnum>.ToText).ToArray());

    private static string Sql(string column, IReadOnlyList<string> values)
        => $"{column} in ({string.Join(", ", values.Select(v => $"'{v}'"))})";
}
