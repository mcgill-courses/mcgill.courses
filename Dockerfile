FROM node:20-slim AS client

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY . /app
WORKDIR /app

FROM client AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build -- --mode=production

FROM rust:slim-buster as server

WORKDIR /usr/src/app
COPY . .
RUN cargo build --release

FROM debian:buster-slim

RUN apt-get update && apt-get install -y libssl1.1 ca-certificates

COPY --from=build /app/client/dist assets
COPY --from=server /usr/src/app/seed seed
COPY --from=server /usr/src/app/.well-known .well-known
COPY --from=server /usr/src/app/target/release/server /usr/local/bin

CMD server --source seed serve --initialize --latest-courses --skip-reviews --asset-dir assets --db-name mcgill-courses
