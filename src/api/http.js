const parseBody = async (response) => {
    // Avoid throwing when the response body was already consumed by another handler.
    if (response.bodyUsed) {
        return { data: null, message: '' };
    }

    const contentType = response.headers?.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    try {
        if (isJson) {
            const data = await response.json();
            const message = typeof data === 'object' && data !== null && 'message' in data ? data.message : '';
            return { data, message: message || '' };
        }

        const text = await response.text();
        if (!text) return { data: null, message: '' };

        // Fallback: if content-type is missing, attempt to parse JSON once.
        try {
            const data = JSON.parse(text);
            const message = typeof data === 'object' && data !== null && 'message' in data ? data.message : '';
            return { data, message: message || text };
        } catch {
            return { data: text, message: text };
        }
    } catch (error) {
        if (response.bodyUsed) {
            return { data: null, message: '' };
        }
        throw error;
    }
};

export async function parseApiResponse(response, defaultError = 'Request failed') {
    const { data, message } = await parseBody(response);
    if (!response.ok) {
        const error = new Error(message || `${defaultError} (${response.status})`);
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
}
