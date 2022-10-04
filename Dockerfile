FROM node:16-alpine
WORKDIR /app

COPY package.json ./
COPY config.json ./
COPY maxmind.json ./
COPY src/ ./src/

EXPOSE 8080

CMD ["npm", "start"]
