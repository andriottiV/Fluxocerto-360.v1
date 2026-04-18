FROM node:20-alpine AS build

WORKDIR /app/fluxocerto-360

COPY fluxocerto-360/package.json fluxocerto-360/package-lock.json ./
COPY fluxocerto-360/patches ./patches

RUN npm ci --legacy-peer-deps

COPY fluxocerto-360 ./

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app/fluxocerto-360

ENV NODE_ENV=production

COPY --from=build /app/fluxocerto-360/package.json ./
COPY --from=build /app/fluxocerto-360/package-lock.json ./
COPY --from=build /app/fluxocerto-360/node_modules ./node_modules
COPY --from=build /app/fluxocerto-360/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]

