# Changesets

When creating a pull request, ALWAYS create a changeset file before committing and pushing:

1. Determine the semver bump type from the changes:
   - **patch**: bug fixes, documentation updates, refactors with no API changes
   - **minor**: new features, new CLI options, non-breaking additions
   - **major**: breaking changes to CLI interface, config format changes, removed features
2. Generate a short kebab-case name summarizing the change (e.g. `fix-template-parsing`)
3. Create `.changeset/<name>.md` with this exact format:

```markdown
---
"biscuitcutter": <patch|minor|major>
---

<One-line summary of the change>
```

4. Commit the changeset file along with the code changes
