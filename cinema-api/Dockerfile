FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
  openssl \
  libssl3 \
  ca-certificates \
  netcat-openbsd \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]