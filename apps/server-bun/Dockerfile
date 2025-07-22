FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies using Bun
RUN bun install

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Expose port
EXPOSE 3000

# Start the server directly with Bun
CMD ["bun", "run", "src/main.ts"]
