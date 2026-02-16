const ONLY_DIGITS_AND_DASH = /^[0-9-\s]+$/;
const ORG_FORMAT_PATTERNS = [
    /^\d{6}-?\d{4}$/,
    /^\d{8}-?\d{4}$/,
    /^\d{10}$/,
    /^\d{12}$/,
];

const normalizeRateString = (value) => `${value ?? ''}`.trim();

export const normalizeSwedishOrgNumber = (value) => {
    const input = normalizeRateString(value);
    if (!input) return '';
    const digits = input.replace(/\D/g, '');
    if (digits.length === 12) return digits.slice(-10);
    return digits;
};

export const isValidSwedishOrgNumberChecksum = (normalizedDigits) => {
    if (!/^\d{10}$/.test(normalizedDigits)) return false;

    const baseDigits = normalizedDigits.slice(0, -1).split('').map((digit) => Number(digit));
    const controlDigit = Number(normalizedDigits.slice(-1));
    const checksum = baseDigits.reduce((sum, digit, index) => {
        const multiplier = index % 2 === 0 ? 2 : 1;
        const product = digit * multiplier;
        return sum + (product > 9 ? product - 9 : product);
    }, 0);

    const expectedControl = (10 - (checksum % 10)) % 10;
    return expectedControl === controlDigit;
};

export const validateSwedishOrgNumber = (value) => {
    const input = normalizeRateString(value);
    if (!input) {
        return {
            isValid: false,
            code: 'required',
            message: 'Organization number is required.',
        };
    }

    if (!ONLY_DIGITS_AND_DASH.test(input)) {
        return {
            isValid: false,
            code: 'invalid_chars',
            message: 'Use only digits and an optional dash (for example 556677-8899).',
        };
    }

    const hasKnownPattern = ORG_FORMAT_PATTERNS.some((pattern) => pattern.test(input));
    if (!hasKnownPattern) {
        return {
            isValid: false,
            code: 'invalid_format',
            message: 'Use format XXXXXX-XXXX or XXXXXXXXXX.',
        };
    }

    const normalized = normalizeSwedishOrgNumber(input);
    if (normalized.length !== 10) {
        return {
            isValid: false,
            code: 'invalid_length',
            message: 'Organization number must contain 10 digits.',
        };
    }

    if (!isValidSwedishOrgNumberChecksum(normalized)) {
        return {
            isValid: false,
            code: 'invalid_checksum',
            message: 'Organization number checksum is invalid.',
        };
    }

    return {
        isValid: true,
        code: null,
        message: '',
        normalized,
    };
};

