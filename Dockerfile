FROM node:20

WORKDIR /usr/src/app

RUN npm install -g --unsafe-perm @bigcommerce/stencil-cli

