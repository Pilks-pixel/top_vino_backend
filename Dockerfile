FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8000

# RUN npx prisma generate

CMD ["npm", "run", "dev"]


