const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value) => {
    if (!value) return false;
    return emailPattern.test(value);
};

export const MIN_PASSWORD_LENGTH = 8;
