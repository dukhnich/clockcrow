const { Observer } = require("../utils/observer.js");

class DaySettings {
    #start
    #end
    #nightStart
    #nightEnd
    constructor(start = 0, end = 24, nightStart = 21, nightEnd = 5) {
        this.#start = start;
        this.#end = end;
        this.#nightStart = nightStart;
        this.#nightEnd = nightEnd;
    }
    get start() { return this.#start; }
    get end() { return this.#end; }
    get nightStart() { return this.#nightStart; }
    get nightEnd() { return this.#nightEnd; }
    isDayHour(hour) {
        return hour >= this.#nightEnd && hour < this.#nightStart;
    }
    isNightHour(hour) {
        return !this.isDayHour(hour);
    }
}
class TimeManager {
    #startTime;
    #endTime;
    #currentTime;
    #settings;
    #observer;
    constructor(startTime = 9, endTime = 5, settings = new DaySettings()) {
        this.#startTime = startTime;
        this.#endTime = endTime;
        this.#currentTime = this.#startTime;
        this.#settings = settings;
        this.#observer = new Observer();
    }
    get startTime() { return this.#startTime; }
    get endTime() { return this.#endTime; }
    get currentTime() { return this.#currentTime; }
    set currentTime(value) {
        const hour = TimeManager.normalizeTime(value, this.#settings.end);
        if (
            (this.#startTime < this.#endTime && hour >= this.#endTime) ||
            (this.#startTime > this.#endTime && (hour < this.#startTime && hour >= this.#endTime))
        ) {
            this.#currentTime = this.#endTime;
            this.#observer.notify({ time: this.#currentTime, gameOver: true });
            return;
        }

        if (this.#currentTime !== hour) {
            this.#currentTime = hour;
            this.#observer.notify({ time: this.#currentTime, gameOver: false });
        }
    }
    static normalizeTime(value, end) {
        let hour = ((value % end) + end) % end;
        if (hour >= end) hour -= end;
        if (hour < 0) hour = 0;
        return hour;
    }
    tick(hours = 1) {
        this.currentTime = this.#currentTime + hours;
    }
    reset() {
        this.currentTime = this.#startTime;
        this.clearObservers();
    }
    isDay() {
        return this.#settings.isDayHour(this.#currentTime);
    }
    isNight() {
        return this.#settings.isNightHour(this.#currentTime);
    }
    getTimeWindow() {
        return this.isDay() ? "day" : "night";
    }
    subscribe(listener) { this.#observer.subscribe(listener); }
    unsubscribe(listener) { this.#observer.unsubscribe(listener); }
    clearObservers() { this.#observer.clear(); }
    formatTime(val) {
      const totalMinutes = Math.round((Number(val) || 0) * 60);
      const h24 = Math.floor((totalMinutes / 60) % 24);
      const m = totalMinutes % 60;
      const hh = String((h24 + 24) % 24).padStart(2, "0");
      const mm = String((m + 60) % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    }
};

module.exports = { TimeManager, DaySettings };