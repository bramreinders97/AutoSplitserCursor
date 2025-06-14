FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copy .env file first to ensure it's available
COPY .env* ./

# Then copy the rest of the application
COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"] 