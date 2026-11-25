FROM node:22-slim AS client

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY . /app
WORKDIR /app

FROM client AS build

ARG VITE_GOOGLE_API_KEY
ENV VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter client run build --mode=production

FROM lukemathwalker/cargo-chef:latest-rust-1.94.1-slim-trixie AS chef

WORKDIR /usr/src/app

FROM chef AS planner

COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS server

COPY --from=planner /usr/src/app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release

FROM debian:trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --system --no-create-home app

COPY --from=build /app/client/dist assets
COPY --from=server /usr/src/app/seed seed
COPY --from=server /usr/src/app/.well-known .well-known
COPY --from=server /usr/src/app/target/release/server /usr/local/bin

USER app

CMD server --source seed --initialize --latest-courses --skip-reviews --asset-dir assets --db-name mcgill-courses
