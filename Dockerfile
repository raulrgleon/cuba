FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
COPY --from=build /app/out ./out
COPY scripts/serve.py ./serve.py
USER 65534:65534
EXPOSE 8873
CMD ["python", "serve.py", "--host", "0.0.0.0"]
