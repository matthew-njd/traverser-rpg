# Traverser API image — tech-06 §3.5. Multi-stage: the SDK restores and publishes, a chiseled
# (distroless, non-root) ASP.NET runtime serves it. Build context is ./api.
#
# ↯ No HTTPS and no dev certificate inside the container, which inverts the usual cloud instinct
# to speak TLS end-to-end. TLS terminates at `tailscale serve` on the host (§1.2, §8.3) and the
# hop from there to here is loopback on a single machine; an in-container certificate would be one
# more thing to renew that the client never sees.

# ↯ .NET 10 images are Ubuntu. The Debian tags — including the `-bookworm-slim` that nearly every
# .NET Dockerfile tutorial in circulation uses — are not published for .NET 10 at all (§3.3), so a
# copied tutorial Dockerfile fails at the pull with what looks like a typo. `10.0` is Ubuntu 24.04.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Restore before the sources are copied so that editing a .cs file reuses the cached package
# layer. Only the API project is built here; Traverser.Tests never enters the runtime image.
COPY Traverser.Api/Traverser.Api.csproj Traverser.Api/
RUN dotnet restore Traverser.Api/Traverser.Api.csproj

COPY Traverser.Api/ Traverser.Api/
RUN dotnet publish Traverser.Api/Traverser.Api.csproj \
        --configuration $BUILD_CONFIGURATION \
        --no-restore \
        --output /app/publish \
        /p:UseAppHost=false


# `-noble-chiseled-extra` rather than plain `-noble-chiseled`: the plain variant ships without ICU
# and without tzdata, and Npgsql resolves time zones through TimeZoneInfo when it reads a
# `timestamptz`. Dropping tzdata to save ~15 MB would buy a TimeZoneNotFoundException surfacing
# from inside a query rather than at startup — the worst possible place for it, given tech-01 §2
# puts a timezone on the player and every activity_day boundary depends on one.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra AS runtime
WORKDIR /app

# Chiseled images already default to the non-root `app` user and to port 8080. Both are restated
# because §3.5 makes them load-bearing rather than incidental: the loopback publish in
# docker-compose.yml is written against 8080, and a future base-image change that quietly moved
# either one should break here rather than in production.
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

COPY --from=build /app/publish .

# `dotnet Traverser.Api.dll`, not an apphost — /p:UseAppHost=false skips generating the native
# launcher, which the chiseled runtime has no use for.
ENTRYPOINT ["dotnet", "Traverser.Api.dll"]
