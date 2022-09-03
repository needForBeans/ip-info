FROM node:16-alpine
WORKDIR /app
COPY package.json ./
COPY config.json /app/
COPY src/ /app/src/
EXPOSE 8080
CMD node .