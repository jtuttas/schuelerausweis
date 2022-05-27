FROM ubuntu:latest
RUN curl -s https://deb.nodesource.com/setup_16.x | sudo bash
RUN apt update
RUN apt install -y nodejs npm
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "npm-shrinkwrap.json*", "./"]
RUN node -v
RUN npm install @mapbox/node-pre-gyp --save
RUN npm install --production && mv node_modules ../
COPY . .
VOLUME ["/usr/src/app/config"]
VOLUME ["/usr/src/app/web"]
EXPOSE 8080
CMD ["/bin/sh","-c","node /usr/src/app/src/index.js"]
