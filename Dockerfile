FROM zenika/alpine-chrome:with-puppeteer

USER root

COPY package*.json ./

RUN npm install
RUN npm install ts-node

COPY index.ts ./

USER chrome

ENTRYPOINT ["npx", "--yes", "ts-node", "index.ts"]
CMD [""]