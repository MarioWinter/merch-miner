FROM python:3.12-slim

LABEL maintainer="mariowinter.sg@gmail.com"
LABEL version="1.1"
LABEL description="Python 3.12 Debian slim — supports rembg/opencv"

WORKDIR /app

COPY . .

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        bash postgresql-client ffmpeg \
        gcc libpq-dev \
        libmagic1 && \
    pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y gcc && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    chmod +x backend.entrypoint.sh && \
    chmod +x worker.entrypoint.sh

EXPOSE 8000

ENTRYPOINT [ "./backend.entrypoint.sh" ]
