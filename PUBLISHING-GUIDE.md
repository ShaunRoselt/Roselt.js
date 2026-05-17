# Publishing Guide

This guide captures the exact steps used to ship `roselt-js@0.2.0` to npm so the next person or agent can repeat the process without rediscovering the blockers.

## 1. Check the current repo state

Start by confirming the package version and making sure the release build is ready.

```bash
cat package.json
npm run build
```

If the build fails, fix that first. Publishing should only happen after `dist/roselt.js` and `dist/roselt.min.js` are up to date.

## 2. Bump the package version

Update `package.json` to the release version you want to ship.

In this release, the version was bumped from `0.1.2` to `0.2.0`.

## 3. Write release notes

Create or update `RELEASE-NOTES.md` before publishing so the release has a human-readable changelog.

Keep the notes short, factual, and consistent with the repo’s existing release-note style.

## 4. Create a publish-capable npm token

This was the critical blocker.

The existing granular token could read and write packages, but npm still rejected publish with a 403 because the token did not actually have bypass-2FA enabled.

Use the npm website to create a new granular access token with these settings:

- Token type: granular access token
- Package permission: read and write
- Package scope: all packages you need to publish
- Bypass 2FA: enabled at token creation time
- Expiration: short-lived if possible

Important: toggling the bypass-2FA checkbox on an existing token details page did not persist. The working fix was to create a new token with bypass-2FA enabled from the start.

## 5. Publish with a temporary npmrc

Write the token into a temporary npm config file and use that file for the publish command.

```bash
cat > /tmp/roselt-publish.npmrc <<'EOF'
//registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE
EOF

npm publish --userconfig /tmp/roselt-publish.npmrc --access public
```

The publish should succeed once the token has write access and bypass-2FA enabled.

## 6. Verify the release

Confirm the registry now reports the new version.

```bash
npm view roselt-js version --registry=https://registry.npmjs.org
```

For this release, the registry returned `0.2.0` after publish.

## 7. Clean up temporary credentials

Delete the temporary npm config file immediately after publishing.

```bash
rm -f /tmp/roselt-publish.npmrc
```

## 8. If publish still fails

If npm returns a 403 that mentions 2FA or bypass-2FA, the token is still not publish-capable.

Check these things in order:

- The token has read and write access.
- The token was created with bypass-2FA enabled.
- The token has not expired.
- The package name and ownership are correct.
- The temporary npmrc is pointing at the intended token.

## 9. Useful browser checkpoints

If you need to repeat the web flow, the relevant npm pages are:

- Access tokens list: `/settings/<username>/tokens`
- New granular token form: `/settings/<username>/tokens/granular-access-tokens/new`
- Existing token details: `/settings/<username>/tokens/granular-access-tokens/<token-id>`

## 10. Short version

1. Build the repo.
2. Bump the package version.
3. Write release notes.
4. Create a new granular npm token with read/write access and bypass-2FA enabled.
5. Publish with a temporary npmrc.
6. Verify the registry version.
7. Remove the temporary npmrc.