FROM node:18-buster

ENV BUILD=1
ARG APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1

RUN sed -i 's/http/https/g' /etc/apt/sources.list
RUN apt-get clean
RUN apt-get update
RUN apt-get install -y wget gnupg ca-certificates procps libxss1 --fix-missing
RUN wget -qO - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
RUN apt-get update
RUN apt-get install -y google-chrome-stable
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ./ /app/

RUN npm install

CMD npm start
