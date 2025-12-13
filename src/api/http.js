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
        const validationMessages = Array.isArray(data?.errors)
            ? data.errors
                  .map((error) => [error.field, error.message].filter(Boolean).join(': '))
                  .filter(Boolean)
            : [];

        const combinedMessage = validationMessages.length > 0 ? validationMessages.join('\n') : message;

        const errorMessage = combinedMessage || `${defaultError} (${response.status})`;
        console.error('API request failed', {
            status: response.status,
            message: errorMessage,
            errors: data?.errors,
        });

        const error = new Error(errorMessage);
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
}
