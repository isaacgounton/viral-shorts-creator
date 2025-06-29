
# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./ 
RUN npm install

# Copy the rest of the application code
COPY . .

# Command to run the application
CMD ["npm", "start"]
