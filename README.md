# Roundcube Login Check TS

This script aims at triggering a valid Roundcube login request, needed to trigger some Roundcube plugin functions (via Roundcube hooks like `ready`).
It uses `puppeteer` to start a headless chrome instance and watch/wait for conditionsn, and `meow` to handle arguments. 

## Usage

```js
    Usage
      $ npx --yes ts-node index.ts <options>
  
    Options
      --authType  , -a    'Authentication type (Basic auth, Auth provider, etc)'
      --host      , -h    'Roundcube instance URL'
      --username  , -u    'Username of the (Roundcube or OAuth provider) account'
      --password  , -p    'Password of the (Roundcube or OAuth provider) account'
  
    Examples
      $ index.ts -a basic -h http://host.docker.internal:9000 -u admin@test.mailu.io -p letmein
      $ index.ts -a basic -h http://host.docker.internal:9000 -u admin@test.mailu.io -p wrongpassword
```

## Return codes

| Return code   | Description                                                                   | 
|---------------|-------------------------------------------------------------------------------|
|   `0`         | Roundcube connection done (valid credentials)                                 |
|   `1`         | An error occured (unknown error, not catched)                                 |
|   `2`         | Roundcube connection failed (invalid credentials, invalid host, config, etc)  |

## Scenarios

### Basic Auth

0. Go to the Roundcube login page
1. Wait/search for the login form/button
2. Fill the `user` and `pwd` fields
3. Submit the form
4. Wait for 401 response (auth failed) OR 200 response on mails AND GET request on refresh (auth success)

### OAuth

0. Go to the Roundcube login page (will redirect to Keycloak login page)
1. Wait/search for the login form/button
2. Fill the `username` and `password` fields
3. Click the login button
4. Wait for error on login form (auth failed) OR 200 response on mails AND GET request on refresh (auth success)

### Useful commands

```bash
# Run an interactive Docker container with Chrome and Puppeteer
docker run -it --rm zenika/alpine-chrome:with-puppeteer /bin/sh

# Run the same Docker container, with the Typescript code/project as a volume
docker run -it --rm -v "$PWD/src/helpers/RoundcubeHelper":/usr/src/app zenika/alpine-chrome:with-puppeteer /bin/sh

# Call the project script, with `ts-node` to call Typescript code directly (TS to JS conversion)
npx --yes ts-node index.ts --auth-type basic --host http://host.docker.internal:9000 --username admin@test.mailu.io --password letmein

# Run the same Docker container and call the script directly
docker run -it --rm -v "$PWD/src/helpers/RoundcubeHelper":/usr/src/app zenika/alpine-chrome:with-puppeteer npx --yes ts-node index.ts --auth-type basic --host http://host.docker.internal:9000 --username admin@test.mailu.io --password letmein

# Get the result value (exit code)
echo $?
```

```bash
# Build the image
docker build -t apitech/roundcube-login-ts:1.0 .

# Use the image
docker run -it --rm apitech/roundcube-login-ts:1.0 --auth-type basic --host http://host.docker.internal:9000 --username admin@test.mailu.io --password letmein

# Get the result value (exit code)
echo $?
```