import * as puppeteer from 'puppeteer';
import meow from 'meow';
import { promisify } from "util";
import { exec as execNoPromise } from "child_process";
import { exit } from 'process';
const exec = promisify(execNoPromise);
const assets = ['png', 'jpg', 'svg', 'webp', 'woff2', 'tiff', 'js', 'css', 'html'];

function endsWithOneOf(suffixes:string[], string:string)
{
    return suffixes.some(function (suffix)
    {
        return string.endsWith(suffix);
    });
}

function enableDebug(page: puppeteer.Page)
{
    page.on('request', (request) =>
    {
        const requestUrl = request.url().split('?')[0];

        // Ignore assets
        if(endsWithOneOf(assets, requestUrl) == false
            && request.resourceType() !== 'image')
        {
        console.debug('req', request.method(), request.url(), request.method());
        }
    });

    page.on('response', (response) =>
    {
        const responseUrl = response.url().split('?')[0];

        // Ignore assets
        if(endsWithOneOf(assets, responseUrl) == false
            && response.request().resourceType() !== 'image')
        {
        console.debug('res', response.url(), response.status(), response.statusText());
        }
    });
}

async function setup(debug: boolean) : Promise<{browser: puppeteer.Browser, page: puppeteer.Page}>
{
    const browser = await puppeteer.launch({
        // bindAddress: "0.0.0.0",
        headless: 'new',
        args: [
        // "--headless",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        // "--remote-debugging-port=9222",
        // "--remote-debugging-address=0.0.0.0"
        ]
    });

    // const browser = await puppeteer.launch({
    //     executablePath,
    //     args: ['--no-sandbox', '--disable-setuid-sandbox'],
    //     headless: false, // new
    // });
    
    const page = await browser.newPage();
    await page.setViewport({width: 1200, height: 720});

    if(debug)
    {
      enableDebug(page);
    }

    return { browser, page };
  }

async function doRoundcubeLoginBasic(
    config: {host:string, username:string, password: string}, 
    settings: {debug:boolean} ): Promise<boolean>
  {
    const { page, browser } = await setup(settings.debug);

    let response = false;
    try
    {
      await page.goto(`${config.host}/?_task=login`, { waitUntil: 'networkidle0' }); // wait until page load
  
      await page.waitForSelector('#rcmloginsubmit').then(async x => 
        {
          console.log('Roundcube page detected !');
  
          await page.type('#rcmloginuser', config.username);
          await page.type('#rcmloginpwd', config.password);
          console.log('Roundcube login form filled !');
  
          // Redirection - Roundcube to Keycloak
          //
          // req: POST
          // res: 302 Found
          // req: GET
          // res: 302 Found
          // req: GET
          // res: 302 Found
          
          // page.on('response', (response) =>
          // {
          //   const responseUrl = response.url().split('?')[0];

          //   // Ignore assets
          //   if(endsWithOneOf(assets, responseUrl) == false)
          //   {
          //     console.debug('res', response.url(), response.status(), response.statusText());

          //     if(response.url().includes('?_task=login'))
          //     {
          //       if(response.status() === 401)
          //       {
          //         console.debug(response);
          //         throw new UnauthorizedException('Keycloak authentication failed (Wrong credentials ?) !');
          //       }
          //     }
          //   }
          // });
  
          await Promise.all(
            [
              //
              // Login response 401
              // (that means authentication failed)
              //
              page.waitForResponse((r:any) => r.status() === 401 
                && r.url().includes('?_task=login'))
                  .then((r:any) =>
                    {
                      console.debug(r);
                      throw new Error('Keycloak authentication failed (Wrong credentials ?) !');
                      //throw new UnauthorizedException()
                    })
                  .catch((e:Error) =>
                    {
                      console.debug(e);
                      if(e.name === 'TimeoutError') // https://github.com/puppeteer/puppeteer/issues/7545
                      {
                        // Ignore the error, Timeout occured while waiting for 401 while we probably got a 200
                      }
                      else { throw e; }
                    }),
              //
              page.click('#rcmloginsubmit').then((c:any) => { console.log('Roundcube login triggered !'); }),
              //
              // Mail page loaded successfully
              // (that means we're authenticated)
              //
              page.waitForResponse((r:any) => r.status() === 200 
                    && r.url().includes('?_task=mail')
              )
                  .then((r:any) => { console.log('Connected to Roundcube !'); })
                  .catch((e: Error) => {console.log('timeout',e)}),
              //
              // First refresh sent
              // (just to wait a bit, so we're sure that the import plugin has been triggered)
              //
              page.waitForRequest((r:any) => r.method() === 'GET' 
                    && r.url().includes('_task=mail')
                    && r.url().includes('_refresh=1')
              )
                  .then((r:any) => { console.log('Roundcube refresh request sent !'); })
                  .catch((e: Error) => {console.log('timeout',e)}),
            ]
          );

          // Roundcube authentication done !
          response = true;  
        }
      );
    }
    catch(exception)
    {
      console.error(exception);
    }
    finally
    {
      await browser.close().then(b => { console.log('[Roundcube] Browser - Closed !') });
      return response;
    }
  }

