FROM node:14

WORKDIR /usr/src/app

RUN npm install -g --unsafe-perm @bigcommerce/stencil-cli

