# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Repository

GitHub repository: `Pilks-pixel/top_vino_backend`

## Pull requests as a triage surface

PRs as a request surface: no.

Triage GitHub Issues only. Do not process external pull requests as incoming requests.

## Common operations

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body "..."`
- Apply a label: `gh issue edit <number> --add-label "..."`
- Close: `gh issue close <number> --comment "..."`
