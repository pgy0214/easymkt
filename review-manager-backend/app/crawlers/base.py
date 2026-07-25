import logging
from contextlib import contextmanager

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

logger = logging.getLogger("crawlers")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@contextmanager
def chrome_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument(f"user-agent={USER_AGENT}")
    driver = webdriver.Chrome(options=options)
    try:
        yield driver
    finally:
        driver.quit()
