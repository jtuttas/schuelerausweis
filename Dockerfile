FROM node:16
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "npm-shrinkwrap.json*", "./"]
RUN node -v
RUN npm install --production && mv node_modules ../
COPY . .
VOLUME ["/usr/src/app/config"]
VOLUME ["/usr/src/app/web"]
EXPOSE 8080
CMD ["/bin/sh","-c","node /usr/src/app/src/index.js >> /usr/src/app/config/server.log"]
