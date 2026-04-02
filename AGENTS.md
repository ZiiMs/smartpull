# smartRoute

smartRoute is a World of Warcraft Mythic+ route planner modeled after `threechest`.

## Product Direction

- Match the core behavior and workflow of `https://github.com/acornellier/threechest`.
- The app should let users build and edit M+ routes in a modern UI.
- Prefer implementing app-specific behavior in routes, feature components, hooks, and lib code rather than modifying shared primitives.

## Editing Rules

- Do not edit files under `src/components/ui` unless the user explicitly asks for it.
- Treat `src/components/ui` as shared design-system primitives.
- Build new screens and planner-specific UI by composing the existing UI components.
