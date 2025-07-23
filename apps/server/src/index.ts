import { Container } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

class ServerContainer extends Container {
  defaultPort = 1337;
  sleepAfter = '3m';
  enableInternet = true;

  envVars: Record<string, string> = Object.fromEntries(Object.entries(env));
  override onStart() {
    console.log('Container successfully started');
  }

  override onStop() {
    console.log('Container successfully shut down');
  }

  override onError(error: unknown) {
    console.log('Container error:', error);
  }
  override fetch(request: Request): Promise<Response> {
    return this.containerFetch(request);
  }
}

// export default {
//   async fetch(request: Request, env: Env): Promise<Response> {
//     const pathname = new URL(request.url).pathname;
//     if (pathname.startsWith('/container')) {
//       const containerInstance = getContainer(env.SERVER_CONTAINER, pathname);
//       return containerInstance.fetch(request);
//     }

//     if (pathname.startsWith('/error')) {
//       const containerInstance = getContainer(env.SERVER_CONTAINER, 'error-test');
//       return containerInstance.fetch(request);
//     }

//     if (pathname.startsWith('/lb')) {
//       const containerInstance = await getRandom(env.SERVER_CONTAINER, 3);
//       return containerInstance.fetch(request);
//     }

//     if (pathname.startsWith('/singleton')) {
//       // getContainer will return a specific instance if no second argument is provided
//       return getContainer(env.SERVER_CONTAINER).fetch(request);
//     }

//     return new Response(
//       'Call /container to start a container with a 10s timeout.\nCall /error to start a container that errors\nCall /lb to test load balancing',
//     );
//   },
// };

export { ServerContainer };
