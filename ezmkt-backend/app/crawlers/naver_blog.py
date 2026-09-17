import datetime
import html
import json
import re
import urllib.parse

import requests

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

_BLOG_ID_RE = re.compile(r"blog\.naver\.com/([a-zA-Z0-9_-]+)")


def _extract_blog_id(blog_url: str) -> str | None:
    match = _BLOG_ID_RE.search(blog_url)
    return match.group(1) if match else None


def fetch_recent_posts(blog_url: str, limit: int = 10) -> list[dict]:
    """블로그 URL에서 최근 게시글 제목+날짜를 가져온다. 네이버 블로그가 자체 제공하는
    비공식 JSON 엔드포인트(PostTitleListAsync)를 그대로 쓴다 — Selenium 없이 일반
    HTTP 요청만으로 동작함을 실제 블로그로 확인함."""
    blog_id = _extract_blog_id(blog_url)
    if not blog_id:
        raise ValueError("네이버 블로그 URL에서 blogId를 찾을 수 없습니다")

    resp = requests.get(
        "https://blog.naver.com/PostTitleListAsync.naver",
        params={
            "blogId": blog_id,
            "viewdate": "",
            "currentPage": 1,
            "categoryNo": 0,
            "parentCategoryNo": "",
            "countPerPage": limit,
        },
        headers={"User-Agent": USER_AGENT},
        timeout=10,
    )
    resp.raise_for_status()
    # 네이버가 내려주는 JSON에 pagingHtml 필드 안에서 작은따옴표를 \'로 이스케이프하는데,
    # 이건 표준 JSON에서 허용되지 않는 이스케이프라 json.loads가 그대로는 실패한다.
    data = json.loads(resp.text.replace("\\'", "'"))
    if data.get("resultCode") != "S":
        raise ValueError(data.get("resultMessage") or "블로그 게시글을 가져오지 못했습니다")

    posts = []
    for item in data.get("postList", [])[:limit]:
        title = html.unescape(urllib.parse.unquote_plus(item.get("title") or ""))
        posts.append({"title": title, "posted_date": _parse_add_date(item.get("addDate"))})
    return posts


def _parse_add_date(raw: str | None) -> datetime.date | None:
    if not raw:
        return None
    match = re.match(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?", raw.strip())
    if not match:
        return None
    year, month, day = match.groups()
    try:
        return datetime.date(int(year), int(month), int(day))
    except ValueError:
        return None
