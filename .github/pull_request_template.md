## Summary

Describe what changed and why.

## Verification

- [ ] `CI / Lint · Typecheck · Test · Build` passes
- [ ] `Security Gate / Static policy · Dependency audit` passes
- [ ] No secrets, credentials, private keys, or local data were committed
- [ ] New behavior has tests or an explicit reason why a test is not applicable
- [ ] Security-sensitive changes include threat/abuse considerations

## Risk

Describe deployment, data, authentication, dependency, or rollback risk.

## Security checklist

- [ ] Inputs are validated and size-bounded
- [ ] Authorization is enforced server-side where required
- [ ] SQL uses bound parameters
- [ ] External URLs/redirects are constrained
- [ ] New GitHub Actions are pinned to full commit SHAs
