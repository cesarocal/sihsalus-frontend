import copy
import json
import unittest
from unittest.mock import patch

import ghcr_orphans as cleanup


def row(number, tags=None):
    return {"id": number, "name": "sha256:" + str(number) * 64,
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
            "metadata": {"container": {"tags": tags or []}}}


class CleanupSafetyTests(unittest.TestCase):
    def setUp(self):
        self.rows = [row(1), row(2), row(3, ["latest"])]
        self.manifests = {
            self.rows[0]["name"]: {"manifests": [{"digest": self.rows[1]["name"]}]},
            self.rows[1]["name"]: {}, self.rows[2]["name"]: {},
        }
        self.plan = {"cutoff": "2026-08-15T00:00:00+00:00", "protected_pins": [self.rows[2]["name"]],
                     "versions": [{key: value for key, value in item.items() if key != "metadata"}
                                  | {"tags": [], "references": [self.rows[1]["name"]] if item["id"] == 1 else []}
                                  for item in self.rows[:2]]}

    def validate(self):
        return cleanup.validate_graph(self.plan, self.rows, self.manifests)

    def test_frozen_reviewed_plan_checksum_and_scope(self):
        plan = cleanup.load_plan()
        self.assertEqual(len(plan["versions"]), 51)
        self.assertTrue(all(item["tags"] == [] for item in plan["versions"]))

    def test_checksum_change_is_rejected(self):
        with patch.object(cleanup, "PLAN_PATH") as path:
            path.read_bytes.return_value = b"{}"
            with self.assertRaisesRegex(RuntimeError, "checksum"):
                cleanup.load_plan()

    def test_isolated_parent_child_can_be_removed(self):
        self.validate()

    def test_shared_child_is_preserved(self):
        self.manifests[self.rows[2]["name"]] = {"manifests": [{"digest": self.rows[1]["name"]}]}
        with self.assertRaisesRegex(RuntimeError, "Retained image"):
            self.validate()

    def test_untagged_retained_reference_is_preserved(self):
        self.rows[2]["metadata"]["container"]["tags"] = []
        self.manifests[self.rows[2]["name"]] = {"subject": {"digest": self.rows[1]["name"]}}
        with self.assertRaisesRegex(RuntimeError, "Retained image"):
            self.validate()

    def test_descriptor_annotation_reference_is_preserved(self):
        self.manifests[self.rows[2]["name"]] = {"annotations": {"vnd.docker.reference.digest": self.rows[0]["name"]}}
        with self.assertRaisesRegex(RuntimeError, "Retained image"):
            self.validate()

    def test_signature_tag_reference_is_preserved(self):
        self.rows[2]["metadata"]["container"]["tags"] = [self.rows[0]["name"].replace(":", "-") + ".sig"]
        with self.assertRaisesRegex(RuntimeError, "Retained image"):
            self.validate()

    def test_new_tag_is_rejected(self):
        self.rows[0]["metadata"]["container"]["tags"] = ["sha-" + "a" * 40]
        with self.assertRaisesRegex(RuntimeError, "has tags"):
            self.validate()

    def test_changed_digest_is_rejected(self):
        self.rows[0]["name"] = "sha256:" + "4" * 64
        self.manifests[self.rows[0]["name"]] = {}
        with self.assertRaisesRegex(RuntimeError, "metadata changed"):
            self.validate()

    def test_changed_timestamp_is_rejected(self):
        self.rows[0]["updated_at"] = "2026-09-13T00:00:00Z"
        with self.assertRaisesRegex(RuntimeError, "metadata changed"):
            self.validate()

    def test_recent_frozen_entry_is_rejected(self):
        for item in (self.rows[0], self.plan["versions"][0]):
            item["created_at"] = "2026-09-13T00:00:00Z"
        with self.assertRaisesRegex(RuntimeError, "too recent"):
            self.validate()

    def test_missing_child_stops_all_deletions(self):
        self.manifests[self.rows[0]["name"]] = {"manifests": [{"digest": "sha256:" + "4" * 64}]}
        with self.assertRaisesRegex(RuntimeError, "Unresolved"):
            self.validate()

    def test_child_before_parent_is_rejected(self):
        self.plan["versions"].reverse()
        with self.assertRaisesRegex(RuntimeError, "parents before children"):
            self.validate()

    def test_missing_protected_pin_is_rejected(self):
        self.rows.pop()
        with self.assertRaisesRegex(RuntimeError, "Protected pin missing"):
            self.validate()

    def test_missing_candidate_requires_journal_reconciliation(self):
        self.rows.pop(0)
        with self.assertRaisesRegex(RuntimeError, "reconcile prior journal"):
            self.validate()

    def test_parent_delete_rejection_never_attempts_child(self):
        journal = {"attempts": [], "deleted": []}
        calls = []

        class FakeRegistry:
            def api(inner_self, path, method="GET"):
                calls.append((path, method))
                return (403, None) if method == "DELETE" else (200, copy.deepcopy(self.rows[0]))

        with self.assertRaisesRegex(RuntimeError, "Delete HTTP 403"):
            cleanup.execute_deletions(self.plan, FakeRegistry(), journal, lambda: None)
        self.assertEqual(len(calls), 2)
        self.assertEqual(journal["deleted"], [])
        self.assertEqual(journal["attempts"][0]["http_status"], 403)

    def test_tag_added_immediately_before_delete_stops_write(self):
        journal = {"attempts": [], "deleted": []}
        calls = []
        self.rows[0]["metadata"]["container"]["tags"] = ["keep"]

        class FakeRegistry:
            def api(inner_self, path, method="GET"):
                calls.append(method)
                return 200, self.rows[0]

        with self.assertRaisesRegex(RuntimeError, "has tags"):
            cleanup.execute_deletions(self.plan, FakeRegistry(), journal, lambda: None)
        self.assertEqual(calls, ["GET"])

    def test_journal_records_successful_parent_before_child_attempt(self):
        journal = {"attempts": [], "deleted": []}
        saved = []
        rows_by_id = {item["id"]: item for item in self.rows}

        class FakeRegistry:
            def api(inner_self, path, method="GET"):
                number = int(path.rsplit("/", 1)[1])
                if number == 2:
                    raise RuntimeError("Network interrupted")
                return (204, None) if method == "DELETE" else (200, rows_by_id[number])

        with self.assertRaisesRegex(RuntimeError, "Network interrupted"):
            cleanup.execute_deletions(self.plan, FakeRegistry(), journal, lambda: saved.append(json.loads(json.dumps(journal))))
        self.assertEqual(saved[-1]["deleted"], [1])
        self.assertEqual(saved[-1]["attempts"][0]["status"], "deleted")


if __name__ == "__main__":
    unittest.main()
