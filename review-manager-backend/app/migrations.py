from sqlalchemy import text

# Lightweight ad-hoc migrations for the SQLite dev DB (no Alembic setup at this
# scale). Base.metadata.create_all only creates missing tables, not columns
# added to existing tables, so new columns need an explicit ALTER TABLE here.


def _add_column_if_missing(conn, table: str, column: str, ddl: str) -> None:
    columns = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
    if column not in columns:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def run_migrations(engine) -> None:
    with engine.connect() as conn:
        # reviewers: is_active (existing rows default to 0/연락불가 so the admin
        # explicitly reviews who's reachable) + OTP fields for the self-service portal
        _add_column_if_missing(
            conn, "reviewers", "is_active", "is_active BOOLEAN NOT NULL DEFAULT 0"
        )
        _add_column_if_missing(conn, "reviewers", "otp_code", "otp_code TEXT")
        _add_column_if_missing(
            conn, "reviewers", "otp_expires_at", "otp_expires_at DATETIME"
        )

        # settings: default claim-time presets, now in minutes (was hours). Add
        # the new columns, copy over converted values, then drop the old ones —
        # settings only ever has one row and it's worth preserving in place
        # rather than reaching for the rebuild-if-empty trick used below.
        settings_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(settings)"))}
        if settings_columns:
            if "naver_default_claim_minutes" not in settings_columns:
                conn.execute(
                    text(
                        "ALTER TABLE settings ADD COLUMN naver_default_claim_minutes "
                        "INTEGER NOT NULL DEFAULT 1440"
                    )
                )
                if "naver_default_claim_hours" in settings_columns:
                    conn.execute(
                        text(
                            "UPDATE settings SET naver_default_claim_minutes = "
                            "naver_default_claim_hours * 60"
                        )
                    )
            if "kakao_default_claim_minutes" not in settings_columns:
                conn.execute(
                    text(
                        "ALTER TABLE settings ADD COLUMN kakao_default_claim_minutes "
                        "INTEGER NOT NULL DEFAULT 1440"
                    )
                )
                if "kakao_default_claim_hours" in settings_columns:
                    conn.execute(
                        text(
                            "UPDATE settings SET kakao_default_claim_minutes = "
                            "kakao_default_claim_hours * 60"
                        )
                    )
            if "naver_default_claim_hours" in settings_columns:
                conn.execute(text("ALTER TABLE settings DROP COLUMN naver_default_claim_hours"))
            if "kakao_default_claim_hours" in settings_columns:
                conn.execute(text("ALTER TABLE settings DROP COLUMN kakao_default_claim_hours"))

        # review_targets: store_name/store_url columns replaced by a store_id FK
        # to the new stores table (stores are now a reusable list, not re-typed
        # per campaign), and claim_time_limit_hours renamed to _minutes. Same
        # SQLite rebuild-if-empty approach as below.
        target_columns = list(conn.execute(text("PRAGMA table_info(review_targets)")))
        if target_columns:
            col_names = {c[1] for c in target_columns}
            if "store_id" not in col_names or "claim_time_limit_minutes" not in col_names:
                targets_count = conn.execute(
                    text("SELECT COUNT(*) FROM review_targets")
                ).scalar()
                if targets_count == 0:
                    tasks_count = conn.execute(text("SELECT COUNT(*) FROM tasks")).scalar()
                    if tasks_count == 0:
                        conn.execute(text("DROP TABLE tasks"))
                    conn.execute(text("DROP TABLE review_targets"))
                # if there's real data, leave both alone rather than risk loss

        # tasks: review_account_id must become nullable (open-pool tasks start
        # unassigned) and gains claimed_at/claim_deadline/last_expired_at. SQLite
        # can't ALTER a column's NOT NULL constraint, so if the old shape is
        # detected we rebuild the table — safe here since this app has no real
        # task history yet; if it ever does, this skips rather than risk data loss.
        task_columns = list(conn.execute(text("PRAGMA table_info(tasks)")))
        if task_columns:
            col_names = {c[1] for c in task_columns}
            review_account_col = next(
                (c for c in task_columns if c[1] == "review_account_id"), None
            )
            old_shape = review_account_col is not None and review_account_col[3] == 1
            if old_shape or "claimed_at" not in col_names:
                existing_count = conn.execute(text("SELECT COUNT(*) FROM tasks")).scalar()
                if existing_count == 0:
                    conn.execute(text("DROP TABLE tasks"))
                # if there's real data, we deliberately leave the old table alone
                # rather than risk destroying it — this app is pre-production scale
                # so that hasn't happened, but this guard costs nothing to keep.

        conn.commit()
