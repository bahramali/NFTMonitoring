// logFetch.js
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

    try {
      const response = await originalFetch(...args);
      const clone = response.clone(); // clone so body can be read twice
      let data;

      try {
        data = await clone.json();
      } catch {
        data = await clone.text();
      }

      console.log('REST API Response:', {
        url: resource,
        status: response.status,
        ok: response.ok,
        data,
      });

      return response;
    } catch (error) {
      console.error('REST API Error:', error);
      throw error;
    }
  };
}
