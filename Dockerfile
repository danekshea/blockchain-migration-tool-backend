# Use the official Node.js image.
FROM node:18.16.1

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy the rest of the application code.
COPY . .

# Run Prisma migrations and generate the client.
RUN npx prisma migrate dev
RUN npx prisma generate

# Command to run the application.
CMD ["npm", "run", "watcher"]
