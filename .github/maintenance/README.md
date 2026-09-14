# Reviewed GHCR orphan cleanup

The optional `cleanup_orphans` input in the existing **SPA Image** workflow
performs one bounded maintenance operation. It accepts only the frozen 51
untagged versions in `ghcr-orphans-20260914.json`, with a checksum embedded in
the runner. The default workflow behavior still verifies the SPA image.

Deletion runs only by manual dispatch on `chore/ghcr-orphans-20260914` in the
canonical repository. It uses the job's `GITHUB_TOKEN` with `packages: write`
and requires the repository's existing package administration permission.
GitHub documents this capability in
[Deleting and restoring a package](https://docs.github.com/en/packages/learn-github-packages/deleting-and-restoring-a-package).
The operation does not grant permissions or use personal access tokens.

Before any deletion, the runner reloads the full package inventory and verifies
the SHA256 of every OCI manifest. It rejects changed metadata, tags, recent
versions, unresolved index children, protected pins and references from any
retained version. It compares a second inventory immediately before deletion.
Each version's digest, tags and timestamps are checked again immediately before
its DELETE request. Parents precede their exclusively referenced children;
the first failure stops all remaining writes.

GHCR does not offer an atomic graph-check-and-delete transaction. The cleanup
job shares `Release-refs/heads/main` with the existing Release workflow and uses
`cancel-in-progress: false`, so those jobs wait for each other. Coordinate this
short operation with any tag or manual candidate publishers as well. Any partial failure requires
reviewing the uploaded journal before another run; missing planned versions
stop a retry. A successful run verifies deleted API state, retained metadata
and the readability of every tagged image's manifest tree and protected pin.
Storage reclamation and billing changes are determined by GitHub and are not
inferred from the number of deleted versions.

Local safeguard tests use only Python's standard library:

```sh
python3 -B -m unittest discover -s .github/maintenance -p 'test_*.py' -v
```

Running `ghcr_orphans.py` without `--delete` performs a read-only preflight and
requires `GITHUB_TOKEN` through the local secret mechanism. The deletion path
additionally requires the manual Actions job context. The workflow uploads
the journal even when validation or a DELETE request fails.
