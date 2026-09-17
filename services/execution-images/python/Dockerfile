FROM python@sha256:c6ead215bfd31f1e433d968853b7a769989117115b728874824e6c0a27cb96fc

LABEL org.opencontainers.image.title="AlgoCove Python execution profile"
LABEL org.opencontainers.image.description="Pinned non-root Python runtime; commands and sandbox policy are selected outside the image."

RUN apk upgrade --no-cache \
  && python -c "import pip, shutil; shutil.rmtree(pip.__path__[0])" \
  && rm -f /usr/local/bin/pip /usr/local/bin/pip3 /sbin/apk /usr/bin/apk \
  && addgroup -S -g 65532 algocove \
  && adduser -S -D -u 65532 -G algocove -h /work algocove \
  && mkdir -p /work /tmp \
  && chown 65532:65532 /work /tmp

ENV HOME=/work \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /work
USER 65532:65532
