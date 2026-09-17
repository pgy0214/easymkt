FROM python:3.13-slim

# 크롤러(Selenium)가 실제 브라우저를 띄우려면 크로미움 본체 + 호환 드라이버,
# 그리고 헤드리스 실행에 필요한 공유 라이브러리들이 있어야 한다 — 기본 slim
# 이미지엔 하나도 없어서(이게 원래 chromedriver 실행 실패의 원인) 여기서 설치한다.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BINARY_PATH=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
