// frontend/public/js/store.js
export const scadaStore = {
  latestPlcData: null,
  ws: null,
  listeners: [], // functions to call when data updates

  setData(data) {
    this.latestPlcData = data;
    this.listeners.forEach(fn => fn(data));
  },

  // subscribe(fn) {
  //   this.listeners.push(fn);
  //   return () => {
  //     this.listeners = this.listeners.filter(f => f !== fn);
  //   };
  // }
  subscribe(fn) {
    this.listeners.push(fn);

    // 🔥 Immediately send latest data
    if (this.latestPlcData) {
      fn(this.latestPlcData);
    }

    return () => {
      this.listeners = this.listeners.filter(f => f !== fn);
    };
  }

};
