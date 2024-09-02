FROM node:18.17.0-alpine

WORKDIR /app

COPY ./ /app/

RUN npm install

CMD npm start
