using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace Traverser.Api.Auth;

/// <summary>
/// Mints and hashes the opaque guest bearer credential (tech-02 §1.4).
/// </summary>
internal static class GuestToken
{
    /// <summary>
    /// 256 bits from the CSPRNG. The token is the <em>entire</em> credential — the guest-only trim
    /// means no password, no second factor, and <c>auth_token</c> carries no expiry — so being
    /// unguessable is its only defence. Cheap to make large; there is exactly one of these per
    /// install and nothing types it by hand.
    /// </summary>
    private const int TokenByteLength = 32;

    /// <summary>Base64Url so the value survives an <c>Authorization</c> header unescaped.</summary>
    public static string Mint() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(TokenByteLength));

    /// <summary>
    /// ↯ Unsalted SHA-256, and deliberately so — see <see cref="Data.Entities.AuthToken"/>. The
    /// input is server-minted high-entropy random rather than a human-chosen password, so there is
    /// no dictionary to precompute against, and a per-row salt would force a table scan on the one
    /// lookup that runs before every single request.
    /// </summary>
    public static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
}
