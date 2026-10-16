FROM node:24-bookworm-slim AS build

WORKDIR /app

ARG VITE_API_BASE_URL=
ARG VITE_CSRF_COOKIE_NAME=lifys_csrf_token

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_CSRF_COOKIE_NAME=${VITE_CSRF_COOKIE_NAME}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/data ./src/data
COPY --from=build /app/index.html ./index.html

EXPOSE 3001

CMD ["npm", "start"]
