namespace Traverser.Api.Data.Entities;

/// <summary>
/// The guest bearer credential (T2 §1.4). Only the SHA-256 of the opaque token lands here — it is
/// a credential with no expiry, and T6 §10.5 replicates nightly dumps of this table off-machine.
/// Unsalted deliberately: the token is server-minted high-entropy random, so there is no dictionary
/// to attack, and per-row salt would break the O(1) lookup the auth path needs.
/// <para>
/// Multiple live rows per player are allowed — re-registration after a reinstall (T6 §13.1's
/// identity-restore path) legitimately mints a second. This is not the multi-device seam (T2 §1.5).
/// </para>
/// </summary>
public class AuthToken
{
    /// <summary>SHA-256 of the opaque token; the token itself is never stored.</summary>
    public byte[] TokenHash { get; set; } = null!;

    public Guid PlayerId { get; set; }

    public DateTime IssuedAt { get; set; }

    /// <summary>Diagnostics only — nothing reads it to make a decision, and it must not become
    /// session expiry without a spec change.</summary>
    public DateTime? LastUsedAt { get; set; }

    /// <summary>Set instead of deleting the row, so "this device was de-authorised" stays
    /// distinguishable from "this token never existed" when something 401s unexpectedly.</summary>
    public DateTime? RevokedAt { get; set; }

    public Player Player { get; set; } = null!;
}
