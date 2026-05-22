FROM node:22-alpine

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY apps/client/package*.json apps/client/

RUN npm ci

COPY . .

RUN npm --workspace apps/client run build

EXPOSE 5173

CMD ["npm", "--workspace", "apps/client", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
