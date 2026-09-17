FROM node@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868

LABEL org.opencontainers.image.title="AlgoCove JavaScript and TypeScript execution profile"
LABEL org.opencontainers.image.description="Pinned non-root Node.js runtime with a pinned TypeScript compiler and no runtime package installation."

RUN apk upgrade --no-cache \
  && npm install --global --ignore-scripts --no-audit --no-fund typescript@5.9.3 \
  && rm -rf /root/.npm /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
  && rm -f /sbin/apk /usr/bin/apk \
  && addgroup -S -g 65532 algocove \
  && adduser -S -D -u 65532 -G algocove -h /work algocove \
  && mkdir -p /work /tmp/algocove-output /opt/algocove \
  && chown -R 65532:65532 /work /tmp/algocove-output /opt/algocove

COPY tsconfig.typecheck.json tsconfig.transpile.json /opt/algocove/
ENV HOME=/work \
    NODE_ENV=production \
    NODE_NO_WARNINGS=1
WORKDIR /work
USER 65532:65532
