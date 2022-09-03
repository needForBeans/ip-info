FROM node:16-alpine
WORKDIR /app
COPY package.json ./
COPY . .
EXPOSE 8080
CMD node .