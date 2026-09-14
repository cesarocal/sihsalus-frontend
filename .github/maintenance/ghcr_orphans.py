"""One-time, fixed-scope GHCR cleanup. Read-only unless --delete is supplied."""

import concurrent.futures
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

REPOSITORY = "sihsalus/sihsalus-frontend"
PACKAGE = "sihsalus-frontend"
PLAN_SHA256 = "ec0e85aa16de241b25535fd9647657df46d1696c25cd29417afff0d2aa4f0ee5"
PLAN_PATH = Path(__file__).with_name("ghcr-orphans-20260914.json")
API_PATH = "/orgs/sihsalus/packages/container/" + PACKAGE
DIGEST = re.compile(r"sha256:[0-9a-f]{64}")
ACCEPT = ",".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def timestamp(value):
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def load_plan():
    raw = PLAN_PATH.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == PLAN_SHA256, "Frozen plan checksum changed")
    plan = json.loads(raw)
    require(plan["package"] == PACKAGE and len(plan["versions"]) == 51, "Unexpected plan scope")
    require(len({row["id"] for row in plan["versions"]}) == 51, "Duplicate version IDs")
    require(len({row["name"] for row in plan["versions"]}) == 51, "Duplicate version digests")
    require(not {row["name"] for row in plan["versions"]} & set(plan["protected_pins"]), "Protected pin in plan")
    for row in plan["versions"]:
        validate_version(row, row, plan["cutoff"], frozen=True)
    return plan


def validate_version(expected, actual, cutoff, frozen=False):
    tags = actual["tags"] if frozen else actual["metadata"]["container"]["tags"]
    require(not tags, "Version has tags: " + str(expected["id"]))
    for key in ("id", "name", "created_at", "updated_at"):
        require(actual[key] == expected[key], "Version metadata changed: " + str(expected["id"]))
    require(DIGEST.fullmatch(actual["name"]), "Invalid digest")
    limit = min(timestamp(cutoff), datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=30))
    require(timestamp(actual["created_at"]) < limit and timestamp(actual["updated_at"]) < limit, "Version is too recent")


def references(manifest, row, known):
    # Include subjects, attestations, descriptor annotations and any known
    # package digest used as config/layer data. Unknown index children fail shut.
    required = [entry["digest"] for entry in manifest.get("manifests", [])]
    if manifest.get("subject"):
        required.append(manifest["subject"]["digest"])
    require(set(required) <= known, "Unresolved OCI index child or subject")
    result = set(required)

    def visit(value):
        if isinstance(value, dict):
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
        elif isinstance(value, str) and value in known:
            result.add(value)

    visit(manifest)
    for tag in row["metadata"]["container"]["tags"]:
        match = re.fullmatch(r"sha256-([0-9a-f]{64})(?:\.(?:sig|att|sbom))?", tag)
        if match:
            result.add("sha256:" + match.group(1))
    return result


def validate_graph(plan, rows, manifests):
    by_id = {row["id"]: row for row in rows}
    known = {row["name"] for row in rows}
    require(len(by_id) == len(rows) == len(known), "Duplicate package inventory records")
    require(set(plan["protected_pins"]) <= known, "Protected pin missing")
    candidates = {row["name"] for row in plan["versions"]}
    graph = {row["name"]: references(manifests[row["name"]], row, known) for row in rows}
    for row in plan["versions"]:
        require(row["id"] in by_id, "Planned version missing; reconcile prior journal before retry")
        validate_version(row, by_id[row["id"]], plan["cutoff"])
        require(graph[row["name"]] == set(row["references"]), "Planned OCI references changed")
    for digest, outgoing in graph.items():
        require(digest in candidates or not outgoing & candidates, "Retained image references a candidate")
    visited = set()
    for row in plan["versions"]:
        require(not graph[row["name"]] & visited, "Delete order must put parents before children")
        visited.add(row["name"])
    return graph


