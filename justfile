set dotenv-load

export RUST_LOG := 'info'

alias a := all
alias d := dev
alias f := fmt
alias i := initialize
alias t := test

default:
  just --list

[group: 'check']
all: build clippy e2e fmt-check forbid lint test

[group: 'dev']
build *mode='development':
  cargo build && pnpm run build -- --mode {{ mode }}

[group: 'container']
build-container:
  docker build -t mcgill.courses:latest .

[group: 'check']
clippy:
  ./bin/clippy

[group: 'test']
coverage:
  ./bin/coverage

[group: 'dev']
dev: services typeshare
  concurrently \
    --kill-others \
    --names 'SERVER,CLIENT' \
    --prefix-colors 'green.bold,magenta.bold' \
    --prefix '[{name}] ' \
    --prefix-length 2 \
    --success first \
    --handle-input \
    --timestamp-format 'HH:mm:ss' \
    --color \
    -- \
    'just watch run -- --db-name=mcgill-courses' \
    'pnpm run dev'

[group: 'test']
e2e:
  pnpm run cy:e2e

[group: 'format']
fmt:
  cargo fmt --all
  pnpm run format

[group: 'check']
fmt-check:
  cargo fmt --all -- --check
  pnpm run format-check

[group: 'check']
forbid:
  ./bin/forbid

[group: 'tools']
[working-directory: 'tools/changelog-generator']
generate-changelog *args:
  cargo run -- --output ../../client/src/assets/changelog.json {{ args }}

[group: 'setup']
initialize *args: restart-services
  cargo run -- --source=seed --initialize --db-name=mcgill-courses {{ args }}

[group: 'setup']
install-dev-deps:
  cargo install hk
  brew install pkl
  hk install
  cargo install present
  cargo install typeshare-cli
  brew install --cask chromedriver
  curl -LsSf https://astral.sh/uv/install.sh | sh

[group: 'check']
lint *args:
  pnpm run lint {{ args }}

[group: 'tools']
[working-directory: 'tools/scraper']
load *args:
  cargo run -- \
    --batch-size=5 \
    --course-delay 1000 \
    --source seed \
    --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36" \
    {{ args }}

[group: 'tools']
readme:
  present --in-place README.md
  @pnpm --dir client exec prettier --write --config .prettierrc ../README.md

[group: 'setup']
restart-services:
  docker compose down --volumes && just services

[group: 'dev']
run *args:
  cargo run {{ args }}

[group: 'container']
run-container: build-container
  docker run -d \
    -e MONGODB_URL=$MONGODB_URL \
    -e MS_CLIENT_ID=$MS_CLIENT_ID \
    -e MS_CLIENT_SECRET=$MS_CLIENT_SECRET \
    -e MS_REDIRECT_URI=$MS_REDIRECT_URI \
    -e RUST_LOG=info \
    -p 8000:8000 \
    mcgill.courses:latest

[group: 'dev']
serve:
  cargo run -- --db-name=mcgill-courses

[group: 'setup']
services:
  docker compose up --no-recreate -d

[group: 'test']
test *filter:
  cargo test --all {{ filter }}

[group: 'dev']
typeshare:
  RUST_LOG=warn typeshare -l typescript -o client/src/lib/types.ts .
  pnpm --dir client exec prettier --write src/lib/types.ts

[group: 'dev']
watch +COMMAND='test':
  cargo watch --clear --exec "{{ COMMAND }}"
