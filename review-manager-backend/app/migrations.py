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

        # reviewers: category distinguishes 관리자(자체보유계정)/리뷰어/체험단/기자단 —
        # existing rows default to 'reviewer' (that's what they all were before
        # this column existed). region/age_group/gender are 체험단-only fields.
        _add_column_if_missing(
            conn, "reviewers", "category", "category TEXT NOT NULL DEFAULT 'reviewer'"
        )
        _add_column_if_missing(conn, "reviewers", "region", "region TEXT")
        _add_column_if_missing(conn, "reviewers", "age_group", "age_group TEXT")
        _add_column_if_missing(conn, "reviewers", "gender", "gender TEXT")

        # reviewers: birth_date — 관리자 계정에서 사용, male|female과 함께 관리자
        # 계정 등록폼에서 입력 가능
        _add_column_if_missing(conn, "reviewers", "birth_date", "birth_date DATE")

        # reviewers: blog_url/blog_index — 체험단 전용, 블로그 주소와 블로그 지수(등급/점수 등)
        _add_column_if_missing(conn, "reviewers", "blog_url", "blog_url TEXT")
        _add_column_if_missing(conn, "reviewers", "blog_index", "blog_index TEXT")

        # review_accounts: ip_address — IP assigned per admin-owned account
        _add_column_if_missing(conn, "review_accounts", "ip_address", "ip_address TEXT")
        _add_column_if_missing(
            conn,
            "review_accounts",
            "has_login_issue",
            "has_login_issue BOOLEAN NOT NULL DEFAULT 0",
        )
        _add_column_if_missing(
            conn, "review_accounts", "password_encrypted", "password_encrypted TEXT"
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

        # stores: address is an optional column filled in by the URL
        # auto-fill crawler. business_hours/menu were renamed to
        # representative_hours/representative_product (대표시간/대표상품) —
        # copy over any existing values before dropping the old columns.
        _add_column_if_missing(conn, "stores", "address", "address TEXT")
        _add_column_if_missing(conn, "stores", "updated_at", "updated_at DATETIME")

        # stores: business_registration_number/representative_name/phone are
        # admin-entered facts needed to render a realistic receipt image —
        # not scraped (business registration numbers aren't public on Naver)
        _add_column_if_missing(
            conn, "stores", "business_registration_number", "business_registration_number TEXT"
        )
        _add_column_if_missing(conn, "stores", "representative_name", "representative_name TEXT")
        _add_column_if_missing(conn, "stores", "phone", "phone TEXT")

        store_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(stores)"))}
        if "representative_hours" not in store_columns:
            conn.execute(text("ALTER TABLE stores ADD COLUMN representative_hours TEXT"))
            if "business_hours" in store_columns:
                conn.execute(
                    text("UPDATE stores SET representative_hours = business_hours")
                )
        if "representative_product" not in store_columns:
            conn.execute(text("ALTER TABLE stores ADD COLUMN representative_product TEXT"))
            if "menu" in store_columns:
                conn.execute(text("UPDATE stores SET representative_product = menu"))
        if "business_hours" in store_columns:
            conn.execute(text("ALTER TABLE stores DROP COLUMN business_hours"))
        if "menu" in store_columns:
            conn.execute(text("ALTER TABLE stores DROP COLUMN menu"))

        # review_targets: work_days_raw restricts which weekdays a campaign's
        # tasks show up in the open pool (null = every day)
        _add_column_if_missing(conn, "review_targets", "work_days_raw", "work_days_raw TEXT")

        # review_targets/tasks: sale_price/sale_amount are the amount charged
        # to the STORE (매출), separate from unit_price/settlement_amount
        # which is what's paid OUT to the reviewer — existing rows have no
        # sale price on record, so they're just left null (excluded from
        # revenue totals rather than guessed)
        _add_column_if_missing(conn, "review_targets", "sale_price", "sale_price INTEGER")
        _add_column_if_missing(conn, "tasks", "sale_amount", "sale_amount INTEGER")

        # review_targets: daily_limit caps how many of a campaign's tasks may
        # be claimed per (KST) day — null means unlimited (today's behavior)
        _add_column_if_missing(conn, "review_targets", "daily_limit", "daily_limit INTEGER")

        # review_targets: 원고 자료(가이드라인/지역특징/메뉴/참고이미지) — 리뷰어가
        # 포털에서 조회하는 캠페인 자료
        _add_column_if_missing(conn, "review_targets", "guideline", "guideline TEXT")
        _add_column_if_missing(
            conn, "review_targets", "regional_features", "regional_features TEXT"
        )
        _add_column_if_missing(conn, "review_targets", "menu_items_json", "menu_items_json TEXT")
        _add_column_if_missing(
            conn, "review_targets", "reference_photo_path", "reference_photo_path TEXT"
        )

        # tasks: receipt_image_path — 영수증 이미지, naver_available_date가 정해지면 자동 생성
        _add_column_if_missing(conn, "tasks", "receipt_image_path", "receipt_image_path TEXT")

        # review_targets: start_date/end_date — 캠페인이 실제로 작업되는 기간(둘 다
        # null이면 기존과 동일하게 무기한). 오픈풀 노출 필터에도 적용됨.
        _add_column_if_missing(conn, "review_targets", "start_date", "start_date DATE")
        _add_column_if_missing(conn, "review_targets", "end_date", "end_date DATE")

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
