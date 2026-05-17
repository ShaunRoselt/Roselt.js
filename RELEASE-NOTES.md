# Release Notes

This file tracks the notable changes to Roselt.js.

## Version 0.2.0 (Unreleased)
- Added a full-screen developer error overlay for missing pages, sections, components, and uncaught runtime errors.
- Missing section errors now resolve back to the exact `<roselt section="...">` line in the user's file.
- Missing component errors now resolve back to the exact custom element usage in the user's page or section.
- Added source code excerpts and stack traces to make failures easier to debug.
- Improved the overlay layout so the error view uses a single scroll path and avoids horizontal overflow.
- Updated the admin-demo example to use the local Roselt.js build.
