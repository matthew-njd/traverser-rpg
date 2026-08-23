namespace Traverser.Api.Progression;

/// <summary>
/// The one source of randomness on the server (T2 §4 step 8's 25% travel roll, and which wild enemy
/// a successful roll resolves to).
/// <para>
/// ↯ **A seam purely so the rule can be tested.** A 25% chance asserted against a real PRNG is a
/// test that fails one run in four or passes for the wrong reason; the daily cap in particular can
/// only be proven by making every roll succeed. Nothing else about it is injectable — there is one
/// implementation, and the fixture swaps it.
/// </para>
/// </summary>
public interface IRandomSource
{
    /// <summary>Uniform in [0, 1).</summary>
    double NextDouble();

    /// <summary>Uniform integer in [0, <paramref name="exclusiveUpper"/>).</summary>
    int Next(int exclusiveUpper);
}

/// <summary>`Random.Shared` is thread-safe and needs no per-request state.</summary>
public sealed class SharedRandomSource : IRandomSource
{
    public double NextDouble() => Random.Shared.NextDouble();

    public int Next(int exclusiveUpper) => Random.Shared.Next(exclusiveUpper);
}
