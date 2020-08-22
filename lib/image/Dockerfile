# ---- Base Node ----
FROM alpine AS base
# install node
RUN apk add --no-cache nodejs-current tini
# set working directory
WORKDIR /usr/app/
# Set tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]
# copy project file
COPY package.json .

#
# ---- Dependencies ----
FROM base AS dependencies
# Get npm
RUN apk add --update nodejs nodejs-npm
# We need Python
RUN echo "http://dl-cdn.alpinelinux.org/alpine/v3.2/main" >> /etc/apk/repositories
RUN echo " @community http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories
RUN apk add --update python python-dev
RUN apk add --update gfortran build-base
# install node packages
RUN npm set progress=false && npm config set depth 0
#RUN npm install --only=production
## copy production node_modules aside
#RUN cp -R node_modules prod_node_modules
# install ALL node_modules, including 'devDependencies'
RUN npm install

##
## ---- Test ----
## run linters, setup and tests
#FROM dependencies AS test
#COPY . .
#RUN  npm run lint && npm run setup && npm run test


FROM golang:1.12-alpine as builder
ARG VERSION=2.3.930.0
RUN set -ex && apk add --no-cache make git gcc libc-dev curl bash && \
    curl -sLO https://github.com/aws/amazon-ssm-agent/archive/${VERSION}.tar.gz && \
    mkdir -p /go/src/github.com && \
    tar xzf ${VERSION}.tar.gz && \
    mv amazon-ssm-agent-${VERSION} /go/src/github.com/amazon-ssm-agent && \
    cd /go/src/github.com/amazon-ssm-agent && \
    echo ${VERSION} > VERSION && \
    gofmt -w agent && make checkstyle || ./Tools/bin/goimports -w agent && \
    make build-linux


FROM alpine:3.11
ARG PHP_VERSION=7.4
ARG AWS_DEFAULT_REGION=us-east-1
ARG USER_ID=blue
ENV SUPERVISOR_VERSION=3.3.1
ENV CLI_BIN_DIR=/var/laraseed
ENV APK_DEL="curl"

WORKDIR $CLI_BIN_DIR

ADD https://dl.bintray.com/php-alpine/key/php-alpine.rsa.pub /etc/apk/keys/php-alpine.rsa.pub

RUN addgroup $USER_ID && \
    adduser -G $USER_ID -s /bin/bash -D $USER_ID --home "/home/$USER_ID"

RUN apk --update add ca-certificates && \
    echo "https://dl.bintray.com/php-alpine/v3.11/php-${PHP_VERSION}" >> /etc/apk/repositories

RUN apk add --update nodejs

## install php and some extensions
RUN apk add \
    php \
    php-bz2 \
    php-dom \
    php-json \
    php-phar \
    php-mbstring \
    php-iconv \
    php-openssl \
    php-curl \
    php-sodium \
    php-zip \
    php-zlib && \
    ln -s /usr/bin/php7 /usr/bin/php

RUN set -ex && apk add --no-cache sudo ca-certificates && \
    adduser -D ssm-user && echo "ssm-user ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ssm-agent-users && \
    mkdir -p /etc/amazon/ssm

COPY --from=builder /go/src/github.com/amazon-ssm-agent/bin/linux_amd64/ /usr/bin
COPY --from=builder /go/src/github.com/amazon-ssm-agent/bin/amazon-ssm-agent.json.template /etc/amazon/ssm/amazon-ssm-agent.json
COPY --from=builder /go/src/github.com/amazon-ssm-agent/bin/seelog_unix.xml /etc/amazon/ssm/seelog.xml

RUN mkdir -p /usr/local/bin/laraboot-scripts
COPY register-instance.sh /usr/local/bin/laraboot-scripts/
RUN chmod -R +x /usr/local/bin/laraboot-scripts
RUN ls /usr/local/bin/laraboot-scripts/

WORKDIR /usr/app/
# copy production node_modules
COPY --from=dependencies /usr/app/node_modules ./node_modules

#RUN apk update && apk add bash < doesnt work
RUN apk add --update bash openssh-keygen curl git py-pip && \
    pip install supervisor && \
    pip install awscli && \
    mkdir -p /var/log/amazon && \
    mkdir -p /var/lib/amazon/ssm/Vault/Store && \
    chmod -R g+rw /var/lib/amazon /var/log/amazon && \
    chown -R $USER_ID:$USER_ID /var/lib/amazon /var/log/amazon

RUN aws --version && \
    aws configure set region "${AWS_DEFAULT_REGION}"

WORKDIR $CLI_BIN_DIR

RUN apk del git autoconf openssl-dev make m4 perl g++ gcc \
        libc-dev check-dev cyrus-sasl-dev libsodium-dev \
        musl-dev libssh2-dev yaml-dev imagemagick-dev zlib-dev tzdata php7-dev && \
    apk del ${APK_DEL} && \
    rm -fR /var/cache/apk/*

RUN ssh-keygen -q -t rsa -N '' -f /home/$USER_ID/id_rsa && \
    chmod g+rw $CLI_BIN_DIR && \
    chown -R $USER_ID:$USER_ID $CLI_BIN_DIR

VOLUME $CLI_BIN_DIR

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
#RUN /bin/bash /usr/local/bin/laraboot-scripts/register-instance.sh
#ENTRYPOINT ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
ENTRYPOINT [ "/usr/local/bin/laraboot-scripts/register-instance.sh" ]
