FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY apps/client/package*.json apps/client/

RUN npm ci

COPY . .

RUN npm run db:generate
RUN npm --workspace apps/server run build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --schema apps/server/prisma/schema.prisma && npm --workspace apps/server run start"]
