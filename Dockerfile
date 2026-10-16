# Packages generate.sh as a container so other systems can run it without
# installing Node:
#   docker run --rm -u "$(id -u):$(id -g)" -v "$PWD/dataset:/out" random-table2image 100 /out
FROM node:22-slim

WORKDIR /app

# Install dependencies at build time; generate.sh skips `npm install` once
# core/node_modules exists, so the container never needs network access.
COPY core/package.json core/package-lock.json core/
RUN npm ci --prefix core --omit=dev

COPY core/ core/
COPY generate.sh .

ENTRYPOINT ["/app/generate.sh"]
