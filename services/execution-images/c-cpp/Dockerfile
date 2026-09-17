FROM gcc@sha256:fb2568a8cc0609134396aeb1eae1f3a91c8ceec54aaee67c798d9602593abd66

LABEL org.opencontainers.image.title="AlgoCove C and C++ execution profile"
LABEL org.opencontainers.image.description="Pinned non-root GCC 15 runtime and compiler; C and C++ remain separate manifest targets."

ADD --checksum=sha256:bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16 https://zlib.net/fossils/zlib-1.3.2.tar.gz /tmp/zlib.tar.gz

RUN apt-get update \
  && apt-get upgrade --yes \
  && tar -xzf /tmp/zlib.tar.gz -C /tmp \
  && cd /tmp/zlib-1.3.2 \
  && ./configure --prefix=/usr/local \
  && make -j"$(nproc)" \
  && make install \
  && ldconfig \
  && rm -rf /tmp/zlib.tar.gz /tmp/zlib-1.3.2 \
  && dpkg-query -W -f='${binary:Package}\n' \
    | grep -E '^(imagemagick|libopenexr-dev|libopenexr-3-1-30|libheif1|uuid-dev|libevent-dev|libevent-2.1-7(:|$)|libevent-pthreads|libevent-openssl-2.1-7|libevent-extra-2.1-7|libde265-0|libxml2|libtiff-dev|libtiff6|libtiffxx6|perl$|perl-modules-|git|openssh|gnupg|curl|libcurl|libmariadb|mariadb|libpq|python3|libpython3|libunbound8|zlib1g|openssl|libssl)' \
    | xargs --no-run-if-empty dpkg --purge --force-depends || true \
  && rm -f /var/lib/dpkg/info/python3* /var/lib/dpkg/info/libpython3* /var/lib/dpkg/info/libunbound8* /var/lib/dpkg/info/zlib1g* \
  && for package in python3 python3-git python3-gitdb python3-libarchive-c python3-minimal python3-packaging python3-smmap python3.13 python3.13-minimal libpython3-stdlib libpython3.13-minimal libpython3.13-stdlib libunbound8 zlib1g zlib1g-dev; do dpkg --purge --force-depends "$package" || true; done \
  && rm -rf /usr/lib/python3 /usr/lib/python3.13 /usr/local/lib/python3.13 \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/* \
  && rm -f /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg \
  && groupadd --system --gid 65532 algocove \
  && useradd --system --uid 65532 --gid 65532 --home-dir /work --no-create-home algocove \
  && mkdir -p /work /tmp/algocove-output \
  && chown -R 65532:65532 /work /tmp/algocove-output

ENV HOME=/work
WORKDIR /work
USER 65532:65532
