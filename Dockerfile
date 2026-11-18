FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY config ./config

RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
USER node

HEALTHCHECK --interval=60s --timeout=5s --start-period=90s \
  CMD wget -qO- http://127.0.0.1:3000/api/status >/dev/null || exit 1

CMD ["node", "server/index.js"]
