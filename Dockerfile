FROM node:latest
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "npm-shrinkwrap.json*", "./"]
RUN echo "los!"
RUN  apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
RUN npm install --production && mv node_modules ../
COPY . .
VOLUME ["/usr/src/app/config"]
EXPOSE 8080
CMD ["/bin/sh","-c","node /usr/src/app/src/index.js  > /usr/src/app/config/server.log 2>&1"]
