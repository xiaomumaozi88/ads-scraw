FROM ubuntu:20.04

ENV BUILD=1
ARG APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1
ARG DEBIAN_FRONTEND=noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# RUN sed -i 's/http/https/g' /etc/apt/sources.list
RUN apt clean
RUN apt update
RUN apt-get install -y wget gnupg ca-certificates procps libxss1 --fix-missing
RUN wget -qO - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
RUN apt-get update
RUN apt-get install -y google-chrome-stable curl

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

RUN apt-get install -y google-chrome-stable
RUN apt-get update && apt-get install -y tcpdump&&  \
    apt-get install --no-install-recommends --yes \
    xvfb \
    libxslt-dev \
    libxrender1 \
    libxtst6 \
    libxi6 \
    libgtk2.0-bin \
    socat \
    x11vnc && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ./ /app/

RUN npm install

CMD ["sh", "entrypoint.sh"]
