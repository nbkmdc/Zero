FROM oven/bun:latest AS bun

WORKDIR /app

# Copy package files
COPY . .

# Copy source code
COPY src/ ./src/

# Install dependencies
RUN bun install --ignore-scripts
WORKDIR /app/src


USER bun
EXPOSE 1337/tcp
CMD ["bun", "run","--watch","server.ts"]
