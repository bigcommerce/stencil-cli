FROM node:24.22.1

WORKDIR /usr/src/app

RUN npm install -g --unsafe-perm @bigcommerce/stencil-cli

