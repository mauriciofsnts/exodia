FROM node:16

# Create app directory
WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

# Bundle app source
COPY . .

RUN yarn

 