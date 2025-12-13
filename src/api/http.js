const parseBody = async (response) => {
    const text = await response.text();
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
