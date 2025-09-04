export function enableFetchLogging() {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const [resource, config] = args;
    const method = config?.method ?? 'GET';
    const body = config?.body;
    let parsedBody = body;
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body;
      }
    }
    console.log('REST API Request:', { url: resource, method, body: parsedBody });
    return originalFetch(...args);
  };
}
