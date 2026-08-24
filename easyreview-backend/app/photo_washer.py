# -*- coding: utf-8 -*-
"""캠페인 사진 업로드시 자동으로 적용하는 EXIF "세탁" — 기존에 수동으로 쓰던 포토워셔라는
프로그램의 동작을 실측 분석해서(원본/세탁후 사진 30장 EXIF 비교) 그대로 재현한 것.
목적은 네이버가 "동일 이미지"로 인식하지 못하게 사진마다 서로 다른 카메라로 찍은 것처럼
보이게 만드는 것 — 재압축으로 픽셀 해시 자체도 바꾸고, 카메라 제조사/모델/촬영값을
무작위로 채워 넣는다.

실측 결과(30장 비교):
  - Make/Model은 서로 독립적으로 무작위 선택(실제 카메라와 안 맞는 조합도 나옴)
  - DateTime/DateTimeOriginal/DateTimeDigitized 셋 다 세탁 시각으로 통일
  - FocalLength 23~197mm, ISO는 100/200/400/800 중 하나, 셔터스피드는 1/1000~1/60
    중 하나, FNumber는 2.8~7.8 사이
  - GPS/렌즈정보/일련번호/Software/저작권 등 원본에 있던 나머지 EXIF는 전부 삭제
  - 파일 용량이 원본의 20~45% 수준으로 줄어듦(이미지 크기는 그대로, JPEG 재압축만)
"""
import io
import random
from datetime import datetime

from PIL import Image

CAMERA_MAKES = [
    "Canon", "Nikon", "Sony", "Fujifilm", "Panasonic", "Olympus",
    "Pentax", "Leica", "Sigma", "Samsung", "Kodak", "Hasselblad", "Ricoh",
]
CAMERA_MODELS = [
    "Canon EOS 5D Mark IV", "Canon EOS R5", "Canon EOS R6", "Canon EOS 90D",
    "Nikon Z7 II", "Nikon Z6 III", "Nikon D850",
    "Sony Alpha A7 IV", "Sony Alpha A7R V", "Sony Alpha A9 III",
    "Fujifilm X-T4", "Fujifilm X-T5", "Fujifilm GFX 100S",
    "Panasonic Lumix S5", "Panasonic Lumix GH6",
    "Olympus OM-1", "Olympus E-M1X",
    "Pentax K-3 III", "Pentax K-1 Mark II",
    "Leica M10-R", "Leica Q2",
    "Sigma fp L",
    "Hasselblad X1D II 50C",
    "Ricoh GR IIIx",
]
ISO_CHOICES = [100, 200, 400, 800]
SHUTTER_SPEEDS = [(1, 1000), (1, 500), (1, 250), (1, 125), (1, 60)]


def _build_random_exif(dt: datetime) -> Image.Exif:
    exif = Image.Exif()
    exif[271] = random.choice(CAMERA_MAKES)  # Make
    exif[272] = random.choice(CAMERA_MODELS)  # Model
    exif[274] = 1  # Orientation
    ts = dt.strftime("%Y:%m:%d %H:%M:%S")
    exif[306] = ts  # DateTime

    exif_ifd = exif.get_ifd(0x8769)
    exif_ifd[36867] = ts  # DateTimeOriginal
    exif_ifd[36868] = ts  # DateTimeDigitized
    exif_ifd[37386] = float(random.randint(20, 200))  # FocalLength
    exif_ifd[34855] = random.choice(ISO_CHOICES)  # ISOSpeedRatings
    num, den = random.choice(SHUTTER_SPEEDS)
    exif_ifd[33434] = num / den  # ExposureTime
    exif_ifd[33437] = round(random.uniform(2.8, 8.0), 1)  # FNumber
    return exif


def wash_photo(content: bytes, target_date: datetime | None = None) -> bytes:
    """이미지 바이트를 받아 EXIF를 랜덤값으로 교체하고 재압축한 JPEG 바이트를 돌려준다."""
    img = Image.open(io.BytesIO(content))
    if img.mode != "RGB":
        img = img.convert("RGB")
    exif = _build_random_exif(target_date or datetime.now())
    # 실측(원본 대 세탁후 30장 비교) 결과 용량이 원본의 20~45% 수준으로 줄었다 — JPEG
    # quality 파라미터로 캘리브레이션해보니 85~95 구간이 그 비율대에 해당했다.
    quality = random.randint(85, 95)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, exif=exif)
    return buf.getvalue()
