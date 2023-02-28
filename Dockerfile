FROM node:18

WORKDIR /usr/src/app

RUN npm install -g --unsafe-perm @bigcommerce/stencil-cli

