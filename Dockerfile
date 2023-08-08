FROM zenika/alpine-chrome:with-puppeteer
LABEL org.opencontainers.image.source="https://github.com/ApitechFR/roundcube-login-check-ts"
LABEL org.opencontainers.image.vendor="Apitech"
LABEL org.opencontainers.image.documentation="https://github.com/ApitechFR/roundcube-login-check-ts/blob/main/README.md"

USER root

COPY package*.json ./

RUN npm install
RUN npm install ts-node

COPY index.ts ./

USER chrome

ENTRYPOINT ["npx", "--yes", "ts-node", "index.ts"]
CMD [""]