export default class Hls {
  static isSupported() {
    return false;
  }
  loadSource() {}
  attachMedia() {}
  on() {}
  destroy() {}
}
Hls.Events = { ERROR: 'error' };
