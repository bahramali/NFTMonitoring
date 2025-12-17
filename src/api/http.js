const parseBody = async (response) => {
    // Avoid throwing when the response body was already consumed by another handler.
    if (response.bodyUsed) {
        return { data: null, message: '' };
    }

    let text;
    try {
        text = await response.text();
    } catch (error) {
        if (response.bodyUsed) {
            return { data: null, message: '' };
        }
        throw error;
    }

    if (!text) return { data: null, message: '' };

    try {
        const data = JSON.parse(text);
        const message = typeof data === 'object' && data !== null && 'message' in data ? data.message : '';
        return { data, message: message || text };
    } catch {
        return { data: text, message: text };
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
