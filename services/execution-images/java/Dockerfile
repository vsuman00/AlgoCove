FROM eclipse-temurin@sha256:010ab2b79329b951bf052dbf515843ab345ae4e4f0ef72287d85c9fa54da275f

LABEL org.opencontainers.image.title="AlgoCove Java execution profile"
LABEL org.opencontainers.image.description="Pinned non-root OpenJDK runtime and compiler; commands and sandbox policy are selected outside the image."

RUN rm -f /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg \
  && groupadd --system --gid 65532 algocove \
  && useradd --system --uid 65532 --gid 65532 --home-dir /work --no-create-home algocove \
  && mkdir -p /work /tmp/algocove-output \
  && chown -R 65532:65532 /work /tmp/algocove-output

ENV HOME=/work
WORKDIR /work
USER 65532:65532