async function doRoundcubeLoginOAuth(
    config: {host:string, username:string, password: string}, 
    settings: {debug:boolean} ): Promise<boolean>
  {
    const loginBtn = '#rcmloginsubmit';
    const { page, browser } = await setup(settings.debug);

    let response = false;
    try
    {
      await page.goto(`${config.host}/?_task=login`, { waitUntil: 'networkidle0' }); // wait until page load
  
      await page.waitForSelector('#kc-form-login').then(async (x:any) => 
        {
          console.log('Keycloak page detected !');
  
          await page.type('#username', config.username);
          await page.type('#password', config.password);
          console.log('Keycloak login form filled !');
  
          await page.click('#kc-login');
          console.log('Keycloak login triggered !');
  
          // Redirection - Roundcube to Keycloak
          //
          // req: POST
          // res: 302 Found
          // req: GET
          // res: 302 Found
          // req: GET
          // res: 302 Found
  
          await Promise.all(
            [
              //
              // Mail page loaded successfully
              // (that means we're authenticated)
              //
              page.waitForResponse((r:any) => r.status() === 200 
                    && r.url().includes('?_task=mail')
              )
                  .then((r:any) => { console.log('Connected to Roundcube !'); }),
              //
              // First refresh sent
              // (just to wait a bit, so we're sure that the import plugin has been triggered)
              //
              page.waitForRequest((r:any) => r.method() === 'GET' 
                    && r.url().includes('_task=mail')
                    && r.url().includes('_refresh=1')
              )
                  .then((r:any) => { console.log('Roundcube refresh request sent !'); }),
              //
              page.waitForSelector('#input-error', {timeout: 3000})
                  .then((r:any) =>
                    {
                      console.debug("Error found on Keycloak authentication page.");
                      throw new Error('Keycloak authentication failed (Wrong credentials ?) !');
                      //throw new UnauthorizedException()
                    })
                  .catch((e: Error) =>
                    {
                      if(e.name === 'TimeoutError') // https://github.com/puppeteer/puppeteer/issues/7545
                      {
                        console.debug("No error found on Keycloak authentication page.");
                      }
                      else { throw e; }                      
                    }),
            ]
          );

          // Roundcube authentication done !
          response = true;  
        }
      );
    }
    catch(exception)
    {
      console.error(exception);
    }
    finally
    {
      await browser.close().then((b:any) => { console.log('[Roundcube] Browser - Closed !') });
      return response;
    }
  }

async function runTests(): Promise<void>
{
    let loginRes:boolean;

    //-----
    //-----
    //-----

    const localRoundcubeWithRegularLogin =
    {
        host: 'http://host.docker.internal:9000',
        username: 'admin@test.mailu.io',
        password: 'xxxxx',
    }

    // Successful basic login
    localRoundcubeWithRegularLogin.password = 'letmein';
    loginRes = await doRoundcubeLoginBasic(localRoundcubeWithRegularLogin, {debug: true});
    console.log('Successful basic login', loginRes);

    // Failing basic login
    localRoundcubeWithRegularLogin.password = 'fake';
    loginRes = await doRoundcubeLoginBasic(localRoundcubeWithRegularLogin, {debug: true});
    console.log('Failing basic login', loginRes);

    //-----
    //-----
    //-----

    const devRoundcubeWithOAuthLogin =
    {
        host: 'https://your.roundcube.host',
        username: 'login@domain',
        password: 'xxxxx',
    }

    // Successful OAuth login
    devRoundcubeWithOAuthLogin.password = 'toto';
    loginRes = await doRoundcubeLoginOAuth(devRoundcubeWithOAuthLogin, {debug: false});
    console.log('Successful OAuth login', loginRes);

    // Failing OAuth login
    devRoundcubeWithOAuthLogin.password = 'fake';
    loginRes = await doRoundcubeLoginOAuth(devRoundcubeWithOAuthLogin, {debug: false});
    console.log('Failing OAuth login', loginRes);
}

// (async () => {
//     await runTests();
//   })();

  
(async () => 
{
  const authTypes:Map<string, Function> = new Map();
  authTypes.set('basic', doRoundcubeLoginBasic);
  authTypes.set('oauth', doRoundcubeLoginOAuth);
  
  const cli = meow(`
    Usage
      $ npx --yes ts-node index.ts <options>
  
    Options
      --authType  , -a    Authentication type (Basic auth to Roundcube, Auth through OAuth provider, etc)
      --host      , -h    Roundcube instance URL
      --username  , -u    Username of the (Roundcube or OAuth provider) account
      --password  , -p    Password of the (Roundcube or OAuth provider) account
  
    Examples
      $ index.ts -a basic -h http://host.docker.internal:9000 -u admin@test.mailu.io -p letmein
      $ index.ts -a basic -h http://host.docker.internal:9000 -u admin@test.mailu.io -p wrongpassword
  `, {
    // importMeta: import.meta,
    flags: {
      authType: {
        isRequired: true,
        type: 'string',
        choices: Object.keys(authTypes),
        shortFlag: 'a',
      },
      host: {
        isRequired: true,
        type: 'string',
        shortFlag: 'h',
      },
      username: {
        isRequired: true,
        type: 'string',
        shortFlag: 'u',
      },
      password: {
        isRequired: true,
        type: 'string',
        shortFlag: 'p',
      },
      debug: {
        type: 'boolean',
        shortFlag: 'd',
      }
    }
  });
  
  if(cli.flags.debug)
  {
    console.log(cli.flags);
  }
  
  const config = {
    host: cli.flags.host,
    username: cli.flags.username,
    password: cli.flags.password,
  };
  
  const settings = {
    debug: cli.flags.debug,
  }
  
  const func = authTypes.get(cli.flags.authType);
  console.log(`Running`, func);
  
  if(func && func instanceof Function)
  {
    const res = await func(config, settings);
    console.log('res', res);

    // if an error is thrown, will be exit(1)
    if(res) 
    {
      console.log("Roundcube login/connection SUCCESS");
      exit(0);
    }
    else
    {
      console.log("Roundcube login/connection FAILED");
      exit(2); 
    }
  }
})();