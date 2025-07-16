// Mock ResizeObserver
global.ResizeObserver = class {
    constructor(callback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
};
