"""
ML Model Evaluation — LLM-Guard Adversarial Scanner
====================================================
Evaluates the TF-IDF + Logistic Regression classifier using a proper
stratified train/val/test split on CORPUS-ONLY data.

Bootstrap samples are excluded from evaluation splits so they cannot
inflate reported metrics.

Usage:
    python evaluate_model.py [--save-on-pass]

    --save-on-pass  Only overwrite the production model artifact if the
                    evaluation gate passes (>=95% precision AND recall).
                    Without this flag, the model is saved regardless and
                    the script exits non-zero on failure.

Exit codes:
    0 — evaluation gate passed
    1 — evaluation gate failed (model may still be saved for debugging)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

# Use canonical training module
sys.path.insert(0, str(Path(__file__).parent))
from ml_training import (
    MODEL_DIR,
    build_eval_splits,
    check_partition_leakage,
    check_partition_leakage,
    corpus_fingerprint,
    load_full_training_dataset,
    save_model,
    train_production_model,
)
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from ml_training import TFIDF_CONFIG, LR_CONFIG, RANDOM_SEED

EVAL_TARGET_PRECISION = 0.95
EVAL_TARGET_RECALL    = 0.95


def _train_on_subset(X_train, y_train):
    vec = TfidfVectorizer(**TFIDF_CONFIG)
    clf = LogisticRegression(**LR_CONFIG)
    vec.fit(X_train)
    clf.fit(vec.transform(X_train), y_train)
    return clf, vec


def run_evaluation(save_on_pass: bool = False) -> dict:
    print(f"Corpus fingerprint: {corpus_fingerprint()}")

    # ── Build corpus-only splits ───────────────────────────────────────
    try:
        X_train, X_val, X_test, y_train, y_val, y_test = build_eval_splits()
    except ValueError as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    print(f"\nCorpus-only split (bootstrap excluded from eval):")
    print(f"  train: {len(X_train)}  val: {len(X_val)}  test: {len(X_test)}")

    # ── Leakage checks across all three partitions ─────────────────────
    leakage = check_partition_leakage(
        X_train.tolist(), X_val.tolist(), X_test.tolist()
    )
    any_leak = any(v > 0 for v in leakage.values())
    if any_leak:
        print(f"\nWARNING — Partition leakage detected: {leakage}")
    else:
        print(f"\nLeakage check: PASS (no overlap across train/val/test)")

    # ── Train on corpus train split ────────────────────────────────────
    clf, vec = _train_on_subset(X_train, y_train)

    # ── Validation evaluation ──────────────────────────────────────────
    val_preds = clf.predict(vec.transform(X_val))

    print("\n" + "=" * 60)
    print("VALIDATION SET RESULTS")
    print("=" * 60)
    print(classification_report(y_val, val_preds, digits=4))

    cm_val = confusion_matrix(y_val, val_preds, labels=["benign", "jailbreak"])
    print("Confusion Matrix (rows=actual, cols=predicted):")
    print(f"               benign  jailbreak")
    print(f"  benign       {cm_val[0][0]:6d}  {cm_val[0][1]:6d}   (FP={cm_val[0][1]})")
    print(f"  jailbreak    {cm_val[1][0]:6d}  {cm_val[1][1]:6d}   (FN={cm_val[1][0]})")

    p, r, f1, _ = precision_recall_fscore_support(
        y_val, val_preds, average="binary", pos_label="jailbreak"
    )
    val_acc = float(np.mean(val_preds == y_val))
    print(f"\nJailbreak — Precision: {p:.4f}  Recall: {r:.4f}  F1: {f1:.4f}  Accuracy: {val_acc:.4f}")

    target_met = p >= EVAL_TARGET_PRECISION and r >= EVAL_TARGET_RECALL
    print(f"Target (>={EVAL_TARGET_PRECISION:.0%} precision AND recall): "
          f"{'PASS' if target_met else 'FAIL'}")

    # ── Test set evaluation ────────────────────────────────────────────
    test_preds = clf.predict(vec.transform(X_test))

    print("\n" + "=" * 60)
    print("TEST SET RESULTS (held-out)")
    print("=" * 60)
    print(classification_report(y_test, test_preds, digits=4))

    cm_test = confusion_matrix(y_test, test_preds, labels=["benign", "jailbreak"])
    print("Confusion Matrix:")
    print(f"               benign  jailbreak")
    print(f"  benign       {cm_test[0][0]:6d}  {cm_test[0][1]:6d}")
    print(f"  jailbreak    {cm_test[1][0]:6d}  {cm_test[1][1]:6d}")

    tp_test, rp_test, f1p_test, _ = precision_recall_fscore_support(
        y_test, test_preds, average="binary", pos_label="jailbreak"
    )
    test_acc = float(np.mean(test_preds == y_test))
    print(f"\nJailbreak — Precision: {tp_test:.4f}  Recall: {rp_test:.4f}  "
          f"F1: {f1p_test:.4f}  Accuracy: {test_acc:.4f}")

    metrics = {
        "val_precision":  float(p),
        "val_recall":     float(r),
        "val_f1":         float(f1),
        "val_accuracy":   val_acc,
        "val_fp":         int(cm_val[0][1]),
        "val_fn":         int(cm_val[1][0]),
        "test_precision": float(tp_test),
        "test_recall":    float(rp_test),
        "test_f1":        float(f1p_test),
        "test_accuracy":  test_acc,
        "test_fp":        int(cm_test[0][1]),
        "test_fn":        int(cm_test[1][0]),
        "target_met":     target_met,
        "partition_leakage": leakage,
    }

    # ── Artifact management ────────────────────────────────────────────
    # Retrain on full dataset before saving so the production model
    # benefits from all data, not just the 60% training split.
    production_clf, production_vec = train_production_model(verbose=True)

    if save_on_pass:
        if target_met:
            save_model(production_clf, production_vec, metrics)
            print(f"\nModel SAVED (evaluation gate passed).")
        else:
            # Save failed artifact under a separate name for debugging
            debug_clf_path = MODEL_DIR / "classifier_failed_eval.pkl"
            debug_vec_path = MODEL_DIR / "vectorizer_failed_eval.pkl"
            MODEL_DIR.mkdir(parents=True, exist_ok=True)
            import joblib
            joblib.dump(production_clf, debug_clf_path)
            joblib.dump(production_vec, debug_vec_path)
            (MODEL_DIR / "failed_eval_metrics.json").write_text(
                json.dumps(metrics, indent=2)
            )
            print(f"\nModel NOT saved to production (gate failed).")
            print(f"Failed artifact written to {debug_clf_path} for debugging.")
    else:
        # Default: always save (development workflow)
        save_model(production_clf, production_vec, metrics)
        print(f"\nModel saved (use --save-on-pass to gate on evaluation results).")

    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate LLM-Guard ML classifier")
    parser.add_argument(
        "--save-on-pass",
        action="store_true",
        help="Only overwrite production model if evaluation gate passes",
    )
    args = parser.parse_args()

    results = run_evaluation(save_on_pass=args.save_on_pass)
    sys.exit(0 if results["target_met"] else 1)
