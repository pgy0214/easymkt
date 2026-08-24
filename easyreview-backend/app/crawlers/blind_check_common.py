import datetime

CHECK_EXPIRY_DAYS = 7


def fingerprint(nickname: str, date_text: str, content: str) -> str:
    return f"{(nickname or '').strip()}|{(date_text or '').strip()}|{(content or '').strip()[:50]}"


def is_expired(reference_date, now: datetime.datetime) -> bool:
    if reference_date is None:
        return False
    if isinstance(reference_date, datetime.date) and not isinstance(
        reference_date, datetime.datetime
    ):
        reference_dt = datetime.datetime.combine(reference_date, datetime.time.min)
    else:
        reference_dt = reference_date
    return (now - reference_dt).days >= CHECK_EXPIRY_DAYS


def apply_scrape_result(task, scraped_reviews, account_label, now, force=False):
    """Update `task`'s blind-check fields from a fresh `scraped_reviews` list
    (dicts with nickname/date_text/content/posted_date). Shared by the Naver
    and Kakao crawlers since the snapshot-then-fingerprint-diff logic is the
    same for both platforms.

    - No snapshot yet: try to find the account's own review in the scrape and
      capture it as the fingerprint snapshot (+ its actual posted date).
    - Snapshot exists: visible if its fingerprint still appears, blinded if not.
    - Past CHECK_EXPIRY_DAYS since posting (or completion, if posting date is
      still unknown): stop checking and flag as expired, unless `force` is set
      (manual recheck deliberately bypasses the expiry/terminal-state guard).
    """
    task.blind_checked_at = now

    if not force:
        reference = task.review_posted_date or task.completed_at
        if is_expired(reference, now):
            task.check_expired = True
            return

    if not task.snapshot_content:
        match = next(
            (r for r in scraped_reviews if (r.get("nickname") or "").strip() == (account_label or "").strip()),
            None,
        )
        if match:
            task.snapshot_date_text = match.get("date_text")
            task.snapshot_content = (match.get("content") or "")[:50]
            if match.get("posted_date"):
                task.review_posted_date = match["posted_date"]
            task.blind_status = "visible"
        return

    current_fingerprints = {
        fingerprint(r.get("nickname"), r.get("date_text"), r.get("content"))
        for r in scraped_reviews
    }
    task_fp = fingerprint(account_label, task.snapshot_date_text, task.snapshot_content)
    task.blind_status = "visible" if task_fp in current_fingerprints else "blinded"