class Registry:
    def __init__(self):
        self.github_token = os.environ["GITHUB_TOKEN"]
        # The package is public. This anonymous pull token never grants writes.
        url = "https://ghcr.io/token?service=ghcr.io&scope=repository:" + REPOSITORY + ":pull"
        with urllib.request.urlopen(url, timeout=30) as response:
            self.pull_token = json.load(response)["token"]

    def api(self, path, method="GET"):
        require(path.startswith(API_PATH), "API path outside the fixed package")
        request = urllib.request.Request("https://api.github.com" + path, method=method, headers={
            "Authorization": "Bearer " + self.github_token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            # Status only; neither response headers nor credentials enter logs.
            return error.code, None

    def versions(self, state="active"):
        rows = []
        for page in range(1, 101):
            status, batch = self.api(API_PATH + f"/versions?per_page=100&page={page}&state={state}")
            require(status == 200 and isinstance(batch, list), f"Inventory HTTP {status}")
            rows.extend(batch)
            if len(batch) < 100:
                return rows
        raise RuntimeError("Inventory exceeds bounded pagination")

    def manifest(self, digest):
        require(DIGEST.fullmatch(digest), "Invalid manifest digest")
        request = urllib.request.Request("https://ghcr.io/v2/" + REPOSITORY + "/manifests/" + digest, headers={
            "Authorization": "Bearer " + self.pull_token, "Accept": ACCEPT,
        })
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read(4 * 1024 * 1024)
            require(response.headers.get("Docker-Content-Digest") in (None, digest), "Registry digest header mismatch")
        require("sha256:" + hashlib.sha256(raw).hexdigest() == digest, "Manifest SHA256 mismatch")
        return json.loads(raw)


def snapshot(rows):
    return sorted((row["id"], row["name"], row["created_at"], row["updated_at"],
                   tuple(sorted(row["metadata"]["container"]["tags"]))) for row in rows)


def execute_deletions(plan, registry, journal, save):
    # Stop at the first failure, including a failed parent. Remaining children
    # are never attempted, and ambiguous prior attempts need manual review.
    for row in plan["versions"]:
        path = API_PATH + "/versions/" + str(row["id"])
        status, current = registry.api(path)
        require(status == 200, f"Version revalidation HTTP {status}")
        validate_version(row, current, plan["cutoff"])
        attempt = {"id": row["id"], "digest": row["name"], "status": "started"}
        journal["attempts"].append(attempt)
        save()
        status, _ = registry.api(path, "DELETE")
        attempt["http_status"] = status
        save()
        require(status == 204, f"Delete HTTP {status}; remaining versions preserved")
        journal["deleted"].append(row["id"])
        attempt["status"] = "deleted"
        save()


def main():
    require(sys.argv[1:] in ([], ["--delete"]), "Only --delete is supported")
    deleting = sys.argv[1:] == ["--delete"]
    if deleting:
        require(os.environ.get("GITHUB_ACTIONS") == "true", "Deletion requires the manual Actions job")
        require(os.environ.get("GITHUB_REPOSITORY") == REPOSITORY, "Unexpected repository")
        require(os.environ.get("GITHUB_REF") == "refs/heads/chore/ghcr-orphans-20260914", "Unexpected maintenance branch")
        require(os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch", "Manual dispatch required")
    path = Path("ghcr-orphan-cleanup-journal.json")
    require(not path.exists(), "Existing journal must be reconciled before retry")
    journal = {"plan_sha256": PLAN_SHA256, "deleted": [], "attempts": [], "status": "validating"}

    def save():
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(journal, indent=2) + "\n")
        temporary.replace(path)

    save()
    try:
        plan = load_plan()
        registry = Registry()
        status, package = registry.api(API_PATH)
        require(status == 200 and package["name"] == PACKAGE and package["visibility"] == "public"
                and package["repository"]["full_name"] == REPOSITORY, "Unexpected package association")
        rows = registry.versions()
        digests = [row["name"] for row in rows]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            manifests = dict(zip(digests, pool.map(registry.manifest, digests)))
        graph = validate_graph(plan, rows, manifests)
        require(snapshot(rows) == snapshot(registry.versions()), "Registry changed during graph inspection")
        journal.update(status="validated", inventory_count=len(rows), manifest_count=len(manifests),
                       validated_candidates=len(plan["versions"]))
        save()
        if deleting:
            execute_deletions(plan, registry, journal, save)
            removed = set(journal["deleted"])
            retained = [row for row in rows if row["id"] not in removed]
            after = registry.versions()
            require(not removed & {row["id"] for row in after}, "Deleted versions remain active")
            require(set(snapshot(retained)) <= set(snapshot(after)), "Retained version metadata changed")
            deleted = {row["id"]: row["name"] for row in registry.versions("deleted")}
            require(all(deleted.get(row["id"]) == row["name"] for row in plan["versions"]), "Deleted-state verification failed")
            protected = set(plan["protected_pins"])
            protected.update(row["name"] for row in retained if row["metadata"]["container"]["tags"])
            pending = list(protected)
            while pending:
                for child in graph[pending.pop()]:
                    if child not in protected and child in graph:
                        protected.add(child)
                        pending.append(child)
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                list(pool.map(registry.manifest, sorted(protected)))
            journal.update(status="completed", retained_manifests_verified=len(protected), deleted_state_verified=True)
        else:
            journal["status"] = "dry-run-passed"
    except Exception as error:
        journal.update(status="stopped", error=str(error))
        raise
    finally:
        save()
        print(json.dumps({"status": journal["status"], "deleted": len(journal["deleted"])}))


if __name__ == "__main__":
    main()
